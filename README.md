# RS Hebdo Delivery

Plateforme interne de **Rolling Stone France** pour la remise des papiers journalistes.

## Qu'est-ce que c'est ?

RS Hebdo Delivery couvre l'intégralité du cycle de vie d'un papier journalistique :

1. **Saisie** — Le journaliste remplit un formulaire structuré selon le type de papier (chronique, interview, disque de la semaine, etc.)
2. **Correction IA** — Le texte est envoyé à Claude (Anthropic) pour correction orthographique et stylistique. Le journaliste voit les corrections en diff et les accepte ou modifie
3. **Génération DOCX** — Un fichier Word formaté est généré automatiquement
4. **Dépôt Dropbox** — Le DOCX et les images sont déposés dans l'arborescence Dropbox de la rédaction, organisée par hebdo et type de papier
5. **Notification** — Un email est envoyé à la rédaction en chef avec un lien vers le dossier Dropbox

L'interface admin permet de gérer les numéros hebdo, les types de papier, les comptes journalistes, de consulter les logs de livraison, et de modifier le prompt IA et les clés API sans redéployer.

## Stack technique

| Couche | Technologie |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS 4, Zustand, React Router 7 |
| **Backend** | Node.js 20, Express 5, TypeScript 6 |
| **Base de données** | Supabase (PostgreSQL + Auth + RLS) |
| **Stockage fichiers** | Dropbox API v2 |
| **Correction IA** | Anthropic Claude (claude-sonnet-4-20250514) |
| **Génération DOCX** | docx (npm) |
| **Email** | Resend API |
| **Déploiement** | Railway (Nixpacks) |

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
# → Exécuter supabase-schema.sql dans Supabase SQL Editor
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
| **[supabase-schema.sql](supabase-schema.sql)** | Schéma complet BDD (tables, RLS, seed data) |

## Structure du projet

```
rs-hebdo-delivery/
├── backend/             # API Express + TypeScript
│   ├── src/
│   │   ├── routes/      # auth, deliveries, admin, correction
│   │   ├── services/    # claude, docx, dropbox, email, logger
│   │   ├── middleware/   # auth JWT, admin role check
│   │   └── utils/       # client Supabase
│   └── .env.example
├── frontend/            # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/       # Login, Dashboard, DeliveryForm, Admin
│   │   ├── components/  # Layout, ProtectedRoute
│   │   ├── services/    # Couche HTTP Axios
│   │   └── stores/      # Zustand auth store
│   └── .env.example
├── supabase-schema.sql  # Schéma BDD complet + seed
├── nixpacks.toml        # Config build Railway
├── DOCUMENTATION.md     # Doc technique complète
├── TUTO-JOURNALISTE.md  # Guide journaliste
└── FAQ-JOURNALISTE.md   # FAQ journaliste
```

## Sécurité — à savoir avant d'intervenir

Détails complets dans `DOCUMENTATION.md` §12. Points essentiels pour un dev / une mise en ligne :

- **RLS Supabase actuellement non fonctionnelle** (récursion `42P17` sur `profiles`, fail-closed). Ne **jamais** corriger par `DISABLE ROW LEVEL SECURITY` : la clé anon est publique, ça ouvrirait la base. Correctif : `REVOKE` sur les tables sensibles **puis** `is_admin()` `SECURITY DEFINER` (voir §12).
- **Secrets** : préférer les variables d'environnement Railway au stockage en clair dans `app_settings`. Le mot de passe applicatif WordPress est déjà en variable Railway (`WORDPRESS_APP_PASSWORD`).
- La sécurité effective repose sur le backend (JWT validé serveur, rôle lu en base, filtrage par `author_id`), qui est fonctionnel.
