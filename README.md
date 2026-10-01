# RS Hebdo Delivery

Plateforme interne de **Rolling Stone France** pour la remise des papiers journalistes.

## Qu'est-ce que c'est ?

RS Hebdo Delivery couvre l'intégralité du cycle de vie d'un papier journalistique :

1. **Saisie** — Le journaliste remplit un formulaire structuré selon le type de papier (chronique, interview, disque de la semaine, etc.)
2. **Correction IA** — Le texte est envoyé au moteur IA choisi par l'admin (Claude d'Anthropic par défaut, Gemini ou Mistral) pour correction orthographique et stylistique. Le journaliste voit les corrections en diff et les accepte ou modifie
3. **Génération DOCX** — Un fichier Word formaté est généré automatiquement
4. **Dépôt Dropbox** — Le DOCX et les images (originaux) sont déposés dans l'arborescence Dropbox de la rédaction, organisée par hebdo et type de papier
5. **Notification** — Un email est envoyé à la rédaction en chef avec un lien vers le dossier Dropbox
6. **WordPress (optionnel)** — En parallèle, l'article est mis en forme selon les conventions de rollingstone.fr et créé en **brouillon** `[EN ATTENTE DE RELECTURE]` avec image à la une, photos, catégories, tags et Yoast

L'interface admin permet de gérer les numéros hebdo, les types de papier, les comptes journalistes (dont la réinitialisation 2FA), de consulter les logs, de livrer ou réattribuer un papier au nom d'un journaliste, de renvoyer un papier vers WordPress, et de modifier le prompt IA, le moteur et le modèle IA, le module WordPress et les clés API sans redéployer.

## Stack technique

| Couche | Technologie |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS 4, Zustand, React Router 7 |
| **Backend** | Node.js 20, Express 5, TypeScript 6 |
| **Base de données** | Supabase (PostgreSQL + Auth + MFA TOTP optionnel + RLS) |
| **Stockage fichiers** | Dropbox API v2 |
| **Correction IA** | Anthropic Claude (modèle choisi dans l'admin, défaut `claude-sonnet-4-5-20250929`), Google Gemini ou Mistral ; Claude Code CLI en secours local |
| **Publication** | WordPress REST API + mu-plugin `rs-delivery/v1` (rollingstone.fr, WP Engine) ; images via `sharp` |
| **Génération DOCX** | docx (npm) |
| **Email** | Resend API |
| **Déploiement** | Railway (Nixpacks) — projet `hebdo-rs` |

Architecture **monorepo** : en production, Express sert l'API ET le frontend compilé depuis un seul service Railway.

## Comptes externes à créer

Avant de pouvoir lancer le projet, il faut créer des comptes sur ces 5 services :

| Service | Pourquoi | Inscription | Variable(s) `.env` |
|---|---|---|---|
| **Supabase** | Base de données + authentification utilisateurs | https://supabase.com | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` |
| **Anthropic** | Correction IA des textes via Claude | https://console.anthropic.com | `ANTHROPIC_API_KEY` |
| **Dropbox** | Stockage des DOCX et images livrés | https://www.dropbox.com/developers/apps | `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN` |
| **Resend** | Notifications email à la rédaction | https://resend.com | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| **Railway** | Hébergement production | https://railway.app | — |

## Quickstart

```bash
# 1. Cloner et installer
git clone <repo-url>
cd rs-hebdo-delivery
npm ci

# 2. Configurer les variables d'environnement
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# → Remplir chaque .env avec les valeurs des services ci-dessus

# 3. Initialiser la base de données
# → Exécuter supabase-schema.sql dans Supabase SQL Editor, puis les 7 migrations
#    de supabase/migrations/ dans l'ordre (ou `supabase db push`)
# → Créer un user admin dans Supabase Auth, puis insérer son profil :
#    INSERT INTO profiles (id, email, full_name, role)
#    VALUES ('<uuid>', 'admin@rollingstone.fr', 'Admin', 'admin');

# 4. Lancer en développement
npm run dev
# Backend : http://localhost:3005
# Frontend : http://localhost:5173
```

## Documentation complète

| Document | Contenu |
|---|---|
| **[DOCUMENTATION.md](DOCUMENTATION.md)** | Architecture, API (tous les endpoints), schéma BDD, déploiement Railway, sécurité, troubleshooting |
| **[TUTO-JOURNALISTE.md](TUTO-JOURNALISTE.md)** | Guide d'utilisation pas-à-pas pour les journalistes |
| **[FAQ-JOURNALISTE.md](FAQ-JOURNALISTE.md)** | Questions fréquentes journalistes |
| **[docs/security/audit-2026-09-04.md](docs/security/audit-2026-09-04.md)** | Audit sécurité (statique + tests live), ordre de correction |
| **[scripts/wp/INSTALLATION.md](scripts/wp/INSTALLATION.md)** | Note pour le développeur de rollingstone.fr : installation du mu-plugin |
| **[supabase-schema.sql](supabase-schema.sql)** + `supabase/migrations/` | Schéma BDD (tables, RLS, seed) — les migrations font foi |

## Structure du projet

```
rs-hebdo-delivery/
├── backend/             # API Express + TypeScript
│   ├── src/
│   │   ├── routes/      # auth, deliveries, admin, correction, setup
│   │   ├── services/    # correction (claude/gemini/mistral/claudeCode), docx, dropbox,
│   │   │                #  email, logger, hebdoRotation, mfaPolicy, imageResize,
│   │   │                #  wordpress, wordpressPublisher, wordpressRules
│   │   ├── middleware/   # auth JWT (+ AAL2 si 2FA), admin role check
│   │   ├── meta/        # provenance.ts (marqueur de paternité, généré)
│   │   └── utils/       # client Supabase, dates
│   └── .env.example
├── frontend/            # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/       # Login, Mfa, Dashboard, DeliveryForm, Admin (7 onglets)
│   │   ├── components/  # Layout, ProtectedRoute
│   │   ├── services/    # Couche HTTP Axios
│   │   ├── stores/      # Zustand auth store (+ état 2FA)
│   │   └── lib/         # client Supabase, provenance.ts
│   └── .env.example
├── supabase/
│   ├── config.toml      # Config locale (TOTP activé)
│   └── migrations/      # 7 migrations SQL (source de vérité)
├── scripts/
│   ├── build-guide.py   # Guide journaliste -> frontend/public/guide.html
│   ├── livrer_hebdo.py  # Livraison en lot via l'API
│   ├── wpe              # CLI WP Engine (SSH/WP-CLI, webhooks, API)
│   ├── wp/              # mu-plugin WordPress + note d'installation
│   └── authorship/      # sign.mjs / verify.mjs (paternité Ed25519)
├── docs/security/       # Audit sécurité
├── supabase-schema.sql  # Schéma BDD historique + seed
├── nixpacks.toml        # Config build Railway
├── .railwayignore       # Exclusions de `railway up` (HEBDO*/, node_modules, dist…)
├── DOCUMENTATION.md     # Doc technique complète
├── TUTO-JOURNALISTE.md  # Guide journaliste
└── FAQ-JOURNALISTE.md   # FAQ journaliste
```

Les dossiers `HEBDO<numéro>/` (papiers et visuels de la semaine) et `macos/` (app desktop) restent locaux : exclus de git et du déploiement.

## Module WordPress

Activable depuis l'admin (Paramètres → WordPress). Chaque livraison crée un **brouillon** sur rollingstone.fr : mise en forme par Claude selon `wordpressRules.ts`, image à la une normalisée 1280 × 853, photos insérées dans le corps, catégories, tags, Yoast. Ce que WordPress refuse d'enregistrer est listé dans `wp_payload.editorTodo` et affiché en pastille ambre dans l'onglet Livraisons. Un échec ne bloque jamais la livraison : email d'alerte aux admins, renvoi en un clic (icône globe).

Côté site, le mu-plugin `scripts/wp/rs-delivery-rest-meta.php` expose les métas Yoast en REST et les routes `rs-delivery/v1/post-meta/{id}`. **Il est installé sur rollingstone.fr** (vérifié le 30/09/2026). Reste à renseigner le réglage `WP_META_MAP` (clés Style Music, Main Music Artist, Reviewer) pour que ces trois champs partent aussi — voir `DOCUMENTATION.md` §7 étape 10.

## Double authentification

2FA TOTP optionnelle, pilotée depuis l'admin (`REQUIRE_MFA`) ou verrouillée par la variable d'environnement `REQUIRE_MFA=true`. Quand elle est active, toute l'API exige un JWT AAL2 ; un admin peut réinitialiser la 2FA d'un compte (Journalistes → bouclier barré). Prérequis : TOTP activé sur le projet Supabase.

## Récapitulatif mensuel

Le 1er de chaque mois à 8 h (Paris), l'app envoie à la rédaction en chef un PDF récapitulant les livraisons du mois écoulé, journaliste par journaliste (numéro, format, titre, date, signes). Téléchargement et envoi manuel depuis l'admin, onglet Hebdo. Détails : `DOCUMENTATION.md`, section `services/monthlyRecap.ts`.

## Scripts

| Script | Usage |
|---|---|
| `python3 scripts/build-guide.py` | Régénère `frontend/public/guide.html` (carte « Guide écrit pas-à-pas » du tableau de bord) à partir de `TUTO-JOURNALISTE.md`. À relancer et commiter après chaque modification du tuto (`pip install markdown`) |
| `scripts/livrer_hebdo.py <papiers.json>` | Livraison en lot d'un hebdo : correction IA puis `POST /api/deliveries` avec `author_id`, images en original. Variables `RS_ADMIN_PASSWORD`, `RS_HEBDO_ID`, `RS_BASE` |
| `scripts/wpe <commande>` | CLI WP Engine : `wp` (WP-CLI via SSH), `ssh`, `taxonomy`, `rebuild`, `purge`, `api`, `doctor`… Config dans `~/.config/wpe/rs.env` (chmod 600), aucun secret dans le script |
| `node scripts/authorship/sign.mjs` | Signe l'empreinte des sources (clé privée hors dépôt) et régénère les fichiers `provenance.ts` |
| `node scripts/authorship/verify.mjs <fichier\|dossier>` | Vérifie un marqueur de paternité (sources, `dist/` ou bundle en prod) |

## Sécurité — à savoir avant d'intervenir

Détails complets dans `DOCUMENTATION.md` §12 et dans l'audit `docs/security/audit-2026-09-04.md`. Points essentiels pour un dev / une mise en ligne :

- **RLS Supabase actuellement non fonctionnelle** (récursion `42P17` sur `profiles`, fail-closed). Ne **jamais** corriger par `DISABLE ROW LEVEL SECURITY` : la clé anon est publique, ça ouvrirait la base. Correctif : `REVOKE` sur les tables sensibles **puis** `is_admin()` `SECURITY DEFINER` (voir §12).
- **Secrets** : préférer les variables d'environnement Railway au stockage en clair dans `app_settings`. Le mot de passe applicatif WordPress est déjà en variable Railway (`WORDPRESS_APP_PASSWORD`).
- **WordPress** : URL validée anti-SSRF (HTTPS, IP publique), articles toujours en brouillon, header `Authorization` jamais loggé. `POST /api/deliveries` n'a pas de rate limit dédié (point ouvert de l'audit).
- La sécurité effective repose sur le backend (JWT validé serveur, AAL2 si 2FA, rôle lu en base, filtrage par `author_id`), qui est fonctionnel.
