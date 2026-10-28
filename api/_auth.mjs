/**
 * PIN login for /admin/. Each person has their own 6-digit PIN; a signed cookie keeps them in for 90 days.
 *
 * Vercel env:
 *   ADMIN_PINS            JSON array: [{ "id": "derek", "name": "Derek", "hash": "<salt hex>:<scrypt hex>" }, …]
 *                         Make one with tools/admin-pin.mjs. Removing a person or changing their PIN ends their sessions.
 *   ADMIN_SESSION_SECRET  random string that signs the session cookie
 */

import { createHmac, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { clientIp, ensureTables, hashIp, sql } from "./_db.mjs";

const scryptAsync = promisify(scrypt);
const COOKIE = "eqs_admin";
const SESSION_SECONDS = 90 * 24 * 60 * 60;
// Failed PINs per IP, and across everyone, inside the window before logins pause.
const LOCK_WINDOW_MIN = 15;
const MAX_FAILS_PER_IP = 5;
const MAX_FAILS_TOTAL = 40;

function users() {
  try {
    const list = JSON.parse(process.env.ADMIN_PINS || "[]");
    return Array.isArray(list) ? list.filter((u) => u && u.id && u.hash) : [];
  } catch {
    return [];
  }
}

export function isConfigured() {
  return users().length > 0 && Boolean(process.env.ADMIN_SESSION_SECRET);
}

const b64 = (s) => Buffer.from(s).toString("base64url");
const sign = (data) => createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update(data).digest("base64url");

function sameText(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function pinMatches(pin, stored) {
  const [salt, key] = String(stored).split(":");
  if (!salt || !key) return false;
  const derived = await scryptAsync(pin, Buffer.from(salt, "hex"), 32);
  return sameText(derived.toString("hex"), key);
}

/** The person this request is signed in as, or null. */
export function currentUser(request) {
  if (!isConfigured()) return null;
  const cookie = (request.headers.get("cookie") || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`));
  if (!cookie) return null;
  const [data, sig] = cookie.slice(COOKIE.length + 1).split(".");
  if (!data || !sig || !sameText(sign(data), sig)) return null;
  let session;
  try {
    session = JSON.parse(Buffer.from(data, "base64url").toString());
  } catch {
    return null;
  }
  if (!session || session.exp < Date.now() / 1000) return null;
  // The PIN fingerprint ties the session to the PIN it was opened with.
  const user = users().find((u) => u.id === session.u && u.hash.slice(-12) === session.v);
  return user ? { id: user.id, name: user.name || user.id } : null;
}

function sessionCookie(user) {
  const data = b64(JSON.stringify({ u: user.id, v: user.hash.slice(-12), exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }));
  return `${COOKIE}=${data}.${sign(data)}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearedCookie() {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

/**
 * Checks a PIN against every person's. Returns { user, cookie } on success, { locked: true } while logins are
 * paused for this IP (or for everyone, under a spread-out guessing attack), or {} for a wrong PIN.
 */
export async function logIn(request, pin) {
  await ensureTables();
  const ipHash = hashIp(clientIp(request));
  const [counts] = await sql(
    `SELECT count(*) FILTER (WHERE ip_hash = $1)::int AS mine, count(*)::int AS total
       FROM eqs_admin_attempts WHERE created_at > now() - make_interval(mins => $2)`,
    [ipHash, LOCK_WINDOW_MIN],
  );
  if (counts.mine >= MAX_FAILS_PER_IP || counts.total >= MAX_FAILS_TOTAL) return { locked: true };

  if (/^\d{6}$/.test(pin)) {
    for (const user of users()) {
      if (await pinMatches(pin, user.hash)) return { user: { id: user.id, name: user.name || user.id }, cookie: sessionCookie(user) };
    }
  }
  await sql(`INSERT INTO eqs_admin_attempts (ip_hash) VALUES ($1)`, [ipHash]);
  await sql(`DELETE FROM eqs_admin_attempts WHERE created_at < now() - interval '1 day'`);
  return {};
}

/** Same-origin check for requests that change something; the cookie is SameSite=Lax as a second line. */
export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
