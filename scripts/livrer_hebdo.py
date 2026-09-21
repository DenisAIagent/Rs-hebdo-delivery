#!/usr/bin/env python3
"""
Livraison des papiers de l'hebdo via l'API RS Hebdo Delivery.

Meme chemin serveur que l'interface : correction IA (/api/correct) puis
livraison multipart (/api/deliveries) avec author_id, ce qui attribue le papier
au bon journaliste. Les images partent en original (limite serveur : 60 Mo).
"""
import json, os, subprocess, sys, mimetypes

API = "https://hebdo-rs.up.railway.app"
SUPA = "https://bhjawmrwmpajihtxuwnl.supabase.co"
PUB = "sb_publishable_p0bgxhrWY_5j9UGIdCBCQA_ks4EgNt_"
HEBDO_ID = os.environ.get("RS_HEBDO_ID", "68605e96-0043-4b5c-80ad-f8e72426a19d")
BASE = os.environ.get("RS_BASE", "/Users/denisadam/Downloads/05_1-3mois/_projets/Rolling Stone ToolKit/Rs-hebdo-delivery-master/HEBDO4septembre")

TYPES = {
    "Sujet de couv": "12b10247-d95c-439d-80bc-98c69f040b9a",
    "Interview 3000": "bd194f1d-ddcc-4917-bd31-506293b806c3",
    "Disque de la semaine": "2f76119d-5ce3-439f-af9b-d32e049c579f",
    "Chroniques": "010c6d3a-680f-4047-bc50-5355db795a1b",
    "Chronique Cinema": "b995b44e-b677-4f60-ad26-4f1f05bcafa2",
    "Chronique Coup de Coeur": "a520d21a-2d16-4621-a742-8f87f1a98dd5",
    "Frenchie": "f271fe21-1294-4af5-be6c-aec749371220",
    "Livres et Expo": "94306ea9-a1d0-48a3-af04-80760e542d09",
    "Live report": "0ae9d99e-fc2b-4453-9f25-b8131a84146e",
}
AUTHORS = {
    "Alma Rota": "3f70c0af-16dd-445f-9fc4-991f7988244a",
    "Belkacem Bahlouli": "03c8b47e-b1e3-4797-9b23-188a75336457",
    "Denis Adam": "f6679ae0-d3fb-48e3-9b40-12cdc294f3e5",
    "Loraine Adam": "115127c3-cd42-4722-83fe-922d9cd8b448",
    "Mathieu David": "5d27b744-4035-470f-96c9-02862afd4d68",
    "Samuel Regnard": "3e4ff0bf-e107-476a-b8e1-42d75fdf45ef",
    "Silvère Vincent": "58f3ff3b-03e8-46c0-9527-f218d3e75c60",
    "Xavier Bonnet": "8cf00e18-5176-49d9-8b78-5b94e177c825",
}

def curl(args, timeout=600):
    r = subprocess.run(["curl", "-s", "--max-time", str(timeout), *args], capture_output=True, text=True)
    return r.stdout

def login():
    pwd = os.environ.get("RS_ADMIN_PASSWORD")
    if not pwd:
        sys.exit("RS_ADMIN_PASSWORD manquant dans l'environnement")
    out = curl(["-X", "POST", "-H", f"apikey: {PUB}", "-H", "Content-Type: application/json",
                "-d", json.dumps({"email": "denis@mdmcmusicads.com", "password": pwd}),
                f"{SUPA}/auth/v1/token?grant_type=password"])
    tok = json.loads(out).get("access_token")
    if not tok:
        sys.exit("Authentification impossible")
    return tok

def correct(token, text):
    """Correction IA, comme l'etape 3 de l'interface. Renvoie le texte corrige."""
    out = curl(["-X", "POST", "-H", f"Authorization: Bearer {token}", "-H", "Content-Type: application/json",
                "-d", json.dumps({"text": text}), f"{API}/api/correct"], timeout=300)
    try:
        d = json.loads(out)
    except json.JSONDecodeError:
        return None, f"reponse illisible: {out[:150]}"
    if not d.get("correctedText"):
        return None, d.get("error") or str(d)[:150]
    return d["correctedText"], f"{len(d.get('corrections', []))} corrections"

def title_for(type_name, meta):
    if type_name in ("Sujet de couv", "Interview 3000", "Chroniques"):
        return meta.get("artiste", "")
    if type_name == "Disque de la semaine":
        return meta.get("album") or meta.get("artiste", "")
    return meta.get("artiste", "")

def deliver(token, paper):
    meta = dict(paper["metadata"])
    body = meta.get("corps", "")
    corrected, info = correct(token, body)
    if corrected is None:
        return False, f"correction IA en echec ({info})"
    meta["corps"] = corrected

    # --form-string et non -F : curl interprete ";", "@" et "<" dans une valeur
    # -F, ce qui tronquait silencieusement tout papier contenant un point-virgule.
    args = ["-X", "POST", "-H", f"Authorization: Bearer {token}",
            "--form-string", f"paper_type_id={TYPES[paper['type']]}",
            "--form-string", f"hebdo_id={HEBDO_ID}",
            "--form-string", f"author_id={AUTHORS[paper['author']]}",
            "--form-string", f"title={title_for(paper['type'], meta)}",
            "--form-string", f"metadata={json.dumps(meta, ensure_ascii=False)}"]
    for img in paper.get("images", []):
        path = os.path.join(BASE, img)
        if not os.path.exists(path):
            return False, f"image introuvable: {img}"
        mime = mimetypes.guess_type(path)[0] or "image/jpeg"
        args += ["-F", f"images=@{path};type={mime}"]
    args += ["-w", "\n%{http_code}", f"{API}/api/deliveries"]

    out = curl(args, timeout=900)
    code = out.strip().splitlines()[-1]
    payload = "\n".join(out.strip().splitlines()[:-1])
    if code not in ("200", "201"):
        try:
            err = json.loads(payload).get("error", payload[:150])
        except Exception:
            err = payload[:150]
        return False, f"HTTP {code} — {err}"
    return True, f"{len(corrected)} signes, {len(paper.get('images', []))} image(s), {info}"

def main():
    papers = json.load(open(sys.argv[1], encoding="utf-8"))
    token = login()
    ok = fail = 0
    for p in papers:
        label = f"{p['author']:18s} | {p['type']:24s} | {title_for(p['type'], p['metadata'])[:38]:38s}"
        success, detail = deliver(token, p)
        print(f"{'OK  ' if success else 'ECHEC'} {label} -> {detail}", flush=True)
        ok, fail = (ok + 1, fail) if success else (ok, fail + 1)
    print(f"\n{ok} livre(s), {fail} echec(s)")

if __name__ == "__main__":
    main()
