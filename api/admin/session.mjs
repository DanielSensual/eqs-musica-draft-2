/** GET: who is signed in. POST { pin }: sign in. DELETE: sign out. */

import { clearedCookie, currentUser, isConfigured, json, logIn, sameOrigin } from "../_auth.mjs";

export async function GET(request) {
  const user = currentUser(request);
  return user ? json({ user }) : json({ user: null }, 401);
}

export async function POST(request) {
  if (!isConfigured()) return json({ error: "The admin isn't set up yet." }, 503);
  if (!sameOrigin(request)) return json({ error: "Forbidden" }, 403);
  const body = await request.json().catch(() => ({}));
  let result;
  try {
    result = await logIn(request, String(body?.pin || ""));
  } catch (error) {
    console.error("[admin/session]", error.message);
    return json({ error: "Sign-in is unavailable right now. Try again in a minute." }, 503);
  }
  if (result.locked) return json({ error: "Too many wrong PINs. Try again in 15 minutes." }, 429);
  if (!result.user) return json({ error: "That PIN didn't match." }, 401);
  return json({ user: result.user }, 200, { "Set-Cookie": result.cookie });
}

export async function DELETE(request) {
  if (!sameOrigin(request)) return json({ error: "Forbidden" }, 403);
  return json({ ok: true }, 200, { "Set-Cookie": clearedCookie() });
}
