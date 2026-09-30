#!/usr/bin/env python3
"""
Génère frontend/public/guide.html à partir de TUTO-JOURNALISTE.md.

La carte « Guide écrit pas-à-pas » du tableau de bord pointe vers /guide.html :
ce fichier statique est servi par Vite/Express sans dépendance côté app.
À relancer après chaque modification du tuto, puis commiter le HTML généré.

    python3 scripts/build-guide.py

Dépendance : pip install markdown
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    import markdown
except ImportError:  # pragma: no cover
    sys.exit("Module 'markdown' manquant : pip install markdown")

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "TUTO-JOURNALISTE.md"
OUT = ROOT / "frontend" / "public" / "guide.html"

TEMPLATE = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Guide du journaliste — RS Hebdo Delivery</title>
<link rel="icon" href="/favicon.svg">
<style>
  :root {{
    --rs-red: #E11D2E; --rs-red-tint: #FBE4E6;
    --ink: #16140F; --ink-2: #2C2A23; --muted: #6F6A5C;
    --paper: #FBF8F2; --paper-2: #F5F0E6; --surface: #FFFFFF; --border: #E6E0D3;
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--paper); color: var(--ink);
    font: 16px/1.65 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }}
  main {{ max-width: 820px; margin: 0 auto; padding: 48px 20px 96px; }}
  h1, h2, h3, h4 {{ font-family: "Instrument Serif", Georgia, serif; font-weight: 400;
    letter-spacing: -0.01em; line-height: 1.15; color: var(--ink); }}
  h1 {{ font-size: 2.6rem; margin: 0 0 8px; }}
  h2 {{ font-size: 1.9rem; margin: 56px 0 12px; padding-top: 24px; border-top: 1px solid var(--border); }}
  h3 {{ font-size: 1.45rem; margin: 40px 0 8px; }}
  h4 {{ font-size: 1.1rem; margin: 28px 0 6px; color: var(--rs-red); font-family: inherit; font-weight: 600; }}
  a {{ color: var(--rs-red); }}
  blockquote {{ margin: 16px 0; padding: 12px 18px; background: var(--surface);
    border-left: 3px solid var(--rs-red); border-radius: 0 8px 8px 0; color: var(--ink-2); }}
  blockquote p {{ margin: 4px 0; }}
  code {{ background: var(--paper-2); padding: 1px 6px; border-radius: 4px; font-size: 0.92em; }}
  pre {{ background: var(--paper-2); padding: 14px 16px; border-radius: 8px; overflow-x: auto; }}
  pre code {{ background: none; padding: 0; }}
  table {{ border-collapse: collapse; width: 100%; margin: 16px 0; background: var(--surface); font-size: 0.95em; }}
  th, td {{ border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }}
  th {{ background: var(--paper-2); }}
  hr {{ border: 0; border-top: 1px solid var(--border); margin: 40px 0; }}
  .top {{ display: inline-block; margin-bottom: 24px; font-size: 13px; color: var(--muted); text-decoration: none; }}
  .top:hover {{ color: var(--rs-red); }}
  @media (max-width: 600px) {{ h1 {{ font-size: 2rem; }} h2 {{ font-size: 1.5rem; }} main {{ padding-top: 28px; }} }}
</style>
</head>
<body>
<main>
<a class="top" href="/">← Retour au tableau de bord</a>
{body}
</main>
</body>
</html>
"""


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    body = markdown.markdown(text, extensions=["tables", "fenced_code", "toc"])
    OUT.write_text(TEMPLATE.format(body=body), encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)} : {OUT.stat().st_size // 1024} Ko")


if __name__ == "__main__":
    main()
