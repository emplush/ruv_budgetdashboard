#!/usr/bin/env python3
"""Baut die IIS-Pakete in Aktuelle_Version/:
- Budgetdashboard_IIS_<v>.zip     Neuinstallation (Inhalt von app/ ohne Unterordner, leerer Ordner App_Data)
- Budgetdashboard_Update_<v>.zip  Update ohne App_Data
- Installationsanleitung.html
Alte Pakete im Ordner werden entfernt."""
import pathlib
import shutil
import zipfile

WURZEL = pathlib.Path(__file__).resolve().parent.parent
APP = WURZEL / "app"
ZIEL = WURZEL / "Aktuelle_Version"
ANLEITUNG = WURZEL / "docs" / "installation.html"
VERSION = (WURZEL / "VERSION").read_text(encoding="utf-8").strip()


def app_dateien():
    for pfad in sorted(APP.rglob("*")):
        rel = pfad.relative_to(APP)
        if pfad.is_file() and rel.parts[0] != "App_Data" and not pfad.name.startswith("."):
            yield pfad, rel.as_posix()


def schreibe_zip(name, mit_app_data):
    pfad = ZIEL / name
    with zipfile.ZipFile(pfad, "w", zipfile.ZIP_DEFLATED) as z:
        for datei, rel in app_dateien():
            z.write(datei, rel)
        if mit_app_data:
            z.writestr(zipfile.ZipInfo("App_Data/"), "")
        z.write(ANLEITUNG, "Installationsanleitung.html")
    return pfad


def main():
    text = ANLEITUNG.read_text(encoding="utf-8")
    if "Version " + VERSION not in text:
        raise SystemExit("docs/installation.html nennt nicht Version %s" % VERSION)
    ZIEL.mkdir(exist_ok=True)
    for alt in ZIEL.glob("Budgetdashboard_*.zip"):
        alt.unlink()
    pakete = [
        schreibe_zip("Budgetdashboard_IIS_%s.zip" % VERSION, True),
        schreibe_zip("Budgetdashboard_Update_%s.zip" % VERSION, False),
    ]
    shutil.copyfile(ANLEITUNG, ZIEL / "Installationsanleitung.html")
    for p in pakete:
        print("%s (%d KB)" % (p.relative_to(WURZEL), p.stat().st_size // 1024))


if __name__ == "__main__":
    main()
