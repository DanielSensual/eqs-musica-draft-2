/**
 * Postgres over Neon's HTTP endpoint, with plain fetch: the site has no package.json, and adding one would put
 * node_modules into the static output.
 *
 * Vercel env: DS_DATABASE_URL, the shared Ghost AI analytics database (analytics_events lives there too).
 */

import { createHash } from "node:crypto";

export function hasDatabase() {
  return Boolean(process.env.DS_DATABASE_URL);
}

/** Runs one parameterised statement ($1, $2, …) and returns its rows. Throws on any database error. */
export async function sql(query, params = []) {
  const url = process.env.DS_DATABASE_URL;
  if (!url) throw new Error("DS_DATABASE_URL is not set");
  const res = await fetch(`https://${new URL(url).hostname}/sql`, {
    method: "POST",
    headers: { "Neon-Connection-String": url, "Content-Type": "application/json" },
    body: JSON.stringify({ query, params }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new Error(`database ${res.status}: ${body?.message || "no response"}`);
  return body.rows;
}

let tablesReady = null;

/** EQS's own tables. analytics_events is created by the Ghost AI tracker and shared. */
export function ensureTables() {
  tablesReady ||= (async () => {
    await sql(`CREATE TABLE IF NOT EXISTS eqs_leads (
      id text PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      form text NOT NULL,
      name text,
      email text NOT NULL,
      fields jsonb NOT NULL DEFAULT '{}'::jsonb,
      attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
      emailed boolean NOT NULL DEFAULT false,
      handled_at timestamptz,
      handled_by text
    )`);
    await sql(`CREATE TABLE IF NOT EXISTS eqs_admin_attempts (
      ip_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await sql(`CREATE INDEX IF NOT EXISTS eqs_admin_attempts_created ON eqs_admin_attempts (created_at)`);
    // The website editor: one row per change request, its photos, and what each Claude call cost.
    await sql(`CREATE TABLE IF NOT EXISTS eqs_edits (
      id text PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      requested_by text NOT NULL,
      status text NOT NULL,
      round int NOT NULL DEFAULT 1,
      thread jsonb NOT NULL DEFAULT '[]'::jsonb,
      progress text,
      summary text,
      draft_sha text,
      published_sha text,
      published_by text,
      published_at timestamptz,
      worker_at timestamptz,
      cost_usd numeric NOT NULL DEFAULT 0
    )`);
    // At most one open draft, even when two people send a request at the same moment.
    await sql(`CREATE UNIQUE INDEX IF NOT EXISTS eqs_edits_one_open ON eqs_edits ((1))
      WHERE status IN ('queued', 'working', 'ready', 'failed', 'needs_daniel', 'publish_requested', 'publishing')`);
    await sql(`CREATE TABLE IF NOT EXISTS eqs_edit_files (
      id text PRIMARY KEY,
      edit_id text NOT NULL,
      round int NOT NULL,
      name text NOT NULL,
      mime text NOT NULL,
      data text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await sql(`CREATE TABLE IF NOT EXISTS eqs_editor_usage (
      created_at timestamptz NOT NULL DEFAULT now(),
      edit_id text NOT NULL,
      usd numeric NOT NULL,
      input_tokens int NOT NULL DEFAULT 0,
      output_tokens int NOT NULL DEFAULT 0
    )`);
  })().catch((error) => {
    tablesReady = null;
    throw error;
  });
  return tablesReady;
}

export function clientIp(request) {
  return (request.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64) || "unknown";
}

export function hashIp(ip) {
  return createHash("sha256").update(`${process.env.ANALYTICS_SALT || "eqs-analytics"}:${ip}`).digest("hex");
}
