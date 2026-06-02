# EQS Música — Agent Handoff (Draft 4)

**Purpose:** Another agent should verify Draft 4 against client assets (Victor/Evelyn WhatsApp + `EQS Website Preview Look.zip`) and report gaps before client review.

---

## Live links (update after deploy)

| What | URL |
|------|-----|
| **Draft 4 (target)** | https://draft-2-eqs-site.vercel.app |
| **GitHub repo** | https://github.com/DanielSensual/eqs-musica-draft-2 |
| **Production domain (future)** | https://www.eqsmusica.com |

**Client preference:** Draft 2 base → evolved through Draft 3 → **Draft 4 follows Evelyn’s Jun 2 mockup** (world map hero, logo upfront, artist grid, new artist form).

---

## Local workspace

```
/Users/danielcastillo/EQS composer draft/
```

**Run locally:**
```bash
cd "/Users/danielcastillo/EQS composer draft"
python3 -m http.server 9876
# Open http://127.0.0.1:9876
```

**Stack:** Single-file static site — all HTML/CSS/JS in `index.html`. No build step. Vercel project: `draft-2-eqs-site`.

---

## What Draft 4 changed (Jun 2, 2026)

### Hero (Evelyn mockup)
- Background: `video/hero-v4.mp4` (from client `EQS Website Preview Look.mp4`)
- **Gold EQS logo overlaid and prominent** (`img/eqs-logo-gold.png`) — addresses “logo buried in background”
- Headline: **#1 TROPICAL MUSIC POWER** + Learn More scroll
- Animated network lines use **moodboard gold `#E6AE6D` + palm `#2d5a3d`** (not neon green)

### Navigation & ticker
- Ticker: `EQS MUSICA # 1 IN TROPICAL MUSIC`
- Nav: **About | DerekVinci | Artist | Booking | New Artist** (pipe-separated, mockup-aligned)
- Header CTA: **NEW ARTIST →**

### Artists section (Evelyn `Artist Page Mockup.png`)
- Title **Artists** + **Book an Artist** button
- 4×2 grid: J Salez, Tony Lozano, Vinny Rivera, Johandy, Jhonny Evidence, Lee Sanz, Albin St Rose, Angel Rose
- New cover photos from client zip in `img/`
- **Placeholders** (PHOTO SOON): Lee Sanz, Albin St Rose, Angel Rose — folders empty in client package

### New artist application form (`#new-artist`)
- All 9 sections from `EQS Website Doc.pdf` in client zip
- Formspree placeholder: `YOUR_ARTIST_FORM_ID` — **not wired yet**
- Booking contact form still: `YOUR_FORM_ID`

### Other
- About blurb section (`#about`)
- DerekVinci section includes client photo (`img/derekvinci.jpg`)
- Stats: **8 artists** on roster
- Logos updated to client gold PNGs
- Copy: tropical (not bachata) in testimonials / Derek bio
- Mr. Don removed from Spotify embed title

---

## Client source files (local, not in git)

| Path | Notes |
|------|--------|
| `~/Downloads/EQS Website Preview Look.zip` | Master asset pack (~300MB) |
| `~/Downloads/WhatsApp Chat - EQS branding (2).zip` | Chat export + Jun 2 mockup video |
| `client-assets/` (extracted, gitignored) | Full unzip of asset pack |
| `.review-assets/` (gitignored) | WhatsApp export scratch |

Key files inside asset pack:
- `EQS Website Doc.pdf` — artist form spec
- `Artist Page Mockup.png` — artists grid layout
- `EQS Website Preview Look.mp4` — hero reference (deployed as `video/hero-v4.mp4`)
- `EQS Logos New/` — gold/white/black logos
- `Artist Pictures/` — cover shots (6 artists + DerekVinci)

---

## Design tokens (moodboard)

```css
--ink: #000000;
--ink-2: #1a2e22;
--cream: #e8e0d4;
--blood / accent-sun: #e6ae6d;
--accent-deep: #943240;
--accent-palm: #2d5a3d;
```

Official moodboard PDF hex labels: `#000000`, `#E6AE6D`, `#D0CAC2`, `#828E98`, `#282A23`  
Fonts: **Cormorant Garamond** (headings), **Montserrat** (body). **No Allura on website.**

---

## Verification checklist (for incoming agent)

### Deploy & assets
- [ ] Live URL loads (desktop + mobile)
- [ ] `video/hero-v4.mp4` plays in hero (check reduced-motion fallback)
- [ ] `img/eqs-logo-gold.png` and all 5 artist cover images load (no 404s)
- [ ] Hero video weight ~12MB — acceptable load on mobile?

### vs Evelyn mockup (Jun 2 video + `Artist Page Mockup.png`)
- [ ] Logo is **clearly upfront**, not lost in map/video
- [ ] Ticker text matches mockup intent
- [ ] Nav items match: About, DerekVinci, Artist, Booking, New Artist
- [ ] Artist grid order and 4×2 layout match mockup
- [ ] Palm/tropical dark green atmosphere on artists section
- [ ] Green highlights use moodboard palette, not neon `#4ade80`

### vs Victor WhatsApp feedback
- [ ] **#1 in Tropical Music** visible (not bachata)
- [ ] No Mr. Don anywhere (roster, footer, embeds)
- [ ] Artists **pop** on dark cards (compare Jhonny Evidence — weakest photo)
- [ ] Cinematic tropical, not luxury-restaurant or generic resort

### Forms & integrations
- [ ] `#new-artist` form renders all 9 sections; required fields enforce seriousness filter
- [ ] Formspree IDs still placeholders — flag if client expects live submissions
- [ ] Booking form at `#contact` still works structurally

### Content gaps (expected — document, don’t block)
- [ ] Lee Sanz, Albin St Rose, Angel Rose photos missing (ask Hector)
- [ ] Updated stream/country stats from Derek not applied (still 60M+, 25+)
- [ ] Spotify embed still generic artist ID `12YP3RGVLp3c36Zi6lFRtR`
- [ ] `eqsmusica.com` Wix migration not done

### Accessibility & QA
- [ ] Keyboard nav + skip link
- [ ] EN/ES language toggle still works on new strings
- [ ] No console errors on scroll/reveal
- [ ] Compare live site side-by-side with `client-assets/.../Artist Page Mockup.png`

---

## Git

```bash
git clone https://github.com/DanielSensual/eqs-musica-draft-2.git
cd eqs-musica-draft-2
git pull origin main
```

**Do not force-push `main` without explicit owner request.**

---

## Copy-paste prompt for verifying agent

```
Verify EQS Música Draft 4 on Vercel.

Live: https://draft-2-eqs-site.vercel.app
Repo: https://github.com/DanielSensual/eqs-musica-draft-2
Read HANDOFF.md in repo root.

Client references (local if available):
- Evelyn Jun 2 mockup video (world map hero, logo upfront)
- Artist Page Mockup.png (4x2 grid, Book an Artist)
- EQS Website Doc.pdf (new artist form — 9 sections)

Deliver:
1. Pass/fail against checklist in HANDOFF.md (with screenshots if possible)
2. List of remaining gaps before sending to Derek/Victor
3. Only fix obvious bugs — do not redesign without approval

Do not commit unless asked.
```

---

*Updated Jun 2, 2026 — Draft 4 (Evelyn mockup + client asset pack).*
