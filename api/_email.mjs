/**
 * Branded HTML for the form notification emails. Files starting with "_" in api/ are not deployed as functions.
 *
 * Email clients ignore <style> blocks and web fonts unevenly, so everything is inline and table-based,
 * with Georgia standing in for Cormorant Garamond and Helvetica/Arial for Montserrat.
 */

const LOGO = "https://draft-2-eqs-site.vercel.app/img/eqs-logo-128.png";
const SITE = "https://www.eqsmusica.com";

const C = {
  page: "#0b0b0b",
  card: "#141414",
  panel: "#1b1b1b",
  rule: "#2a2a2a",
  gold: "#e6ae6d",
  cream: "#e8e0d4",
  muted: "#8f8a82",
  ink: "#0b0b0b",
};
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// Labels match the ones visitors see on the site, grouped the way the form groups them.
export const LAYOUTS = {
  booking: {
    eyebrow: "Booking Inquiry",
    highlights: ["inquiry"],
    sections: [
      { title: "Contact", fields: { first_name: "First Name", last_name: "Last Name", email: "Email" } },
      { title: "Inquiry", fields: { inquiry: "Inquiry Type", message: "Message" } },
    ],
  },
  artist: {
    eyebrow: "New Artist Application",
    highlights: ["city", "genre", "years_releasing"],
    sections: [
      { title: "Basic Information", fields: { full_name: "Full Name", artist_name: "Artist Name", email: "Email", phone: "Phone", country: "Country", city: "City", age: "Age", genre: "Genre" } },
      { title: "Music Links", fields: { spotify: "Spotify", youtube: "YouTube", apple_music: "Apple Music", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", linktree: "Linktree", website: "Website" } },
      { title: "Music Career", fields: { years_releasing: "Years releasing music", songs_released: "Official songs released", release_frequency: "Release frequency" } },
      { title: "Social Media Consistency", fields: { post_frequency: "How often they post", videos_30_days: "Videos (last 30 days)", videos_90_days: "Videos (last 90 days)", content_time_percent: "Time spent creating content", creates_own_content: "Creates own content" } },
      { title: "Professionalism", fields: { pro_photos: "Professional photos", cover_art: "Professional cover art", epk: "EPK available", performs_live: "Performs live", live_performances_12mo: "Live shows (last 12 months)" } },
      { title: "Investment & Commitment", fields: { investment_12mo: "Invested (last 12 months)", paid_ads: "Runs paid ads", hired_professionals: "Has hired pros", willing_to_invest: "Willing to invest with the label" } },
      { title: "Mindset", fields: { why_join: "Why EQS Música?", what_different: "What makes them different", five_years: "Where in 5 years", sacrifice: "What they'll sacrifice", hours_per_week: "Hours per week on music" } },
      { title: "Discipline Test", fields: { weekly_routine: "Weekly routine" } },
      { title: "Final Submission", fields: { bio: "Bio", music_files_link: "Music files", why_invest: "Why EQS should invest in them" } },
    ],
  },
  creator: {
    eyebrow: "Creator Program Submission",
    highlights: ["discipline"],
    sections: [
      { title: "Creator", fields: { creator_name: "Name", creator_email: "Email", discipline: "What They Make", portfolio: "Portfolio / Links" } },
      { title: "About Their Work", fields: { message: "Message" } },
    ],
  },
};

// Select values that are slugs on the site.
const VALUE_LABELS = {
  inquiry: { booking: "Booking", demo: "Demo Submission", press: "Press", collaboration: "Collaboration", general: "General" },
  discipline: { video: "Video / Editing", photo: "Photography", design: "Graphic Design / Artwork", social: "Social / Short-Form Content", other: "Other" },
};

const HIGHLIGHT_LABELS = { inquiry: "Inquiry", city: "Based in", genre: "Genre", years_releasing: "Releasing", discipline: "Discipline" };

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const LINK = `color:${C.gold};text-decoration:underline`;

/** Escape, keep line breaks, and turn emails, URLs and bare domains into gold links. */
function rich(value) {
  return esc(value)
    .replace(
      /([^\s@<>]+@[^\s@<>]+\.[a-z]{2,})|(https?:\/\/[^\s<]+|(?:www\.)?[a-z0-9-]+\.(?:com|net|org|io|me|co|tv|fm|app|link)(?:\/[^\s<,]*)?)/gi,
      (match, email, url) => {
        if (email) return `<a href="mailto:${email}" style="${LINK}">${email}</a>`;
        const href = /^https?:/i.test(url) ? url : `https://${url}`;
        return `<a href="${href}" style="${LINK}">${url}</a>`;
      },
    )
    .replace(/\n/g, "<br>");
}

export function displayValue(key, value) {
  return VALUE_LABELS[key]?.[value] || value;
}

function cell(label, value, attrs = "") {
  const l = `<div style="font-family:${SANS};font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:${C.muted};padding-bottom:4px">${esc(label)}</div>`;
  const v = `<div style="font-family:${SANS};font-size:15px;line-height:1.6;color:${C.cream}">${rich(value)}</div>`;
  return `<td valign="top" ${attrs}style="padding:10px 12px 10px 0;border-bottom:1px solid ${C.rule}">${l}${v}</td>`;
}

const isShort = (value) => value.length <= 36 && !value.includes("\n");

/** Short answers sit two to a row; anything long gets the full width. */
function rows(entries) {
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    const [label, value] = entries[i];
    const next = entries[i + 1];
    if (isShort(value) && next && isShort(next[1])) {
      out.push(`<tr>${cell(label, value, 'width="50%" ')}${cell(next[0], next[1], 'width="50%" ')}</tr>`);
      i++;
    } else {
      out.push(`<tr>${cell(label, value, 'colspan="2" ')}</tr>`);
    }
  }
  return out;
}

function section(title, rows) {
  return `
    <tr><td style="padding:28px 32px 0">
      <div style="font-family:${SERIF};font-size:13px;letter-spacing:2.5px;text-transform:uppercase;color:${C.gold};padding-bottom:6px">${esc(title)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows.join("")}</table>
    </td></tr>`;
}

/**
 * @param {object} o
 * @param {string} o.formId
 * @param {Map<string,string>} o.fields   already-trimmed text fields
 * @param {string} o.who                  display name of the sender
 * @param {string} o.replyTo
 * @param {string} o.reference
 * @param {string[]} o.attachments        file names
 * @param {string|null} o.testFor         real recipient when this is a test send
 */
export function renderEmail({ formId, fields, who, replyTo, reference, attachments, testFor }) {
  const layout = LAYOUTS[formId];
  const first = who.split(/\s+/)[0];
  const used = new Set();

  const chips = layout.highlights
    .filter((k) => fields.get(k))
    .map((k) => {
      used.add(k);
      const v = k === "city" && fields.get("country") ? `${fields.get(k)}, ${fields.get("country")}` : displayValue(k, fields.get(k));
      return `<td style="padding:0 8px 8px 0"><div style="border:1px solid ${C.rule};background:${C.panel};padding:8px 12px">
        <div style="font-family:${SANS};font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:${C.muted}">${esc(HIGHLIGHT_LABELS[k])}</div>
        <div style="font-family:${SANS};font-size:14px;color:${C.cream};padding-top:2px">${esc(v)}</div></div></td>`;
    });

  const sections = layout.sections
    .map(({ title, fields: map }) => {
      const entries = Object.entries(map)
        .filter(([k]) => fields.get(k))
        .map(([k, label]) => (used.add(k), [label, displayValue(k, fields.get(k))]));
      return entries.length ? section(title, rows(entries)) : "";
    })
    .join("");

  // Anything the layout doesn't know about still reaches the inbox.
  const extras = [...fields].filter(([k]) => !used.has(k));
  const extraSection = extras.length
    ? section("Other", rows(extras.map(([k, v]) => [k.replace(/_/g, " "), v])))
    : "";

  const files = attachments.length
    ? `<tr><td style="padding:24px 32px 0"><div style="border:1px dashed ${C.rule};padding:12px 14px;font-family:${SANS};font-size:13px;color:${C.cream}">
        <span style="color:${C.gold}">&#128206; ${attachments.length} file${attachments.length > 1 ? "s" : ""} attached</span> &nbsp;${attachments.map(esc).join(" · ")}</div></td></tr>`
    : "";

  const testBanner = testFor
    ? `<tr><td style="background:${C.gold};padding:10px 32px;font-family:${SANS};font-size:12px;letter-spacing:1px;color:${C.ink};text-align:center">
        TEST SEND — the live form delivers this to <strong>${esc(testFor)}</strong></td></tr>`
    : "";

  const mailto = `mailto:${encodeURIComponent(replyTo)}?subject=${encodeURIComponent(`Re: ${layout.eyebrow} — EQS Música`)}`;
  const preheader = `${layout.eyebrow} from ${who} · ${reference}`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light">
<title>${esc(preheader)}</title></head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}">
<tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.card};border:1px solid ${C.rule}">
  ${testBanner}
  <tr><td style="padding:28px 32px 22px;border-bottom:1px solid ${C.rule}">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:12px"><img src="${LOGO}" width="40" height="40" alt="EQS" style="display:block;border:0"></td>
      <td style="font-family:${SERIF};font-size:18px;letter-spacing:3px;color:${C.cream}"><strong style="color:${C.gold}">EQS</strong> MÚSICA</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:30px 32px 0">
    <div style="font-family:${SANS};font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:${C.gold}">${esc(layout.eyebrow)}</div>
    <div style="font-family:${SERIF};font-size:32px;line-height:1.2;color:${C.cream};padding-top:10px">${esc(who)}</div>
    <div style="font-family:${SANS};font-size:14px;color:${C.muted};padding-top:6px"><a href="mailto:${esc(replyTo)}" style="color:${C.muted};text-decoration:none">${esc(replyTo)}</a></div>
  </td></tr>
  ${chips.length ? `<tr><td style="padding:20px 24px 0 32px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${chips.join("")}</tr></table></td></tr>` : ""}
  <tr><td style="padding:22px 32px 0">
    <a href="${mailto}" style="display:inline-block;background:${C.gold};color:${C.ink};font-family:${SANS};font-size:13px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;padding:14px 26px">Reply to ${esc(first)} &rarr;</a>
  </td></tr>
  ${sections}${extraSection}${files}
  <tr><td style="padding:32px 32px 28px">
    <div style="border-top:1px solid ${C.rule};padding-top:18px;font-family:${SANS};font-size:12px;line-height:1.7;color:${C.muted}">
      Sent from the form at <a href="${SITE}" style="color:${C.gold};text-decoration:none">eqsmusica.com</a>. Hit reply to answer ${esc(first)} directly.<br>
      Reference <span style="color:${C.cream}">${esc(reference)}</span>
    </div>
  </td></tr>
</table>
<div style="font-family:${SERIF};font-size:12px;letter-spacing:2px;color:${C.muted};padding-top:16px">#1 IN TROPICAL MUSIC</div>
</td></tr></table>
</body></html>`;
}
