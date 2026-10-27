# eqsmusica.com — Wix → Vercel cutover

**Prepared:** Oct 27, 2026 · **SWITCHED:** Oct 27, 2026 ~2:00 PM ET · **Vercel project:** `draft-2-eqs-site`

> **Done.** Wix A records are now `216.150.1.1` + `216.150.16.1` (the three `185.230.63.x` records are gone), and `www` is a CNAME to
> `aef5825a04ce704e.vercel-dns-017.com`. Vercel shows both domains Valid, the Let's Encrypt certificate was issued, the apex 308s to www,
> all pages and old Wix URLs resolve, and a live form test from www.eqsmusica.com was delivered. MX, SPF and the verification TXT were checked
> unchanged at the Wix nameserver right after the switch. Still open: an outside test email to DEREKVINCI@EQSMUSICA.COM, and the after-launch list below.

## The approach: keep Wix DNS and change only two records

The domain is registered at Wix and uses Wix nameservers (`ns2/ns3.wixdns.net`). Leave the nameservers where they are.
The cutover changes only the **website** records (the root A records and the `www` CNAME). The mail records stay
untouched, so Google Workspace email keeps flowing.

Moving the nameservers to Vercel would mean re-creating every mail record by hand, and a missed one breaks email.
Changing two records carries no email risk.

## Current Wix DNS (read from the Wix dashboard, Oct 27)

| Type | Host | Value | Cutover |
|---|---|---|---|
| A | `@` | 185.230.63.171 / .186 / .107 (Wix) | **REPLACE** → `216.150.1.1` + `216.150.16.1` |
| CNAME | `www` | cdn3.wixdns.net | **REPLACE** → `aef5825a04ce704e.vercel-dns-017.com` |
| CNAME | `m` | www1.wixdns.net (Wix mobile alias) | leave (delete after launch) |
| MX ×5 | `@` | aspmx.l.google.com (10), alt1–alt4 (20–50) — **Google Workspace** | **DO NOT TOUCH** |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` | **DO NOT TOUCH** |
| TXT | `@` | `google-site-verification=vNe607…` | **DO NOT TOUCH** |
| CNAME | `_dmarc` | _dmarc.wixemails.com (`p=none`) | leave |
| CNAME | `s1._domainkey`, `s2._domainkey`, `sel1._domainkey`, `sg` | *.eqsmusica.com.s015.ascendbywix.com (Wix email marketing) | leave |
| NS | | ns2.wixdns.net, ns3.wixdns.net | **DO NOT CHANGE** |

## Before the switch

1. **Forms.** All three forms now post to `api/submit.mjs`, which sends email through Resend. Recipients are fixed in
   that file: booking → DEREKVINCI@EQSMUSICA.COM, artist apply → halvarez@eqsmusica.com, creators →
   victorsavanillabooking@gmail.com. Set these Vercel env vars on `draft-2-eqs-site` for Production and Preview:
   - `RESEND_API_KEY`: the Ghost AI Resend key (ghostaisystems.com is a verified sending domain)
   - `FORMS_FROM`: `EQS Música Website <forms@ghostaisystems.com>`
   - `FORMS_BCC`: `danielcastillo@mediageekz.com` (optional; a copy of every submission during launch week)
   Redeploy, then submit each form once on draft-2-eqs-site.vercel.app.
   Already fixed (Oct 27): internal `*.md` hidden from the deploy, invented testimonials removed, old Wix URLs
   redirected (`vercel.json`), plus `404.html`, `robots.txt`, `sitemap.xml`, dead YouTube and partner links, and slimmer logo/photo files.
   **Done Oct 27:** env vars set; all three forms test-delivered (Resend `delivered`). To re-test without emailing
   the client, POST to `/api/submit/` with header `x-forms-test: $FORMS_TEST_TOKEN` (token in the gitignored `.env.local`).
2. **Done Oct 27.** Vercel's values, read from its domain config API: A `216.150.1.1` + `216.150.16.1`
   (fallback `76.76.21.21`), CNAME `aef5825a04ce704e.vercel-dns-017.com` (fallback `cname.vercel-dns.com`).
   In Vercel → `draft-2-eqs-site` → Settings → Domains, added:
   - `www.eqsmusica.com` as the primary domain (every canonical and OG URL already uses `www`)
   - `eqsmusica.com` with a **308 redirect → www.eqsmusica.com**
   Vercel reports "Invalid Configuration" until DNS moves. That status is expected, and the same screen shows the
   exact A and CNAME values to use. Use those values. They are usually `A 216.198.79.1` (older value `76.76.21.21`)
   and a project CNAME such as `xxxx.vercel-dns-0xx.com` (older value `cname.vercel-dns.com`).
3. In Wix → DNS Records, click **Export** to keep a backup of the zone.

## The switch (about 10 minutes, then propagation)

4. In Wix → Domains → eqsmusica.com → ⋯ → **Manage DNS records**:
   - Delete the three `185.230.63.x` A records and add two: `216.150.1.1` and `216.150.16.1`.
   - Edit the `www` CNAME from `cdn3.wixdns.net` to `aef5825a04ce704e.vercel-dns-017.com`.
   - If Wix locks these rows because the domain is still connected to the Wix site, first use
     ⋯ → **Unassign from this site**. This disconnects the old Wix site from the domain. It does **not** touch MX
     records or email. Then edit the records.
5. Change nothing else on that page.

## Verify (in this order)

- [ ] `dig +short A eqsmusica.com` returns the Vercel IP, and `dig +short CNAME www.eqsmusica.com` returns the Vercel CNAME.
- [ ] Vercel shows both domains **Valid** and has issued SSL (usually a few minutes).
- [ ] `https://eqsmusica.com` 308-redirects to `https://www.eqsmusica.com/`. All eight pages load, and EN/ES switches.
- [ ] Old Wix URLs redirect (see the redirects block in the audit). Nothing important returns 404.
- [ ] **Email:** `dig +short MX eqsmusica.com` still lists the five Google servers. Send an outside email to
      DEREKVINCI@EQSMUSICA.COM and get a reply out of that mailbox.
- [ ] Submit each form once (booking, artist apply, creators, revisions) and confirm each email arrives at its recipient.
- [ ] Paste `https://www.eqsmusica.com` into WhatsApp/iMessage and check that the OG preview image renders.

## Rollback

Put the three A records back (`185.230.63.171`, `.186`, `.107`), set `www` to `cdn3.wixdns.net`, and if the domain was
unassigned, reassign it to the Wix site. The TTL is 1 hour, so a rollback takes effect within about an hour.

## After launch (Derek's decisions, don't rush)

- **Don't cancel the Wix Premium plan yet.** The domain is registered through Wix (renews Jun 15, 2027). If the domain
  came as the plan's free-year voucher, cancelling the plan turns its renewal into a separate charge, and the domain
  must stay registered either way. Confirm with Derek before anything is cancelled.
- **Google Workspace billing:** the Wix "Business Email" page isn't visible to a collaborator. Ask Derek whether
  Workspace is billed through Wix. If it is, that subscription has to stay.
- **Add DKIM for Google Workspace.** No `google._domainkey` record exists, so mail sent from @eqsmusica.com is unsigned
  and more likely to land in spam. Generate the key in Google Admin → Gmail → Authenticate email, then add the TXT
  record in Wix DNS. (This issue predates us and is independent of the cutover.)
- Delete the `m` CNAME (Wix mobile alias) after a week of clean traffic.
- **The Wix blog (99 posts) does not carry over.** Old `/post/...` URLs redirect to `/artists/`. If Derek wants the
  posts kept, export them from Wix **before** unassigning the domain.
- Submit `https://www.eqsmusica.com/sitemap.xml` in Google Search Console (the domain is already verified there).
- `/newsletter/` is empty until Hector sends the first issue (see `newsletters/README.md`).
- Open with the client: danielsensualAI on the public roster (Daniel is now an EQS artist with *Báilame Así* and
  *Artificial*, so this may just need a name check), and the unconfirmed "Trusted By" partner list.
- Real press now exists (Hector's Oct 16 links on *Artificial*: hojaderutadigital.mx, elfiesta.es, gacetadigital.net,
  ballobachata.it, and others). These could become an "In the Press" strip where the invented testimonials used to be.
- Nav crowds between roughly 800 and 1000px wide (items run together). This predates the cutover; tidy it later.
