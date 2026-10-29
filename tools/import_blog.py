#!/usr/bin/env python3
"""One-off import of the Wix blog export into src/blog/posts.json and img/blog/.

    python3 tools/import_blog.py ~/Downloads/eqsmusica-blog-export.json

Keeps published posts only, re-hosts every Wix image (resized, JPEG) under img/blog/,
rewrites the image links, and drops third-party <script> widgets (Songkick).
YouTube and Spotify iframes are kept. Re-running reuses images already downloaded.
"""

import hashlib
import json
import re
import subprocess
import sys
import unicodedata
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "img" / "blog"
OUT = ROOT / "src" / "blog" / "posts.json"
WIX = re.compile(r"https://static\.wixstatic\.com/media/[^\s\"'<>)]+")
SPANISH = re.compile(r"\b(el|la|los|las|de|que|con|una|su|nuevo|nueva|presenta|para|una|del)\b", re.I)


def ascii_slug(text):
    s = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    if len(s) > 80:
        s = s[:80].rsplit("-", 1)[0]
    return s or "post"


def media_base(url):
    """static.wixstatic.com/media/<id>~mv2.<ext> without any /v1/... transform suffix."""
    return url.split("/v1/")[0]


def fetch(url):
    key = hashlib.sha1(media_base(url).encode()).hexdigest()[:12]
    dest = IMG / f"{key}.jpg"
    if dest.exists():
        return url, f"/img/blog/{key}.jpg"
    raw = IMG / f"{key}.orig"
    try:
        req = urllib.request.Request(media_base(url), headers={"User-Agent": "Mozilla/5.0 (Macintosh) Chrome/124 Safari/537.36", "Referer": "https://www.eqsmusica.com/"})
        raw.write_bytes(urllib.request.urlopen(req, timeout=60).read())
        subprocess.run(
            ["sips", "-Z", "1200", "-s", "format", "jpeg", "-s", "formatOptions", "78", str(raw), "--out", str(dest)],
            check=True, capture_output=True,
        )
    except Exception as e:  # keep going; the page falls back to the Wix URL
        print("  FAILED", url, e)
        return url, None
    finally:
        raw.unlink(missing_ok=True)
    return url, f"/img/blog/{key}.jpg"


def clean_body(html):
    html = re.sub(r"<script\b[^>]*>.*?</script>", "", html, flags=re.S | re.I)
    html = re.sub(r"<script\b[^>]*/?>", "", html, flags=re.I)
    return html


def main(src):
    data = json.loads(Path(src).read_text(encoding="utf-8"))
    posts = [p for p in data["posts"] if p["status"] == "published"]
    IMG.mkdir(parents=True, exist_ok=True)

    urls = set()
    for p in posts:
        urls.update(WIX.findall(p["contentHtml"]))
        if p.get("coverImage") and p["coverImage"].get("url"):
            urls.add(p["coverImage"]["url"])
    print(f"{len(posts)} posts, {len(urls)} images")
    with ThreadPoolExecutor(3) as pool:
        mapping = dict(pool.map(fetch, sorted(urls)))
    ok = sum(1 for v in mapping.values() if v)
    print(f"images re-hosted: {ok}/{len(mapping)}")

    out, seen = [], set()
    for p in posts:
        body = clean_body(p["contentHtml"])
        for u, new in mapping.items():
            if new:
                body = body.replace(u, new)
        cover = p.get("coverImage") or {}
        cover_url = mapping.get(cover.get("url")) if cover.get("url") else None
        slug = ascii_slug(p["slug"])
        base, n = slug, 2
        while slug in seen:
            slug, n = f"{base}-{n}", n + 1
        seen.add(slug)
        text = p.get("contentText") or ""
        out.append({
            "slug": slug,
            "title": p["title"],
            "date": (p.get("firstPublishedDate") or p["createdDate"])[:10],
            "excerpt": (p.get("excerpt") or text[:200]).strip(),
            "cover": cover_url,
            "lang": "es" if len(SPANISH.findall(p["title"] + " " + text[:400])) >= 4 else "en",
            "body": body,
            "old": [p["slug"], (p.get("oldWixUrl") or "").split("/post/")[-1]],
        })
    out.sort(key=lambda x: x["date"], reverse=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", OUT.relative_to(ROOT), len(out), "posts")


if __name__ == "__main__":
    main(sys.argv[1])
