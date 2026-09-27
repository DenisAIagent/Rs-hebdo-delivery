#!/usr/bin/env node
// Preuve de paternité — signe l'état actuel des sources avec la clé privée de l'auteur.
//
// Principe : une paire de clés Ed25519 est générée UNE fois et la clé privée
// reste hors du dépôt (~/.rs-hebdo-authorship/). Le script calcule l'empreinte
// SHA-256 de toutes les sources, signe une déclaration d'auteur et l'inscrit
// dans deux fichiers compilés avec l'app (backend + frontend).
// Seul le détenteur de la clé privée peut produire une signature valide.
//
// Aucun appel réseau, aucune exécution au runtime : les fichiers générés ne
// contiennent que des constantes (déclaration, signature, clé publique).
//
// Usage : node scripts/authorship/sign.mjs ["Nom Auteur"] [email]

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const KEY_DIR = path.join(os.homedir(), '.rs-hebdo-authorship');
const PRIVATE_KEY_PATH = path.join(KEY_DIR, 'ed25519_private.pem');
const PUBLIC_KEY_PATH = path.join(KEY_DIR, 'ed25519_public.pem');

const AUTHOR = process.argv[2] || 'Denis Adam';
const EMAIL = process.argv[3] || 'denis@mdmcmusicads.com';
const WORK = 'RS Hebdo Delivery';

const OUTPUTS = [
  'backend/src/meta/provenance.ts',
  'frontend/src/lib/provenance.ts',
];

// Sources couvertes par l'empreinte (les fichiers de provenance en sont exclus)
const SOURCE_ENTRIES = [
  'backend/src', 'frontend/src', 'frontend/index.html', 'supabase',
  'supabase-schema.sql', 'scripts/livrer_hebdo.py',
  'package.json', 'backend/package.json', 'frontend/package.json',
  'README.md', 'DOCUMENTATION.md', 'FAQ-JOURNALISTE.md', 'TUTO-JOURNALISTE.md',
];
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.vite', '__pycache__']);
const IGNORED_FILES = new Set(['.DS_Store']);

function listFiles(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [relPath];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    if (IGNORED_DIRS.has(entry.name) || IGNORED_FILES.has(entry.name)) return [];
    return listFiles(path.posix.join(relPath, entry.name));
  });
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function loadOrCreateKeys() {
  if (fs.existsSync(PRIVATE_KEY_PATH)) {
    const privateKey = crypto.createPrivateKey(fs.readFileSync(PRIVATE_KEY_PATH));
    return { privateKey, publicKey: crypto.createPublicKey(privateKey), created: false };
  }
  fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o644 });
  return { privateKey, publicKey, created: true };
}

function buildManifest() {
  const files = SOURCE_ENTRIES.flatMap(listFiles)
    .filter((f) => !OUTPUTS.includes(f))
    .sort();
  const lines = files.map((f) => `${sha256(fs.readFileSync(path.join(ROOT, f)))}  ${f}`);
  const manifest = `${lines.join('\n')}\n`;
  return { manifest, fileCount: files.length, sourceHash: sha256(manifest) };
}

function renderModule({ statement, signature, publicKey, id }) {
  const year = new Date().getFullYear();
  return `/*! ${WORK} — (c) ${year} ${AUTHOR} <${EMAIL}>. Tous droits réservés.
 * provenance:${id} ed25519:${signature} */
// Fichier généré par scripts/authorship/sign.mjs — ne pas modifier à la main.
// Constantes inertes : aucun appel réseau, aucun effet à l'exécution.
export const PROVENANCE = {
  statement: ${JSON.stringify(statement)},
  signature: '${signature}',
  publicKey: '${publicKey}',
} as const;
`;
}

function main() {
  const { privateKey, publicKey, created } = loadOrCreateKeys();
  const { manifest, fileCount, sourceHash } = buildManifest();
  const signedAt = new Date().toISOString();

  const statement = JSON.stringify({
    oeuvre: WORK,
    auteur: AUTHOR,
    email: EMAIL,
    date: signedAt,
    empreinte_sources_sha256: sourceHash,
    fichiers: fileCount,
  });
  const signature = crypto.sign(null, Buffer.from(statement), privateKey).toString('base64');
  const publicKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const id = sourceHash.slice(0, 16);

  const moduleSource = renderModule({ statement, signature, publicKey: publicKeyB64, id });
  for (const out of OUTPUTS) {
    fs.mkdirSync(path.dirname(path.join(ROOT, out)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, out), moduleSource);
  }

  // Dossier de preuve local (hors dépôt) : à déposer (e-Soleau, horodatage)
  const proofDir = path.join(KEY_DIR, 'proofs', signedAt.replace(/[:.]/g, '-'));
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(path.join(proofDir, 'manifest.sha256'), manifest);
  fs.writeFileSync(path.join(proofDir, 'statement.json'), statement);
  fs.writeFileSync(path.join(proofDir, 'statement.sig'), signature);
  fs.copyFileSync(PUBLIC_KEY_PATH, path.join(proofDir, 'ed25519_public.pem'));

  console.log(`${created ? 'Nouvelle paire de clés créée' : 'Clé existante utilisée'} : ${KEY_DIR}`);
  console.log(`Sources signées : ${fileCount} fichiers — empreinte ${sourceHash}`);
  console.log(`Fichiers générés : ${OUTPUTS.join(', ')}`);
  console.log(`Dossier de preuve : ${proofDir}`);
}

main();
