/**
 * The editor bot's side door (Railway → here). Only the bot calls it, with `Authorization: Bearer EDITOR_WORKER_SECRET`.
 * Keeping the bot on this API means the database URL and the Resend key never leave Vercel.
 *
 * GET: claim the next job (a draft round, a publish or an undo), with that round's photos and today's spend.
 * POST { id, kind, … }: report progress, cost and the outcome.
 */

import { timingSafeEqual } from "node:crypto";
import { json } from "../_auth.mjs";
import { ensureTables, sql } from "../_db.mjs";
import { OPEN, dailyCap, notify, spentToday } from "../_editor.mjs";

// A job whose bot has gone quiet this long is treated as abandoned (a restart mid-job).
const STALE_MIN = 20;
const ADMIN_URL = "https://www.eqsmusica.com/admin/";

function authorized(request) {
  const secret = process.env.EDITOR_WORKER_SECRET;
  const given = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

const note = (role, text, extra = {}) => JSON.stringify([{ role, text, at: new Date().toISOString(), ...extra }]);
const firstRequest = (thread) => (thread.find((t) => t.role === "user") || {}).text || "";

export async function GET(request) {
  if (!authorized(request)) return json({ error: "Forbidden" }, 403);
  try {
    await ensureTables();
    await recoverStale();
    const [job] = await sql(
      `UPDATE eqs_edits e
          SET status = CASE e.status WHEN 'queued' THEN 'working' WHEN 'publish_requested' THEN 'publishing' ELSE 'undoing' END,
              worker_at = now(), updated_at = now()
        WHERE e.id = (SELECT id FROM eqs_edits WHERE status IN ('queued', 'publish_requested', 'undo_requested')
                       ORDER BY updated_at LIMIT 1 FOR UPDATE SKIP LOCKED)
        RETURNING e.id, e.status, e.round, e.thread, e.requested_by, e.published_by, e.draft_sha, e.published_sha, e.summary`,
    );
    if (!job) return json({ job: null });
    const files =
      job.status === "working"
        ? await sql(`SELECT name, mime, data FROM eqs_edit_files WHERE edit_id = $1 AND round = $2 ORDER BY name`, [job.id, job.round])
        : [];
    return json({ job, files, spentToday: await spentToday(), cap: dailyCap() });
  } catch (error) {
    console.error("[editor/jobs]", error.message);
    return json({ error: "database unavailable" }, 503);
  }
}

async function recoverStale() {
  const stale = `worker_at < now() - make_interval(mins => ${STALE_MIN})`;
  await sql(
    `UPDATE eqs_edits SET status = CASE WHEN draft_sha IS NULL THEN 'failed' ELSE 'ready' END, progress = NULL, updated_at = now(),
            thread = thread || $1::jsonb
      WHERE status = 'working' AND ${stale}`,
    [note("editor", "I was interrupted before finishing that one. Please send the request again.", { kind: "error" })],
  );
  await sql(
    `UPDATE eqs_edits SET status = 'ready', progress = NULL, updated_at = now(), thread = thread || $1::jsonb
      WHERE status = 'publishing' AND ${stale}`,
    [note("editor", "Publishing was interrupted, so nothing changed on the live site. Tap Publish again.", { kind: "error" })],
  );
  await sql(
    `UPDATE eqs_edits SET status = 'published', progress = NULL, updated_at = now(), thread = thread || $1::jsonb
      WHERE status = 'undoing' AND ${stale}`,
    [note("editor", "Undo was interrupted, so the live site still has this change. Try Undo again.", { kind: "error" })],
  );
  // Photos are in the repo once a change is published; drafts that ended no longer need theirs.
  await sql(
    `DELETE FROM eqs_edit_files f USING eqs_edits e
      WHERE f.edit_id = e.id AND e.status NOT IN (${OPEN.map((s) => `'${s}'`).join(", ")})`,
  );
}

export async function POST(request) {
  if (!authorized(request)) return json({ error: "Forbidden" }, 403);
  const body = await request.json().catch(() => null);
  const id = String(body?.id || "");
  if (!/^ED-[0-9A-F]{8}$/.test(id)) return json({ error: "Unknown job." }, 400);
  try {
    await ensureTables();
    const usage = body.usage;
    if (usage && Number(usage.usd) > 0) {
      await sql(`INSERT INTO eqs_editor_usage (edit_id, usd, input_tokens, output_tokens) VALUES ($1, $2, $3, $4)`, [
        id,
        Number(usage.usd),
        Math.round(Number(usage.input_tokens) || 0),
        Math.round(Number(usage.output_tokens) || 0),
      ]);
      await sql(`UPDATE eqs_edits SET cost_usd = cost_usd + $2 WHERE id = $1`, [id, Number(usage.usd)]);
    }
    const text = String(body.text || "").slice(0, 4000);
    const update = await outcome(body.kind, id, text, body);
    if (!update) return json({ error: "Unknown kind." }, 400);
    const rows = await sql(update.query, update.params);
    if (!rows.length) return json({ error: "That job has moved on." }, 409);
    if (update.email) await sendEmail(update.email, rows[0], text);
    return json({ ok: true });
  } catch (error) {
    console.error("[editor/jobs]", error.message);
    return json({ error: "database unavailable" }, 503);
  }
}

/** The SQL for each report from the bot; the WHERE clause only lets a job move forward from the state it's in. */
function outcome(kind, id, text, body) {
  const done = "progress = NULL, updated_at = now(), worker_at = now()";
  const returning = "RETURNING id, requested_by, published_by, summary, thread, cost_usd::float AS cost_usd";
  switch (kind) {
    case "progress":
      return {
        query: `UPDATE eqs_edits SET progress = $2, worker_at = now() WHERE id = $1 AND status IN ('working', 'publishing', 'undoing') RETURNING id`,
        params: [id, text.slice(0, 200)],
      };
    case "drafted":
      return {
        query: `UPDATE eqs_edits SET status = 'ready', summary = $2, draft_sha = $3, ${done}, thread = thread || $4::jsonb
                 WHERE id = $1 AND status = 'working' ${returning}`,
        params: [id, text, String(body.sha || "").slice(0, 40), note("editor", text, { kind: "drafted" })],
      };
    case "needs_daniel":
      return {
        query: `UPDATE eqs_edits SET status = 'needs_daniel', ${done}, thread = thread || $2::jsonb
                 WHERE id = $1 AND status = 'working' ${returning}`,
        params: [id, note("editor", text, { kind: "needs_daniel" })],
        email: "Needs you",
      };
    case "failed":
      return {
        query: `UPDATE eqs_edits SET status = CASE WHEN draft_sha IS NULL THEN 'failed' ELSE 'ready' END, ${done},
                       thread = thread || $2::jsonb
                 WHERE id = $1 AND status = 'working' ${returning}`,
        params: [id, note("editor", text, { kind: "error" })],
        email: "A request didn't go through",
      };
    case "published":
      return {
        query: `UPDATE eqs_edits SET status = 'published', published_sha = $2, published_at = now(), ${done},
                       thread = thread || $3::jsonb
                 WHERE id = $1 AND status = 'publishing' ${returning}`,
        params: [id, String(body.sha || "").slice(0, 40), note("editor", text, { kind: "published" })],
        email: "Published",
      };
    case "publish_failed":
      return {
        query: `UPDATE eqs_edits SET status = 'ready', ${done}, thread = thread || $2::jsonb WHERE id = $1 AND status = 'publishing' ${returning}`,
        params: [id, note("editor", text, { kind: "error" })],
        email: "Publishing failed",
      };
    case "undone":
      return {
        query: `UPDATE eqs_edits SET status = 'undone', ${done}, thread = thread || $2::jsonb WHERE id = $1 AND status = 'undoing' ${returning}`,
        params: [id, note("editor", text, { kind: "undone" })],
        email: "Undone",
      };
    case "undo_failed":
      return {
        query: `UPDATE eqs_edits SET status = 'published', ${done}, thread = thread || $2::jsonb WHERE id = $1 AND status = 'undoing' ${returning}`,
        params: [id, note("editor", text, { kind: "error" })],
        email: "Undo failed",
      };
    default:
      return null;
  }
}

function sendEmail(subject, edit, text) {
  const requests = edit.thread.filter((t) => t.role === "user");
  return notify(`${subject}: ${edit.id}`, [
    text,
    "",
    `Asked by ${edit.requested_by}${edit.published_by ? `, published by ${edit.published_by}` : ""}.`,
    `First request: ${firstRequest(edit.thread)}`,
    requests.length > 1 ? `Latest request: ${requests.at(-1).text}` : null,
    `Claude cost so far: $${edit.cost_usd.toFixed(2)}`,
    "",
    ADMIN_URL,
  ]);
}
