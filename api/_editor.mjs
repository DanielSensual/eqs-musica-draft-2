/**
 * Shared pieces of the website editor. The admin queues change requests in eqs_edits; the editor bot on Railway
 * picks them up through api/editor/jobs, has Claude make the change on the `editor-draft` branch, and Vercel
 * builds that branch as the preview. Publishing merges the draft into main.
 *
 * Vercel env:
 *   EDITOR_WORKER_URL      the bot's base URL; the admin pings its /wake so a request starts at once
 *   EDITOR_WORKER_SECRET   shared secret between this site and the bot
 *   EDITOR_PREVIEW_URL     where Vercel serves the editor-draft branch
 *   EDITOR_PREVIEW_BYPASS  optional; Vercel's "Protection Bypass for Automation" secret, so the preview opens
 *                          on a phone without a Vercel login
 *   EDITOR_DAILY_CAP_USD   optional, default 5
 *   ADMIN_PUBLISHERS       optional, default "derek,daniel": who may publish and undo; everyone else drafts
 *   EDITOR_NOTIFY          optional; who gets the publish / needs-Daniel emails (defaults to FORMS_BCC)
 */

import { sql } from "./_db.mjs";

// A draft is "open" until it's published or discarded; only one is open at a time.
export const OPEN = ["queued", "working", "ready", "failed", "needs_daniel", "publish_requested", "publishing"];
// The bot is busy with these, so the draft can't take another request yet.
export const BUSY = ["queued", "working", "publish_requested", "publishing", "undo_requested", "undoing"];

export const dailyCap = () => Number(process.env.EDITOR_DAILY_CAP_USD) || 5;

export function canPublish(user) {
  const ids = (process.env.ADMIN_PUBLISHERS || "derek,daniel").split(",").map((s) => s.trim().toLowerCase());
  return Boolean(user && ids.includes(String(user.id).toLowerCase()));
}

/** Claude spend since midnight Eastern, in dollars. */
export async function spentToday() {
  const [row] = await sql(
    `SELECT coalesce(sum(usd), 0)::float AS usd FROM eqs_editor_usage
      WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York')`,
  );
  return row.usd;
}

export function previewLink() {
  const base = process.env.EDITOR_PREVIEW_URL;
  if (!base) return null;
  const bypass = process.env.EDITOR_PREVIEW_BYPASS;
  return bypass ? `${base.replace(/\/$/, "")}/?x-vercel-protection-bypass=${encodeURIComponent(bypass)}&x-vercel-set-bypass-cookie=true` : base;
}

/** Nudges the bot so a new request starts now rather than at its next check. Never blocks the caller for long. */
export async function wakeWorker() {
  const url = process.env.EDITOR_WORKER_URL;
  const secret = process.env.EDITOR_WORKER_SECRET;
  if (!url || !secret) return;
  await fetch(`${url.replace(/\/$/, "")}/wake`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(2500),
  }).catch(() => {});
}

/** A plain-text email to Daniel through the site's Resend setup. Best effort. */
export async function notify(subject, lines) {
  const to = (process.env.EDITOR_NOTIFY || process.env.FORMS_BCC || "").split(",").map((s) => s.trim()).filter(Boolean);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FORMS_FROM;
  if (!to.length || !apiKey || !from) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: `[EQS Editor] ${subject}`, text: lines.filter((l) => l != null).join("\n") }),
    signal: AbortSignal.timeout(8000),
  }).catch((error) => console.error("[editor] notify failed", error.message));
}

/** ISO 8601 with a Z, which every browser parses (Postgres's default text form trips Safari). */
export const iso = (col) => `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ${col}`;
