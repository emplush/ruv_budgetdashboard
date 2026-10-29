#!/usr/bin/env python3
"""Baut dist/artefakt.html: eine einzelne HTML-Datei mit allen Styles, Schriften, Bildern und Skripten."""
import base64
import pathlib
import re

WURZEL = pathlib.Path(__file__).resolve().parent.parent
APP = WURZEL / "app"
ZIEL = WURZEL / "dist" / "artefakt.html"

MIME = {".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".png": "image/png"}


def daten_url(pfad: pathlib.Path) -> str:
    return "data:%s;base64,%s" % (MIME[pfad.suffix], base64.b64encode(pfad.read_bytes()).decode("ascii"))


def css_einbetten(pfad: pathlib.Path) -> str:
    text = pfad.read_text(encoding="utf-8")

    def ersetze(treffer):
        rel = treffer.group(2)
        datei = (pfad.parent / rel).resolve()
        if datei.suffix == ".woff" and (datei.with_suffix(".woff2")).exists():
            return "url(%s)" % daten_url(datei.with_suffix(".woff2"))
        return "url(%s)" % daten_url(datei)

    text = re.sub(r"url\((['\"]?)(\.\./fonts/[^'\")]+)\1\)", ersetze, text)
    # Doppelte woff-Quelle nach dem Einbetten entfernen
    text = re.sub(r"(url\(data:font/woff2;base64,[^)]+\) format\('woff2'\)),\s*url\(data:font/woff2;base64,[^)]+\) format\('woff'\)", r"\1", text)
    return text


def main():
    html = (APP / "index.html").read_text(encoding="utf-8")

    def link(treffer):
        return "<style>\n%s\n</style>" % css_einbetten(APP / treffer.group(1))

    def skript(treffer):
        js = (APP / treffer.group(1)).read_text(encoding="utf-8")
        assert "</script" not in js.lower(), treffer.group(1)
        return "<script>\n%s\n</script>" % js

    html = re.sub(r'<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?">', link, html)
    html = re.sub(r'<script src="([^"?]+)(?:\?[^"]*)?"></script>', skript, html)
    html = re.sub(r'<link rel="icon" href="[^"]+">\n?', "", html)
    html = re.sub(r'<link rel="apple-touch-icon" href="[^"]+">\n?', "", html)
    for name in ("logo-positiv.svg", "logo-negativ.svg"):
        html = html.replace("img/" + name, daten_url(APP / "img" / name))
    ZIEL.parent.mkdir(exist_ok=True)
    ZIEL.write_text(html, encoding="utf-8")
    print("%s (%d KB)" % (ZIEL.relative_to(WURZEL), ZIEL.stat().st_size // 1024))


if __name__ == "__main__":
    main()
