#!/usr/bin/env python3
"""
Applique les regles de formulaire decidees le 01/10/2026 (redaction) :
- chapo obligatoire sur TOUS les types (il ne sert qu'a WordPress, jamais sur Dropbox) ;
- chroniques musique (Chroniques, Disque de la semaine, Coup de Coeur, Frenchie) :
  clip YouTube obligatoire (`lien`, validation youtube) + Bandcamp ou site officiel
  obligatoire (`lien_achat`, validation website).
Idempotent : relance sans risque. Usage : RS_ADMIN_TOKEN=... python3 scripts/update-fields-config.py [--dry-run]
"""
import json, os, sys, urllib.request

API = os.environ.get("RS_API", "https://hebdo-rs.up.railway.app")
TOKEN = os.environ.get("RS_ADMIN_TOKEN") or sys.exit("RS_ADMIN_TOKEN manquant")
DRY = "--dry-run" in sys.argv
MUSIC = {"Chroniques", "Disque de la semaine", "Chronique Coup de Coeur", "Frenchie"}
CHAPO = {"key": "chapo", "type": "textarea", "label": "Chapô (pour le site)", "required": True,
         "hint": "1 à 2 phrases d'accroche pour rollingstone.fr — n'apparaît pas dans le document livré"}
CLIP = {"key": "lien", "type": "url", "label": "Clip YouTube", "required": True, "validation": "youtube"}
SITE = {"key": "lien_achat", "type": "url", "label": "Bandcamp ou site officiel", "required": True, "validation": "website",
        "hint": "Lien vers le Bandcamp, le site de l'artiste ou du label (pas YouTube)"}

def req(method, path, body=None):
    r = urllib.request.Request(f"{API}{path}", data=json.dumps(body).encode() if body is not None else None, method=method,
                               headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r, timeout=60))

def upgrade(name, fields):
    out = [dict(f) for f in fields if f.get("key") != "chapo"]
    # chapo juste avant le corps du texte
    idx = next((i for i, f in enumerate(out) if f.get("key") == "corps"), len(out))
    out.insert(idx, CHAPO)
    if name in MUSIC:
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
