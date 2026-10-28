/**
 * Site forms → email via Resend. One endpoint for the booking, artist-application and creator forms.
 *
 * Vercel env (Production + Preview):
 *   RESEND_API_KEY   Resend key whose account has a verified sending domain
 *   FORMS_FROM       e.g. "EQS Música Website <forms@ghostaisystems.com>"
 *   FORMS_BCC        optional, comma-separated; a copy of every submission (launch monitoring)
 *   FORMS_TEST_TOKEN optional; a request carrying it in `x-forms-test` goes only to FORMS_BCC, marked [TEST],
 *                    so the live forms can be checked without emailing the client
 *   DS_DATABASE_URL  optional; each real submission is also saved for the /admin/ leads list
 *
 * Recipients are fixed here, never taken from the request. Replies go to the submitter.
 * Errors use Formspree's JSON shape ({ errors: [{ message }] }) so the front end reads one format.
 */

import { createHash } from "node:crypto";
import { ensureTables, hasDatabase, sql } from "./_db.mjs";
import { LAYOUTS, displayValue, renderEmail } from "./_email.mjs";

const FORMS = {
  booking: {
    to: ["DEREKVINCI@EQSMUSICA.COM"],
    subject: "Booking inquiry",
    emailField: "email",
    name: (f) => [f.get("first_name"), f.get("last_name")].filter(Boolean).join(" "),
  },
  artist: {
    to: ["halvarez@eqsmusica.com"],
    subject: "New artist application",
    emailField: "email",
    name: (f) => f.get("artist_name") || f.get("full_name"),
  },
  creator: {
    to: ["victorsavanillabooking@gmail.com"],
    subject: "Creator Program submission",
    emailField: "creator_email",
    name: (f) => f.get("creator_name"),
  },
};

// Fields the site adds for routing or spam control; never part of the email body.
const INTERNAL = new Set(["form", "_gotcha", "_subject", "route_to"]);
// Vercel rejects request bodies over 4.5 MB before this runs; the front end checks the same cap.
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WINDOW_MS = 60_000;
const hits = new Map();

/** A bounded per-instance limiter; not a global quota. */
function rateLimited(key, now = Date.now()) {
  const entry = hits.get(key);
  if (entry && now - entry.started < WINDOW_MS) return ++entry.count > 5;
  if (hits.size >= 1000) hits.clear();
  hits.set(key, { started: now, count: 1 });
  return false;
}

function fail(status, message) {
  return Response.json({ ok: false, errors: [{ message }] }, { status });
}

function label(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function POST(request) {
  let data;
  try {
    data = await request.formData();
  } catch {
    return fail(400, "Couldn't read the form. Please try again.");
  }

  const formId = String(data.get("form") || "");
  const form = FORMS[formId];
  if (!form) return fail(400, "Unknown form.");
  // Honeypot filled in: answer like a success so bots learn nothing.
  if (String(data.get("_gotcha") || "")) return Response.json({ ok: true });

  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64) || "unknown";
  if (rateLimited(ip)) return fail(429, "Please wait a minute before sending again.");

  const replyTo = String(data.get(form.emailField) || "").trim();
  if (!EMAIL_RE.test(replyTo) || replyTo.length > 254) return fail(400, "Please enter a valid email address.");

  const fields = new Map();
  const attachments = [];
  let attachmentBytes = 0;
  for (const [key, value] of data.entries()) {
    if (INTERNAL.has(key)) continue;
    if (typeof value === "object" && value !== null && "arrayBuffer" in value) {
      if (!value.size) continue;
      attachmentBytes += value.size;
      if (attachmentBytes > MAX_ATTACHMENT_BYTES) {
        return fail(413, "Uploads are too large. Please share files through a Dropbox or Drive link instead.");
      }
      const content = Buffer.from(await value.arrayBuffer()).toString("base64");
      attachments.push({ filename: value.name || `${key}`, content });
      continue;
    }
    const text = String(value).trim().slice(0, 10_000);
    if (!text) continue;
    fields.set(key, fields.has(key) ? `${fields.get(key)}, ${text}` : text);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FORMS_FROM;
  if (!apiKey || !from) {
    console.error("[submit] RESEND_API_KEY or FORMS_FROM is not set");
    return fail(503, "This form is temporarily unavailable.");
  }

  const labels = Object.assign({}, ...LAYOUTS[formId].sections.map((s) => s.fields));
  const body = [...fields].map(([key, value]) => `${labels[key] || label(key)}: ${displayValue(key, value)}`).join("\n");
  const fingerprint = createHash("sha256").update(JSON.stringify([formId, body])).digest("hex");
  const reference = `EQS-${fingerprint.slice(0, 8).toUpperCase()}`;
  const who = form.name(fields) || replyTo;
  const bcc = (process.env.FORMS_BCC || "").split(",").map((s) => s.trim()).filter(Boolean);
  const testToken = process.env.FORMS_TEST_TOKEN || "";
  const isTest = Boolean(testToken && bcc.length) && request.headers.get("x-forms-test") === testToken;

  const email = JSON.stringify({
    from,
    to: isTest ? bcc : form.to,
    ...(bcc.length && !isTest ? { bcc } : {}),
    reply_to: replyTo,
    subject: `${isTest ? `[TEST → ${form.to.join(", ")}] ` : ""}[${reference}] ${form.subject} — ${who}`,
    text: [
      `EQS Música website — ${form.subject}`,
      `Reference: ${reference}`,
      `Reply to: ${replyTo}`,
      "",
      body,
      "",
      "Sent from the form at www.eqsmusica.com. Reply to this email to answer the sender directly.",
    ].join("\n"),
    html: renderEmail({
      formId,
      fields,
      who,
      replyTo,
      reference,
      attachments: attachments.map((a) => a.filename),
      testFor: isTest ? form.to.join(", ") : null,
    }),
    ...(attachments.length ? { attachments } : {}),
  });
  // Keyed on the exact email, so a double-click is sent once but a changed template or test flag never collides.
  const sendKey = createHash("sha256").update(email).digest("hex");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `eqs-form/v2/${sendKey}`,
    },
    body: email,
  }).catch(() => null);

  const emailed = Boolean(res && res.ok);
  // Test sends stay out of the admin's lead list.
  if (!isTest) {
    const rows = [...fields].map(([key, value]) => ({ key, label: labels[key] || label(key), value: displayValue(key, value) }));
    await saveLead({ reference, formId, who, replyTo, rows, attachments, emailed });
  }

  if (!emailed) {
    // Provider errors can contain configuration details; never return them to the browser.
    console.error("[submit] Resend rejected the email", res && res.status);
    return fail(502, "Your message hasn't been sent. Please try again.");
  }
  return Response.json({ ok: true, reference });
}

/** Keeps a copy for the /admin/ leads list. Best effort: a database problem never blocks the email. */
async function saveLead({ reference, formId, who, replyTo, rows, attachments, emailed }) {
  if (!hasDatabase()) return;
  try {
    await ensureTables();
    await sql(
      `INSERT INTO eqs_leads (id, form, name, email, fields, attachments, emailed)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
       ON CONFLICT (id) DO UPDATE SET emailed = eqs_leads.emailed OR EXCLUDED.emailed`,
      [
        reference,
        formId,
        who,
        replyTo,
        // An array, because jsonb reorders object keys and the admin should read in the form's order.
        JSON.stringify(rows),
        JSON.stringify(attachments.map((a) => a.filename)),
        emailed,
      ],
    );
  } catch (error) {
    console.error("[submit] couldn't save the lead", error.message);
  }
}
