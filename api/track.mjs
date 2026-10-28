/**
 * Visit tracking for the /admin/ dashboard. assets/track.js posts here; rows go to the shared analytics_events table
 * tagged site = "eqs", the same shape the Ghost AI Command Center reads. No cookies: the visitor id lives in
 * localStorage and the IP is stored only as a salted hash.
 */

import { randomUUID } from "node:crypto";
import { clientIp, hasDatabase, hashIp, sql } from "./_db.mjs";

const SITE_HOSTS = new Set(["www.eqsmusica.com", "eqsmusica.com", "draft-2-eqs-site.vercel.app"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const EVENTS = new Set(["page_view", "scroll_depth", "engagement_time", "outbound_click", "artist_click", "language_switch", "form_submit"]);
const REFERRER_SPAM = ["semalt.com", "darodar.com", "ilovevitaly.com", "trafficbot.live", "buttons-for-website.com", "free-social-buttons.com"];

const WINDOW_MS = 60_000;
const hits = new Map();

function rateLimited(key, now = Date.now()) {
  const entry = hits.get(key);
  if (entry && now - entry.started < WINDOW_MS) return ++entry.count > 120;
  if (hits.size >= 5000) hits.clear();
  hits.set(key, { started: now, count: 1 });
  return false;
}

/** "eqs" for the live site, "eqs-dev" for local testing (kept out of the dashboard), null for anyone else. */
function siteFor(request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    const { hostname } = new URL(origin);
    if (SITE_HOSTS.has(hostname)) return "eqs";
    if (LOCAL_HOSTS.has(hostname)) return "eqs-dev";
  } catch {}
  return null;
}

function isSpam(referrer) {
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return REFERRER_SPAM.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}

const text = (v, max) => (typeof v === "string" && v ? v.slice(0, max) : null);

export async function POST(request) {
  const site = siteFor(request);
  if (!site) return new Response(null, { status: 403 });
  const ip = clientIp(request);
  if (rateLimited(ip)) return new Response(null, { status: 429 });

  const raw = await request.text().catch(() => "");
  if (raw.length > 8000) return new Response(null, { status: 413 });
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const { eventName, path, referrer, title, visitorId, sessionId, properties } = event || {};
  if (!EVENTS.has(eventName) || !text(path, 500) || !text(visitorId, 100) || !text(sessionId, 100)) {
    return new Response(null, { status: 400 });
  }
  if (isSpam(referrer) || !hasDatabase()) return new Response(null, { status: 204 });

  const props = JSON.stringify({ ...(properties && typeof properties === "object" ? properties : {}), site });
  if (props.length > 4000) return new Response(null, { status: 413 });
  try {
    await sql(
      `INSERT INTO analytics_events (id, event_name, path, referrer, title, visitor_id, session_id, properties, user_agent, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
      [
        randomUUID(),
        eventName,
        path.slice(0, 500),
        text(referrer, 500),
        text(title, 300),
        visitorId.slice(0, 100),
        sessionId.slice(0, 100),
        props,
        (request.headers.get("user-agent") || "").slice(0, 400),
        hashIp(ip),
      ],
    );
  } catch (error) {
    console.error("[track]", error.message);
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
