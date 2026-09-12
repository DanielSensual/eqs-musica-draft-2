# EQS newsletter archive

Issues written by Hector Alvarez are hosted here and listed on the site at `/#newsletter`.

## Adding an issue

1. Drop the PDF in this folder, named `eqs-brief-NN.pdf` (`eqs-brief-01.pdf`, `eqs-brief-02.pdf`, …).
2. Open `index.html`, find `<div class="newsletter__grid" id="newsletter-grid">`, and copy the commented
   `<article class="issue-card">` template into the grid — newest issue first.
3. Fill in the issue number, date, headline, and one-line summary, and point the link at the new PDF.
4. On the first issue, delete the `<p class="newsletter__empty">…</p>` line.
5. Commit and push — Vercel redeploys automatically.

The `data-en` / `data-es` attributes on the card are optional; drop them for a single-language issue.
