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
