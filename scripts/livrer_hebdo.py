#!/usr/bin/env python3
"""
Livraison des papiers de l'hebdo via l'API RS Hebdo Delivery.

Meme chemin serveur que l'interface : correction IA (/api/correct) puis
livraison multipart (/api/deliveries) avec author_id, ce qui attribue le papier
au bon journaliste. Les images partent telles que listees (limite serveur :
60 Mo par fichier, 30 fichiers par livraison).

Les identifiants (hebdo courant, types de papier, auteurs) sont relus via l'API
a chaque lancement : ils ont change avec la migration du 06/10/2026.

Garde-fou « aucun texte ajoute » : si la correction IA insere des mots absents
du texte du journaliste, elle est ecartee et le papier part avec son texte
d'origine (signale dans le rapport).

Usage :
  RS_BASE=<dossier HEBDOxxx> python3 scripts/livrer_hebdo.py papiers.json --numero 241 [--dry-run]
Mot de passe admin : variable RS_ADMIN_PASSWORD, sinon fichier scripts/.env
(ligne RS_ADMIN_PASSWORD=..., ignore par git).
"""
import argparse, difflib, json, mimetypes, os, re, subprocess, sys

API = os.environ.get("RS_API", "https://rs-hebdo-delivery-production.up.railway.app")
SUPA = os.environ.get("RS_SUPABASE", "https://tjchtqvavjkwpsldszxf.supabase.co")
PUB = os.environ.get("RS_SUPABASE_PUBLISHABLE", "sb_publishable_pYol1ke9D6VC4_cAAh4yBA_LwtGGSUa")
ADMIN_EMAIL = os.environ.get("RS_ADMIN_EMAIL", "denis@mdmcmusicads.com")
BASE = os.environ.get("RS_BASE", "")
ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")


def curl(args, timeout=600):
    r = subprocess.run(["curl", "-s", "--max-time", str(timeout), *args], capture_output=True, text=True)
    return r.stdout


def admin_password():
    pwd = os.environ.get("RS_ADMIN_PASSWORD")
    if not pwd and os.path.exists(ENV_FILE):
        for line in open(ENV_FILE, encoding="utf-8"):
            if line.startswith("RS_ADMIN_PASSWORD="):
                pwd = line.split("=", 1)[1].strip()
    return pwd or sys.exit("RS_ADMIN_PASSWORD manquant (variable d'environnement ou scripts/.env)")


def login():
    out = curl(["-X", "POST", "-H", f"apikey: {PUB}", "-H", "Content-Type: application/json",
                "-d", json.dumps({"email": ADMIN_EMAIL, "password": admin_password()}),
                f"{SUPA}/auth/v1/token?grant_type=password"])
    tok = json.loads(out or "{}").get("access_token")
    return tok or sys.exit("Authentification impossible")


def api_get(token, path):
    out = curl(["-H", f"Authorization: Bearer {token}", f"{API}{path}"], timeout=60)
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        sys.exit(f"GET {path} : reponse illisible ({out[:120]})")


def resolve_ids(token, numero):
    hebdo = api_get(token, "/api/deliveries/hebdos")
    hebdo = hebdo[0] if isinstance(hebdo, list) else hebdo
    if str(hebdo.get("numero")) != str(numero):
        sys.exit(f"Hebdo courant = n°{hebdo.get('numero')} et non n°{numero} : marquer le {numero} comme courant dans l'admin")
    types = {t["name"]: t["id"] for t in api_get(token, "/api/deliveries/paper-types")}
    people = api_get(token, "/api/admin/journalists")
    people = people if isinstance(people, list) else people.get("data", [])
    authors = {p.get("full_name"): p["id"] for p in people if p.get("full_name")}
    return hebdo["id"], types, authors


# --- Garde-fou : la correction ne doit ajouter aucun mot -------------------

_TAGS = re.compile(r"</?[a-z]+[^>]*>", re.I)
_WORD = re.compile(r"[\w’'-]+", re.U)


def _words(text):
    plain = _TAGS.sub(" ", text).replace(" ", " ").replace(" ", " ")
    return [w.lower().strip("’'-") for w in _WORD.findall(plain) if w.strip("’'-")]


def added_words(original, corrected):
    """Mots que la correction insere (au-dela des remplacements mot pour mot)."""
    a, b = _words(original), _words(corrected)
    added = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if op == "insert":
            added += b[j1:j2]
        elif op == "replace" and (j2 - j1) > (i2 - i1):
            added += b[j1 + (i2 - i1):j2]
    return added


# --- Livraison --------------------------------------------------------------

def correct(token, text):
    """Correction IA, comme l'etape 3 de l'interface. Renvoie (texte, info)."""
    out = curl(["-X", "POST", "-H", f"Authorization: Bearer {token}", "-H", "Content-Type: application/json",
                "-d", json.dumps({"text": text}), f"{API}/api/correct"], timeout=300)
    try:
        d = json.loads(out)
    except json.JSONDecodeError:
        return None, f"reponse illisible: {out[:150]}"
    if not d.get("correctedText"):
        return None, d.get("error") or str(d)[:150]
    return d["correctedText"], f"{len(d.get('corrections', []))} corrections"


def checked_body(token, body):
    corrected, info = correct(token, body)
    if corrected is None:
        return None, f"correction IA en echec ({info})"
    extra = added_words(body, corrected)
    if extra:
        return body, f"CORRECTION ECARTEE (mots ajoutes : {' '.join(extra[:12])}) — texte d'origine livre"
    return corrected, info


def deliver(token, paper, ids, dry_run):
    hebdo_id, types, authors = ids
    if paper["type"] not in types:
        return False, f"type inconnu: {paper['type']}"
    if paper["author"] not in authors:
        return False, f"auteur sans compte: {paper['author']}"
    meta = dict(paper["metadata"])
    corrected, info = checked_body(token, meta.get("corps", ""))
    if corrected is None:
        return False, info
    meta["corps"] = corrected
    images = [os.path.join(BASE, img) for img in paper.get("images", [])]
    missing = [p for p in images if not os.path.exists(p)]
    if missing:
        return False, f"image introuvable: {missing[0]}"
    if dry_run:
        return True, f"[dry-run] {len(corrected)} signes, {len(images)} image(s), {info}"

    # --form-string et non -F : curl interprete ";", "@" et "<" dans une valeur
    # -F, ce qui tronquait silencieusement tout papier contenant un point-virgule.
    args = ["-X", "POST", "-H", f"Authorization: Bearer {token}",
            "--form-string", f"paper_type_id={types[paper['type']]}",
            "--form-string", f"hebdo_id={hebdo_id}",
            "--form-string", f"author_id={authors[paper['author']]}",
            "--form-string", f"title={paper['title']}",
            "--form-string", f"metadata={json.dumps(meta, ensure_ascii=False)}"]
    for path in images:
        mime = mimetypes.guess_type(path)[0] or "image/jpeg"
        args += ["-F", f"images=@{path};type={mime}"]
    args += ["-w", "\n%{http_code}", f"{API}/api/deliveries"]

    out = curl(args, timeout=900)
    lines = out.strip().splitlines() or ["000"]
    code, payload = lines[-1], "\n".join(lines[:-1])
    if code not in ("200", "201"):
        try:
            err = json.loads(payload).get("error", payload[:150])
        except Exception:
            err = payload[:150]
        return False, f"HTTP {code} — {err}"
    return True, f"{len(corrected)} signes, {len(images)} image(s), {info}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("papers")
    ap.add_argument("--numero", required=True)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", help="ne traiter que les papiers dont le titre contient ce texte")
    args = ap.parse_args()
    if not BASE:
        sys.exit("RS_BASE manquant (dossier HEBDOxxx)")
    papers = json.load(open(args.papers, encoding="utf-8"))
    if args.only:
        papers = [p for p in papers if args.only.lower() in p["title"].lower()]
    token = login()
    ids = resolve_ids(token, args.numero)
    ok = fail = 0
    for p in papers:
        label = f"{p['author']:18s} | {p['type']:24s} | {p['title'][:38]:38s}"
        success, detail = deliver(token, p, ids, args.dry_run)
        print(f"{'OK  ' if success else 'ECHEC'} {label} -> {detail}", flush=True)
        ok, fail = (ok + 1, fail) if success else (ok, fail + 1)
    print(f"\n{ok} {'verifie(s)' if args.dry_run else 'livre(s)'}, {fail} echec(s)")


if __name__ == "__main__":
    main()
