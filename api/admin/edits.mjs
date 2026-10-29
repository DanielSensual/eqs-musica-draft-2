/**
 * The admin's Website tab.
 * GET: the open draft (if any), recent changes, today's editor spend and whether this person may publish.
 * POST { action: "request", message, files: [{ name, mime, data }] }: start a draft, or another round on the open one.
 * POST { action: "publish" | "discard" | "undo", id }
 */

import { randomBytes } from "node:crypto";
import { currentUser, json, sameOrigin } from "../_auth.mjs";
import { ensureTables, sql } from "../_db.mjs";
import { BUSY, OPEN, canPublish, dailyCap, iso, previewLink, spentToday, wakeWorker } from "../_editor.mjs";

const MAX_MESSAGE = 2000;
const MAX_FILES = 3;
// Base64 characters per photo. The admin shrinks photos before upload, so this only stops oversized ones.
const MAX_FILE_CHARS = 1_400_000;
const MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const list = (values) => values.map((s) => `'${s}'`).join(", ");

export async function GET(request) {
  const user = currentUser(request);
  if (!user) return json({ error: "Sign in first." }, 401);
  try {
    await ensureTables();
    const [drafts, history, spent] = await Promise.all([
      sql(
        `SELECT id, status, round, thread, progress, summary, requested_by, draft_sha IS NOT NULL AS has_preview,
                ${iso("created_at")}, ${iso("updated_at")}
           FROM eqs_edits WHERE status IN (${list(OPEN)}) ORDER BY created_at DESC LIMIT 1`,
      ),
      sql(
        `SELECT id, status, summary, requested_by, published_by, ${iso("published_at")}, ${iso("updated_at")}, thread
           FROM eqs_edits WHERE status NOT IN (${list(OPEN)}) ORDER BY updated_at DESC LIMIT 15`,
      ),
      spentToday(),
    ]);
    const live = history.find((e) => e.status === "published");
    return json({
      draft: drafts[0] || null,
      history: history.map(({ thread, ...e }) => ({
        ...e,
        request: (thread.find((t) => t.role === "user") || {}).text || "",
        rounds: thread.filter((t) => t.role === "user").length,
        canUndo: e.id === live?.id && canPublish(user),
      })),
      previewUrl: drafts[0]?.has_preview ? previewLink() : null,
      canPublish: canPublish(user),
      spentToday: Math.round(spent * 100) / 100,
      cap: dailyCap(),
    });
  } catch (error) {
    console.error("[admin/edits]", error.message);
    return json({ error: "Couldn't load the editor. Try again in a minute." }, 503);
  }
}

export async function POST(request) {
  const user = currentUser(request);
  if (!user) return json({ error: "Sign in first." }, 401);
  if (!sameOrigin(request)) return json({ error: "Forbidden" }, 403);
  const body = await request.json().catch(() => ({}));
  try {
    await ensureTables();
    switch (body?.action) {
      case "request":
        return await requestChange(user, body);
      case "publish":
        return await publish(user, String(body.id || ""));
      case "discard":
        return await discard(user, String(body.id || ""));
      case "undo":
        return await undo(user, String(body.id || ""));
      default:
        return json({ error: "Unknown action." }, 400);
    }
  } catch (error) {
    console.error("[admin/edits]", error.message);
    return json({ error: "Couldn't save that. Try again." }, 503);
  }
}

async function requestChange(user, body) {
  const message = String(body.message || "").trim();
  if (!message) return json({ error: "Write what you'd like changed." }, 400);
  if (message.length > MAX_MESSAGE) return json({ error: `Please keep it under ${MAX_MESSAGE} characters.` }, 400);
  const files = Array.isArray(body.files) ? body.files : [];
  if (files.length > MAX_FILES) return json({ error: `Up to ${MAX_FILES} photos per request.` }, 400);
  for (const f of files) {
    if (!MIMES.has(f?.mime) || typeof f.data !== "string" || !f.data || f.data.length > MAX_FILE_CHARS) {
      return json({ error: "One of the photos couldn't be used. Try a JPEG or PNG." }, 400);
    }
  }
  if ((await spentToday()) >= dailyCap()) {
    return json({ error: "The editor has used today's budget. It will take new requests tomorrow." }, 429);
  }

  const [open] = await sql(`SELECT id, status, round FROM eqs_edits WHERE status IN (${list(OPEN)}) LIMIT 1`);
  if (open && BUSY.includes(open.status)) {
    return json({ error: "The editor is still working on the last request. Give it a minute." }, 409);
  }
  const round = open ? open.round + 1 : 1;
  const names = files.map((_, i) => `photo-${round}-${i + 1}.${files[i].mime.split("/")[1].replace("jpeg", "jpg")}`);
  const entry = JSON.stringify([{ role: "user", by: user.name, text: message, at: new Date().toISOString(), files: names }]);

  let id;
  if (open) {
    const rows = await sql(
      `UPDATE eqs_edits SET status = 'queued', round = $2, thread = thread || $3::jsonb, progress = NULL, updated_at = now()
        WHERE id = $1 AND status IN ('ready', 'failed', 'needs_daniel') RETURNING id`,
      [open.id, round, entry],
    );
    if (!rows.length) return json({ error: "The editor is still working on the last request. Give it a minute." }, 409);
    id = open.id;
  } else {
    id = `ED-${randomBytes(4).toString("hex").toUpperCase()}`;
    try {
      await sql(
        `INSERT INTO eqs_edits (id, requested_by, status, round, thread) VALUES ($1, $2, 'queued', 1, $3::jsonb)`,
        [id, user.name, entry],
      );
    } catch (error) {
      if (/eqs_edits_one_open/.test(error.message)) {
        return json({ error: "Someone else just started a change. Reload to see it." }, 409);
      }
      throw error;
    }
  }
  for (const [i, f] of files.entries()) {
    await sql(`INSERT INTO eqs_edit_files (id, edit_id, round, name, mime, data) VALUES ($1, $2, $3, $4, $5, $6)`, [
      `F-${randomBytes(6).toString("hex")}`,
      id,
      round,
      names[i],
      f.mime,
      f.data,
    ]);
  }
  await wakeWorker();
  return json({ ok: true, id });
}

async function publish(user, id) {
  if (!canPublish(user)) return json({ error: "Only Derek or Daniel can publish. Ask one of them to tap Publish." }, 403);
  const rows = await sql(
    `UPDATE eqs_edits SET status = 'publish_requested', published_by = $2, progress = 'Publishing…', updated_at = now()
      WHERE id = $1 AND status = 'ready' AND draft_sha IS NOT NULL RETURNING id`,
    [id, user.name],
  );
  if (!rows.length) return json({ error: "This draft isn't ready to publish." }, 409);
  await wakeWorker();
  return json({ ok: true });
}

async function discard(user, id) {
  const [edit] = await sql(`SELECT requested_by, status FROM eqs_edits WHERE id = $1`, [id]);
  if (!edit) return json({ error: "Unknown change." }, 404);
  if (!canPublish(user) && edit.requested_by !== user.name) {
    return json({ error: `Only ${edit.requested_by}, Derek or Daniel can discard this draft.` }, 403);
  }
  const rows = await sql(
    `UPDATE eqs_edits SET status = 'discarded', progress = NULL, updated_at = now(),
            thread = thread || $2::jsonb
      WHERE id = $1 AND status IN ('ready', 'failed', 'needs_daniel') RETURNING id`,
    [id, JSON.stringify([{ role: "system", text: `Discarded by ${user.name}.`, at: new Date().toISOString() }])],
  );
  if (!rows.length) return json({ error: "This draft can't be discarded right now." }, 409);
  return json({ ok: true });
}

async function undo(user, id) {
  if (!canPublish(user)) return json({ error: "Only Derek or Daniel can undo a published change." }, 403);
  const rows = await sql(
    `UPDATE eqs_edits SET status = 'undo_requested', progress = 'Undoing…', updated_at = now(),
            thread = thread || $2::jsonb
      WHERE id = $1 AND status = 'published'
        AND id = (SELECT id FROM eqs_edits WHERE status = 'published' ORDER BY published_at DESC LIMIT 1)
      RETURNING id`,
    [id, JSON.stringify([{ role: "system", text: `Undo requested by ${user.name}.`, at: new Date().toISOString() }])],
  );
  if (!rows.length) return json({ error: "Only the most recent published change can be undone." }, 409);
  await wakeWorker();
  return json({ ok: true });
}
