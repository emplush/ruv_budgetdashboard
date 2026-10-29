#!/usr/bin/env python3
"""Verkleinert die Handbuch-Bilder in app/handbuch/bilder/ (256 Farben, PNG). Aufruf nach node tools/handbuch_bilder.js."""
import pathlib
from PIL import Image

ORDNER = pathlib.Path(__file__).resolve().parent.parent / "app" / "handbuch" / "bilder"

for pfad in sorted(ORDNER.glob("*.png")):
    vorher = pfad.stat().st_size
    bild = Image.open(pfad).convert("RGB").quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    bild.save(pfad, optimize=True)
    print("%s %d KB -> %d KB" % (pfad.name, vorher // 1024, pfad.stat().st_size // 1024))
