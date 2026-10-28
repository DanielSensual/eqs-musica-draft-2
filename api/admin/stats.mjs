/** GET ?range=24h|7d|30d|90d: the dashboard's numbers for the live site, from analytics_events and eqs_leads. */

import { currentUser, json } from "../_auth.mjs";
import { ensureTables, sql } from "../_db.mjs";

const RANGES = {
  "24h": { interval: "24 hours", bucket: "hour", steps: 24 },
  "7d": { interval: "7 days", bucket: "day", steps: 7 },
  "30d": { interval: "30 days", bucket: "day", steps: 30 },
  "90d": { interval: "90 days", bucket: "day", steps: 90 },
};
const TZ = "America/New_York";
// Local testing reads the "eqs-dev" rows that api/track.mjs writes for localhost.
const SITE = process.env.EQS_STATS_SITE === "eqs-dev" ? "eqs-dev" : "eqs";

// Referrer hosts → the names Derek's team would use. Anything else shows as its domain.
const SOURCE_NAMES = [
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "Facebook"],
  [/(^|\.)google\./, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, "X"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "WhatsApp"],
  [/(^|\.)spotify\.com$/, "Spotify"],
  [/(^|\.)linktr\.ee$/, "Linktree"],
];

function sourceName(raw) {
  if (!raw || raw === "direct") return "Direct";
  const host = raw.toLowerCase().replace(/^www\./, "");
  for (const [re, name] of SOURCE_NAMES) if (re.test(host)) return name;
  return host;
}

/** Fills the gaps so the chart has every hour or day, oldest first. */
function series(rows, { bucket, steps }) {
  const byKey = new Map(rows.map((r) => [r.bucket, r]));
  const out = [];
  const now = new Date();
  for (let i = steps - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * (bucket === "hour" ? 3600e3 : 86400e3));
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...(bucket === "hour" ? { hour: "2-digit", hourCycle: "h23" } : {}),
    })
      .format(d)
      .replace(", ", "T");
    const row = byKey.get(bucket === "hour" ? `${key}:00` : key);
    out.push({ at: bucket === "hour" ? `${key}:00` : key, visitors: row?.visitors || 0, views: row?.views || 0 });
  }
  return out;
}

export async function GET(request) {
  const user = currentUser(request);
  if (!user) return json({ error: "Sign in first." }, 401);
  const range = RANGES[new URL(request.url).searchParams.get("range")] || RANGES["30d"];
  const iv = range.interval;
  const inRange = `properties->>'site' = '${SITE}' AND created_at >= now() - $1::interval`;
  const views = `event_name = 'page_view' AND ${inRange}`;
  const fmt = range.bucket === "hour" ? `YYYY-MM-DD"T"HH24":00"` : "YYYY-MM-DD";

  try {
    await ensureTables();
    const [totals, previous, buckets, pages, sources, devices, artists, outbound, languages, engagement, leads] = await Promise.all([
      sql(
        `SELECT count(DISTINCT visitor_id)::int AS visitors, count(DISTINCT session_id)::int AS sessions,
                count(*)::int AS views FROM analytics_events WHERE ${views}`,
        [iv],
      ),
      sql(
        `SELECT count(DISTINCT visitor_id)::int AS visitors FROM analytics_events
          WHERE event_name = 'page_view' AND properties->>'site' = '${SITE}'
            AND created_at >= now() - 2 * $1::interval AND created_at < now() - $1::interval`,
        [iv],
      ),
      sql(
        `SELECT to_char(date_trunc('${range.bucket}', created_at AT TIME ZONE '${TZ}'), '${fmt}') AS bucket,
                count(DISTINCT visitor_id)::int AS visitors, count(*)::int AS views
           FROM analytics_events WHERE ${views} GROUP BY 1`,
        [iv],
      ),
      sql(
        `SELECT split_part(path, '?', 1) AS path, count(*)::int AS views, count(DISTINCT visitor_id)::int AS visitors
           FROM analytics_events WHERE ${views} GROUP BY 1 ORDER BY views DESC LIMIT 12`,
        [iv],
      ),
      sql(
        `SELECT coalesce(nullif(properties->>'utm_source', ''),
                         nullif(split_part(regexp_replace(coalesce(referrer, ''), '^https?://', ''), '/', 1), ''),
                         'direct') AS source,
                count(DISTINCT session_id)::int AS sessions
           FROM analytics_events
          WHERE ${views} AND coalesce(referrer, '') !~* '^https?://([a-z0-9-]+\\.)*(eqsmusica\\.com|draft-2-eqs-site\\.vercel\\.app)'
          GROUP BY 1`,
        [iv],
      ),
      sql(
        `SELECT coalesce(properties->>'device_type', 'unknown') AS device, count(DISTINCT session_id)::int AS sessions
           FROM analytics_events WHERE ${views} GROUP BY 1 ORDER BY sessions DESC`,
        [iv],
      ),
      sql(
        `SELECT properties->>'artist' AS artist, count(*)::int AS clicks
           FROM analytics_events WHERE event_name = 'artist_click' AND ${inRange} AND properties ? 'artist'
          GROUP BY 1 ORDER BY clicks DESC LIMIT 15`,
        [iv],
      ),
      sql(
        `SELECT coalesce(properties->>'destination', 'other') AS destination, count(*)::int AS clicks
           FROM analytics_events WHERE event_name = 'outbound_click' AND ${inRange} GROUP BY 1 ORDER BY clicks DESC`,
        [iv],
      ),
      sql(
        `SELECT coalesce(properties->>'site_lang', 'en') AS lang, count(DISTINCT visitor_id)::int AS visitors
           FROM analytics_events WHERE ${views} GROUP BY 1`,
        [iv],
      ),
      sql(
        `SELECT round(avg((properties->>'seconds')::numeric))::int AS avg_seconds,
                round(100.0 * count(*) FILTER (WHERE (properties->>'bounced')::boolean) / greatest(count(*), 1))::int AS bounce_rate
           FROM analytics_events WHERE event_name = 'engagement_time' AND ${inRange}`,
        [iv],
      ),
      sql(`SELECT form, count(*)::int AS count FROM eqs_leads WHERE created_at >= now() - $1::interval GROUP BY 1`, [iv]),
    ]);

    // Several referrer hosts can share one name (l.instagram.com, instagram.com), so merge after naming.
    const merged = new Map();
    for (const row of sources) merged.set(sourceName(row.source), (merged.get(sourceName(row.source)) || 0) + row.sessions);

    return json({
      user,
      range: Object.keys(RANGES).find((k) => RANGES[k] === range),
      totals: {
        ...totals[0],
        previousVisitors: previous[0]?.visitors || 0,
        avgSeconds: engagement[0]?.avg_seconds || 0,
        bounceRate: engagement[0]?.bounce_rate || 0,
        leads: leads.reduce((n, r) => n + r.count, 0),
      },
      series: series(buckets, range),
      pages,
      sources: [...merged].map(([name, sessions]) => ({ name, sessions })).sort((a, b) => b.sessions - a.sessions).slice(0, 10),
      devices,
      artists,
      outbound,
      languages,
      leadsByForm: leads,
    });
  } catch (error) {
    console.error("[admin/stats]", error.message);
    return json({ error: "Couldn't load the numbers. Try again in a minute." }, 503);
  }
}
