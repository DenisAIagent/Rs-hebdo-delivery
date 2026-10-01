# RS Hebdo Delivery — Documentation Technique

**Version** : 1.3.0  
**Date** : 2026-09-30  
**Auteur** : Documentation générée à partir du code source (état du dépôt au commit `3e63e25`, 27 septembre 2026)

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture](#2-architecture)
   - 2b. [Installation et lancement — Guide complet pour développeurs](#2b-installation-et-lancement--guide-complet-pour-développeurs)
3. [Structure du projet](#3-structure-du-projet)
4. [Configuration et variables d'environnement](#4-configuration-et-variables-denvironnement)
5. [Base de données](#5-base-de-données)
6. [API Backend — Référence complète des endpoints](#6-api-backend--référence-complète-des-endpoints)
7. [Flux de livraison](#7-flux-de-livraison)
8. [Administration](#8-administration)
9. [Services internes](#9-services-internes)
10. [Frontend](#10-frontend)
11. [Déploiement Railway](#11-déploiement-railway)
12. [Sécurité](#12-sécurité)
13. [Troubleshooting](#13-troubleshooting)
14. [Glossaire](#14-glossaire)

---

## 1. Vue d'ensemble

RS Hebdo Delivery est la plateforme interne de Rolling Stone France qui gère la remise des papiers par les journalistes. L'outil couvre l'intégralité du cycle de vie d'un papier : saisie du contenu dans un formulaire structuré par type de papier, correction orthographique et stylistique automatisée par IA (Claude d'Anthropic par défaut, Gemini ou Mistral au choix de l'admin), génération du fichier DOCX formaté, dépôt dans Dropbox dans la bonne arborescence, notification email à la rédaction en chef et, si le module est activé, création d'un **brouillon WordPress** sur rollingstone.fr.

### Acteurs principaux

| Acteur | Rôle |
|---|---|
| Journaliste | Remise des papiers via le formulaire, consultation de ses livraisons |
| Administrateur | Gestion des hebdos, types de papier, journalistes (dont réinitialisation 2FA), consultation des logs, paramétrage des clés API, du moteur IA, du module WordPress et du prompt IA ; livraison au nom d'un journaliste ; renvoi d'un papier vers WordPress |

### Flux simplifié

```
Journaliste → sélection hebdo → sélection type papier → saisie contenu
           → correction IA → review → soumission
           → génération DOCX → upload Dropbox → enregistrement BDD
           → notification email
           → (en parallèle, non bloquant) brouillon WordPress [EN ATTENTE DE RELECTURE]
```

---

## 2. Architecture

### Vue d'ensemble technique

```
┌────────────────────────────────────────────────────────────┐
│                        Railway (PaaS)                      │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Node.js 20 / Express 5                  │  │
│  │                                                      │  │
│  │  /api/*         → Routes Express (TypeScript)        │  │
│  │  /*  (fallback) → Sert le build React (dist/)        │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
          │              │              │               │              │
          ▼              ▼              ▼               ▼              ▼
   ┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────────┐
   │  Supabase  │ │  Dropbox   │ │ IA correction│ │   Resend   │ │  WordPress   │
   │ (Postgres  │ │  API v2    │ │ Claude /     │ │  (email)   │ │ rollingstone │
   │  + Auth +  │ │ (originaux)│ │ Gemini /     │ │            │ │ .fr REST +   │
   │  TOTP)     │ │            │ │ Mistral      │ │            │ │ mu-plugin    │
   └────────────┘ └────────────┘ └──────────────┘ └────────────┘ └──────────────┘
```

### Choix d'architecture : application monorepo

L'application est structurée en **monorepo** : le backend Express sert à la fois l'API et le frontend React en production. En développement, les deux serveurs tournent indépendamment (`localhost:3005` pour l'API, `localhost:5173` pour Vite).

En production (Railway), le frontend est compilé en fichiers statiques (`frontend/dist/`) qui sont servis par Express via `express.static`. Cette approche simplifie radicalement le déploiement : un seul service Railway, une seule URL, pas de proxy nginx à configurer.

### Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Frontend | React | 19.x |
| Frontend bundler | Vite | 8.x |
| Frontend CSS | Tailwind CSS | 4.x |
| Frontend state | Zustand | 5.x |
| Frontend routing | React Router | 7.x |
| Frontend HTTP | Axios | 1.x |
| Backend runtime | Node.js | >=20 |
| Backend framework | Express | 5.x |
| Backend langage | TypeScript | 6.x |
| Base de données | Supabase (PostgreSQL) | — |
| Auth | Supabase Auth (+ MFA TOTP optionnel) | — |
| Stockage fichiers | Dropbox API | v2 |
| Génération DOCX | docx (npm) | 9.x |
| IA correction (défaut) | Anthropic Claude (`@anthropic-ai/sdk` 0.80) | `claude-sonnet-4-5-20250929` par défaut, modèle choisi dans l'admin |
| IA correction (alternatives) | Google Gemini (`@google/generative-ai`), Mistral (`@mistralai/mistralai`), Claude Code CLI (local uniquement) | — |
| IA mise en forme WordPress | Anthropic Claude (même clé, même modèle) | — |
| Images WordPress | sharp | 0.34 |
| Publication | WordPress REST API (`wp/v2`) + mu-plugin `rs-delivery/v1` | — |
| Email | Resend (API) | — |
| Upload fichiers | Multer | 2.x |
| Déploiement | Railway (Nixpacks) | — |

---

## 2b. Installation et lancement — Guide complet pour développeurs

### Prérequis

- **Node.js >= 20** (vérifier avec `node -v`)
- **npm** (inclus avec Node.js)
- **Git**
- Un compte sur chaque service externe ci-dessous

### Étape 0 : Comptes à créer

| # | Service | Usage | Inscription | Ce qu'il faut récupérer |
|---|---|---|---|---|
| 1 | **Supabase** | Base de données PostgreSQL + authentification | https://supabase.com | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` |
| 2 | **Anthropic** | Correction IA via Claude | https://console.anthropic.com | `ANTHROPIC_API_KEY` (format `sk-ant-...`) |
| 3 | **Dropbox** | Stockage des DOCX et images | https://www.dropbox.com/developers/apps | `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN` |
| 4 | **Resend** | Notifications email | https://resend.com | `RESEND_API_KEY` (format `re_...`) |
| 5 | **Railway** | Hébergement production | https://railway.app | — (déploiement via CLI ou GitHub) |

---

### Étape 1 : Créer le projet Supabase

C'est la première chose à faire car tout le reste en dépend.

1. Aller sur https://supabase.com → **New Project**
2. Choisir un nom (ex. `rs-hebdo-delivery`), un mot de passe pour la base, et la région la plus proche (ex. `eu-west-1` pour la France)
3. Attendre que le projet soit provisionné (~2 min)
4. **Récupérer les clés** dans le dashboard Supabase → **Settings** → **API** :
   - **Project URL** → c'est votre `SUPABASE_URL` (format `https://xxxxxxx.supabase.co`)
   - **anon public** → c'est votre `SUPABASE_ANON_KEY` (JWT commençant par `eyJ...`)
   - **service_role** → c'est votre `SUPABASE_SERVICE_KEY` (JWT commençant par `eyJ...`)

   > **Attention** : La `service_role` key a un accès total à la base, contournant le RLS. Ne jamais l'exposer côté client.

5. **Exécuter le schéma SQL** : Aller dans **SQL Editor** → **New Query**, coller **intégralement** le contenu de `supabase-schema.sql` et exécuter. Ce script :
   - Crée les 6 tables (`profiles`, `paper_types`, `hebdo_config`, `deliveries`, `delivery_logs`, `app_settings`)
   - Active les politiques RLS sur toutes les tables
   - Insère les **8 types de papier** prédéfinis avec leur configuration de formulaire
   - Insère les **4 clés `app_settings`** vides (Anthropic, Dropbox)
   - Crée le **premier hebdo** (RSH226)

6. **Appliquer les migrations `supabase/migrations/`** (dans l'ordre chronologique des noms de fichiers) — via `supabase db push` ou en collant chaque fichier dans le SQL Editor. Elles complètent le schéma principal :

| Migration | Rôle |
|---|---|
| `20260325000000_initial_schema.sql` | Tables de base (`profiles`, `paper_types`, `hebdo_config`, `deliveries`), RLS, seed types de papier et premier hebdo |
| `20260326000000_correction_prompt.sql` | Table `correction_prompt` + prompt de correction par défaut |
| `20260520000000_ai_provider_settings.sql` | Table `app_settings` (si absente) + clés `AI_PROVIDER` (défaut `anthropic`) et `GEMINI_API_KEY` |
| `20260521000000_mistral_settings.sql` | Clé `MISTRAL_API_KEY` |
| `20260825000000_wordpress_module.sql` | Clés `WORDPRESS_*` + colonnes `wp_post_id`, `wp_post_url`, `wp_status`, `wp_payload` sur `deliveries` |
| `20260825120000_rls_logs_prompt.sql` | Table `delivery_logs` (si absente) + RLS admin sur `delivery_logs` et `correction_prompt` |
| `20260903000000_mfa_toggle.sql` | Clé `REQUIRE_MFA` (défaut `false`) |

   > **Attention** : les noms des types de papier de la migration initiale ont été alignés sur la production le 30/09/2026, mais seul `supabase-schema.sql` contient un `fields_config` de départ, et il est en retard sur la base réelle (photos obligatoires, étoiles Frenchie…). En cas de doute, la base de production fait foi : lire `fields_config` en direct via `GET /api/deliveries/paper-types`, jamais dans un seed.

6b. **Activer le TOTP côté Supabase** (nécessaire seulement si vous comptez activer la 2FA depuis l'admin) : Dashboard → Authentication → MFA → TOTP. En local, `supabase/config.toml` l'active déjà (`[auth.mfa.totp] enroll_enabled = true`).

7. **Créer le premier compte administrateur** :
   - Dans Supabase → **Authentication** → **Users** → **Add User** (email + mot de passe)
   - Puis insérer le profil admin dans le SQL Editor :

```sql
INSERT INTO profiles (id, email, full_name, role)
VALUES ('<uuid-copié-depuis-auth>', 'admin@rollingstone.fr', 'Admin', 'admin');
```

8. **Configurer le reset de mot de passe** (optionnel mais recommandé) :
   - Supabase → **Authentication** → **URL Configuration**
   - Définir **Site URL** : `https://votre-app.railway.app` (ou `http://localhost:5173` en dev)
   - Ajouter dans **Redirect URLs** : `https://votre-app.railway.app/reset-password`
   - Cela permet au flux "Mot de passe oublié" de fonctionner (voir section 10)

---

### Étape 2 : Cloner et installer le projet

```bash
git clone <repo-url>
cd rs-hebdo-delivery
npm ci    # installe les dépendances racine + backend + frontend (via postinstall)
```

### Étape 3 : Configurer les variables d'environnement

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Remplir chaque `.env` avec les valeurs obtenues des services ci-dessus. Voir la **section 4** pour le détail de chaque variable.

**Variables critiques à configurer immédiatement** :
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` (obtenues à l'étape 1)
- `SETUP_SECRET_TOKEN` : générer une chaîne aléatoire (ex. `openssl rand -hex 32`). Ce token sécurise l'endpoint de configuration initiale `/api/setup/configure` (voir section 6)
- `FRONTEND_URL` : `http://localhost:5173` en dev

Les clés Anthropic, Dropbox et Resend peuvent être configurées plus tard via l'interface setup ou l'admin. Les réglages WordPress, le moteur IA, le modèle Claude et la 2FA se pilotent uniquement depuis l'admin (table `app_settings`), avec fallback sur les variables d'environnement pour les secrets.

### Étape 4 : Lancement en développement

```bash
npm run dev
```

Démarre simultanément :
- **Backend Express** : http://localhost:3005
- **Frontend Vite** : http://localhost:5173

### Étape 5 : Configuration initiale via le Setup Wizard

Au premier lancement, si les clés API (Anthropic, Dropbox) ne sont pas configurées ni dans les variables d'environnement ni dans la table `app_settings`, l'application affiche automatiquement un **assistant de configuration** (`SetupPage`) au lieu de l'écran de connexion.

Le setup wizard demande les 4 clés obligatoires :
- `ANTHROPIC_API_KEY`
- `DROPBOX_APP_KEY`
- `DROPBOX_APP_SECRET`
- `DROPBOX_REFRESH_TOKEN`

L'endpoint `POST /api/setup/configure` est protégé par le header `X-Setup-Token` qui doit correspondre à la variable d'environnement `SETUP_SECRET_TOKEN`. Une fois l'application configurée, cet endpoint est verrouillé (retourne `403`). Les clés peuvent ensuite être modifiées via l'onglet Settings de l'admin.

### Étape 6 : Déploiement sur Railway (production)

1. Créer un compte sur https://railway.app
2. **Nouveau projet** → choisir "Deploy from GitHub repo" ou utiliser la CLI `railway`
3. Railway détecte automatiquement le `nixpacks.toml` et configure le build
4. **Configurer les variables d'environnement** dans Railway → Variables (voir section 11 pour la liste complète)
5. Déployer :

```bash
# Via CLI
railway up
```

6. Récupérer l'URL publique (format `https://xxx.railway.app`) et la configurer :
   - Mettre cette URL dans `FRONTEND_URL` sur Railway
   - Mettre cette URL dans les **Redirect URLs** de Supabase (voir étape 1.8)

7. Le fichier `.railwayignore` à la racine exclut de l'envoi tout ce que Nixpacks ne compile pas (`node_modules/`, `dist/`, dossiers de travail `HEBDO*/`, `macos/`, `.env`). Sans lui, `railway up` téléversait ~90 Mo de visuels et expirait avant le début du build.

### Build et lancement production (hors Railway)

```bash
npm run build    # compile frontend (Vite → dist/) + backend (tsc → dist/)
npm start        # lance Express qui sert l'API + le frontend statique
```

---

## 3. Structure du projet

```
rs-hebdo-delivery/
├── package.json              # Monorepo root — scripts build/start/dev
├── nixpacks.toml             # Build Railway
├── .railwayignore            # Exclusions de `railway up` (node_modules, dist, HEBDO*/, macos/, .env)
├── .gitignore                # Exclut aussi macos/ (app desktop, secrets bakés) et HEBDO*/ (papiers de la semaine)
├── supabase-schema.sql       # Schéma historique complet (voir §5 : les migrations font foi)
├── DOCUMENTATION.md          # Ce fichier
├── README.md / TUTO-JOURNALISTE.md / FAQ-JOURNALISTE.md
│
├── docs/
│   └── security/
│       └── audit-2026-09-04.md   # Audit sécurité (statique + live) — référence pour §12
│
├── supabase/
│   ├── config.toml           # Config locale Supabase (TOTP activé)
│   └── migrations/           # 7 migrations SQL, source de vérité du schéma (liste en §2b étape 6)
│
├── scripts/
│   ├── build-guide.py        # Génère frontend/public/guide.html (guide journaliste) depuis TUTO-JOURNALISTE.md
│   ├── livrer_hebdo.py       # Livraison en lot d'un hebdo via l'API (correction IA puis POST /api/deliveries)
│   ├── wpe                   # CLI maison WP Engine : WP-CLI via SSH, webhooks headless, API REST v1
│   ├── wp/
│   │   ├── rs-delivery-rest-meta.php   # mu-plugin WordPress (metas Yoast en REST + routes rs-delivery/v1)
│   │   └── INSTALLATION.md             # Note pour le développeur du site
│   └── authorship/
│       ├── sign.mjs          # Signe l'empreinte des sources (Ed25519) → fichiers provenance.ts
│       └── verify.mjs        # Vérifie un marqueur de paternité (sources, dist ou bundle en prod)
│
├── HEBDO<numéro>/            # Dossiers de travail locaux (papiers + visuels d'un numéro) — jamais versionnés
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── index.ts          # Point d'entrée Express, middlewares globaux, BIND_HOST
│       ├── meta/
│       │   └── provenance.ts # Marqueur de paternité signé (généré, ne pas éditer)
│       ├── middleware/
│       │   ├── auth.ts       # Vérification JWT Supabase + niveau AAL2 si 2FA requise
│       │   └── admin.ts      # Vérification rôle admin
│       ├── routes/
│       │   ├── auth.ts       # GET /api/auth/config (public), GET /api/auth/profile
│       │   ├── deliveries.ts # CRUD livraisons journalistes (déclenche le pipeline WordPress)
│       │   ├── admin.ts      # CRUD admin (types, hebdos, journalistes + reset 2FA, livraisons, logs, prompt, settings, WordPress, modèles)
│       │   ├── correction.ts # POST /api/correct
│       │   └── setup.ts      # GET /api/setup/status, POST /api/setup/configure
│       ├── services/
│       │   ├── correction.ts       # Aiguillage vers le moteur IA actif (AI_PROVIDER)
│       │   ├── correctionPrompt.ts # Prompt de correction (BDD + fallback), marqueurs de lignes vides
│       │   ├── claude.ts           # Anthropic : correction (sortie structurée), liste live des modèles
│       │   ├── gemini.ts           # Google Gemini : correction (cascade de modèles)
│       │   ├── mistral.ts          # Mistral : correction (cascade de modèles)
│       │   ├── claudeCode.ts       # Claude Code CLI local (secours hors production)
│       │   ├── docx.ts             # Génération du fichier DOCX
│       │   ├── dropbox.ts          # Dropbox API v2 : upload, réattribution, relecture des images
│       │   ├── email.ts            # Notifications Resend (livraison, échec WordPress)
│       │   ├── deliveryLogger.ts   # Logs structurés en base Supabase
│       │   ├── hebdoRotation.ts    # Rotation automatique des hebdos (cron interne)
│       │   ├── mfaPolicy.ts        # Politique 2FA (REQUIRE_MFA), cache 30 s
│       │   ├── imageResize.ts      # Dérivés JPEG pour WordPress (image à la une 1280×853, corps ≤ 1600 px)
│       │   ├── wordpress.ts        # Client REST WordPress (anti-SSRF, médias, tags, brouillons, metas)
│       │   ├── wordpressPublisher.ts # Pipeline complet de publication en brouillon + editorTodo
│       │   └── wordpressRules.ts   # Conventions éditoriales, taxonomie, Style Music, prompt IA WordPress
│       └── utils/
│           ├── dates.ts      # Fenêtres vendredi → vendredi des hebdos
│           └── supabase.ts   # Client Supabase (admin + user)
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── .env.example
    └── src/
        ├── main.tsx          # Point d'entrée React (référence PROVENANCE)
        ├── App.tsx           # Routeur principal
        ├── types/
        │   └── index.ts      # Tous les types TypeScript partagés
        ├── lib/
        │   ├── supabase.ts   # Client Supabase frontend (auth uniquement)
        │   └── provenance.ts # Marqueur de paternité signé (généré, ne pas éditer)
        ├── stores/
        │   └── authStore.ts  # Store Zustand — état d'authentification + état 2FA
        ├── services/
        │   └── api.ts        # Couche HTTP (Axios) vers le backend
        ├── components/
        │   ├── Layout.tsx    # Shell de l'application (nav, sidebar)
        │   └── ProtectedRoute.tsx # HOC de protection des routes (redirige vers /mfa si besoin)
        └── pages/
            ├── LoginPage.tsx
            ├── MfaPage.tsx            # Saisie du code TOTP ou enrôlement (QR code)
            ├── ForgotPasswordPage.tsx # Formulaire "Mot de passe oublié"
            ├── ResetPasswordPage.tsx  # Formulaire de réinitialisation (via lien email)
            ├── OnboardingPage.tsx     # Tutoriel interactif 5 étapes (premier login)
            ├── SetupPage.tsx          # Assistant de configuration initiale
            ├── DashboardPage.tsx
            ├── DeliveryFormPage.tsx   # Formulaire multi-étapes de livraison
            └── admin/
                ├── AdminPage.tsx      # Shell de l'admin (onglets)
                ├── PaperTypesTab.tsx
                ├── HebdoTab.tsx
                ├── JournalistsTab.tsx # + réinitialisation 2FA d'un compte
                ├── DeliveriesTab.tsx  # + envoi/renvoi WordPress (globe), pastille "à finir dans l'éditeur"
                ├── PromptTab.tsx
                ├── LogsTab.tsx
                └── SettingsTab.tsx    # Moteur IA, modèle Claude, 2FA, WordPress, clés API
```

Le dossier `macos/` (application desktop Electron) existe en local mais est exclu du dépôt et du déploiement : il embarque des secrets et ne joue aucun rôle sur Railway.

---

## 4. Configuration et variables d'environnement

### Variables backend (fichier `.env` à la racine de `backend/`)

#### `SUPABASE_URL`
- **Description** : URL de votre projet Supabase
- **Format** : `https://<project-ref>.supabase.co`
- **Comment l'obtenir** : Tableau de bord Supabase → Settings → API → Project URL
- **Requis** : Oui

#### `SUPABASE_SERVICE_KEY`
- **Description** : Clé de service Supabase (contourne les politiques RLS — ne jamais exposer côté client)
- **Format** : JWT long commençant par `eyJ...`
- **Comment l'obtenir** : Tableau de bord Supabase → Settings → API → `service_role` key
- **Requis** : Oui
- **Attention** : Cette clé a un accès total à la base. Elle doit uniquement être utilisée côté serveur.

#### `SUPABASE_ANON_KEY`
- **Description** : Clé publique Supabase (respecte les politiques RLS)
- **Format** : JWT long commençant par `eyJ...`
- **Comment l'obtenir** : Tableau de bord Supabase → Settings → API → `anon` key
- **Requis** : Oui (utilisée dans `createSupabaseClient()` pour les opérations utilisateur)

#### `ANTHROPIC_API_KEY`
- **Description** : Clé API Anthropic pour la correction de texte via Claude
- **Format** : `sk-ant-...`
- **Comment l'obtenir** : https://console.anthropic.com → API Keys
- **Requis** : Oui pour la correction automatique (l'application reste fonctionnelle sans elle, mais la correction est désactivée)
- **Note** : Cette clé peut aussi être stockée dans la table `app_settings` de Supabase et mise à jour via l'interface admin. La clé en variable d'environnement est utilisée si la table ne contient pas de valeur.
- **Usage** : correction de texte (si `AI_PROVIDER = anthropic`) **et** mise en forme des articles WordPress (toujours Claude, quel que soit le moteur de correction choisi).

#### `CLAUDE_MODEL`
- **Description** : Identifiant du modèle Claude utilisé pour la correction et la mise en forme WordPress
- **Format** : `claude-sonnet-4-5-20250929`, `claude-opus-4-1-...`
- **Priorité** : `app_settings.CLAUDE_MODEL` (choisi dans l'admin, liste live via `GET /api/admin/models`) → variable d'environnement → `DEFAULT_CLAUDE_MODEL` codé en dur (`claude-sonnet-4-5-20250929`)
- **Requis** : Non. Si le modèle configuré n'existe plus, le backend bascule sur le modèle par défaut à la seconde tentative.

#### `GEMINI_API_KEY`
- **Description** : Clé Google AI Studio, utilisée uniquement si `AI_PROVIDER = gemini`
- **Format** : `AIza...`
- **Priorité** : `app_settings` puis variable d'environnement
- **Requis** : Non (seulement si Gemini est le moteur actif)

#### `MISTRAL_API_KEY`
- **Description** : Clé Mistral, utilisée uniquement si `AI_PROVIDER = mistral`
- **Priorité** : `app_settings` puis variable d'environnement
- **Requis** : Non (seulement si Mistral est le moteur actif)

#### `CLAUDE_CODE_BIN` / `CLAUDE_CODE_MODEL`
- **Description** : Chemin du binaire `claude` (défaut `claude`) et alias de modèle (défaut `sonnet`) utilisés par le moteur `claude-code`. Ce moteur lance la CLI Claude Code sur la machine hôte (authentification OAuth de l'abonnement, `ANTHROPIC_API_KEY` volontairement retirée de l'environnement du process).
- **Requis** : Non. **Ne fonctionne pas sur Railway** (le binaire n'est pas installé) : moteur de secours local uniquement, signalé comme tel dans l'admin.

#### `REQUIRE_MFA`
- **Description** : Verrou serveur de la double authentification TOTP. `true` force la 2FA quel que soit le réglage `app_settings.REQUIRE_MFA` piloté depuis l'admin. Toute autre valeur (ou absence) laisse la main au réglage admin.
- **Requis** : Non (défaut : 2FA désactivée). Voir §12.

#### `BIND_HOST`
- **Description** : Interface d'écoute du serveur Express. Non définie (Railway) : toutes les interfaces. Définie (ex. `127.0.0.1` pour l'app desktop) : écoute restreinte, serveur injoignable depuis le réseau.
- **Requis** : Non

#### `WORDPRESS_ENABLED`, `WORDPRESS_URL`, `WORDPRESS_USERNAME`, `WORDPRESS_APP_PASSWORD`
- **Description** : Module WordPress. Ces quatre valeurs sont d'abord lues dans `app_settings` (onglet Paramètres → WordPress) puis, si vides, dans les variables d'environnement.
- **`WORDPRESS_ENABLED`** : `true`/`1` active le module ; tout le reste le désactive (skip silencieux du pipeline)
- **`WORDPRESS_URL`** : **HTTPS obligatoire** (sauf `http://localhost` en dev) ; l'hôte doit résoudre vers une IP publique, sinon `assertSafeWpUrl` refuse (anti-SSRF)
- **`WORDPRESS_USERNAME`** : compte WordPress dédié (en production `rs_delivery`, rôle `api_writer`)
- **`WORDPRESS_APP_PASSWORD`** : mot de passe application (profil WP → Mots de passe d'application). **Recommandé en variable Railway** plutôt qu'en base : c'est le cas en production, la ligne `app_settings` est vide.
- **Requis** : Non (module optionnel)

#### `WP_META_MAP` (uniquement `app_settings`)
- **Description** : JSON qui associe les trois champs éditoriaux du thème/des plugins aux clés de métadonnées WordPress réelles : `{"styleMusic":"<clé>","mainArtist":"<clé>","reviewScore":"<clé>"}`. Tant qu'une clé est vide, le champ correspondant n'est pas envoyé (aucun nom de clé n'est jamais deviné) et reste listé dans `editorTodo`.
- **Comment la remplir** : lire les métas d'un article de référence via `GET /wp-json/rs-delivery/v1/post-meta/{id}` (mu-plugin, auth par mot de passe application), repérer les clés, les saisir dans l'admin. Aucun redéploiement nécessaire.
- **État au 30/09/2026** : vide. Style Music, Main Music Artist et note Reviewer sont donc encore à finir à la main dans l'éditeur (voir §7 étape 10).

#### `AI_PROVIDER` (uniquement `app_settings`)
- **Description** : Moteur de correction actif : `anthropic` (défaut), `gemini`, `mistral` ou `claude-code`. Se change dans l'admin (Paramètres → Moteur IA). Une valeur inconnue retombe sur `anthropic`.

#### `DROPBOX_APP_KEY`
- **Description** : Identifiant de l'application Dropbox
- **Format** : Chaîne alphanumérique, ex. `abc123xyz`
- **Comment l'obtenir** : https://www.dropbox.com/developers/apps → créer une app → App key
- **Requis** : Oui

#### `DROPBOX_APP_SECRET`
- **Description** : Secret de l'application Dropbox
- **Format** : Chaîne alphanumérique
- **Comment l'obtenir** : Même page que `DROPBOX_APP_KEY` → App secret
- **Requis** : Oui

#### `DROPBOX_REFRESH_TOKEN`
- **Description** : Token OAuth2 de type `refresh_token` permettant de générer des access tokens sans interaction utilisateur
- **Format** : Longue chaîne alphanumérique
- **Comment l'obtenir** :
  1. Dans l'app Dropbox, activer le scope `files.content.write` et `files.content.read` et `sharing.write`
  2. Générer un code d'autorisation via le flux OAuth2 `offline` :  
     `https://www.dropbox.com/oauth2/authorize?client_id=<APP_KEY>&token_access_type=offline&response_type=code`
  3. Échanger le code contre un refresh token :  
     `curl -X POST https://api.dropboxapi.com/oauth2/token -d "grant_type=authorization_code&code=<CODE>" -u <APP_KEY>:<APP_SECRET>`
  4. Récupérer le champ `refresh_token` dans la réponse JSON
- **Requis** : Oui

#### `DROPBOX_ROOT_FOLDER`
- **Description** : Chemin absolu du dossier racine dans Dropbox où seront créés les dossiers des hebdos
- **Format** : Chemin Dropbox commençant par `/`, ex. `/Hebdo Delivery`
- **Valeur par défaut** : `/Hebdo Delivery` (si non définie)
- **Requis** : Non (valeur par défaut utilisée)

#### `SETUP_SECRET_TOKEN`
- **Description** : Token de sécurité requis pour l'endpoint de configuration initiale `POST /api/setup/configure`. Empêche toute personne non autorisée de configurer l'application au premier lancement.
- **Format** : Chaîne aléatoire (ex. `openssl rand -hex 32`)
- **Comment le générer** : `openssl rand -hex 32` ou tout générateur de chaîne aléatoire
- **Requis** : Oui — si absent, l'endpoint de setup retourne `403` et la configuration initiale est impossible via l'interface web. Les clés devront alors être configurées directement dans les variables d'environnement ou dans la table `app_settings` via le SQL Editor Supabase.

#### `FRONTEND_URL`
- **Description** : URL complète du frontend, utilisée pour la configuration CORS
- **Format** : `https://votre-app.railway.app` (production) ou `http://localhost:5173` (dev)
- **Requis** : Oui en production. En développement, la valeur par défaut `http://localhost:5173` est utilisée.

#### `PORT`
- **Description** : Port d'écoute du serveur Express
- **Format** : Entier, ex. `3005`
- **Valeur par défaut** : `3005`
- **Requis** : Non (Railway injecte automatiquement cette variable)

#### Variables email — Resend

Les notifications email sont envoyées via **Resend** (https://resend.com).

**Comment configurer Resend :**

1. Créer un compte gratuit sur https://resend.com (3 000 emails/mois gratuits)
2. Dans le dashboard Resend, aller dans **API Keys** → **Create API Key**
3. Copier la clé générée (format `re_...`) dans `RESEND_API_KEY`
4. *(Optionnel)* Pour envoyer depuis un domaine custom (`@rollingstone.fr`) :
   - Aller dans **Domains** → **Add Domain**
   - Ajouter les enregistrements DNS (DKIM, SPF) fournis par Resend
   - Une fois vérifié, mettre à jour `RESEND_FROM_EMAIL` avec votre domaine
5. Sans domaine custom, les emails partent depuis `onboarding@resend.dev` (suffisant pour les tests)

| Variable | Description | Exemple |
|---|---|---|
| `RESEND_API_KEY` | Clé API Resend | `re_123abc...` |
| `RESEND_FROM_EMAIL` | Adresse d'expédition | `RS Hebdo <noreply@rollingstone.fr>` |
| `NOTIFY_EMAIL_ALMA` | Destinataire 1 des notifications de livraison | `alma@rollingstone.fr` |
| `NOTIFY_EMAIL_DENIS` | Destinataire 2 des notifications de livraison | `denis@rollingstone.fr` |

- Si `RESEND_API_KEY` est absente, les emails sont silencieusement ignorés. La livraison n'échoue pas.
- Si `NOTIFY_EMAIL_ALMA` et `NOTIFY_EMAIL_DENIS` sont toutes deux vides, les emails ne sont pas envoyés et un avertissement est loggué en console.
- Les mêmes deux adresses reçoivent l'**alerte d'échec WordPress** (`notifyWordpressError`) : livraison Dropbox OK mais pas de brouillon créé, avec le détail de l'erreur et un lien vers l'app pour relancer l'envoi.

#### Configuration email depuis l'admin (depuis le 01/10/2026)

`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NOTIFY_EMAIL_ALMA` et `NOTIFY_EMAIL_DENIS` se saisissent désormais dans l'admin (Réglages → Email), stockés dans `app_settings` ; les variables d'environnement ci-dessus ne servent plus que de secours (`getEmailConfig()` dans `services/email.ts`). Seule la clé est masquée. Prérequis Resend : un compte, une clé API, et un domaine d'envoi vérifié (DNS) pour écrire à des adresses autres que celle du compte.

### Variables frontend (fichier `frontend/.env`)

#### `VITE_SUPABASE_URL`
- **Description** : URL du projet Supabase (identique à `SUPABASE_URL`)
- **Requis** : Oui — l'application lève une erreur au démarrage si absent

#### `VITE_SUPABASE_ANON_KEY`
- **Description** : Clé anonyme Supabase (identique à `SUPABASE_ANON_KEY`)
- **Requis** : Oui

#### `VITE_API_URL`
- **Description** : URL de base de l'API backend
- **Format** : `https://votre-app.railway.app` ou vide (chaîne vide)
- **Par défaut** : Chaîne vide — dans ce cas, les appels API sont relatifs à l'origine courante. C'est le comportement attendu en production puisque le backend sert le frontend.
- **En développement** : Laisser vide ou mettre `http://localhost:3005`

Le frontend ne lit **que** ces trois variables (`import.meta.env.VITE_*`). La politique 2FA n'est pas une variable de build : le frontend l'interroge au démarrage via `GET /api/auth/config`.

---

## 5. Base de données

Le schéma historique complet se trouve dans `supabase-schema.sql` ; les évolutions depuis sont dans `supabase/migrations/` (liste en §2b, étape 6), qui constituent la source de vérité. Les politiques RLS (Row Level Security) sont déclarées sur toutes les tables, mais **non fonctionnelles en l'état** (récursion, voir §12) : la protection effective est assurée par le backend.

### Table `profiles`

Extension de la table `auth.users` de Supabase. Créée automatiquement via l'API admin lors de la création d'un journaliste.

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Référence `auth.users(id)` — suppression en cascade |
| `email` | TEXT | Adresse email (dupliquée depuis auth pour facilité des jointures) |
| `full_name` | TEXT | Nom complet affiché dans l'interface et dans les DOCX |
| `role` | TEXT | `journalist` ou `admin` (contrainte CHECK) |
| `is_active` | BOOLEAN | Compte actif/désactivé. Un compte inactif est refusé au niveau du middleware auth |
| `created_at` | TIMESTAMPTZ | Date de création |

**Politiques RLS** :
- Un utilisateur peut lire uniquement son propre profil
- Un admin peut lire et gérer tous les profils

---

### Table `paper_types`

Référentiel des types de papier configuré par les admins. Chaque type définit son propre formulaire via `fields_config`.

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Identifiant |
| `name` | TEXT | Nom affiché (ex. "Disque de la semaine") |
| `sign_limit` | INTEGER | Limite en signes du corps du texte. Affiché en temps réel dans le formulaire |
| `drive_folder_name` | TEXT | Nom exact du sous-dossier créé dans Dropbox pour ce type |
| `fields_config` | JSONB | Tableau de `FieldConfig` — définit les champs du formulaire |
| `is_active` | BOOLEAN | Si `false`, le type n'apparaît pas dans le formulaire journaliste |
| `sort_order` | INTEGER | Ordre d'affichage dans les listes |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

**Structure d'un objet `FieldConfig`** :

```json
{
  "key": "corps",
  "label": "Corps du texte",
  "type": "text | textarea | url | images | stars",
  "required": true,
  "min": 3,
  "max": 5
}
```

- `key` : Identifiant de champ, utilisé comme clé dans `metadata` et pour localiser le corps du texte (`corps`)
- `type` :
  - `text` : Champ texte simple (une ligne)
  - `textarea` : Champ texte multi-lignes
  - `url` : Lien numérique, rendu en bleu souligné dans le DOCX
  - `images` : Champ de type upload d'images. `min` définit le nombre minimum requis
  - `stars` : Notation de 0 à `max` (défaut 5), affichée en `★★★☆☆` dans le DOCX
- Le champ avec `key: "corps"` est traité comme le corps principal du texte — c'est lui qui est envoyé à Claude pour correction et dont la longueur est comptée comme `sign_count`

**Types de papier prédéfinis** (données seed) :

| Nom | Limite signes | Dossier Dropbox |
|---|---|---|
| Sujet de couv | 15 000 | `Sujet de couv` |
| Interview 3000 | 3 000 | `Interview 3000` |
| Disque de la semaine | 2 500 | `Disque de la semaine` |
| Chroniques | 1 500 | `Chroniques` |
| Chronique Cinema | 1 500 | `Chronique cinema` |
| Chronique Coup de Coeur | 2 500 | `Chronique coup de coeur` |
| Frenchie | 2 500 | `frenchie` |
| Livres et Expo | 1 500 | `Livres et expo` |

---

### Table `hebdo_config`

Référentiel des numéros hebdomadaires. Un seul hebdo peut avoir `is_current = true` à la fois.

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Identifiant |
| `numero` | INTEGER | Numéro du magazine (ex. 226) |
| `label` | TEXT | Libellé calculé, toujours `RSH<numero>` (ex. `RSH226`) |
| `start_date` | DATE | Date de début de la période de remise (nullable) |
| `end_date` | DATE | Date limite de remise (nullable) |
| `is_current` | BOOLEAN | Si `true`, c'est l'hebdo actif proposé par défaut aux journalistes |
| `created_at` | TIMESTAMPTZ | — |

**Logique de sélection de l'hebdo actif** (endpoint `GET /api/deliveries/hebdos`) :
1. L'hebdo avec `is_current = true` est prioritaire
2. À défaut, le premier hebdo dont `end_date >= aujourd'hui`
3. En dernier recours, le plus récent par `numero`

**Rotation automatique** : Le service `hebdoRotation.ts` vérifie toutes les heures si `end_date` de l'hebdo courant est dépassée. Si oui, il crée automatiquement l'hebdo N+1 avec une fenêtre de 7 jours (voir section 9).

**Politiques RLS** : Lecture ouverte à tous les utilisateurs authentifiés. Écriture réservée aux admins.

---

### Table `deliveries`

Table centrale. Chaque ligne représente un papier soumis par un journaliste.

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Identifiant |
| `author_id` | UUID (FK → profiles) | Auteur |
| `hebdo_id` | UUID (FK → hebdo_config) | Numéro cible |
| `paper_type_id` | UUID (FK → paper_types) | Type de papier |
| `title` | TEXT | Titre calculé par le frontend à partir des métadonnées |
| `subject` | TEXT | Sujet principal (artiste ou album), nullable |
| `body_original` | TEXT | Corps du texte brut (avant correction) |
| `body_corrected` | TEXT | Corps du texte après correction IA. En pratique, contient le texte final intégré dans les métadonnées |
| `digital_link` | TEXT | Lien URL optionnel (champ `lien` du formulaire) |
| `image_filename` | TEXT | Liste des noms de fichiers images, séparés par une virgule |
| `metadata` | JSONB | Tous les champs du formulaire sous forme clé-valeur (artiste, album, corps, accroche, etc.) |
| `drive_folder_url` | TEXT | URL du dossier Dropbox partagé (lien cliquable dans le dashboard) |
| `status` | TEXT | `draft`, `corrected` ou `delivered` (contrainte CHECK). **En pratique, le code définit toujours `delivered` à la soumission.** Les valeurs `draft` et `corrected` sont réservées pour une future évolution (brouillons) mais ne sont pas utilisées dans le flux actuel |
| `sign_count` | INTEGER | Longueur en caractères du corps du texte |
| `created_at` | TIMESTAMPTZ | — |
| `delivered_at` | TIMESTAMPTZ | Horodatage de livraison définitive |
| `wp_status` | TEXT (nullable) | Suivi WordPress : `pending` (envoi en cours), `sent` (brouillon créé), `error` (échec, voir Logs), `NULL` (module désactivé ou jamais envoyé) — migration `20260825000000` |
| `wp_post_id` | INTEGER (nullable) | ID du brouillon WordPress |
| `wp_post_url` | TEXT (nullable) | URL d'édition du brouillon (`/wp-admin/post.php?post=…&action=edit`) |
| `wp_payload` | JSONB (nullable) | Payload complet produit par l'IA (titre, slug, chapô, HTML, catégories, tags, Yoast, `mainArtist`, `styleMusic`, `photoCredit`) enrichi par le pipeline : `featuredMediaId`, `bodyMediaIds`, `reviewScore`, `styleMusicValue`, `metaRejected` (clés refusées par WordPress) et **`editorTodo`** (liste lisible de ce qui reste à saisir dans l'éditeur) |

**Politiques RLS** :
- Un journaliste peut lire et insérer uniquement ses propres livraisons
- Un admin peut lire toutes les livraisons

**Note sur `metadata`** : Ce champ JSONB est le conteneur principal du contenu éditorial. Sa structure varie selon le `fields_config` du `paper_type`. Les champs `body_original`, `body_corrected`, `subject` et `digital_link` sont des doublons dénormalisés extraits de `metadata` pour faciliter les requêtes.

---

### Table `delivery_logs`

Logs structurés de chaque étape du pipeline de livraison. Visibles uniquement par les admins.

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Identifiant |
| `level` | TEXT | `info`, `warn` ou `error` |
| `step` | TEXT | Étape du pipeline (voir ci-dessous) |
| `message` | TEXT | Message lisible en français |
| `detail` | TEXT | Détail technique (stacktrace, réponse HTTP Dropbox, etc.) |
| `journalist_id` | UUID (FK → profiles, nullable) | Journaliste concerné |
| `journalist_name` | TEXT | Copie du nom (pour lisibilité sans jointure) |
| `hebdo_label` | TEXT | Ex. `RSH226` |
| `paper_type_name` | TEXT | Ex. `Chroniques` |
| `title` | TEXT | Titre du papier |
| `created_at` | TIMESTAMPTZ | — |

**Étapes loggées** :

| Clé `step` | Description |
|---|---|
| `start` | Démarrage de la livraison |
| `validation` | Validation des champs obligatoires |
| `docx` | Génération du fichier DOCX |
| `dropbox-auth` | Authentification Dropbox |
| `dropbox-folders` | Création/vérification des dossiers |
| `dropbox-upload` | Upload DOCX + images |
| `dropbox-link` | Création du lien partagé |
| `database` | Enregistrement en base |
| `email` | Envoi de la notification |
| `success` | Livraison complètement terminée |
| `dropbox-prepare` | Pré-création des dossiers d'un hebdo |
| `admin-reassign` | Réattribution d'une livraison à un autre journaliste |
| `wp-start` | Début de l'envoi WordPress |
| `wp-links` | Recherche des liens internes candidats (warn si impossible) |
| `wp-format` | Mise en forme IA, catégories, shortcode Reviews Box |
| `wp-tags` | Tag impossible à créer (ignoré) |
| `wp-media` | Image à la une, dérivés web, réutilisation médiathèque, doublons |
| `wp-meta` | Métas acceptées ou **refusées** par WordPress (Yoast, Style Music, Main Artist, Reviewer) |
| `wp-success` | Brouillon créé (ID + URL d'édition) |
| `wp-error` | Échec global de l'envoi (déclenche l'email d'alerte) |

**RLS** : lecture réservée aux admins (migration `20260825120000_rls_logs_prompt.sql`, qui recrée aussi la table si elle manque sur une base montée uniquement via migrations).

**Rétention** : Le code prévoit une suppression manuelle des logs de plus de 30 jours via `DELETE /api/admin/logs`. Le commentaire dans le schéma SQL mentionne une suppression automatique des logs de plus de 90 jours pouvant être activée via un cron Supabase.

---

### Table `app_settings`

Stockage des clés API et paramètres configurables par les admins depuis l'interface. Évite de devoir redéployer l'application pour changer une clé.

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Identifiant |
| `key` | TEXT (UNIQUE) | Nom du paramètre |
| `value` | TEXT | Valeur en clair (masquée dans les réponses API : seuls les 4 derniers caractères visibles). ⚠️ Stockage non chiffré — voir §12 et l'audit : préférer les variables d'environnement Railway pour les secrets. |
| `updated_at` | TIMESTAMPTZ | — |
| `updated_by` | UUID (FK → profiles, nullable) | Admin ayant effectué la dernière modification |

**Clés connues** (seed des migrations) :

| Clé | Secret ? | Rôle |
|---|---|---|
| `ANTHROPIC_API_KEY` | oui | Correction Claude + mise en forme WordPress |
| `ANTHROPIC_WORKSPACE_ID` | non | Identifiant de workspace (`wrkspc_…`) envoyé en en-tête `anthropic-workspace-id` ; obligatoire seulement si la clé a été créée au niveau de l'organisation (sinon l'API répond `This API key is not scoped to a workspace`) |
| `GEMINI_API_KEY`, `MISTRAL_API_KEY` | oui | Moteurs de correction alternatifs |
| `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN` | oui | Dropbox |
| `WORDPRESS_APP_PASSWORD` | oui | Mot de passe application WordPress (vide en prod : variable Railway) |
| `AI_PROVIDER` | non | `anthropic` / `gemini` / `mistral` / `claude-code` |
| `CLAUDE_MODEL` | non | Modèle Claude choisi dans l'admin |
| `REQUIRE_MFA` | non | `true`/`false` — 2FA imposée à tous |
| `WORDPRESS_ENABLED`, `WORDPRESS_URL`, `WORDPRESS_USERNAME` | non | Module WordPress |
| `WP_META_MAP` | non | Mapping JSON des clés de métas du thème/plugins (voir §4) |

Les clés « non secrètes » (`NON_SECRET_KEYS` dans `routes/admin.ts`) sont renvoyées en clair par `GET /api/admin/settings` ; les autres sont masquées.

**Note** : `claude.ts`, `gemini.ts`, `mistral.ts` et `getWpConfig()` (WordPress) lisent leur clé dans cette table en priorité, avec fallback sur la variable d'environnement. `mfaPolicy.ts` lit `REQUIRE_MFA` ici, sauf si la variable d'environnement `REQUIRE_MFA=true` force l'activation. Le service `dropbox.ts` utilise uniquement les variables d'environnement.

**Secrets recommandés en variables d'environnement Railway** (plutôt qu'en clair dans cette table) : `ANTHROPIC_API_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `WORDPRESS_APP_PASSWORD`. Le mot de passe applicatif WordPress **a déjà été déplacé** vers Railway (`WORDPRESS_APP_PASSWORD`), sa ligne `app_settings` est vidée. Le fallback `process.env` rend la bascule transparente pour le code.

---

### Table `correction_prompt`

Stocke le prompt système envoyé à Claude pour la correction de texte. Il n'existe qu'une seule ligne dans cette table (pattern singleton).

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Identifiant |
| `prompt_text` | TEXT | Le prompt complet envoyé à Claude |
| `updated_at` | TIMESTAMPTZ | — |
| `updated_by` | UUID (FK → profiles, nullable) | Admin ayant modifié le prompt |

**Note** : La table `correction_prompt` est créée et alimentée par la migration `20260326000000_correction_prompt.sql` (RLS admin ajoutée par `20260825120000`). Si la table est absente ou vide, `correctionPrompt.ts` utilise automatiquement le `FALLBACK_PROMPT` codé en dur. Le prompt est partagé par tous les moteurs IA (`buildSystemPrompt` y ajoute les consignes de conservation des lignes vides).

---

### Diagramme des relations

```
auth.users
    │
    └─(1:1)─► profiles ─────────────────────────────┐
                  │                                   │
                  └─(1:N)─► deliveries               │
                                │                    │ (updated_by)
                                ├─(N:1)─► paper_types│
                                │                    │
                                └─(N:1)─► hebdo_config│
                                                     │
              delivery_logs ─(N:1)─► profiles        │
              app_settings ─(N:1)──────────────────► ┘
              correction_prompt ─(N:1)─────────────► ┘
```

---

## 6. API Backend — Référence complète des endpoints

### Authentification des requêtes

Tous les endpoints sauf `/api/health`, `/api/setup/*` et `/api/auth/config` exigent un header `Authorization` :

```
Authorization: Bearer <supabase_access_token>
```

Le token est le JWT Supabase de la session active. Le frontend l'injecte automatiquement via un intercepteur Axios.

Si la 2FA est active (voir §12), le JWT doit porter le claim `aal: 'aal2'` ; sinon la réponse est `401 { "error": "Verification 2FA requise", "code": "mfa_required" }`.

Les endpoints sous `/api/admin/*` exigent en plus que le profil de l'utilisateur ait `role = 'admin'`.

---

### Endpoint de santé

#### `GET /api/health`
Vérifie que le serveur tourne. Pas d'authentification requise.

**Réponse 200** :
```json
{
  "status": "ok",
  "timestamp": "2026-04-01T10:00:00.000Z"
}
```

---

### Configuration initiale (Setup)

Ces endpoints sont **publics** (pas d'authentification requise). Ils permettent de configurer l'application au premier lancement.

#### `GET /api/setup/status`
Vérifie si l'application est configurée. Retourne `true` si les 4 clés obligatoires (`ANTHROPIC_API_KEY`, `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`) sont présentes — soit en variables d'environnement, soit dans la table `app_settings`.

**Réponse 200** :
```json
{ "configured": true }
```

Le frontend appelle cet endpoint au démarrage (`App.tsx`). Si `configured === false`, le **Setup Wizard** est affiché au lieu de l'écran de connexion.

#### `POST /api/setup/configure`
Configure les clés API pour la première fois. Bloqué si l'application est déjà configurée.

**Headers requis** : `X-Setup-Token: <valeur de SETUP_SECRET_TOKEN>`

**Body** :
```json
{
  "settings": [
    { "key": "ANTHROPIC_API_KEY", "value": "sk-ant-..." },
    { "key": "DROPBOX_APP_KEY", "value": "abc123" },
    { "key": "DROPBOX_APP_SECRET", "value": "xyz789" },
    { "key": "DROPBOX_REFRESH_TOKEN", "value": "..." }
  ]
}
```

**Réponse 200** : `{ "message": "Configuration initiale terminee avec succes" }`
**Erreur 403** : Token manquant/invalide ou application déjà configurée
**Erreur 400** : Clé obligatoire manquante

**Important** : Une fois l'application configurée, cet endpoint est verrouillé définitivement. Pour modifier les clés ensuite, utiliser l'onglet Settings de l'admin (voir section 8).

---

### Authentification

#### `GET /api/auth/config`
Public. Retourne la politique d'authentification, lue par le frontend au démarrage et après chaque login pour décider d'afficher `/mfa`.

**Réponse 200** : `{ "mfaRequired": true }` (ou `false`)

#### `GET /api/auth/profile`
Retourne le profil complet de l'utilisateur identifié par le token Bearer.

**Headers** : `Authorization: Bearer <token>`

**Réponse 200** :
```json
{
  "user": {
    "id": "uuid",
    "email": "journaliste@rollingstone.fr",
    "full_name": "Xavier Bonnet",
    "role": "journalist",
    "is_active": true,
    "created_at": "2026-01-01T00:00:00.000Z"
  }
}
```

**Erreurs** : `401` token manquant/invalide, `404` profil introuvable

---

### Livraisons (journaliste)

Tous les endpoints ci-dessous requièrent `authMiddleware`.

#### `GET /api/deliveries`
Liste toutes les livraisons de l'utilisateur connecté, triées par date décroissante. Inclut les relations `paper_type` et `hebdo`.

**Réponse 200** : Tableau d'objets `Delivery` avec champs joints.

---

#### `GET /api/deliveries/current-hebdo`
Retourne l'hebdo ayant `is_current = true`.

**Réponse 200** : Objet `HebdoConfig` ou `null`

---

#### `GET /api/deliveries/hebdos`
Retourne l'hebdo actif selon la logique de priorité (voir section Base de données). Retourne un objet unique, pas un tableau.

**Réponse 200** : Objet `HebdoConfig` ou `null`

---

#### `POST /api/deliveries/ensure-hebdo`
Cherche un hebdo par numéro. Le crée s'il n'existe pas. Permet aux journalistes de travailler sur un numéro futur avant qu'il soit officiallement créé par un admin.

**Body** :
```json
{ "numero": 227 }
```

**Réponse 200** : Objet `HebdoConfig` existant  
**Réponse 201** : Objet `HebdoConfig` nouvellement créé  
**Erreur 400** : Numéro invalide (hors plage 1-9999)  
**Rate limit spécifique** : 5 créations par heure par utilisateur (la recherche d'un hebdo existant n'est pas limitée)

---

#### `POST /api/deliveries/prepare-hebdo`
Pré-crée la structure de dossiers Dropbox pour un hebdo donné (dossier racine + un sous-dossier par type de papier actif). Appelé automatiquement lors de la confirmation de l'hebdo dans le formulaire.

**Body** :
```json
{ "hebdo_id": "uuid" }
```

**Réponse 200** :
```json
{ "message": "Dossiers prets" }
```

Le lien partagé du dossier racine de l'hebdo n'est volontairement **pas** renvoyé : il donnerait accès aux papiers de tous les journalistes.

---

#### `GET /api/deliveries/paper-types`
Retourne tous les types de papier actifs (`is_active = true`), triés par `sort_order`.

**Réponse 200** : Tableau d'objets `PaperType`

---

#### `POST /api/deliveries`
Soumet une livraison complète. Requiert `multipart/form-data`.

**Body (form-data)** :

| Champ | Type | Description |
|---|---|---|
| `paper_type_id` | string | UUID du type de papier |
| `hebdo_id` | string | UUID de l'hebdo cible |
| `title` | string | Titre calculé côté frontend |
| `metadata` | string (JSON sérialisé) | Tous les champs du formulaire |
| `images` | File[] | Images (0 à 30, max 60 Mo chacune) |
| `author_id` | string (optionnel) | **Admin uniquement** : UUID du journaliste au nom duquel livrer (compte actif). Un non-admin qui le renseigne reçoit `403` |

**Contraintes** :
- Images : uniquement des fichiers `image/*`, SVG refusé d'emblée, contenu vérifié par magic bytes (JPEG/PNG/GIF/WebP/TIFF/HEIC) — sinon `400`
- Taille max par fichier : 60 Mo ; maximum 30 images par soumission
- Timeout de la requête étendu à **15 minutes** (`req.setTimeout(900_000)`)
- Limite pratique en production : le proxy Railway répond `502` au-delà d'environ 78 Mo de corps multipart (8 photos de presse). Réduire les JPEG > 10 Mo avant envoi (voir §11).

**Réponse 201** :
```json
{
  "delivery": { ...DeliveryObject },
  "drive": {
    "folderUrl": "https://...",
    "docxUrl": "https://...",
    "imageUrls": ["https://..."]
  },
  "message": "Papier livre avec succes !"
}
```

**Traitement interne** (dans l'ordre) :
1. Validation des champs requis
2. Vérification du type de papier et de l'hebdo en base
3. Nettoyage HTML de tous les champs texte des métadonnées
4. Génération du DOCX
5. Création/vérification de la structure Dropbox
6. Upload DOCX + images dans Dropbox
7. Enregistrement en base Supabase
8. Lancement du pipeline WordPress **en arrière-plan** (`void publishDeliveryToWordpress(...)`) si le module est activé — la réponse n'attend pas son résultat
9. Envoi de la notification email
10. Retour de la réponse

---

#### `GET /api/deliveries/:id`
Retourne une livraison par son ID. Vérifie que l'utilisateur en est l'auteur.

**Réponse 200** : Objet `Delivery` avec `paper_type` et `hebdo` joints  
**Erreur 404** : Livraison introuvable ou non autorisée

---

#### `PUT /api/deliveries/:id`
Modifie une livraison existante. Vérifie la propriété. Re-génère le DOCX et re-uploade dans Dropbox. Requiert `multipart/form-data`.

**Body** : Même structure que `POST /api/deliveries`

**Réponse 200** :
```json
{
  "delivery": { ...DeliveryObject },
  "drive": { "folderUrl": "..." },
  "message": "Papier modifie avec succes !"
}
```

---

### Correction IA

#### `POST /api/correct`
Envoie un texte au moteur IA actif (`AI_PROVIDER`) pour correction orthographique et stylistique.

**Body** :
```json
{ "text": "Le texte a corriger..." }
```

**Contrainte** : Texte de 1 à 100 000 caractères  
**Rate limit spécifique** : 30 requêtes par heure par utilisateur (en plus du rate limit global)  
**Timeout** : 5 minutes (`req.setTimeout(300_000)`) — un sujet de couv peut prendre 30 à 90 s

**Réponse 200** :
```json
{
  "correctedText": "Le texte corrigé complet",
  "corrections": [
    {
      "original": "texte original",
      "corrected": "texte corrigé",
      "type": "orthographe",
      "explanation": "Correction de l'accord du participe passé"
    }
  ],
  "signCount": 1234,
  "provider": "anthropic"
}
```

Types de correction possibles : `orthographe`, `grammaire`, `ponctuation`, `style`, `typographie`

**Erreurs** : `503` si le fournisseur IA répond en 5xx ou 429 (surcharge, quota), `500` sinon, avec `detail` et `providerStatus`. Le backend ne renvoie **jamais** un faux « 0 correction » : si la sortie structurée n'aboutit pas après 2 tentatives, c'est une erreur.

---

### Administration

Tous les endpoints ci-dessous requièrent `authMiddleware` ET `adminMiddleware`.

#### Types de papier

| Méthode | URL | Description |
|---|---|---|
| `GET` | `/api/admin/paper-types` | Liste tous les types (y compris inactifs) |
| `POST` | `/api/admin/paper-types` | Crée un type |
| `PUT` | `/api/admin/paper-types/:id` | Modifie un type |
| `DELETE` | `/api/admin/paper-types/:id` | Désactive un type (soft delete — passe `is_active` à `false`) |

**Body POST** :
```json
{
  "name": "Nouveau type",
  "sign_limit": 2000,
  "drive_folder_name": "nouveau-type",
  "fields_config": [...],
  "sort_order": 9
}
```

---

#### Hebdos

| Méthode | URL | Description |
|---|---|---|
| `GET` | `/api/admin/hebdo` | Liste tous les hebdos |
| `POST` | `/api/admin/hebdo` | Crée un hebdo et le définit comme courant |
| `PUT` | `/api/admin/hebdo/:id/set-current` | Définit un hebdo existant comme courant (désactive les autres) |
| `GET` | `/api/admin/hebdo/:id/status` | Retourne l'état de complétion par type de papier pour un hebdo donné |

**Body POST hebdo** :
```json
{
  "numero": 227,
  "start_date": "2026-04-02",
  "end_date": "2026-04-06"
}
```

**Réponse GET /:id/status** :
```json
[
  {
    "paper_type_id": "uuid",
    "name": "Disque de la semaine",
    "count": 2,
    "deliveries": [
      { "title": "Album X", "author": "Xavier B.", "status": "delivered" }
    ]
  }
]
```

---

#### Journalistes

| Méthode | URL | Description |
|---|---|---|
| `GET` | `/api/admin/journalists` | Liste tous les profils |
| `POST` | `/api/admin/journalists` | Crée un compte journaliste (auth + profil) |
| `PUT` | `/api/admin/journalists/:id` | Modifie un profil (nom, rôle, is_active). Refuse de désactiver ou rétrograder le dernier admin |
| `DELETE` | `/api/admin/journalists/:id/mfa` | **Réinitialise la 2FA** : supprime tous les facteurs TOTP enrôlés (`auth.admin.mfa.deleteFactor`). L'utilisateur re-scanne un QR code à sa prochaine connexion. Icône bouclier barré dans l'onglet Journalistes |

**Body POST journaliste** :
```json
{
  "email": "nouveau@rollingstone.fr",
  "full_name": "Prénom Nom",
  "password": "motdepasse123",
  "role": "journalist"
}
```

La création crée simultanément l'utilisateur dans `auth.users` Supabase (avec email confirmé d'office) et le profil dans `profiles`.

---

#### Livraisons (vue admin)

| Méthode | URL | Description |
|---|---|---|
| `GET` | `/api/admin/deliveries` | Liste toutes les livraisons (tous auteurs) avec jointures |
| `GET` | `/api/admin/deliveries/:id` | Détail d'une livraison sans vérification de propriété |
| `PUT` | `/api/admin/deliveries/:id` | Modifie titre/métadonnées ; avec `author_id`, réattribue la livraison (voir §7) |
| `DELETE` | `/api/admin/deliveries/:id` | Supprime définitivement la ligne en base (**ni** le dossier Dropbox **ni** le brouillon WordPress ne sont supprimés) |
| `POST` | `/api/admin/deliveries/:id/wordpress` | (Re)envoie une livraison vers WordPress : les images sont relues depuis Dropbox, un **nouveau** brouillon est créé. Timeout 5 min. Réponse : `{ post: { id, link, editUrl, metaRejected }, wp_payload, message }` — `wp_payload.editorTodo` liste ce qui reste à saisir dans l'éditeur. `400` si module désactivé ou échec (voir Logs) |

**Note sur PUT admin** : Contrairement à `PUT /api/deliveries/:id`, cette route ne re-génère pas le DOCX et ne re-uploade pas dans Dropbox lorsqu'on ne change que les métadonnées. Seule une réattribution (`author_id` différent) régénère le DOCX et le réécrit sur Dropbox.

---

#### Logs

| Méthode | URL | Description |
|---|---|---|
| `GET` | `/api/admin/logs` | Liste les logs récents (max 500) |
| `DELETE` | `/api/admin/logs` | Supprime les logs de plus de 30 jours |

**Query params GET** :
- `level` : Filtre par niveau (`info`, `warn`, `error`)
- `limit` : Nombre de résultats (max 500, défaut 100)

---

#### Prompt IA

| Méthode | URL | Description |
|---|---|---|
| `GET` | `/api/admin/prompt` | Retourne le prompt de correction actuel |
| `PUT` | `/api/admin/prompt` | Met à jour le prompt (50 caractères minimum) |

---

#### WordPress

| Méthode | URL | Description |
|---|---|---|
| `POST` | `/api/admin/wordpress/test` | Teste les identifiants (`GET /wp-json/wp/v2/users/me`). Body optionnel `{ url, username, appPassword }` pour tester des valeurs saisies mais pas encore enregistrées ; un mot de passe vide retombe sur celui stocké. Réponse `{ ok: true, name }` ou `400 { ok: false, error }` |

L'envoi/renvoi d'une livraison est documenté plus haut (`POST /api/admin/deliveries/:id/wordpress`).

---

#### Modèles Claude

| Méthode | URL | Description |
|---|---|---|
| `GET` | `/api/admin/models` | Liste en direct (API Anthropic `models.list`) des modèles `claude-*` disponibles sur le compte, du plus récent au plus ancien : `[{ id, display_name, created_at }]` |
| `GET` | `/api/admin/models/latest` | Le plus récent d'entre eux (`404` si aucun) |

---

#### Paramètres API

| Méthode | URL | Description |
|---|---|---|
| `GET` | `/api/admin/settings` | Liste tous les paramètres (secrets masqués) |
| `PUT` | `/api/admin/settings` | Met à jour un ou plusieurs paramètres ; invalide le cache de la politique 2FA si `REQUIRE_MFA` change |

**Body PUT settings** :
```json
{
  "settings": [
    { "key": "ANTHROPIC_API_KEY", "value": "sk-ant-..." },
    { "key": "AI_PROVIDER", "value": "gemini" },
    { "key": "WP_META_MAP", "value": "{\"styleMusic\":\"\",\"mainArtist\":\"\",\"reviewScore\":\"\"}" }
  ]
}
```

**Masquage des valeurs** : Les clés non secrètes (`REQUIRE_MFA`, `AI_PROVIDER`, `CLAUDE_MODEL`, `WORDPRESS_ENABLED`, `WORDPRESS_URL`, `WORDPRESS_USERNAME`, `WP_META_MAP`) sont renvoyées en clair. Toutes les autres sont masquées : `••••••••xxxx` (8 points + 4 derniers caractères). Cela permet de vérifier visuellement qu'une clé est configurée sans exposer sa valeur ; la valeur masquée n'est jamais réutilisable.

---

#### Récapitulatif mensuel

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/admin/recap/:ym/pdf` | PDF des livraisons du mois `ym` (`AAAA-MM`), `Content-Disposition: attachment` |
| POST | `/api/admin/recap/:ym/send` | Envoi du PDF par email à la rédaction en chef ; réponse `{ sent, recipients, total }` |

Erreurs : `400` si `ym` est invalide ou si Resend / `NOTIFY_EMAIL_ALMA` ne sont pas configurés, `500` si Resend refuse l'envoi.

---

## 7. Flux de livraison

### Diagramme de séquence

```
Journaliste          Frontend              Backend              Services
    │                    │                    │                     │
    │──sélection hebdo──►│                    │                     │
    │                    │──GET /hebdos──────►│                     │
    │                    │◄──hebdo actif──────│                     │
    │──confirme hebdo────►│                    │                     │
    │                    │──POST /prepare-hebdo►│                   │
    │                    │                    │──ensureFolder()────►│ Dropbox
    │                    │◄──folderUrl────────│◄────────────────────│
    │                    │                    │                     │
    │──sélection type────►│                    │                     │
    │                    │──GET /paper-types──►│                     │
    │                    │◄──types actifs─────│                     │
    │                    │                    │                     │
    │──saisie contenu────►│                    │                     │
    │──demande correction►│                    │                     │
    │                    │──POST /api/correct─►│                     │
    │                    │                    │──correction.correctText()►│ Claude / Gemini / Mistral
    │                    │                    │◄──corrections────────│
    │                    │◄──correctedText────│                     │
    │                    │                    │                     │
    │──review + submit───►│                    │                     │
    │                    │──POST /api/deliveries►│                  │
    │                    │   (multipart)       │──generateDocx()─────►│ docx lib
    │                    │                    │◄──Buffer DOCX────────│
    │                    │                    │──uploadDelivery()───►│ Dropbox (originaux)
    │                    │                    │◄──folderUrl──────────│
    │                    │                    │──INSERT deliveries──►│ Supabase
    │                    │                    │──publishDeliveryToWordpress() (fire & forget)
    │                    │                    │──notifyDelivery()───►│ Resend
    │                    │◄──201 success──────│                     │
    │◄──confirmation UI──│                    │                     │
    │                    │                    │   … en arrière-plan :│
    │                    │                    │──formatArticleForWp()►│ Claude API
    │                    │                    │──upload médias, tags─►│ WordPress REST
    │                    │                    │──createWpDraftPost()─►│ WordPress REST
    │                    │                    │──UPDATE wp_* ────────►│ Supabase
    │                    │                    │──notifyWordpressError() si échec──►│ Resend
```

### Étape 1 : Sélection et confirmation de l'hebdo

Le formulaire charge l'hebdo actif via `GET /api/deliveries/hebdos`. Le journaliste peut modifier le numéro manuellement (cas des papiers en avance). Lors de la confirmation, `POST /api/deliveries/prepare-hebdo` est appelé pour pré-créer les dossiers Dropbox et vérifier la connexion au service.

### Étape 2 : Sélection du type de papier

Le formulaire affiche les types actifs avec leur limite de signes. Chaque type a un formulaire différent défini par `fields_config`.

### Étape 3 : Saisie du contenu

Le formulaire est généré dynamiquement à partir de `fields_config`. Les types de champs supportés sont : `text`, `textarea`, `url`, `images`, `stars`. Un compteur de signes en temps réel compare la longueur du corps (`corps`) à la limite du type de papier.

### Étape 4 : Correction IA

Le corps du texte (champ `corps`) est envoyé à Claude via `POST /api/correct`. Claude répond avec :
- Le texte corrigé
- La liste détaillée des corrections (type, original, corrigé, explication)

Si la correction échoue (timeout, erreur API), le texte original est conservé et le processus continue.

### Étape 5 : Review

L'utilisateur voit le texte corrigé en regard des corrections détaillées. Il peut modifier le texte corrigé avant soumission.

### Étape 6 : Soumission

Le formulaire est envoyé en `multipart/form-data` avec :
- Les métadonnées JSON (incluant le texte corrigé)
- Les images

### Étape 7 : Génération DOCX

Le service `docx.ts` génère un fichier Word formaté avec :
- Titre en Heading 1
- Mention auteur + type en italique grisé
- Séparateur
- Champs dans l'ordre de `fields_config` avec un rendu adapté par type :
  - `accroche` : italique Georgia 13pt
  - `credits` : italique petite taille grisé
  - `chapo` : gras Georgia 13pt
  - `corps` / `textarea` : paragraphes Georgia 12pt, double interligne
  - `url` : bleu souligné
  - `stars` : `★★★☆☆ (3/5)`
  - `images` : ignoré dans le DOCX

### Étape 8 : Upload Dropbox

Le service `dropbox.ts` :
1. Rafraîchit le token OAuth2 si nécessaire (cache de 55 minutes)
2. Crée les dossiers manquants (idempotent — les conflits sont ignorés)
3. Construit le chemin de destination. **Règle de base : un papier reste toujours dans le dossier de son type**, celui pré-créé par `ensureHebdoFolderStructure` (`RSH249/Interview 3000`, `RSH249/Chroniques`…). Certains types ajoutent un sous-dossier *à l'intérieur* :
   - `Interview *` : un sous-dossier par sujet — `RSH249/Interview 3000/Interview Keb' Mo'`
   - `Chroniques Musique`, `Chronique cinema`, `Livres et expo` : un sous-dossier par journaliste — `RSH249/Livres et expo/Loraine Adam`
   - tous les autres types : les fichiers sont déposés directement dans le dossier du type

   > Avant le 3 septembre 2026, les interviews créaient un dossier `Interview <sujet>` **à côté** du dossier du type (hors arborescence) et `Livres et expo` était renommé `Livres et expo <journaliste>`. Les livraisons antérieures peuvent donc se trouver hors du dossier de leur type.
4. Upload le DOCX (mode overwrite)
5. Upload chaque image séquentiellement
6. Crée ou récupère les liens partagés

**Résilience** : Un mécanisme de retry automatique gère les erreurs 429 (rate limit) et 401 (token expiré). Maximum 3 tentatives avec backoff.

### Étape 9 : Enregistrement et notification

La livraison est enregistrée en base Supabase avec tous les champs. Un email HTML est envoyé à `NOTIFY_EMAIL_ALMA` et `NOTIFY_EMAIL_DENIS` avec les informations clés et un lien vers le dossier Dropbox.

### Attribution du journaliste (admin)

**À la livraison.** Quand un admin livre un papier, une étape supplémentaire précède le choix du type : « Pour quel journaliste livrez-vous ? » (liste des comptes actifs). Le formulaire n'affiche les types de papier qu'une fois le journaliste choisi. Le champ `author_id` part avec le `FormData` ; `POST /api/deliveries` vérifie que l'appelant est admin et que le compte cible est actif, puis attribue la livraison à ce journaliste (nom repris dans le DOCX, l'arborescence Dropbox et l'email de notification). Un journaliste non-admin ne voit pas cette étape et livre toujours en son nom.

**Après coup.** Dans Admin → Livraisons, la colonne Journaliste est un menu déroulant : le changer réattribue la livraison (`PUT /api/admin/deliveries/:id` avec `author_id`). Le backend alors :

1. met à jour `author_id` sur la livraison ;
2. régénère le DOCX avec le même contenu et le nouveau nom d'auteur (`generateDocx`), puis l'écrase sur Dropbox (`reattributeDelivery`) — le papier n'est jamais supprimé ;
3. si l'arborescence dépend du journaliste (chroniques musique, chronique cinéma, livres et expo), déplace le dossier complet pour garder images et DOCX ensemble, et met à jour `drive_folder_url` ;
4. journalise l'opération (étape `admin-reassign`). Un échec Dropbox n'annule pas la réattribution en base : il est signalé dans les Logs et dans le message de retour.

---

### Étape 10 : Envoi WordPress (parallèle, non bloquant)

> **Règle éditoriale (01/10/2026)** : le corps de l'article WordPress est le texte livré **mot pour mot** (`buildArticleHtml` dans `wordpressPublisher.ts`, testé) : un `<p>` par paragraphe, citations « » en `<em>`, un H3 de chapô (champ `chapo` ou `accroche` du formulaire, sinon la **première phrase du texte livré** via `splitChapoFromBody`, qui est alors retirée du corps (le texte commence à la phrase suivante, les lignes de mention en tête restent) ; depuis le 01/10/2026 plus aucun résumé généré n'est utilisé comme chapô, l'excerpt IA ne sert plus qu'à la meta description Yoast), et la signature `Par Prénom Nom` en fin d'article. L'IA ne produit plus le HTML, elle ne fournit que titre, slug, excerpt, catégories, tags, Yoast, Style Music, Main Artist et crédit photo. Les liens internes automatiques ont été retirés. Ordre des blocs : chapô, chronique avec la vidéo au milieu (URL YouTube du champ `lien` seule dans un paragraphe, après la première moitié des paragraphes ; juste avant la signature s'il n'y a qu'un paragraphe), lien sortant nommé selon le domaine (`outboundLinkLabel` : « Écouter et acheter sur Bandcamp », « Écouter l'album » pour un smartlink, « Fiche de l'éditeur », « Fiche AlloCiné », « Voir sur la plateforme », sinon « Site officiel ») à partir de `lien` non YouTube ou de la clé `lien_achat` des métadonnées — plus jamais de lien « Voir le clip » sous la vidéo ; à défaut un avertissement dans les Logs invite à renseigner le site officiel ou le Bandcamp de l'artiste —, bloc « À lire aussi » (`pickInternalLink` : l'article choisi par l'IA parmi les candidats trouvés par artiste, album, titre et Style Music ; sinon un candidat dont le titre cite l'artiste ; sinon la page de la rubrique de l'article, pour que Yoast compte toujours un lien interne), signature. Les images (à la une et dans le corps) reçoivent un texte alternatif « Artiste – Album » (sinon le titre), y compris sur un renvoi (`setWpMediaMeta`). **Reviews Box, Main Artist, Style Music** (`services/wordpressReviewBox.ts`, clés découvertes le 01/10/2026 via le mu-plugin : `rwp_reviews` structure Reviewer avec template Music `rwp_template_5c765e33791e9` ou Cinéma `rwp_template_5c765e419ddad`, note `etoiles` arrondie au demi-point, image = image à la une ; `_mat_value` ; `_tsm_value`) sont écrits après la création du brouillon par `ensureEditorialMeta`, uniquement s'ils sont vides sur l'article (lecture préalable via `GET /wp-json/rs-delivery/v1/post-meta/{id}`), y compris sur un renvoi : une saisie de la rédaction n'est jamais écrasée. Le réglage `WP_META_MAP` n'est plus utilisé. Routes admin de diagnostic : `GET/POST /api/admin/wordpress/post-meta/:id`. Style Music exige le mu-plugin ≥ 2.1.0 (préfixe `_tsm_`). Sur un renvoi, seul le corps, l'extrait et l'auteur du brouillon sont mis à jour (`contentOnly`) : titre, slug, Yoast, catégories, tags et métaboxes restent intacts. L'auteur WordPress est positionné sur l'utilisateur du même nom quand le compte API peut le lister (`findWpUserByName`), sinon l'article reste au compte `rs_delivery`. Un renvoi depuis l'admin **met à jour** le brouillon existant (`POST /posts/{id}`) au lieu d'en créer un second.


Si le module WordPress est activé (admin → Paramètres → WordPress), chaque livraison est aussi envoyée sur rollingstone.fr via l'API REST WP (`/wp-json/wp/v2/`), authentifiée par **mot de passe application** (Basic auth, timeout 30 s, porté à 180 s pour les uploads médias car WordPress génère les tailles intermédiaires côté serveur). Le pipeline (`services/wordpressPublisher.ts`) :

1. Recherche jusqu'à 12 articles existants sur le site (artiste, album, titre, Style Music ; jamais l'article lui-même) comme candidats de lien interne.
2. Mise en forme IA (Claude, sortie structurée forcée) selon les conventions éditoriales (`services/wordpressRules.ts`) : chapô en H3, intertitres H4 (jamais H1/H2/H5/H6, jamais de lien dans H3/H4), citations `<em>« »</em>`, crédit traduction en fin d'article si une URL source RS US est fournie, ≥ 1 lien interne, catégories parent + sous-catégorie (taxonomie complète avec IDs), ≥ 5 tags, Yoast (focus keyword, titre SEO ~55c, meta description ~150c, slug propre).
3. Tags : réutilisation des tags existants (recherche) avant création.
4. Images : toutes les images de la livraison sont envoyées dans la médiathèque (dédupliquées par nom de fichier, crédit photo en légende du média, jamais dans le texte). La **première** devient l'image à la une, normalisée au format rollingstone.fr **1280 × 853** (recadrage centré `cover`, orientation EXIF appliquée, JPEG qualité 90, fichier `<nom>-1280x853.jpg` — `services/imageResize.ts`, lib `sharp`) ; en cas d'échec de conversion l'original est envoyé et un warning `wp-media` est loggé. Les **suivantes** sont converties en version web (`toWebJpeg` : côté long ≤ 1600 px sans agrandissement, JPEG qualité 85, fichier `<nom>-web.jpg` — les originaux presse de 10-30 Mo faisaient expirer l'upload WordPress) puis **réparties dans le corps de l'article** (`insertImagesIntoBody`) : blocs image Gutenberg placés à intervalles réguliers après les paragraphes, jamais avant le chapô H3 ni juste après un H3/H4, reliquat en fin d'article. Les fichiers déposés sur **Dropbox restent les originaux**, sans modification. Lors d'un **renvoi depuis l'admin**, les fichiers ne sont plus en mémoire : ils sont retéléchargés depuis le dossier Dropbox de la livraison (`fetchDeliveryImages`, mêmes noms et même ordre que `deliveries.image_filename`).
   **Aucune photo livrée** (cas typique des chroniques) : le pipeline cherche une image existante dans la médiathèque (`findWpMediaByKeywords` : « artiste album », album, artiste, titre) et la réutilise comme image à la une ; sinon warning `wp-media`. Ce cas est devenu rare : depuis le 17/09/2026, le champ `photos` (`fields_config`) est **obligatoire** (min 1) sur Chroniques, Chronique Cinema, Chronique Coup de Coeur, Frenchie, Livres et Expo (max 1) et Disque de la semaine, et Interview 3000 en demande 2 ; la recherche en médiathèque ne sert plus que de filet de sécurité.
   **Chroniques** (`isChroniqueType`) : titre imposé « Chronique : Artiste, Album » (cinéma : « Critique : Titre »), catégories `[3627, 6716]` (+ `6275` métal) / Disque de la semaine `[3627, 23176]` / cinéma `[3619, 3, 6714]`, et le shortcode `[rwp-review-recap id="0"]` (Reviewer plugin) est ajouté automatiquement après le corps, avant le crédit auteur/traduction s'il existe (`appendReviewRecap`). La note du formulaire (`etoiles`, sur 5) est conservée dans `wp_payload.reviewScore` ; la **Reviews Box** elle-même (L'avis de Rolling Stone, template Review Chronique Music, note, image = image à la une) reste à renseigner dans l'éditeur tant que ses clés de métadonnées ne sont pas exposées à l'API REST.
5. Création du post en **brouillon** avec le titre suffixé `[EN ATTENTE DE RELECTURE]`. La requête porte les métas Yoast (`_yoast_wpseo_focuskw`, `_yoast_wpseo_title`, `_yoast_wpseo_metadesc`) et, **uniquement si `WP_META_MAP` les déclare**, les métas Style Music (valeur `1`..`27` du select du thème, table `WP_STYLE_MUSIC`), Main Music Artist et note Reviewer. Aucun nom de clé n'est jamais deviné.
6. **Vérité sur ce que WordPress a gardé** (`createWpDraftPost`) : si WordPress répond `400`, l'article est recréé **sans** métas et toutes les clés sont marquées refusées ; s'il répond `201` en ignorant silencieusement certaines métas (cas le plus fréquent), le backend relit `data.meta` et liste les clés absentes dans `metaRejected`. Un log `wp-meta` (warn) nomme les clés refusées.
7. Suivi sur la livraison : `wp_post_id`, `wp_post_url` (lien d'édition), `wp_status` (`pending`/`sent`/`error`), `wp_payload` (payload IA complet + `metaRejected` + **`editorTodo`**). `editorTodo` (`buildEditorTodo`) est calculé à partir des refus réels : une ligne par champ réellement à saisir à la main (Yoast, Style Music avec la valeur à sélectionner, Main Music Artist avec le nom, Reviews Box avec la note). Un champ accepté par l'API n'y apparaît plus. L'admin l'affiche en **pastille ambre** à côté du globe dans l'onglet Livraisons, et en toast après un renvoi manuel.

**Métas via REST — le mu-plugin.** WordPress n'accepte dans `wp/v2/posts.meta` que les métas déclarées avec `show_in_rest` ; par défaut rollingstone.fr n'en exposait que 5 (ExactMetrics + `footnotes`) et ignorait tout le reste en silence. Le mu-plugin du dépôt, `scripts/wp/rs-delivery-rest-meta.php` (v2.0.0), corrige cela :
- il **enregistre les 3 métas Yoast** avec `show_in_rest` (écriture réservée aux comptes ayant `edit_post` sur l'article, `sanitize_text_field`) ;
- il expose `GET /wp-json/rs-delivery/v1/post-meta/{id}` (lecture seule : toutes les métas désérialisées + termes de taxonomie d'un article, pour **découvrir** les clés réelles du thème et de Reviewer sur un article de référence) ;
- il expose `POST /wp-json/rs-delivery/v1/post-meta/{id}` (corps `{"meta": {...}}`, écriture limitée aux préfixes `_yoast_wpseo_`, `rwp_`, `sm_`, `_sm_`, `mat_`, `_mat_`, valeurs scalaires ou tableaux de scalaires uniquement, clés refusées renvoyées dans `refused`). Le backend l'utilise **en secours** (`writeWpMetaViaMuPlugin`, `wordpress.ts`) : les métas que `posts.meta` a refusées ou ignorées sont retentées par cette route juste après la création du brouillon ; seules celles encore refusées restent dans `metaRejected`.

Installation : copier le fichier dans `wp-content/mu-plugins/` (SFTP WP Engine ou `scripts/wpe ssh`) — actif immédiatement, désinstallation = suppression du fichier. Détails pour le développeur du site dans `scripts/wp/INSTALLATION.md`.

**État réel au 30 septembre 2026 (vérifié en live)** :
- le mu-plugin **est installé** : `GET https://www.rollingstone.fr/wp-json/` liste le namespace `rs-delivery/v1` et sa route `post-meta/(?P<id>\d+)` ; le schéma de `wp/v2/posts` accepte désormais `_yoast_wpseo_title`, `_yoast_wpseo_metadesc` et `_yoast_wpseo_focuskw`. Les champs Yoast partent donc correctement.
- `WP_META_MAP` est **vide** : Style Music, Main Music Artist et la note Reviewer restent dans `editorTodo` tant que leurs clés n'ont pas été lues sur un article de référence (ex. `post-meta/154725`, chronique Brandon Flowers) puis saisies dans l'admin.
- une sonde `GET .../post-meta/1` répond `404` parce que l'article 1 n'existe pas : ce n'est pas un signe d'absence du plugin.
- le module a été **réactivé en test** pour le numéro RSH240 (2 octobre 2026) avec l'accord de la rédaction en chef, après avoir été coupé du 10 au 30 septembre.

**Champs à finir à la main dans l'éditeur classique** tant que `WP_META_MAP` est vide : Style Music (metabox `id_sm_metaboxe`, `select[name="liste"]`), Main Music Artist (metabox `id_mat_metaboxe`, `input#new-mat-tag`) et la Reviews Box (plugin Reviewer d'Evographics, template « Review Chronique Music », critère « Avis de la rédaction », note sur 5, image = image à la une). Les valeurs suggérées par l'IA sont conservées dans `wp_payload`.

Un échec WordPress ne bloque **jamais** la livraison : `wp_status` passe à `error`, l'étape `wp-error` est loggée, et un **email d'alerte** part aux admins (`notifyWordpressError`, mêmes destinataires que les notifications de livraison). L'admin corrige puis relance depuis l'onglet Livraisons (icône globe) ou via `POST /api/admin/deliveries/:id/wordpress` — un renvoi crée toujours un **nouveau** brouillon, l'ancien n'est pas supprimé (l'app ne sait pas supprimer un article WordPress). Test des identifiants : `POST /api/admin/wordpress/test`.

**Garde-fous** : l'article est toujours créé en `draft`, jamais publié ; l'URL WordPress est validée contre les adresses internes (anti-SSRF, HTTPS obligatoire, résolution DNS vers une IP publique) ; le header `Authorization` est effacé des objets d'erreur axios avant tout log.

---

## 8. Administration

L'interface d'administration est accessible à l'URL `/admin` pour les utilisateurs avec `role = 'admin'`. Elle est organisée en 7 onglets.

### Onglet "Types de papier"

Permet de gérer le référentiel des types de papier :
- Création d'un nouveau type avec son formulaire (`fields_config`)
- Modification du nom, de la limite de signes, du dossier Dropbox cible
- Désactivation (soft delete) d'un type — il n'apparaît plus dans le formulaire journaliste mais reste visible dans les livraisons historiques
- Réordonnancement via `sort_order`

### Onglet "Hebdo"

Permet de :
- Créer un nouveau numéro hebdomadaire avec ses dates de début/fin
- Définir le numéro actif (`is_current`) — un seul peut être actif à la fois
- Visualiser l'état de complétion de chaque hebdo par type de papier (nombre de livraisons reçues)

### Onglet "Journalistes"

Permet de :
- Créer un compte journaliste (email + mot de passe + nom)
- Modifier le nom, le rôle (`journalist` ou `admin`) et le statut actif/inactif (le dernier admin ne peut être ni désactivé ni rétrogradé)
- La désactivation d'un compte (`is_active = false`) empêche immédiatement toute connexion
- **Réinitialiser la 2FA** d'un compte (icône bouclier barré, `DELETE /api/admin/journalists/:id/mfa`) : téléphone perdu, application supprimée — l'utilisateur re-scanne un QR code à sa prochaine connexion

### Onglet "Livraisons"

Vue globale de toutes les livraisons de tous les journalistes :
- Recherche, consultation du détail d'une livraison
- Modification des métadonnées (sans re-génération Dropbox)
- **Réattribution** à un autre journaliste via le menu déroulant de la colonne Journaliste (DOCX régénéré et dossier Dropbox déplacé si nécessaire, voir §7)
- Suppression définitive (base uniquement)
- **WordPress** : icône globe par ligne. Lien vers le brouillon si `wp_status = sent`, icône rouge si `error`, bouton d'envoi/renvoi sinon (confirmation demandée si un brouillon existe déjà). Une **pastille ambre** au survol liste `editorTodo`, c'est-à-dire les champs que WordPress n'a pas pu enregistrer et qui restent à saisir dans l'éditeur classique.

### Onglet "Prompt IA"

Éditeur du prompt envoyé à Claude pour la correction. Interface avec :
- Textarea pleine page (mode mono-espace)
- Compteur de caractères
- Avertissement de zone sensible
- Confirmation obligatoire avant sauvegarde
- Annulation des modifications

**Important** : Une modification incorrecte du prompt peut dégrader la correction. Le prompt est partagé par tous les moteurs (Claude, Gemini, Mistral, Claude Code). Le `FALLBACK_PROMPT` codé en dur dans `backend/src/services/correctionPrompt.ts` n'est utilisé que si la ligne en base est absente ou illisible. Avec Claude, la sortie est **structurée** (outil `submit_correction`) : un prompt cassé ne produit plus de JSON invalide mais une erreur explicite après 2 tentatives.

### Onglet "Logs"

Tableau de bord des logs du pipeline de livraison :
- Filtrage par niveau (Tous / Erreurs / Alertes / Info)
- Résumé rapide (nombre d'erreurs, d'alertes)
- Détail expandable par log (contexte : journaliste, hebdo, type, titre, stacktrace)
- Rafraîchissement manuel
- Bouton de nettoyage (supprime les logs > 30 jours)

### Onglet "Settings" (Paramètres et clés API)

Tout se pilote sans redéploiement (table `app_settings`). Sections, de haut en bas :

1. **Moteur IA pour la correction** — sélecteur `anthropic` / `gemini` / `mistral` / `claude-code` (`AI_PROVIDER`). Un pictogramme signale une clé manquante pour le moteur choisi ; `claude-code` est marqué « local uniquement » (ne fonctionne pas sur Railway).
2. **Modèle Claude (correction)** — liste **live** des modèles du compte Anthropic (`GET /api/admin/models`), du plus récent au plus ancien, avec repli sur une liste embarquée si l'API est injoignable. Enregistre `CLAUDE_MODEL`. Utilisé aussi pour la mise en forme WordPress.
3. **Double authentification (2FA)** — interrupteur `REQUIRE_MFA`. Sans effet si la variable d'environnement `REQUIRE_MFA=true` verrouille déjà l'activation.
4. **WordPress (rollingstone.fr)** — interrupteur `WORDPRESS_ENABLED`, URL du site, nom d'utilisateur WP, mot de passe application (champ vide = conserver l'existant), bouton **Tester la connexion** (utilise les valeurs saisies, même non enregistrées) et **Enregistrer**. `WP_META_MAP` se saisit via `PUT /api/admin/settings` (pas de champ dédié dans l'interface).
5. **Clés API** (sections secrètes) : Anthropic, Gemini, Mistral, Dropbox. Valeurs masquées (`••••••••xxxx`) ; cliquer « Modifier », saisir, sauvegarder par section.

---

## 9. Services internes

### `services/correction.ts` — aiguillage IA

`correctText(text)` lit `app_settings.AI_PROVIDER` (`anthropic` par défaut, valeur inconnue → `anthropic`) et délègue à `claude.ts`, `gemini.ts`, `mistral.ts` ou `claudeCode.ts`. Le résultat est complété par `provider`.

### `services/correctionPrompt.ts` — prompt et structure

- `getPromptFromDB()` : lit `correction_prompt`, fallback `FALLBACK_PROMPT`.
- `buildSystemPrompt(base)` : ajoute les consignes de conservation de la mise en page.
- `numberEmptyLines(text)` / `restoreStructure(original, corrigé, corrections)` : les lignes vides sont remplacées par des marqueurs `[LIGNE_VIDE_X]` avant l'appel IA puis restaurées, pour que les paragraphes ne soient jamais fusionnés.

### `services/claude.ts`

**Modèle** : `getClaudeModel()` → `app_settings.CLAUDE_MODEL`, sinon env `CLAUDE_MODEL`, sinon `DEFAULT_CLAUDE_MODEL = claude-sonnet-4-5-20250929`  
**Timeout** : 120 secondes  
**Max tokens réponse** : 16 384

`correctText(text)` :
1. Charge la clé (`getApiKey`, base puis env) et le prompt
2. Appelle `messages.create` avec l'outil `submit_correction` et `tool_choice` forcé : la réponse est un objet structuré, plus de parsing de texte libre
3. Jusqu'à **2 tentatives** ; si le modèle configuré est invalide (404, `not_found`…), bascule sur `DEFAULT_CLAUDE_MODEL` pour la seconde
4. Retourne `{ correctedText, corrections, signCount }` après `restoreStructure`
5. Sans bloc structuré après 2 tentatives : **lève une erreur** (plus de faux « 0 correction »)

`listClaudeModels()` interroge `anthropic.models.list` (modèles `claude-*`, triés du plus récent au plus ancien) ; `getLatestClaudeModel()` renvoie le premier.

### `services/gemini.ts` et `services/mistral.ts`

Même contrat que `claude.ts` (clé en base puis env, prompt partagé, marqueurs de lignes vides, JSON réparé par `jsonrepair`). Cascade de modèles avec 1 nouvel essai par modèle sur erreur transitoire (5xx, 429, « overloaded ») :
- Gemini : `gemini-3.5-flash` → `gemini-2.5-flash` → `gemini-2.5-flash-lite`
- Mistral : `mistral-large-latest` → `mistral-small-latest`

### `services/claudeCode.ts`

Moteur de secours **local** : lance la CLI `claude --print --output-format json` (binaire `CLAUDE_CODE_BIN`, modèle `CLAUDE_CODE_MODEL`, timeout 5 min) en retirant `ANTHROPIC_API_KEY` de l'environnement pour forcer l'authentification OAuth de l'abonnement. Utile quand les crédits API sont épuisés ; **échoue sur Railway** (binaire absent).

---

### `services/docx.ts`

Génère un Buffer DOCX à partir des métadonnées et de la configuration de champs. Utilise la librairie `docx` (npm).

**Mise en page** : Marges de 2,54 cm (1440 twips) sur les 4 côtés.

**Rendu par type de champ** :

| Champ / Type | Rendu DOCX |
|---|---|
| Titre | Heading 1 |
| Auteur + type | Italique grisé 11pt |
| `accroche` | Italique Georgia 13pt |
| `credits` | Italique grisé 10pt avec préfixe "Crédits :" |
| `chapo` | Gras Georgia 13pt, interligne 1.5 |
| `corps` / textarea | Georgia 12pt, interligne 1.5, séparation double |
| `url` | Bleu souligné 11pt avec label en gras |
| `stars` | `★★★☆☆ (3/5)` |
| `images` | Ignoré |

---

### `services/dropbox.ts`

Service de stockage remplaçant l'ancienne intégration Google Drive. Utilise l'API HTTP Dropbox v2 directement via Axios (pas le SDK officiel `dropbox` npm bien que celui-ci soit présent dans `package.json`).

**Gestion des tokens** :
- Cache en mémoire du token d'accès
- Expiration anticipée de 5 minutes (conservatif)
- Les requêtes concurrentes de refresh partagent la même promesse (`refreshPromise`) pour éviter des appels multiples simultanés

**Encodage des chemins** : Les caractères non-ASCII sont encodés en `\uXXXX` dans le header `Dropbox-API-Arg` (requis par l'API Dropbox pour les noms de fichiers avec accents, espaces, etc.).

**Idempotence** : `ensureFolder()` ignore les erreurs 409 "conflict/folder" — un dossier qui existe déjà n'est pas une erreur.

**Logique de nommage des sous-dossiers** (`resolveDeliveryFolderPaths`, voir §7 étape 8) : un papier reste dans le dossier de son type ; `Interview *` ajoute un sous-dossier par sujet ; `Chroniques Musique`, `Chronique cinema` et `Livres et expo` ajoutent un sous-dossier par journaliste.

**Autres fonctions** :
- `ensureHebdoFolderStructure(label, types)` : pré-crée le dossier de l'hebdo et un sous-dossier par type actif.
- `reattributeDelivery(previous, next, docx)` : réécrit le DOCX au nom du nouvel auteur et déplace le dossier si l'arborescence dépend du journaliste. Rien n'est jamais supprimé.
- `fetchDeliveryImages(params, wantedNames)` : relit les images d'une livraison depuis son dossier Dropbox (`files/list_folder` puis téléchargement), dans l'ordre de `deliveries.image_filename`. Utilisé par le renvoi WordPress, les buffers n'étant pas conservés en base.

---

### `services/wordpress.ts` — client REST WordPress

- `getWpConfig(override?)` : lit `WORDPRESS_URL/USERNAME/APP_PASSWORD` (base puis env), accepte des valeurs de formulaire non enregistrées (test de connexion). Passe l'URL par `assertSafeWpUrl` : HTTPS obligatoire (sauf `localhost` en dev), résolution DNS et refus des IP privées / loopback / lien-local (anti-SSRF).
- `wpClient()` : axios Basic auth sur `/wp-json/wp/v2`, timeout 30 s, intercepteur qui **efface `Authorization`** de l'erreur avant rethrow.
- `testWpConnection()` (`/users/me`), `searchWpPosts(query)` (5 candidats de liens internes), `findWpMediaByKeywords(queries)` (réutilisation d'une image de la médiathèque), `findOrCreateWpTag(name)` (recherche exacte insensible à la casse, gère `term_exists`), `uploadWpMedia({buffer, filename, mimetype, caption})` (dédup par nom de fichier, timeout 180 s, légende = crédit photo).
- `createWpDraftPost(input)` : crée le brouillon, envoie les métas Yoast + `extraMeta`, renvoie `{ id, link, editUrl, metaRejected }` (voir §7 étape 10 pour la détection des refus).
- `getWpMetaMap()` : parse `app_settings.WP_META_MAP`.

### `services/wordpressPublisher.ts` — pipeline

`publishDeliveryToWordpress(input)` (fire-and-forget, ne lève jamais) : skip si module désactivé → `wp_status = pending` → liens internes → `formatArticleForWp` (Claude, outil `submit_wp_article`, `max_tokens` 16 384, 2 tentatives avec repli de modèle) → `normalizeWpCategories` → tags (15 max) → images (`toFeaturedJpeg` pour la première, `toWebJpeg` pour les autres, `insertImagesIntoBody`) → shortcode `[rwp-review-recap id="0"]` pour les chroniques (`isChroniqueType`, `appendReviewRecap`) → `createWpDraftPost` → log `wp-meta` → `wp_status = sent` + `wp_payload` (avec `editorTodo` via `buildEditorTodo`). En cas d'erreur : `wp_status = error`, log `wp-error`, `notifyWordpressError`.

`republishDeliveryToWordpress(id)` : recharge la livraison, relit les images depuis Dropbox (`fetchDeliveryImages`) et relance le pipeline. Utilisé par `POST /api/admin/deliveries/:id/wordpress`.

### `services/wordpressRules.ts` — conventions éditoriales

Source de vérité pour : la taxonomie complète des catégories rollingstone.fr (IDs parents `Musique 3627`, `Culture 3619`, `Actualites 5870`, `Lifestyle 6718`, sous-catégories → parent, catégories autonomes), `normalizeWpCategories` (ne garde que les IDs connus et ajoute toujours le parent), la table `WP_STYLE_MUSIC` (libellé → valeur `1`..`27` du select du thème) et `buildWpSystemPrompt()` (chapô H3, intertitres H4, `<em>« »</em>`, ≥ 1 lien interne, ≥ 5 tags, Yoast, crédit traduction).

### `services/imageResize.ts` — dérivés pour WordPress (lib `sharp`)

- `toFeaturedJpeg(buffer, name)` : orientation EXIF appliquée, recadrage `cover` **1280 × 853** (format du template Canva éditorial, position `attention`), JPEG qualité 90, fichier `<nom>-1280x853.jpg`.
- `toWebJpeg(buffer, name)` : côté long ≤ **1600 px** sans agrandissement, JPEG qualité 85, fichier `<nom>-web.jpg`.
- Lève sur une image indécodable : l'appelant envoie alors l'original et logge un warning `wp-media`. **Dropbox reçoit toujours les originaux intacts.**

### `services/mfaPolicy.ts` — politique 2FA

`isMfaRequired()` : `true` si env `REQUIRE_MFA=true` ; sinon lit `app_settings.REQUIRE_MFA` (`true`/`1`), **cache 30 s**. En cas d'erreur de lecture, considère la 2FA désactivée (fail-open, signalé dans l'audit). `invalidateMfaPolicyCache()` est appelé par `PUT /api/admin/settings`.

### `meta/provenance.ts` (backend) et `lib/provenance.ts` (frontend) — marqueur de paternité

Fichiers **générés** par `scripts/authorship/sign.mjs`, à ne pas éditer à la main. Ils exportent une constante `PROVENANCE = { statement, signature, publicKey }` : `statement` est une déclaration JSON (œuvre, auteur, email, date, empreinte SHA-256 des sources, nombre de fichiers), `signature` sa signature **Ed25519** en base64, `publicKey` la clé publique SPKI. Constantes inertes : aucun appel réseau, aucun effet à l'exécution. Le frontend importe la constante dans `main.tsx` pour qu'elle survive au bundling (le commentaire d'en-tête `/*! … provenance:<id> ed25519:<sig> */` est conservé par Vite).

- **Signer** (détenteur de la clé privée uniquement) : `node scripts/authorship/sign.mjs ["Nom Auteur"] [email]`. La paire de clés est créée une fois dans `~/.rs-hebdo-authorship/` (clé privée `0600`, hors dépôt). Le script hache `backend/src`, `frontend/src`, `frontend/index.html`, `supabase/`, `supabase-schema.sql`, `scripts/livrer_hebdo.py`, les `package.json` et les 4 fichiers Markdown, signe la déclaration, régénère les deux `provenance.ts` et dépose un dossier de preuve horodaté (`manifest.sha256`, `statement.json`, `statement.sig`, clé publique) dans `~/.rs-hebdo-authorship/proofs/`, à conserver pour un dépôt e-Soleau ou un horodatage.
- **Vérifier** (sans clé privée) : `node scripts/authorship/verify.mjs <fichier|dossier> [cle_publique.pem]` — accepte les sources, `dist/` ou un bundle récupéré en production, retrouve le marqueur `ed25519:` et la déclaration (guillemets échappés ou non selon la minification) et affiche `VALIDE` / `INVALIDE` avec l'auteur, la date et l'empreinte. Code de sortie 0 si au moins un marqueur valide.
- Toute modification des sources couvertes invalide l'empreinte de la déclaration en cours : re-signer avant une release si l'on veut un marqueur cohérent.

---

### `services/email.ts`

Service de notification email via **Resend API** (https://resend.com). Utilise un simple `fetch` POST vers `https://api.resend.com/emails` — aucune dépendance npm supplémentaire. L'email HTML utilise des styles inline (compatible webmail).

Deux emails : `notifyDelivery` (livraison réussie, lien Dropbox) et `notifyWordpressError` (livraison OK mais brouillon WordPress non créé, détail d'erreur tronqué à 600 caractères, lien vers l'app). Destinataires : `NOTIFY_EMAIL_ALMA` et `NOTIFY_EMAIL_DENIS`.

**Protection XSS** : Tous les paramètres utilisateur (nom journaliste, titre, etc.) sont échappés via `escapeHtml()`. L'URL du dossier Dropbox est validée via `sanitizeUrl()` pour autoriser uniquement `http:` et `https:`.

**Comportement non-bloquant** : Les erreurs d'envoi sont loggées en console mais ne propagent pas d'exception — une livraison ne doit jamais échouer à cause d'un problème d'email. Si `RESEND_API_KEY` n'est pas configurée, l'envoi est silencieusement ignoré.

---

### `services/deliveryLogger.ts`

Service de logging structuré vers Supabase. Toutes les fonctions sont `async` mais ne propagent jamais d'exception (try/catch silencieux). Les logs n'impactent jamais le flux de livraison.

**API** :
```typescript
logInfo(step, message, ctx?)     // niveau info
logWarn(step, message, ctx?, detail?)  // niveau warn
logError(step, message, ctx?, error?)  // niveau error + extraction du détail
```

Le contexte `LogContext` transporte les métadonnées du log (`journalistId`, `journalistName`, `hebdoLabel`, `paperTypeName`, `title`).

---

### `services/hebdoRotation.ts`

Service de **rotation automatique des numéros hebdomadaires**. Démarre au boot du serveur (`startHebdoRotation()` appelé dans `index.ts`) et vérifie toutes les heures si l'hebdo courant doit être remplacé.

**Comportement** :
1. Récupère l'hebdo avec `is_current = true`
2. Vérifie si `end_date` est dépassée (comparaison UTC)
3. Si oui :
   - Passe l'hebdo courant à `is_current = false`
   - Crée un nouvel hebdo N+1 avec label `RSH{numero+1}` et une fenêtre **vendredi → vendredi** calculée par `utils/dates.ts` (même logique que le pré-remplissage des dates dans l'onglet Hebdo de l'admin)
   - Définit le nouvel hebdo comme courant
4. Si la création échoue, restaure le flag `is_current` sur l'ancien hebdo (rollback)

**Fréquence** : Vérification immédiate au démarrage du serveur, puis toutes les 60 minutes (configurable via `CHECK_INTERVAL_MS`).

**Cas limites** :
- Si aucun hebdo courant n'existe → skip silencieux
- Si l'hebdo courant n'a pas de `end_date` → skip silencieux
- Les erreurs sont loggées en console mais ne bloquent jamais le serveur

**Impact pour l'admin** : Les numéros hebdomadaires sont créés automatiquement à l'expiration de la date de fin. L'admin n'a pas besoin de créer manuellement le prochain numéro, mais peut toujours le faire via l'onglet Hebdo de l'admin.

---

### `services/monthlyRecap.ts`

Récapitulatif mensuel des livraisons, par journaliste, envoyé en PDF à la rédaction en chef.

- **Collecte** : `collectMonthlyRecap(year, month)` lit les livraisons dont `created_at` tombe dans le mois civil (jointures `profiles`, `paper_types`, `hebdo_config`) et les regroupe par auteur (`groupByAuthor`, tri par nom puis date, cumul des signes).
- **PDF** : `buildRecapPdf(recap)` (pdfkit, A4) — en-tête rouge, un bloc par journaliste (nom, nombre de papiers, signes, email) avec un tableau Numéro · Format · Titre · Date · Signes, pied de page paginé.
- **Envoi** : `sendMonthlyRecap(year, month)` envoie le PDF en pièce jointe via Resend à `NOTIFY_EMAIL_ALMA`, copie `NOTIFY_EMAIL_DENIS`, objet `[Hebdo Delivery] Récapitulatif des livraisons — <mois>`.
- **Planification** : `startMonthlyRecapScheduler()` (démarré dans `index.ts`) vérifie toutes les 30 minutes ; `shouldSendNow` déclenche l'envoi **le 1er du mois à partir de 8 h (Europe/Paris)** pour le mois écoulé, une seule fois (clé `app_settings.RECAP_LAST_SENT` = `AAAA-MM`). Un redémarrage du serveur ne renvoie pas le mail.
- **Admin** : `GET /api/admin/recap/:ym/pdf` (téléchargement) et `POST /api/admin/recap/:ym/send` (envoi manuel), exposés dans l'onglet Hebdo (carte « Récapitulatif mensuel », sélecteur de mois).
- **Tests** : `npm test` dans `backend/` (node:test via tsx) couvre le parsing du mois, les bornes, le regroupement et la règle de déclenchement.

### `utils/supabase.ts`

Deux clients Supabase sont exportés :

- `supabaseAdmin` : Client avec la `service_role` key. Contourne les politiques RLS. Utilisé par tout le code backend pour toutes les opérations de lecture/écriture.
- `createSupabaseClient(accessToken)` : Crée un client avec le JWT d'un utilisateur spécifique, respectant les politiques RLS. Non utilisé dans le code actuel mais disponible pour des besoins futurs.

---

## 10. Frontend

### Routing

```
(setup)        → SetupPage          (affiché automatiquement si l'app n'est pas configurée)
/login         → LoginPage          (redirige vers / si déjà connecté)
/mfa           → MfaPage            (code TOTP ou enrôlement ; redirige vers / si la session est déjà AAL2)
/forgot-password → ForgotPasswordPage (envoi du lien de réinitialisation par email)
/reset-password  → ResetPasswordPage  (formulaire de nouveau mot de passe, accessible via lien email)
/onboarding    → OnboardingPage     (ProtectedRoute — tutoriel interactif 5 étapes)
/              → DashboardPage      (ProtectedRoute)
/livrer        → DeliveryFormPage   (ProtectedRoute)
/livrer/:id    → DeliveryFormPage   (ProtectedRoute, mode édition)
/admin         → AdminPage          (ProtectedRoute, adminOnly)
*              → Redirige vers /
```

**Logique de démarrage** (`App.tsx`) :
1. L'app appelle `GET /api/setup/status` et `initialize()` (restauration session Supabase) en parallèle
2. Si `configured === false` → affiche le **Setup Wizard** (aucune autre route accessible)
3. Sinon → affiche le routeur normal

`ProtectedRoute` redirige vers `/login` si l'utilisateur n'est pas authentifié. Avec `adminOnly`, redirige vers `/` si le rôle n'est pas `admin`.

### Mot de passe oublié / Réinitialisation

L'application dispose d'un flux complet de réinitialisation de mot de passe :

1. **`/forgot-password`** : Le journaliste saisit son email. Un lien de réinitialisation est envoyé via `supabase.auth.resetPasswordForEmail()` avec `redirectTo` pointant vers `/reset-password`.
2. **`/reset-password`** : Le journaliste arrive via le lien email, saisit son nouveau mot de passe. La mise à jour est effectuée via `supabase.auth.updateUser()`.

**Prérequis** : Configurer les Redirect URLs dans Supabase → Authentication → URL Configuration (voir section 2b, étape 1.8).

### Onboarding

Au premier login, les journalistes sont redirigés vers `/onboarding` — un tutoriel interactif en 5 étapes :
1. Bienvenue et présentation de l'outil
2. Le Dashboard et la liste des livraisons
3. Le formulaire de livraison
4. L'upload d'images
5. La correction IA et Dropbox

L'onboarding est tracké par clé localStorage (`rs-onboarding-done-{userId}`). Il n'apparaît qu'une seule fois. Si le localStorage est effacé, l'onboarding réapparaît.

### Authentification frontend

L'authentification est gérée en deux couches :

1. **Supabase Auth** (côté client) : Le client `supabase` (`frontend/src/lib/supabase.ts`) gère la session JWT, le stockage en localStorage, et le renouvellement automatique des tokens.

2. **Store Zustand** (`authStore.ts`) : Maintient l'état `{ user, loading, initialized }` dans l'application React. Au démarrage de l'app (`App.tsx`), `initialize()` est appelé pour restaurer la session depuis le localStorage Supabase et charger le profil via `GET /api/auth/profile`.

**Flux de connexion** :
```
login(email, password)
  → supabase.auth.signInWithPassword()          (session AAL1)
  → GET /api/auth/config                         (mfaRequired ?)
  → si 2FA requise et session non AAL2 : set({ user: null, mfaRequired: true }) → /mfa
      → MfaPage : challenge TOTP (ou enrôlement QR) → completeMfa()
  → getProfile() via API backend
  → set({ user: profile, mfaRequired: false })
```

Le store expose `mfaPolicy` (politique serveur) et `mfaRequired` (la session courante doit encore passer la 2FA). `ProtectedRoute` redirige vers `/mfa` plutôt que `/login` quand `mfaRequired` est vrai.

**Interception Axios** : Chaque requête HTTP ajoute automatiquement le token de session Supabase dans le header `Authorization`. Cela garantit que le backend valide toujours un token frais.

### Formulaire de livraison (`DeliveryFormPage`)

Le formulaire multi-étapes est l'écran central de l'application. Il gère deux modes :
- **Mode création** (`/livrer`) : Flux complet en 4 étapes
- **Mode édition** (`/livrer/:id`) : Pré-remplissage depuis la livraison existante, démarrage à l'étape `content`
- **Mode édition admin** (`/livrer/:id?admin=true`) : Utilise les endpoints admin (pas de re-upload Dropbox)

**Étapes du formulaire** :
1. `type` : Sélection du hebdo et du type de papier
2. `content` : Formulaire dynamique généré depuis `fields_config`
3. `correction` : Affichage des corrections Claude
4. `review` : Résumé avant soumission

**Génération du titre** :
Le titre de la livraison est dérivé des métadonnées selon le type de papier :
- `Sujet de couv`, `Interview 3000` : champ `artiste`
- `Disque de la semaine` : champ `album` puis `artiste`
- `Chroniques` : champ `artiste`
- Sinon : premier champ de type `text`

**Upload d'images** : Intégration `react-dropzone` avec prévisualisation. Formats acceptés : jpg, jpeg, png, webp, gif, heic, heif, tiff, bmp, avif. Le serveur accepte jusqu'à 60 Mo par fichier et 30 fichiers ; le champ `photos` de chaque type impose son propre minimum (`fields_config`, à lire en direct via `GET /api/deliveries/paper-types`).

**Livraison par un admin** : une étape « Pour quel journaliste livrez-vous ? » précède le choix du type ; `author_id` part avec le `FormData` (voir §7).

### Dashboard (`DashboardPage`)

- Affiche les statistiques rapides (nombre de livraisons, dernière livraison)
- Liste paginable filtrée par hebdo
- Lien vers le dossier Dropbox de chaque livraison
- Lien de modification de chaque livraison

**Protection XSS** : Les URLs Dropbox et les liens numériques sont validés avec `isSafeUrl()` avant d'être rendus en `<a href>`.

---

## 11. Déploiement Railway

### Architecture de déploiement

L'application est déployée comme un **service unique** sur Railway. Le backend Express sert à la fois l'API et les fichiers statiques du frontend compilé.

### Processus de build

Défini dans `package.json` (racine) :

```json
{
  "scripts": {
    "postinstall": "cd backend && npm ci && cd ../frontend && npm ci",
    "build:frontend": "cd frontend && rm -rf dist node_modules/.vite && npm run build",
    "build:backend": "cd backend && rm -rf dist && npm run build",
    "build": "npm run build:frontend && npm run build:backend",
    "start": "cd backend && NODE_ENV=production node dist/index.js"
  }
}
```

**Ordre d'exécution** :
1. Railway installe les dépendances racine (script `postinstall` installe également les dépendances `backend/` et `frontend/`)
2. `build:frontend` → `vite build` → sortie dans `frontend/dist/`
3. `build:backend` → `tsc` → sortie dans `backend/dist/`
4. `start` → `node backend/dist/index.js` avec `NODE_ENV=production`

### Configuration Nixpacks

Le fichier `nixpacks.toml` à la racine configure le build Railway. Il définit explicitement les phases d'installation, de build et de démarrage :

```toml
[phases.setup]
nixPkgs = ["nodejs_20"]

[phases.install]
cmds = [
  "cd backend && npm ci",
  "cd frontend && npm ci"
]

[phases.build]
cmds = [
  "cd frontend && rm -rf dist node_modules/.vite && npm run build",
  "cd backend && rm -rf dist && npm run build"
]

[start]
cmd = "cd backend && NODE_ENV=production node dist/index.js"
```

### Variables d'environnement sur Railway

À configurer dans le tableau de bord Railway → Variables :

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
DROPBOX_APP_KEY=...
DROPBOX_APP_SECRET=...
DROPBOX_REFRESH_TOKEN=...
DROPBOX_ROOT_FOLDER=/Hebdo Delivery
FRONTEND_URL=https://<votre-app>.railway.app
NODE_ENV=production
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=RS Hebdo <noreply@rollingstone.fr>
NOTIFY_EMAIL_ALMA=...
NOTIFY_EMAIL_DENIS=...
SETUP_SECRET_TOKEN=<chaîne aléatoire — openssl rand -hex 32>
WORDPRESS_APP_PASSWORD=<mot de passe application WP — les 3 autres réglages WordPress sont en base>
# Optionnels
# CLAUDE_MODEL=claude-sonnet-4-5-20250929
# GEMINI_API_KEY=... / MISTRAL_API_KEY=...
# REQUIRE_MFA=true      (verrou serveur 2FA)
# BIND_HOST=...         (ne pas définir sur Railway)
```

**Note** : Railway injecte automatiquement `PORT`. Ne pas définir cette variable manuellement. Ne pas définir `BIND_HOST` non plus : le service doit écouter sur toutes les interfaces.

### Variables d'environnement Vite (frontend)

Les variables `VITE_*` sont injectées au moment du **build** (pas du runtime). Elles doivent être définies dans Railway **avant** le déploiement ou en les ajoutant au fichier `frontend/.env.production` committé.

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=
```

`VITE_API_URL` est laissé vide : les appels API seront relatifs à l'origine (ex. `https://votre-app.railway.app/api/...`).

> **Conséquence pratique** : après avoir changé une variable `VITE_*`, il faut **rebuilder** — `railway up` (nouveau build) et non `railway redeploy` (qui relance le même artefact avec l'ancienne valeur bakée).

### Déploiement

```bash
# Depuis le répertoire racine du projet
railway up
```

`railway up` respecte `.railwayignore` : `node_modules/`, `dist/`, `.vite/`, les dossiers de travail `HEBDO*/`, `Hebdo RS Delivery-design/`, `deck/`, `macos/`, les `.env` et sauvegardes, les logs et `.DS_Store` ne sont pas téléversés. Avant ce fichier, l'envoi des visuels d'archive (~90 Mo) faisait expirer la requête avant même le début du build.

Projet Railway : `hebdo-rs` (service `hebdo-rs`, environnement `production`, URL publique `https://hebdo-rs.up.railway.app`).

### Limites d'exploitation constatées

- Le proxy Railway refuse en **HTTP 502** un `POST /api/deliveries` d'environ 78 Mo de multipart (8 photos de presse originales) ; ~38 Mo passent. Réduire les JPEG > 10 Mo côté client avant livraison (copie, bord long 4 000 px) — le serveur, lui, accepte 60 Mo par fichier.
- L'upload d'un média WordPress a un timeout dédié de **180 s** (WordPress génère les tailles intermédiaires côté serveur) ; les dérivés `imageResize.ts` évitent d'y arriver.
- Le pare-feu Cloudflare devant rollingstone.fr est sensible à certains `User-Agent` : les sondes manuelles (`curl`) doivent envoyer un UA de navigateur.

### Proxy reverse et IP réelle

En production, Express est configuré pour faire confiance au reverse proxy Railway :

```typescript
if (isProd) {
  app.set('trust proxy', 1);
}
```

Cela est nécessaire pour que `express-rate-limit` utilise l'IP réelle du client (pas l'IP interne Railway).

### Timeouts

Le serveur utilise des timeouts courts par défaut, avec extension per-request pour les routes lentes :

```typescript
// Timeouts par défaut (courts)
server.timeout = 30_000;          // 30s
server.keepAliveTimeout = 30_000;
server.headersTimeout = 35_000;
```

Les routes de livraison (`POST /api/deliveries`, `PUT /api/deliveries/:id`) étendent le timeout à **15 minutes** (900 s) sur leur requête spécifique, car le pipeline complet (DOCX + upload Dropbox + photos de presse) peut être long. `POST /api/correct` et `POST /api/admin/deliveries/:id/wordpress` passent à **5 minutes** (300 s). Le client Anthropic a son propre timeout de 120 s par appel.

### Interface d'écoute

Si `BIND_HOST` est défini, `app.listen(PORT, BIND_HOST)` restreint l'écoute à cette interface (cas de l'app desktop qui embarque le backend sur `127.0.0.1`). Non défini : comportement historique, toutes interfaces — c'est ce qu'attend Railway.

---

## 12. Sécurité

> Les points ci-dessous reflètent l'état **réel** vérifié en production, pas seulement l'intention du code. À lire avant toute intervention sur la base ou les secrets. Le rapport complet est dans **`docs/security/audit-2026-09-04.md`** (cartographie statique + tests live non destructifs) ; l'ordre de correction qu'il recommande est repris en fin de section.

### Double authentification (2FA) — optionnelle

La 2FA TOTP (Google Authenticator, 1Password, Authy…) est **désactivée par défaut** et se pilote depuis l'admin (Paramètres → Double authentification, interrupteur stocké dans `app_settings.REQUIRE_MFA`). Le backend lit ce réglage (cache 30 s) et l'expose au frontend via `GET /api/auth/config` (public). La variable d'environnement `REQUIRE_MFA=true` force l'activation côté serveur. Une fois activée, elle s'applique à tous les comptes via le MFA natif Supabase :

- **Frontend** : après le login par mot de passe, la page `/mfa` prend le relais — saisie du code à 6 chiffres si un facteur est déjà enrôlé, sinon enrôlement forcé (QR code + clé manuelle) avant d'entrer dans l'app.
- **Backend** : `authMiddleware` exige le claim `aal: 'aal2'` dans le JWT sur **toutes** les routes API — une session mot-de-passe-seul (AAL1) reçoit `401 { code: 'mfa_required' }`.
- **Téléphone perdu** : un admin réinitialise la 2FA d'un utilisateur (Admin → Journalistes → icône bouclier barré, ou `DELETE /api/admin/journalists/:id/mfa`) ; l'utilisateur re-scanne un QR code à sa prochaine connexion.
- **Prérequis** : TOTP activé côté Supabase — local : `[auth.mfa.totp]` dans `supabase/config.toml` ; production : Dashboard → Authentication → MFA → TOTP.
- **Limite connue (audit)** : `isMfaRequired()` est fail-open — si la lecture de `app_settings` échoue, la 2FA est considérée désactivée. Un fail-closed serait préférable.
- **État en production au 30/09/2026** : `mfaRequired: false` (2FA désactivée, confirmé via `/api/auth/config`).

### Module WordPress — surface d'attaque

- **SSRF** : `assertSafeWpUrl` impose HTTPS, résout l'hôte et refuse toute IP privée, loopback ou lien-local (`10/8`, `127/8`, `169.254/16`, `172.16/12`, `192.168/16`, `::1`, `fc00::/7`, `fe80::/10`, formes `::ffff:` mappées). Un admin ne peut donc pas pointer le module vers un service interne ou les métadonnées cloud.
- **Publication** : toujours `status: draft`. Un journaliste ne peut jamais publier sur rollingstone.fr ; le renvoi est réservé aux admins.
- **Compte WordPress** : `rs_delivery`, rôle `api_writer`, mot de passe application (API REST uniquement, jamais `wp-admin`). Côté site, le mu-plugin n'écrit que sur une liste fermée de préfixes de métas et exige `edit_post` sur l'article visé.
- **Point ouvert (audit, HIGH)** : `POST /api/deliveries` déclenche le pipeline (appel Claude à 16 384 tokens, jusqu'à 15 tags, N médias) sans rate limit dédié — seul le limiteur global s'applique. Un limiteur par utilisateur y est recommandé.
- **Point ouvert (audit, MEDIUM)** : le HTML produit par l'IA est inséré tel quel dans le brouillon ; atténué par le statut brouillon et la relecture humaine. `sanitize-html` en allowlist est recommandé.

### Authentification — Supabase JWT

L'authentification est entièrement déléguée à Supabase Auth. Le serveur ne gère pas de sessions propres. Le middleware `authMiddleware` :

1. Extrait le token Bearer du header `Authorization`
2. Valide le token via `supabaseAdmin.auth.getUser(token)` — cet appel vérifie la signature et l'expiration du JWT côté Supabase
3. Charge le profil `profiles` pour obtenir le rôle et le statut `is_active`
4. Rejette (`403`) les comptes désactivés même avec un token valide

```typescript
req.userId   // UUID de l'utilisateur
req.userEmail
req.userRole // 'journalist' | 'admin'
```

### Autorisation — Rôles

Deux niveaux d'accès :
- **journalist** : Accès à ses propres livraisons uniquement (vérifié en base ET via RLS Supabase)
- **admin** : Accès à tout via le middleware `adminMiddleware` (vérifie `req.userRole === 'admin'`)

### Row Level Security (RLS) Supabase

> ⚠️ **État réel (vérifié en live) : la RLS est actuellement NON FONCTIONNELLE.** Les policies admin de `profiles` font un sous-select sur `profiles` (`supabase-schema.sql:77-87`), ce qui provoque une **récursion infinie** (`ERROR 42P17`) à l'évaluation. Cette erreur contamine **toutes** les tables (leurs policies admin lisent `profiles`). Conséquence : toute requête directe via la clé anon/authenticated renvoie **500**, sur toutes les tables.

**Pourquoi l'app fonctionne quand même** : le backend utilise la `service_role` key (`utils/supabase.ts`), qui **contourne** la RLS, et le frontend ne lit **aucune table directement** (uniquement `supabase.auth.*`). La RLS n'est donc jamais sur le chemin critique — c'est pourquoi la panne était invisible.

**Ce que ça implique** :
- La RLS n'offre aujourd'hui **aucune** défense en profondeur réelle : elle « tient » uniquement parce qu'elle échoue en *fail-closed*.
- **Piège critique** : ne **jamais** corriger par `ALTER TABLE profiles DISABLE ROW LEVEL SECURITY` ni en restaurant naïvement les policies admin. La clé anon est publique (bundle JS) ; rendre la RLS de nouveau « évaluable » sans précaution ouvrirait la base journalistes en lecture publique.
- **Correctif recommandé** : d'abord `REVOKE ALL ON <tables sensibles> FROM anon, authenticated;` (le backend est en `service_role`, personne d'autre n'a besoin d'accès direct), **puis** réécrire les policies via une fonction `public.is_admin()` en `SECURITY DEFINER` (qui ne redéclenche pas la RLS), en ajoutant `TO authenticated` et en fermant `hebdo_config USING(true)`. Le `REVOKE` doit être appliqué **avant ou en même temps** que la correction de la récursion, jamais après.

  ```sql
  -- 1. Fermer l'accès client (à faire EN PREMIER)
  REVOKE ALL ON app_settings, profiles, deliveries, delivery_logs, correction_prompt
    FROM anon, authenticated;

  -- 2. Puis casser la récursion
  CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql SECURITY DEFINER SET search_path = public AS
    $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') $$;
  -- remplacer chaque EXISTS(... FROM profiles ...) par public.is_admin() dans les policies,
  -- ajouter TO authenticated, et remplacer hebdo_config USING(true) par USING(auth.uid() IS NOT NULL)
  ```

Le backend applique ses propres contrôles d'accès (validation du JWT côté serveur, rôle lu en base, filtrage par `author_id`) — ceux-ci sont fonctionnels et constituent aujourd'hui la **seule** ligne de défense effective.

### Rate Limiting

**Rate limit global** (toutes les routes `/api/*`) :

```typescript
rateLimit({
  windowMs: 15 * 60 * 1000,  // Fenêtre de 15 minutes
  max: 300,                   // 300 requêtes max par IP
})
```

Les headers standardisés `RateLimit-*` sont inclus dans les réponses.

**Rate limits spécifiques par endpoint** :

| Endpoint | Limite | Fenêtre | Clé |
|---|---|---|---|
| `POST /api/correct` | 30 requêtes | 1 heure | Par utilisateur (userId) |
| `POST /api/deliveries/ensure-hebdo` (création uniquement) | 5 créations | 1 heure | Par utilisateur (userId) |

Ces limites spécifiques s'ajoutent au rate limit global. Par exemple, un utilisateur peut effectuer 300 requêtes API en 15 minutes, mais parmi celles-ci, il ne peut pas dépasser 30 corrections par heure.

### Helmet — Headers de sécurité HTTP

En production, Helmet configure une Content Security Policy stricte :

```
default-src: 'self'
script-src:  'self' 'unsafe-inline' https://client.crisp.chat
style-src:   'self' 'unsafe-inline' https://fonts.googleapis.com https://client.crisp.chat
font-src:    'self' https://fonts.gstatic.com https://client.crisp.chat
img-src:     'self' data: https:
connect-src: 'self' https://*.supabase.co wss://client.relay.crisp.chat https://client.crisp.chat https://storage.crisp.chat
frame-src:   https://game.crisp.chat
object-src:  'none'
```

**Note** : Les domaines `crisp.chat` sont autorisés pour le widget de support Crisp intégré à l'application (chat en direct). `'unsafe-inline'` est requis pour les scripts inline de Crisp.

En développement, la CSP est désactivée pour simplifier le workflow Vite HMR.

### CORS

La liste des origines autorisées est construite depuis `FRONTEND_URL` :
- En production : uniquement l'URL du frontend Railway
- En développement : `http://localhost:5173` par défaut

Les requêtes sans `Origin` (ex. curl depuis le même serveur) sont autorisées.

### Nettoyage HTML

Tous les champs texte des métadonnées sont systématiquement nettoyés des balises HTML avant enregistrement en base et avant génération DOCX. Les entités HTML (`&nbsp;`, `&amp;`, etc.) sont décodées. Ce nettoyage est appliqué à deux niveaux :
- Dans `POST /api/deliveries` et `PUT /api/deliveries/:id` (côté journaliste)
- Dans `PUT /api/admin/deliveries/:id` (côté admin)

### Validation des URLs

Les URLs Dropbox et les liens numériques affichés dans le frontend sont validés par `isSafeUrl()` — seuls les protocoles `http:` et `https:` sont autorisés. Dans le service email, `sanitizeUrl()` applique la même validation. Cela prévient les injections `javascript:` dans les attributs `href`.

### Protection des clés API

Les clés stockées dans `app_settings` ne sont jamais retournées **en clair par l'API** : `GET /api/admin/settings` retourne une version masquée `••••••••xxxx` (8 puces + 4 derniers caractères).

> **Nuance importante** : ce masquage est purement côté présentation. Les valeurs sont stockées **en clair** (`TEXT`) dans `app_settings` ; le masquage ne protège donc pas contre un accès direct à la base. Recommandation : `REVOKE` l'accès `anon`/`authenticated` sur `app_settings` et déplacer les secrets vers les variables d'environnement Railway (le code lit déjà `process.env` en fallback).

**Mot de passe applicatif WordPress** : il est désormais stocké dans la variable d'environnement Railway `WORDPRESS_APP_PASSWORD` (et la ligne `app_settings` correspondante est vidée). `getWpConfig()` lit `app_settings` en priorité puis retombe sur `process.env`, donc le déplacement est transparent.

**Journalisation — pas de fuite du header d'authentification** : `wpClient()` (`services/wordpress.ts`) installe un intercepteur axios qui **efface le header `Authorization` de l'objet d'erreur** avant qu'il ne remonte. Les appelants (`routes/deliveries.ts`, `routes/admin.ts`) ne logguent par ailleurs que `err.response.data || err.message`, jamais l'objet brut. Cela empêche le mot de passe applicatif WordPress (Basic auth) d'atterrir en clair dans les logs Railway. Même modèle que `services/dropbox.ts`.

### Gestion des erreurs

Un handler d'erreurs Express global intercepte toutes les erreurs non gérées et retourne une réponse standardisée avec un `errorId` unique (UUID) :

```json
{ "error": "Internal server error", "reference": "uuid-v4" }
```

En production, la stacktrace n'est pas exposée dans la réponse.

### Indexation et SEO

L'application envoie un header `X-Robots-Tag: noindex, nofollow` sur toutes les requêtes **sauf** celles provenant de bots de réseaux sociaux (Facebook, Twitter, WhatsApp, Slack, LinkedIn). Cela empêche l'indexation par les moteurs de recherche tout en permettant l'aperçu OpenGraph lors du partage de liens.

### Widget de support — Crisp

Un widget de chat Crisp est intégré en production pour le support utilisateur. Les domaines Crisp (`client.crisp.chat`, `client.relay.crisp.chat`, `storage.crisp.chat`, `game.crisp.chat`) sont autorisés dans la CSP. La configuration du widget (identifiant Crisp) est gérée côté frontend.

### Upload de fichiers — Multer

- Seuls les fichiers avec un mimetype `image/*` sont acceptés ; les SVG sont refusés d'emblée (vecteur XSS)
- **Vérification des magic bytes** après réception (`assertRealImages`) : le contenu binaire doit correspondre à une image réelle (JPEG/PNG/GIF/WebP/TIFF/HEIC), indépendamment du mimetype client
- Taille maximale par fichier : **60 Mo** ; maximum **30 fichiers** par soumission (photos de presse HD)
- Stockage en mémoire (Buffer) — pas de fichiers temporaires sur disque

> Note : `POST /api/deliveries` déclenche le pipeline WordPress (appel IA + uploads médias) mais n'a **pas** de rate limit dédié — seul le limiteur global (300/15 min/IP) s'applique. Un rate limit par utilisateur y est recommandé.

### Contrôles d'accès vérifiés (audit du 4 septembre 2026)

- **Pas d'IDOR** : `GET /api/deliveries`, `GET /:id`, `PUT /:id` filtrent tous par `author_id = req.userId`. L'attribution à un autre auteur est réservée aux admins.
- **Pas d'escalade de rôle** : aucun endpoint ne permet à un journaliste d'écrire son propre `role` ; la modification est admin-only et protège le dernier admin.
- **Bundle navigateur propre** : aucune sourcemap, aucun secret, seules les trois variables `VITE_*` attendues.
- **En-têtes** : CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `X-Robots-Tag` confirmés en live.

### Marqueur de paternité

Les sources embarquent une déclaration d'auteur signée Ed25519 (`backend/src/meta/provenance.ts`, `frontend/src/lib/provenance.ts`), vérifiable sans la clé privée avec `node scripts/authorship/verify.mjs <fichier|dossier>`. Voir §9. Ce n'est pas un mécanisme de sécurité applicative mais une preuve d'antériorité : la clé privée reste hors dépôt (`~/.rs-hebdo-authorship/`).

### Ordre de correction recommandé (extrait de l'audit)

1. ✅ **Fait** — ne plus logger l'objet d'erreur axios WordPress (fuite du mot de passe application dans les logs Railway) ; rotation du mot de passe.
2. `REVOKE ALL ON app_settings, profiles, deliveries, delivery_logs, correction_prompt FROM anon, authenticated;` — **avant** toute correction de la récursion RLS.
3. Corriger la récursion RLS via `is_admin()` `SECURITY DEFINER`, ajouter `TO authenticated`, fermer `hebdo_config USING(true)`. **Jamais** `DISABLE ROW LEVEL SECURITY`.
4. Sortir les secrets restants de `app_settings` vers Railway et les faire tourner (Dropbox refresh token en priorité). ✅ Déjà fait pour `WORDPRESS_APP_PASSWORD`.
5. Rate limit dédié sur `POST /api/deliveries`, `fieldSize` multer, plafond `sign_limit` serveur.
6. Verrouiller le wizard de setup (allow-list, `SETUP_ENABLED`), `sanitize-html` sur le contenu WordPress, `maskValue` → `isSet`, MFA fail-closed, CSP sans `unsafe-inline`.

---

## 13. Troubleshooting

### La correction IA ne fonctionne pas

| Symptôme | Cause probable | Solution |
|---|---|---|
| "Correction indisponible" dans le formulaire | Clé du moteur actif absente ou invalide (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY` ou `MISTRAL_API_KEY` selon `AI_PROVIDER`) | Vérifier la clé dans l'onglet Paramètres (section Moteur IA signale la clé manquante) ou dans `backend/.env`. La clé dans `app_settings` a priorité sur la variable d'environnement |
| `503` avec `providerStatus` 429 ou 5xx | Quota épuisé ou fournisseur surchargé | Attendre, ou basculer temporairement le moteur dans l'admin (Gemini/Mistral). En local, `claude-code` utilise l'abonnement Claude plutôt que les crédits API |
| « La correction n'a pas abouti » | Sortie structurée incomplète après 2 tentatives (texte très long, troncature) | Réessayer ; découper le texte si > 100 000 signes. Ce message remplace l'ancien faux « 0 correction » |
| Correction très lente (> 30s) | Texte très long ou surcharge API | Normal pour un sujet de couv (30-90 s ; timeout 5 min). Vérifier le status du fournisseur |
| Le modèle Claude choisi n'existe plus | `CLAUDE_MODEL` obsolète | Le backend bascule automatiquement sur `claude-sonnet-4-5-20250929` à la 2e tentative ; choisir un modèle dans la liste live de l'admin |
| Moteur `claude-code` en erreur en production | Binaire `claude` absent sur Railway | Ce moteur est local uniquement ; repasser sur `anthropic` |
| Erreur 401 sur `/api/correct` | Token Supabase expiré côté frontend, ou 2FA active et session AAL1 (`code: mfa_required`) | Se déconnecter et se reconnecter ; passer la 2FA |

### WordPress

| Symptôme | Cause probable | Solution |
|---|---|---|
| Aucun brouillon créé, `wp_status` vide | Module désactivé | Admin → Paramètres → WordPress → interrupteur « Active » |
| `wp_status = error`, email « Échec de l'envoi WordPress » | Identifiants invalides, URL refusée, IA ou upload en échec | Lire l'étape `wp-error` dans les Logs ; « Tester la connexion » dans l'admin ; relancer via le globe (onglet Livraisons) |
| « WORDPRESS_URL doit utiliser HTTPS » / « adresse réseau interne » | Anti-SSRF | Saisir `https://www.rollingstone.fr` ; les hôtes internes sont refusés par conception |
| Pastille ambre « à finir dans l'éditeur », log `wp-meta` « champ(s) refusé(s) » | WordPress a ignoré des métas non déclarées en REST | Yoast : vérifier que le mu-plugin est présent (`GET /wp-json/` doit lister `rs-delivery/v1`). Style Music / Main Artist / Reviewer : renseigner `WP_META_MAP` après lecture des clés sur un article de référence (`GET /wp-json/rs-delivery/v1/post-meta/{id}`) |
| `GET /wp-json/rs-delivery/v1/post-meta/1` → 404 | L'article 1 n'existe pas | Ce n'est pas un signe d'absence du plugin : tester avec un ID d'article réel |
| `curl` vers rollingstone.fr renvoie une page Cloudflare / 403 | Pare-feu sensible au `User-Agent` | Envoyer un UA de navigateur (`-A "Mozilla/5.0 ..."`) |
| Image à la une absente sur une chronique | Aucune photo livrée et rien en médiathèque | Livrer la pochette dans le champ `photos` ; le log `wp-media` indique la recherche tentée |
| Article envoyé sans catégorie | L'IA a proposé des IDs inconnus | Warning `wp-format` ; corriger dans l'éditeur. La taxonomie de référence est dans `wordpressRules.ts` |
| Renvoi depuis l'admin sans images | Images introuvables dans le dossier Dropbox | Le dossier a été déplacé/renommé ; warning `wp-media`, l'article part sans image |
| `502` sur `POST /api/deliveries` avec beaucoup de photos | Corps multipart > ~78 Mo refusé par le proxy Railway | Réduire les JPEG > 10 Mo avant envoi (voir §11) |

### Double authentification

| Symptôme | Cause probable | Solution |
|---|---|---|
| Boucle sur `/mfa`, code refusé | Horloge du téléphone décalée, ou application supprimée | Vérifier l'heure automatique ; sinon un admin réinitialise la 2FA (Journalistes → bouclier barré) et l'utilisateur re-scanne un QR code |
| `401 { code: "mfa_required" }` sur l'API | 2FA activée après connexion ; la session est restée AAL1 | Se déconnecter / reconnecter pour passer le challenge TOTP |
| Interrupteur 2FA sans effet dans l'admin | `REQUIRE_MFA=true` en variable d'environnement | La variable verrouille l'activation ; la retirer de Railway pour rendre la main à l'admin |
| Enrôlement impossible (« MFA not enabled ») | TOTP désactivé côté Supabase | Dashboard Supabase → Authentication → MFA → activer TOTP |

### Les emails ne partent pas

| Symptôme | Cause probable | Solution |
|---|---|---|
| Aucun email reçu, pas d'erreur dans les logs | `RESEND_API_KEY` non configurée | Vérifier que la variable est présente dans `backend/.env` (local) et dans Railway (production) |
| Erreur `422` dans les logs console | Adresse d'expédition non autorisée | Sans domaine vérifié sur Resend, utiliser `onboarding@resend.dev` comme `RESEND_FROM_EMAIL`. Avec domaine custom : vérifier les DNS (DKIM/SPF) dans le dashboard Resend |
| Emails reçus en spam | Domaine non authentifié | Configurer un domaine custom dans Resend et ajouter les enregistrements DNS |

### Dropbox : erreurs d'upload

| Symptôme | Cause probable | Solution |
|---|---|---|
| `invalid_access_token` | Refresh token expiré ou révoqué | Re-générer un refresh token via le flux OAuth2 (voir section 4, variable `DROPBOX_REFRESH_TOKEN`) |
| `path/not_found` | Le dossier racine n'existe pas dans Dropbox | Créer manuellement le dossier défini dans `DROPBOX_ROOT_FOLDER` (défaut : `/Hebdo Delivery`) |
| Timeout sur les gros uploads | Images trop lourdes | Vérifier que les timeouts serveur sont bien à 5 minutes (voir section 11). Réduire la taille des images côté journaliste |

### CORS en développement

| Symptôme | Cause probable | Solution |
|---|---|---|
| `CORS policy: No 'Access-Control-Allow-Origin'` | `FRONTEND_URL` mal configurée | Vérifier que `FRONTEND_URL=http://localhost:5173` dans `backend/.env` |
| CORS OK en dev, erreur en prod | `FRONTEND_URL` pointe encore sur localhost | Mettre l'URL Railway production dans la variable Railway |

### Supabase / Authentification

| Symptôme | Cause probable | Solution |
|---|---|---|
| 403 sur toutes les requêtes API | Profil absent dans `profiles` | L'utilisateur existe dans Supabase Auth mais pas dans la table `profiles`. Insérer manuellement |
| 403 malgré un profil existant | Compte désactivé (`is_active = false`) | Passer `is_active` à `true` dans `profiles` via le SQL Editor ou l'admin |
| "Invalid JWT" | `SUPABASE_URL` ou `SUPABASE_ANON_KEY` incorrects | Vérifier les valeurs dans `backend/.env` et `frontend/.env` — elles doivent pointer vers le même projet Supabase |

### Setup Wizard / Configuration initiale

| Symptôme | Cause probable | Solution |
|---|---|---|
| Le setup wizard apparaît alors que les clés sont configurées | Les clés sont dans les variables d'env mais pas dans `app_settings`, ou inversement | Le check vérifie les deux sources. S'assurer que les 4 clés obligatoires sont non-vides dans au moins une source |
| `403 Token de setup invalide` | Le header `X-Setup-Token` ne correspond pas à `SETUP_SECRET_TOKEN` | Vérifier que la variable `SETUP_SECRET_TOKEN` est définie dans `backend/.env` et que le frontend envoie la bonne valeur |
| `403 SETUP_SECRET_TOKEN non configure` | Variable d'environnement absente | Ajouter `SETUP_SECRET_TOKEN` dans `backend/.env` (voir section 4) |
| `403 Application deja configuree` | Setup déjà effectué | Normal — utiliser l'onglet Settings de l'admin pour modifier les clés |

### Build / Déploiement

| Symptôme | Cause probable | Solution |
|---|---|---|
| Build frontend échoue | Variables `VITE_*` absentes | Les variables Vite sont injectées au **build**, pas au runtime. Les définir dans Railway **avant** le déploiement |
| Une variable `VITE_*` modifiée n'est pas prise en compte | `railway redeploy` relance l'ancien artefact | Lancer `railway up` pour rebuilder |
| `railway up` expire avant le build | Envoi trop volumineux | Vérifier que `.railwayignore` est présent et exclut `HEBDO*/`, `node_modules/`, `dist/` |
| `MODULE_NOT_FOUND` au démarrage | `npm ci` n'a pas tourné dans backend/ ou frontend/ | Vérifier le script `postinstall` dans le `package.json` racine. En local : `cd backend && npm ci && cd ../frontend && npm ci` |

---

## 14. Glossaire

| Terme | Définition |
|---|---|
| **Hebdo** | Numéro hebdomadaire du magazine Rolling Stone France. Identifié par un numéro entier et un label `RSH<numero>` |
| **Type de papier** | Catégorie éditoriale définissant la structure du contenu (ex. Chroniques, Interview 3000). Chaque type a son propre formulaire et son dossier Dropbox |
| **Livraison** | Action de soumettre un papier pour un hebdo donné. Crée un enregistrement `deliveries` et dépose les fichiers dans Dropbox |
| **DOCX** | Format Microsoft Word généré automatiquement à partir du contenu du formulaire |
| **Metadata** | Champ JSONB contenant tous les champs du formulaire sous forme clé-valeur (artiste, album, corps, accroche, etc.) |
| **Sign count** | Nombre de caractères du corps du texte (`corps`), utilisé pour vérifier le respect de la limite éditoriale |
| **Correction IA** | Passage du corps du texte par Claude (Anthropic) pour correction orthographique et stylistique |
| **RLS** | Row Level Security — mécanisme PostgreSQL/Supabase d'isolation des données par utilisateur au niveau de la base |
| **Service role** | Clé Supabase avec accès administrateur complet, contournant le RLS. Utilisée uniquement côté backend |
| **Nixpacks** | Système de build automatique de Railway, configuré via `nixpacks.toml` |
| **RS Hebdo** | Rolling Stone Hebdomadaire — désigne le magazine ou ses numéros dans le contexte de l'application |
| **Setup Wizard** | Assistant de configuration initiale affiché au premier lancement si les clés API ne sont pas configurées. Protégé par `SETUP_SECRET_TOKEN` |
| **Rotation auto** | Service `hebdoRotation.ts` qui crée automatiquement le prochain numéro hebdomadaire lorsque la date de fin de l'hebdo courant est dépassée |
| **Onboarding** | Tutoriel interactif en 5 étapes affiché au premier login d'un journaliste. Tracké via localStorage |
| **Crisp** | Widget de chat en direct intégré pour le support utilisateur en production |
| **AAL1 / AAL2** | Niveau d'assurance d'authentification du JWT Supabase : mot de passe seul (AAL1) ou mot de passe + TOTP vérifié (AAL2). Exigé AAL2 par le backend quand la 2FA est active |
| **TOTP** | Code à usage unique basé sur le temps (Google Authenticator, 1Password…), utilisé pour la 2FA |
| **Moteur IA / `AI_PROVIDER`** | Fournisseur utilisé pour la correction : `anthropic`, `gemini`, `mistral` ou `claude-code` (local) |
| **Mot de passe application** | Identifiant WordPress dédié à l'API REST (Basic auth), distinct du mot de passe de connexion à `wp-admin` |
| **mu-plugin** | *Must-use plugin* WordPress, actif dès qu'il est déposé dans `wp-content/mu-plugins/`. Ici `rs-delivery-rest-meta.php`, qui expose les métas Yoast en REST et les routes `rs-delivery/v1` |
| **`WP_META_MAP`** | Réglage JSON reliant Style Music, Main Music Artist et note Reviewer à leurs clés de métas WordPress réelles |
| **`metaRejected` / `editorTodo`** | Liste des clés de métas refusées par WordPress et, dérivée, liste lisible des champs à finir à la main dans l'éditeur (pastille ambre) |
| **Reviews Box** | Encadré de notation du plugin Reviewer (Evographics) sur rollingstone.fr, rendu par le shortcode `[rwp-review-recap id="0"]` ajouté automatiquement aux chroniques |
| **Image à la une** | *Featured image* WordPress, normalisée par l'app au format 1280 × 853 (template Canva éditorial) |
| **Marqueur de paternité** | Déclaration d'auteur signée Ed25519 embarquée dans les sources et le bundle (`scripts/authorship/`) |
| **WP Engine / `wpe`** | Hébergeur de rollingstone.fr et CLI maison (`scripts/wpe`) pour WP-CLI via SSH, webhooks de build headless et API REST WP Engine |
