#!/usr/bin/env python3
"""
Applique les regles de formulaire decidees le 01/10/2026 (redaction) :
- chapo obligatoire sur TOUS les types (il ne sert qu'a WordPress, jamais sur Dropbox) ;
- chroniques musique (Chroniques, Disque de la semaine, Coup de Coeur, Frenchie) :
  clip YouTube obligatoire (`lien`, validation youtube) + Bandcamp ou site officiel
  obligatoire (`lien_achat`, validation website) ;
- nom de l'artiste / titre du film / titre du livre en MAJUSCULES (transform uppercase) sur tous les types ;
- Livres et Expo : note facultative (livres notes, expos pas toujours) ;
- Disque de la semaine : note (etoiles) obligatoire, comme les autres chroniques
  (elle manquait, donc absente du document Dropbox du RSH240).
Idempotent : relance sans risque. Usage : RS_ADMIN_TOKEN=... python3 scripts/update-fields-config.py [--dry-run]
"""
import json, os, sys, urllib.request

API = os.environ.get("RS_API", "https://hebdo-rs.up.railway.app")
TOKEN = os.environ.get("RS_ADMIN_TOKEN") or sys.exit("RS_ADMIN_TOKEN manquant")
DRY = "--dry-run" in sys.argv
MUSIC = {"Chroniques", "Disque de la semaine", "Chronique Coup de Coeur", "Frenchie"}
# Le champ `artiste` (nom d'artiste, titre du film, titre du livre ou de l'expo) est en MAJUSCULES sur tous les types (02/10/2026).
ARTIST_UPPER = MUSIC | {"Sujet de couv", "Interview 3000", "Live report", "Chronique Cinema", "Livres et Expo"}
CHAPO = {"key": "chapo", "type": "textarea", "label": "Chapô (pour le site)", "required": True,
         "hint": "1 à 2 phrases d'accroche pour rollingstone.fr — n'apparaît pas dans le document livré"}
CLIP = {"key": "lien", "type": "url", "label": "Clip YouTube", "required": True, "validation": "youtube"}
STARS = {"key": "etoiles", "max": 5, "type": "stars", "label": "Nombre d'etoiles (sur 5)", "required": True}
SITE = {"key": "lien_achat", "type": "url", "label": "Bandcamp ou site officiel", "required": True, "validation": "website",
        "hint": "Lien vers le Bandcamp, le site de l'artiste ou du label (pas YouTube)"}

def req(method, path, body=None):
    r = urllib.request.Request(f"{API}{path}", data=json.dumps(body).encode() if body is not None else None, method=method,
                               headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r, timeout=60))

def upgrade(name, fields):
    out = [dict(f) for f in fields if f.get("key") != "chapo"]
    for f in out:
        if f.get("key") == "artiste" and name in ARTIST_UPPER:
            f["transform"] = "uppercase"
    # chapo juste avant le corps du texte
    idx = next((i for i, f in enumerate(out) if f.get("key") == "corps"), len(out))
    out.insert(idx, CHAPO)
    if name == "Livres et Expo" and not any(f.get("key") == "etoiles" for f in out):
        # Note facultative : les livres sont notes, les expos pas toujours.
        album = next((i for i, f in enumerate(out) if f.get("key") == "album"), 0)
        out.insert(album + 1, {**STARS, "required": False, "label": "Nombre d'etoiles (sur 5) — livres"})
    if name in MUSIC:
        if not any(f.get("key") == "etoiles" for f in out):
            album = next((i for i, f in enumerate(out) if f.get("key") == "album"), 0)
            out.insert(album + 1, STARS)
        out = [f for f in out if f.get("key") not in ("lien", "lien_achat")]
        photos = next((i for i, f in enumerate(out) if f.get("type") == "images"), len(out))
        out[photos:photos] = [CLIP, SITE]
    return out

types = req("GET", "/api/admin/paper-types")
types = types if isinstance(types, list) else types.get("data", [])
for t in types:
    new = upgrade(t["name"], t.get("fields_config") or [])
    if new == t.get("fields_config"):
        print("=", t["name"], "(déjà à jour)"); continue
    print("~", t["name"], "->", ", ".join(f"{f['key']}{'*' if f.get('required') else ''}" for f in new))
    if not DRY:
        req("PUT", f"/api/admin/paper-types/{t['id']}", {"fields_config": new})
print("dry-run, rien écrit" if DRY else "fait")
