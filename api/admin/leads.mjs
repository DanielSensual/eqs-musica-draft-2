/**
 * GET ?form=booking|artist|creator&q=text&status=open|handled: the newest 200 leads.
 * PATCH { id, handled }: mark a lead handled (or open again).
 */

import { currentUser, json, sameOrigin } from "../_auth.mjs";
import { ensureTables, sql } from "../_db.mjs";

const FORMS = new Set(["booking", "artist", "creator"]);
// ISO 8601 with a Z, which every browser parses (Postgres's default text form trips Safari).
const iso = (col) => `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ${col}`;

export async function GET(request) {
  const user = currentUser(request);
  if (!user) return json({ error: "Sign in first." }, 401);
  const params = new URL(request.url).searchParams;
  const where = [];
  const values = [];
  const form = params.get("form");
  if (FORMS.has(form)) where.push(`form = $${values.push(form)}`);
  const status = params.get("status");
  if (status === "open") where.push("handled_at IS NULL");
  if (status === "handled") where.push("handled_at IS NOT NULL");
  const q = (params.get("q") || "").trim().slice(0, 100);
  if (q) where.push(`(name ILIKE $${values.push(`%${q}%`)} OR email ILIKE $${values.length} OR fields::text ILIKE $${values.length})`);

  try {
    await ensureTables();
    const leads = await sql(
      `SELECT id, ${iso("created_at")}, form, name, email, fields, attachments, emailed, ${iso("handled_at")}, handled_by
         FROM eqs_leads ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY created_at DESC LIMIT 200`,
      values,
    );
    return json({ leads });
  } catch (error) {
    console.error("[admin/leads]", error.message);
    return json({ error: "Couldn't load leads. Try again in a minute." }, 503);
  }
}

export async function PATCH(request) {
  const user = currentUser(request);
  if (!user) return json({ error: "Sign in first." }, 401);
  if (!sameOrigin(request)) return json({ error: "Forbidden" }, 403);
  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || "");
  if (!/^EQS-[0-9A-F]{8}$/.test(id)) return json({ error: "Unknown lead." }, 400);
  try {
    const rows = body.handled
      ? await sql(`UPDATE eqs_leads SET handled_at = now(), handled_by = $2 WHERE id = $1 RETURNING id, ${iso("handled_at")}, handled_by`, [id, user.name])
      : await sql(`UPDATE eqs_leads SET handled_at = NULL, handled_by = NULL WHERE id = $1 RETURNING id, ${iso("handled_at")}, handled_by`, [id]);
    return rows.length ? json({ lead: rows[0] }) : json({ error: "Unknown lead." }, 404);
  } catch (error) {
    console.error("[admin/leads]", error.message);
    return json({ error: "Couldn't save that. Try again." }, 503);
  }
}
