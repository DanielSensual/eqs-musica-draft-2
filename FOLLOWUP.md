# EQS Música — Delivery Follow-Up

**Date:** Jul 3, 2026
**Status:** Site tightened and verified — ready for client review. Two owner items block full launch: form endpoints and the domain transfer.

---

## What was fixed in this pass (merged to `main`)

| Fix | Detail |
|-----|--------|
| **Language toggle was invisible** | A CSS rule hid the inactive `data-lang` button, so visitors could never switch EN ↔ ES. Rule now excludes the toggle buttons; Spanish works site-wide. |
| **Hero poster 404** | `img/eqs-logo-poster.png` was listed in `.vercelignore` but is the hero video's poster frame. No longer excluded from deploys. |
| **Booking form dead-end** | Submitting while the Formspree ID is a placeholder now shows a bilingual inline message pointing to DEREKVINCI@EQSMUSICA.COM instead of a Formspree error page. The guard deactivates automatically once a real endpoint is set. |
| **Roster count mismatch** | Stats said 8 artists; the grid has 9. Stat now reads 9 (+5 note) and the footer lists the full roster. |
| **Photo weight** | Six portraits compressed from ~41MB to ~1.4MB (1600px long edge, q82). |
| **Dead assets** | Unused `hero-v4.mp4` (13MB) and duplicate `vinny-rivera.jpg` excluded from deploys; `mr-don.jpg` deleted. Dead-end SoundCloud footer icon removed. |

Verified end-to-end in Chromium: EN/ES toggle, booking-form guard (both languages, plus empty-submit native validation), all referenced assets present in a simulated Vercel deploy, no console errors from site code.

---

## Owner to-do before launch

### 1. Forms (Daniel)
- [ ] Create two Formspree forms and replace the placeholders in `index.html`:
  - Booking form: `action="https://formspree.io/f/YOUR_FORM_ID"` (search `YOUR_FORM_ID`)
  - Artist application: `action="https://formspree.io/f/YOUR_ARTIST_FORM_ID"` (search `YOUR_ARTIST_FORM_ID`)
- [ ] Submit each form once end-to-end after wiring (both guards deactivate automatically).

### 2. Domain (Daniel)
- [ ] Wix → Vercel migration for `eqsmusica.com` (canonical/OG URLs in `<head>` already point to `https://www.eqsmusica.com/`).
- [ ] After DNS cut-over, confirm social-share preview (OG image) resolves.

### 3. Client confirmations (Victor / Evelyn / Hector)
- [ ] **danielsensualAI on the public roster** — added Jun 17, not in Evelyn's mockup. Confirm approval before Derek sees it.
- [ ] Photos for **Lee Sanz** and **Albin St Rose** (cards still show PHOTO SOON).
- [ ] Updated stream/country stats from Derek (site still shows 60M+ / 25+).
- [ ] Social handles: SoundCloud (icon removed until a handle exists); confirm `@eqsmusica` on Instagram/YouTube/Facebook.
- [ ] Per-artist Spotify URLs — only J Salez and Vinny Rivera have embeds.

---

## Deploy notes

- Vercel project `draft-2-eqs-site`; static, no build step. Push to the connected branch and Vercel redeploys.
- Local preview: `python3 -m http.server 9876` in the repo root.
- Full historical context and the client-asset checklist live in `HANDOFF.md`; the outstanding asset email draft is `ASSETS_REQUEST.md`.

---

## Sep 12, 2026 — client requirement sweep

Checked the site against Victor's list of main points. Six of nine were already built; the two missing sections are now in (uncommitted until Daniel says go).

### Added this pass

| Section | Where | Notes |
|---|---|---|
| **Newsletter archive** — "The EQS Brief" | `#newsletter`, nav + footer | Issues hosted in `newsletters/` as PDFs and listed newest-first. Empty state until the first issue lands; the card template and instructions are in `newsletters/README.md` and as a comment in the grid markup. |
| **EQS Creator Program** | `#creators`, nav + footer | Perks list + submission form (name, email, discipline, portfolio links, message) plus a direct mailto. Same placeholder guard as the other two forms. |

Nav went from five items to seven, so spacing tightens below 1200px and again below 1000px (pipes hide, letter-spacing narrows) — verified no horizontal overflow at 1440 / 1100 / 1024 / 960 / 910 in both EN and ES, and the sections stack correctly at 375. Both new form guards fire in both languages; the booking-form selector was narrowed so it no longer matches the creator form, which now sits earlier in the DOM.

### Blocked on answers

- [ ] **Hector Alvarez's email** — the artist form has no recipient set at all. Victor wants all artist forms going to Hector.
- [ ] **Daniel's submission email** — replace `YOUR_CREATOR_EMAIL` in two places (the mailto in `#creators`, and `CREATOR_MSG` in the script block).
- [ ] **Third Formspree form** for the Creator Program (`YOUR_CREATOR_FORM_ID`), on top of the two already pending.
- [ ] **Roster mismatch.** Victor's list has six names and says **Angel Rico**; the site has nine and says **Angel Rose**. Unresolved: which spelling is right, and whether **Lee Sanz**, **Albin St Rose**, and **danielsensualAI** belong on the public roster.
- [ ] **Partners section** currently lists DSPs and majors under "Trusted By" — Victor asked for a Partners section, so confirm the real partner list (and whether logos are coming).
- [ ] **Updated stats** from Derek — still 60M+ streams / 25+ countries / 9 artists.

### Answers found in the WhatsApp export (no need to ask again)

Source: `~/Downloads/WhatsApp Chat - EQS branding.zip` (Sep 12, 2026 export) plus the May–Jun export already in `.review-assets/_chat.txt`. The group has 90-day disappearing messages, so the new export only covers Jun 17 → Sep 12 — keep both files.

| Question | Answer | Where it came from |
|---|---|---|
| Artist-form recipient | **halvarez@eqsmusica.com** | Victor, Jul 1: "The emails and forms collected should go to Hector" |
| Creator Program recipient | **victorsavanillabooking@gmail.com** — Victor wrote "my email" in his own list, so it is his, not Daniel's | Victor, Sep 12 + his email given May 21 |
| Domain | Derek holds the Wix login; Victor said to set it up directly with him | Victor, Jul 1 |
| Hero green | The neon green is baked into the client's own final map animation (`video/hero-main.mp4`), so it is theirs, not ours to recolor | Victor asked on Jun 2 to move off neon green, then supplied this video |

### Researched instead of waiting (Sep 12)

- **Angel Rico, not Angel Rose.** Victor's Sep 12 list says Angel Rico, the client pack's own file is `Angel Rico Cover.heic` (inside a folder mislabeled "Angel Rose"), and Spotify confirms Angel Rico — the Spanish singer whose "Mintiéndome" is a DerekVinci production on EQS. Renamed site-wide, image renamed to `img/angel-rico.jpg`.
- **Albin St' Rose** takes an apostrophe on Spotify, Apple Music, Deezer and Beatport. Corrected (the client folder spells it "Abin St Rose").
- **Both missing photos are in.** Lee Sanz: the press portrait from the EQS press release for "Mami" (lamezcla.com), cropped to portrait and graded. Albin St' Rose: his Spotify artist photo, cropped tighter and graded down hard — it is a bright daylight desert shot and still the odd one out, so it is the first card to swap when Hector sends real files.
- **Spotify IDs verified for every artist** and wired into the releases section: J Salez `1k9LH8hJGdjr23xa8Gu7zU`, Vinny Rivera `16KwTAKkQMkBVS0Fuz2vpt`, Tony Lozano `3BcUTcUB24CvdeMUho68m4`, Jhonny Evidence `7EndqnY5tR0pzhbVFJr5Zy`, Johandy `1CitJ6r1mhjof0XLq0BMHQ`, Angel Rico `5tQCNQQQoHVjwuGKbpoFQx`, Lee Sanz `5NenmouPCo43LQcwuzZD0f`, Albin St' Rose `6YqUpk9eMaZeryksmey4Xf`.
- **Stats replaced with something verifiable.** Monthly listeners on Sep 12, 2026: J Salez 581,058 · Vinny Rivera 321,341 · Tony Lozano 320,330 · Jhonny Evidence 211,154 · Johandy 58,086 · Angel Rico 18,016 · Lee Sanz 312 · Albin St' Rose 249 — **1.5M+ combined**. The old "60M+ combined streams" was unsourced, so the tile now reads 1.5M+ monthly listeners. Founding note now reads "Boston '98 · Orlando since '06", matching their own about page.
- **Mr. Don is still credited** on "Perfecta" inside DerekVinci's public "EQS Bachata Music" playlist. Derek asked that Mr. Don not be featured at all, so that playlist is not embedded anywhere on the site (the catalog card still links out to it). Someone with playlist access may want to fix that on Spotify.
- **The old Wix roster lists DJ Khalid and DJ Taga'Da**, who are on neither Victor's list nor the new site. Confirm whether they are still with EQS before launch.

### Still outstanding

- [ ] Three Formspree endpoints (booking, artist, creator) — recipients are now documented in the markup, but the forms themselves are not created.
- [ ] Wix login from Derek for the eqsmusica.com migration.
- [ ] Real photos for Albin St' Rose (and a better one for Lee Sanz if Hector has it).
- [ ] Derek's own updated numbers, if he wants something other than monthly listeners.
- [ ] Partners section still lists DSPs and majors rather than actual EQS partners.
- [ ] danielsensualAI on the public roster — still unconfirmed by the client.

---

## Site structure (multi-page, Sep 12, 2026)

The one long scroll is now eight pages. Everything still looks the same — same CSS, same components — it is just split up.

| Page | URL | Sections |
|---|---|---|
| Home | `/` | Hero, about blurb, stats, four featured artists, partners, closing CTA |
| Artists | `/artists/` | Full roster, stats, Spotify players, closing CTA |
| About | `/about/` | Label story (Boston 1998 → Orlando 2006), services, stats, partners, testimonials |
| DerekVinci | `/derekvinci/` | Bio and credits, selected productions, closing CTA |
| Newsletter | `/newsletter/` | The EQS Brief archive |
| Creators | `/creators/` | Creator Program + submission form |
| Apply | `/apply/` | Nine-step artist application |
| Booking | `/booking/` | Booking form, closing CTA |

### How to edit

```
src/partials/   head, ticker, header, drawer, footer, mini player, mobile action bar — shared by every page
src/sections/   one file per content block; a page is a list of these
assets/         site.css and site.js, shared by every page
tools/build.py  page list (titles, descriptions, which sections) + the assembler
```

1. Edit the partial, section, or asset.
2. Run `python3 tools/build.py`.
3. Commit the source change **and** the regenerated pages together.

Never hand-edit `index.html` or `*/index.html` — they carry a "Generated by tools/build.py" comment and the next build overwrites them. Write in-page links in sections as the old anchors (`#roster`, `#contact`, …); the build rewrites them to the right page, and keeps them as same-page anchors where they belong. Asset paths are root-absolute (`/img/…`) so they resolve from every page depth.

### Behavior worth knowing

- **Old links still work.** `eqsmusica.com/#roster`, `/#new-artist`, etc. redirect to the matching page before the home page renders.
- **Language carries across pages** — the EN/ES choice is saved in `localStorage`.
- **The nav marks the current page** (gold link, `aria-current="page"`).
- **Each page has its own title, description, canonical URL, and a single `<h1>`** — the first section of each interior page is promoted to `<h1>` at build time.
- `vercel.json` sets `trailingSlash: true` so `/artists` and `/artists/` resolve to one URL; `src/` and `tools/` are excluded from deploys via `.vercelignore`.
- Local preview is unchanged: `python3 -m http.server 9876` serves `/artists/` etc. exactly like Vercel.

### Content flag

The three testimonials on the About page ("Producer, BN Music", "A&R Executive, Latin Division", "Music Journalist, Orlando Sentinel") do not come from anywhere in the client material, and one still says "eight artists, sixty million streams". Quotes attributed to a named publication need to be real — get real ones from Derek or remove the section before launch. They were moved off the home page in the split for that reason.

