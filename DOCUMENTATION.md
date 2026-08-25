# RS Hebdo Delivery — Documentation Technique

**Version** : 1.1.0  
**Date** : 2026-04-10  
**Auteur** : Documentation générée à partir du code source

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

RS Hebdo Delivery est la plateforme interne de Rolling Stone France qui gère la remise des papiers par les journalistes. L'outil couvre l'intégralité du cycle de vie d'un papier : saisie du contenu dans un formulaire structuré par type de papier, correction orthographique et stylistique automatisée via Claude (IA d'Anthropic), génération du fichier DOCX formaté, dépôt dans Dropbox dans la bonne arborescence, et notification email à la rédaction en chef.

### Acteurs principaux

| Acteur | Rôle |
|---|---|
| Journaliste | Remise des papiers via le formulaire, consultation de ses livraisons |
| Administrateur | Gestion des hebdos, types de papier, journalistes, consultation des logs, paramétrage des clés API et du prompt IA |

### Flux simplifié

```
Journaliste → sélection hebdo → sélection type papier → saisie contenu
           → correction IA (Claude) → review → soumission
           → génération DOCX → upload Dropbox → notification email → enregistrement BDD
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
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
   │  Supabase   │    │   Dropbox    │    │  Anthropic   │
   │ (PostgreSQL │    │   API v2     │    │  Claude API  │
   │  + Auth)    │    │              │    │              │
   └─────────────┘    └──────────────┘    └──────────────┘
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
| Auth | Supabase Auth | — |
| Stockage fichiers | Dropbox API | v2 |
| Génération DOCX | docx (npm) | 9.x |
| IA correction | Anthropic Claude | claude-sonnet-4-20250514 |
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

6. **Créer la table `correction_prompt`** (non incluse dans le schéma principal) — exécuter dans le SQL Editor :

```sql
CREATE TABLE correction_prompt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

ALTER TABLE correction_prompt ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage correction prompt"
  ON correction_prompt FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

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

Les clés Anthropic, Dropbox et Resend peuvent être configurées plus tard via l'interface setup ou l'admin.

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
├── supabase-schema.sql       # Schéma complet de la base de données
├── DOCUMENTATION.md          # Ce fichier
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts          # Point d'entrée Express, middlewares globaux
│       ├── middleware/
│       │   ├── auth.ts       # Vérification JWT Supabase
│       │   └── admin.ts      # Vérification rôle admin
│       ├── routes/
│       │   ├── auth.ts       # GET /api/auth/profile
│       │   ├── deliveries.ts # CRUD livraisons journalistes
│       │   ├── admin.ts      # CRUD admin (types, hebdos, journalistes, logs, prompt, settings)
│       │   ├── correction.ts # POST /api/correct
│       │   └── setup.ts      # GET /api/setup/status, POST /api/setup/configure
│       ├── services/
│       │   ├── claude.ts     # Appel à l'API Anthropic (correction texte)
│       │   ├── docx.ts       # Génération du fichier DOCX
│       │   ├── dropbox.ts    # Upload Dropbox API v2 (service principal)
│       │   ├── email.ts      # Notification email via Resend API
│       │   ├── deliveryLogger.ts # Logs structurés en base Supabase
│       │   └── hebdoRotation.ts  # Rotation automatique des hebdos (cron interne)
│       └── utils/
│           └── supabase.ts   # Client Supabase (admin + user)
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── main.tsx          # Point d'entrée React
        ├── App.tsx           # Routeur principal
        ├── types/
        │   └── index.ts      # Tous les types TypeScript partagés
        ├── lib/
        │   └── supabase.ts   # Client Supabase frontend (auth uniquement)
        ├── stores/
        │   └── authStore.ts  # Store Zustand — état d'authentification
        ├── services/
        │   └── api.ts        # Couche HTTP (Axios) vers le backend
        ├── components/
        │   ├── Layout.tsx    # Shell de l'application (nav, sidebar)
        │   └── ProtectedRoute.tsx # HOC de protection des routes
        └── pages/
            ├── LoginPage.tsx
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
                ├── JournalistsTab.tsx
                ├── DeliveriesTab.tsx
                ├── PromptTab.tsx
                ├── LogsTab.tsx
                └── SettingsTab.tsx
```

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

---

## 5. Base de données

Le schéma complet se trouve dans `supabase-schema.sql`. Les politiques RLS (Row Level Security) sont activées sur toutes les tables.

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

**Rétention** : Le code prévoit une suppression manuelle des logs de plus de 30 jours via `DELETE /api/admin/logs`. Le commentaire dans le schéma SQL mentionne une suppression automatique des logs de plus de 90 jours pouvant être activée via un cron Supabase.

---

### Table `app_settings`

Stockage des clés API et paramètres configurables par les admins depuis l'interface. Évite de devoir redéployer l'application pour changer une clé.

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Identifiant |
| `key` | TEXT (UNIQUE) | Nom du paramètre |
| `value` | TEXT | Valeur (masquée dans les réponses API : seuls les 4 derniers caractères sont visibles) |
| `updated_at` | TIMESTAMPTZ | — |
| `updated_by` | UUID (FK → profiles, nullable) | Admin ayant effectué la dernière modification |

**Clés prédéfinies** (seed) :
- `ANTHROPIC_API_KEY`
- `DROPBOX_APP_KEY`
- `DROPBOX_APP_SECRET`
- `DROPBOX_REFRESH_TOKEN`

**Note** : Le service `claude.ts` lit `ANTHROPIC_API_KEY` depuis cette table en priorité, avec fallback sur la variable d'environnement. Le service `dropbox.ts` utilise uniquement les variables d'environnement (la synchronisation entre `app_settings` et les variables d'environnement n'est pas implémentée automatiquement — prévu pour une version future).

---

### Table `correction_prompt`

Stocke le prompt système envoyé à Claude pour la correction de texte. Il n'existe qu'une seule ligne dans cette table (pattern singleton).

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Identifiant |
| `prompt_text` | TEXT | Le prompt complet envoyé à Claude |
| `updated_at` | TIMESTAMPTZ | — |
| `updated_by` | UUID (FK → profiles, nullable) | Admin ayant modifié le prompt |

**Note** : La table `correction_prompt` n'est pas présente dans le fichier `supabase-schema.sql` principal. Elle doit exister dans la base Supabase déployée. Si la table est absente ou vide, le service `claude.ts` utilise automatiquement le `FALLBACK_PROMPT` codé en dur dans le code source.

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

Tous les endpoints sauf `/api/health` et `/api/setup/*` exigent un header `Authorization` :

```
Authorization: Bearer <supabase_access_token>
```

Le token est le JWT Supabase de la session active. Le frontend l'injecte automatiquement via un intercepteur Axios.

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
{ "message": "Dossiers prets", "folderUrl": "https://www.dropbox.com/..." }
```

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
| `images` | File[] | Images (0 à 10, max 25 Mo chacune) |

**Contraintes** :
- Images : uniquement des fichiers `image/*`
- Taille max par fichier : 25 Mo
- Maximum 10 images par soumission

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
8. Envoi de la notification email
9. Retour de la réponse

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
Envoie un texte à Claude pour correction orthographique et stylistique.

**Body** :
```json
{ "text": "Le texte a corriger..." }
```

**Contrainte** : Texte de 1 à 100 000 caractères  
**Rate limit spécifique** : 30 requêtes par heure par utilisateur (en plus du rate limit global)

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
  "signCount": 1234
}
```

Types de correction possibles : `orthographe`, `grammaire`, `ponctuation`, `style`, `typographie`

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
| `PUT` | `/api/admin/journalists/:id` | Modifie un profil (nom, rôle, is_active) |

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
| `PUT` | `/api/admin/deliveries/:id` | Modifie les métadonnées d'une livraison sans re-upload Dropbox |
| `DELETE` | `/api/admin/deliveries/:id` | Supprime définitivement une livraison |

**Note sur PUT admin** : Contrairement à `PUT /api/deliveries/:id`, cette route ne re-génère pas le DOCX et ne re-uploade pas dans Dropbox. Elle met à jour uniquement les métadonnées en base. Usage prévu pour des corrections mineures post-livraison.

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

#### Paramètres API

| Méthode | URL | Description |
|---|---|---|
| `GET` | `/api/admin/settings` | Liste tous les paramètres (valeurs masquées) |
| `PUT` | `/api/admin/settings` | Met à jour un ou plusieurs paramètres |

**Body PUT settings** :
```json
{
  "settings": [
    { "key": "ANTHROPIC_API_KEY", "value": "sk-ant-..." },
    { "key": "DROPBOX_APP_KEY", "value": "abc123" }
  ]
}
```

**Masquage des valeurs** : La réponse GET (et la réponse PUT) retourne les valeurs masquées : `••••••••xxxx` (8 points + 4 derniers caractères). Cela permet de vérifier visuellement qu'une clé est configurée sans exposer sa valeur.

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
    │                    │                    │──claude.correctText()►│ Claude API
    │                    │                    │◄──corrections────────│
    │                    │◄──correctedText────│                     │
    │                    │                    │                     │
    │──review + submit───►│                    │                     │
    │                    │──POST /api/deliveries►│                  │
    │                    │   (multipart)       │──generateDocx()─────►│ docx lib
    │                    │                    │◄──Buffer DOCX────────│
    │                    │                    │──uploadDelivery()───►│ Dropbox
    │                    │                    │◄──folderUrl──────────│
    │                    │                    │──INSERT deliveries──►│ Supabase
    │                    │                    │──notifyDelivery()───►│ Resend
    │                    │◄──201 success──────│                     │
    │◄──confirmation UI──│                    │                     │
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
3. Construit le chemin de destination avec une logique spéciale :
   - `Interview *` : renomme le sous-dossier avec le nom de l'artiste (`Interview Bowie`)
   - `Livres et expo` : ajoute le nom du journaliste
   - `Chroniques Musique` / `Chronique cinema` : crée un sous-dossier au nom du journaliste
4. Upload le DOCX (mode overwrite)
5. Upload chaque image séquentiellement
6. Crée ou récupère les liens partagés

**Résilience** : Un mécanisme de retry automatique gère les erreurs 429 (rate limit) et 401 (token expiré). Maximum 3 tentatives avec backoff.

### Étape 9 : Enregistrement et notification

La livraison est enregistrée en base Supabase avec tous les champs. Un email HTML est envoyé à `NOTIFY_EMAIL_ALMA` et `NOTIFY_EMAIL_DENIS` avec les informations clés et un lien vers le dossier Dropbox.

### Étape 10 : Envoi WordPress (parallèle, non bloquant)

Si le module WordPress est activé (admin → Paramètres → WordPress), chaque livraison est aussi envoyée sur rollingstone.fr via l'API REST WP (`/wp-json/wp/v2/`), authentifiée par **mot de passe application** (Basic auth). Le pipeline (`services/wordpressPublisher.ts`) :

1. Recherche jusqu'à 5 articles existants sur le site (candidats de lien interne).
2. Mise en forme IA (Claude, sortie structurée forcée) selon les conventions éditoriales (`services/wordpressRules.ts`) : chapô en H3, intertitres H4 (jamais H1/H2/H5/H6, jamais de lien dans H3/H4), citations `<em>« »</em>`, crédit traduction en fin d'article si une URL source RS US est fournie, ≥ 1 lien interne, catégories parent + sous-catégorie (taxonomie complète avec IDs), ≥ 5 tags, Yoast (focus keyword, titre SEO ~55c, meta description ~150c, slug propre).
3. Tags : réutilisation des tags existants (recherche) avant création.
4. Image à la une : première image de la livraison, dédupliquée par nom de fichier dans la médiathèque, crédit photo en légende (jamais dans le corps).
5. Création du post en **brouillon** avec le titre suffixé `[EN ATTENTE DE RELECTURE]`.
6. Suivi sur la livraison : `wp_post_id`, `wp_post_url` (lien d'édition), `wp_status` (`pending`/`sent`/`error`), `wp_payload` (payload IA complet).

**Champs à finir à la main dans l'éditeur classique** (non fiables via REST) : Yoast (`yoast_wpseo_*`), Style Music (`select[name="liste"]`) et Main Music Artist (`input#new-mat-tag`). Les valeurs suggérées par l'IA sont conservées dans `wp_payload`.

Un échec WordPress ne bloque **jamais** la livraison : il est loggé (onglet Logs, étapes `wp-*`) et l'admin peut relancer l'envoi depuis l'onglet Livraisons (icône globe) ou via `POST /api/admin/deliveries/:id/wordpress`. Test des identifiants : `POST /api/admin/wordpress/test`.

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
- Modifier le nom, le rôle (`journalist` ou `admin`) et le statut actif/inactif
- La désactivation d'un compte (`is_active = false`) empêche immédiatement toute connexion

### Onglet "Livraisons"

Vue globale de toutes les livraisons de tous les journalistes :
- Filtrage par hebdo, type de papier, journaliste
- Consultation du détail d'une livraison
- Modification des métadonnées (sans re-génération Dropbox)
- Suppression définitive

### Onglet "Prompt IA"

Éditeur du prompt envoyé à Claude pour la correction. Interface avec :
- Textarea pleine page (mode mono-espace)
- Compteur de caractères
- Avertissement de zone sensible
- Confirmation obligatoire avant sauvegarde
- Annulation des modifications

**Important** : Une modification incorrecte du prompt peut casser silencieusement la correction (Claude ne produira plus de JSON valide). En cas de doute, Claude utilise son `FALLBACK_PROMPT` codé en dur dans `backend/src/services/claude.ts`.

### Onglet "Logs"

Tableau de bord des logs du pipeline de livraison :
- Filtrage par niveau (Tous / Erreurs / Alertes / Info)
- Résumé rapide (nombre d'erreurs, d'alertes)
- Détail expandable par log (contexte : journaliste, hebdo, type, titre, stacktrace)
- Rafraîchissement manuel
- Bouton de nettoyage (supprime les logs > 30 jours)

### Onglet "Settings"

Gestion des clés API depuis l'interface (sans redéploiement) :
- Section "API Claude" : `ANTHROPIC_API_KEY`
- Section "Dropbox" : `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`

Les valeurs existantes sont masquées (`••••••••xxxx`). Pour modifier une clé, cliquer "Modifier" et saisir la nouvelle valeur. La sauvegarde est par section.

---

## 9. Services internes

### `services/claude.ts`

**Modèle utilisé** : `claude-sonnet-4-20250514`  
**Timeout** : 120 secondes  
**Max tokens réponse** : 8 192

La fonction `correctText(text)` :
1. Charge le prompt depuis la table `correction_prompt` (fallback sur `FALLBACK_PROMPT`)
2. Envoie le texte à Claude en demandant une réponse JSON structurée
3. Parse la réponse JSON (gère les blocs markdown ```json ... ```)
4. Retourne `{ correctedText, corrections, signCount }`
5. En cas d'erreur de parsing, retourne le texte original inchangé

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

**Logique de nommage des sous-dossiers** :
- Type `Interview` : renommé `Interview <nom artiste>` si l'artiste est renseigné
- Type `Livres et expo` : suffixé du nom du journaliste
- Types `Chroniques Musique` et `Chronique cinema` : création d'un sous-sous-dossier au nom du journaliste

---

### `services/email.ts`

Service de notification email via **Resend API** (https://resend.com). Utilise un simple `fetch` POST vers `https://api.resend.com/emails` — aucune dépendance npm supplémentaire. L'email HTML utilise des styles inline (compatible webmail).

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
   - Crée un nouvel hebdo N+1 avec label `RSH{numero+1}`, une fenêtre de 7 jours (`start_date` = ancien `end_date`, `end_date` = +7 jours)
   - Définit le nouvel hebdo comme courant
4. Si la création échoue, restaure le flag `is_current` sur l'ancien hebdo (rollback)

**Fréquence** : Vérification immédiate au démarrage du serveur, puis toutes les 60 minutes (configurable via `CHECK_INTERVAL_MS`).

**Cas limites** :
- Si aucun hebdo courant n'existe → skip silencieux
- Si l'hebdo courant n'a pas de `end_date` → skip silencieux
- Les erreurs sont loggées en console mais ne bloquent jamais le serveur

**Impact pour l'admin** : Les numéros hebdomadaires sont créés automatiquement à l'expiration de la date de fin. L'admin n'a pas besoin de créer manuellement le prochain numéro, mais peut toujours le faire via l'onglet Hebdo de l'admin.

---

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
  → supabase.auth.signInWithPassword()
  → getProfile() via API backend
  → set({ user: profile })
```

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

**Upload d'images** : Intégration `react-dropzone` avec prévisualisation. Formats acceptés : jpg, jpeg, png, webp, gif, heic, heif, tiff, bmp, avif. Taille max 25 Mo. Maximum 20 fichiers.

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
```

**Note** : Railway injecte automatiquement `PORT`. Ne pas définir cette variable manuellement.

### Variables d'environnement Vite (frontend)

Les variables `VITE_*` sont injectées au moment du **build** (pas du runtime). Elles doivent être définies dans Railway **avant** le déploiement ou en les ajoutant au fichier `frontend/.env.production` committé.

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=
```

`VITE_API_URL` est laissé vide : les appels API seront relatifs à l'origine (ex. `https://votre-app.railway.app/api/...`).

### Déploiement

```bash
# Depuis le répertoire racine du projet
railway up
```

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

Les routes de livraison (`POST /api/deliveries`, `PUT /api/deliveries/:id`) étendent le timeout à **5 minutes** (300s) sur leur requête spécifique, car le pipeline complet (DOCX + upload Dropbox + images) peut être long. Le timeout de la correction IA (`POST /api/correct`) est de **120 secondes**.

---

## 12. Sécurité

### Double authentification (2FA) — obligatoire pour tous

La 2FA TOTP (Google Authenticator, 1Password, Authy…) est **obligatoire pour tous les comptes**, via le MFA natif Supabase :

- **Frontend** : après le login par mot de passe, la page `/mfa` prend le relais — saisie du code à 6 chiffres si un facteur est déjà enrôlé, sinon enrôlement forcé (QR code + clé manuelle) avant d'entrer dans l'app.
- **Backend** : `authMiddleware` exige le claim `aal: 'aal2'` dans le JWT sur **toutes** les routes API — une session mot-de-passe-seul (AAL1) reçoit `401 { code: 'mfa_required' }`.
- **Téléphone perdu** : un admin réinitialise la 2FA d'un utilisateur (Admin → Journalistes → icône bouclier barré, ou `DELETE /api/admin/journalists/:id/mfa`) ; l'utilisateur re-scanne un QR code à sa prochaine connexion.
- **Prérequis** : TOTP activé côté Supabase — local : `[auth.mfa.totp]` dans `supabase/config.toml` ; production : Dashboard → Authentication → MFA → TOTP.

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

Les politiques RLS constituent une deuxième ligne de défense indépendante du backend. Même en cas de bug dans le code Express, un journaliste ne peut pas accéder aux données d'un autre journaliste via une requête directe à Supabase.

Le backend utilise la `service_role` key qui contourne le RLS — c'est intentionnel car le backend applique ses propres contrôles d'accès plus fins.

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

Les clés stockées dans `app_settings` ne sont jamais retournées en clair. L'API retourne toujours une version masquée : `••••••••xxxx` (8 tirets + 4 derniers caractères). Cela permet de vérifier visuellement qu'une clé est configurée sans l'exposer.

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

- Seuls les fichiers avec un mimetype `image/*` sont acceptés
- Taille maximale par fichier : 25 Mo
- Stockage en mémoire (Buffer) — pas de fichiers temporaires sur disque
- Maximum 10 fichiers par soumission

---

## 13. Troubleshooting

### La correction IA ne fonctionne pas

| Symptôme | Cause probable | Solution |
|---|---|---|
| "Correction indisponible" dans le formulaire | `ANTHROPIC_API_KEY` absente ou invalide | Vérifier la clé dans `backend/.env` ET dans l'onglet Settings de l'admin (table `app_settings`). La clé dans `app_settings` a priorité sur la variable d'environnement |
| Correction très lente (> 30s) | Texte très long ou surcharge API Anthropic | Normal pour les textes > 10 000 signes. Vérifier le status Anthropic : https://status.anthropic.com |
| Erreur 401 sur `/api/correct` | Token Supabase expiré côté frontend | Se déconnecter et se reconnecter |

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
