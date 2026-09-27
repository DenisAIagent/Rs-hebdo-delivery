#!/usr/bin/env node
// Vérifie une preuve de paternité, sans clé privée.
//
// Accepte un fichier ou un dossier : sources (provenance.ts), build
// (dist/*.js) ou bundle récupéré sur le site en production. Cherche le
// marqueur "ed25519:<signature>" et la déclaration signée, puis vérifie la
// signature avec la clé publique de référence (~/.rs-hebdo-authorship/).
//
// Usage : node scripts/authorship/verify.mjs <fichier|dossier> [cle_publique.pem]

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const target = process.argv[2];
const publicKeyPath = process.argv[3]
  || path.join(os.homedir(), '.rs-hebdo-authorship', 'ed25519_public.pem');

if (!target) {
  console.error('Usage : node scripts/authorship/verify.mjs <fichier|dossier> [cle_publique.pem]');
  process.exit(2);
}

const SCANNED = /\.(ts|tsx|js|mjs|cjs|html)$/;
const IGNORED_DIRS = new Set(['node_modules', '.vite']);

function listFiles(abs) {
  if (fs.statSync(abs).isFile()) return [abs];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    if (IGNORED_DIRS.has(entry.name)) return [];
    const child = path.join(abs, entry.name);
    return entry.isDirectory() ? listFiles(child) : SCANNED.test(entry.name) ? [child] : [];
  });
}

// La déclaration est un objet JSON inscrit dans une chaîne ; selon la
// minification ses guillemets sont échappés (\") ou non. On la retrouve
// dans les deux cas puis on retire l'échappement.
function extractStatements(content) {
  const re = /\{\\?"oeuvre\\?".*?\\?"fichiers\\?":\d+\}/g;
  return [...content.matchAll(re)].map((m) => m[0].replace(/\\"/g, '"'));
}

function verifyFile(file, publicKey) {
  const content = fs.readFileSync(file, 'utf8');
  // Signature présente dans le commentaire (sources) et/ou dans l'objet
  // PROVENANCE (seule forme conservée après minification du bundle).
  const signaturePattern = /(?:ed25519:|signature:\s*["'`])([A-Za-z0-9+/=]{80,})/g;
  const signatures = [...new Set([...content.matchAll(signaturePattern)].map((m) => m[1]))];
  if (signatures.length === 0) return null;

  const statements = extractStatements(content);
  for (const signature of signatures) {
    for (const statement of statements) {
      const ok = crypto.verify(null, Buffer.from(statement), publicKey, Buffer.from(signature, 'base64'));
      if (ok) return { valid: true, statement: JSON.parse(statement) };
    }
  }
  return { valid: false, statement: null };
}

function main() {
  if (!fs.existsSync(publicKeyPath)) {
    console.error(`Clé publique introuvable : ${publicKeyPath}`);
    process.exit(2);
  }
  const publicKey = crypto.createPublicKey(fs.readFileSync(publicKeyPath));
  const results = listFiles(path.resolve(target))
    .map((file) => ({ file, result: verifyFile(file, publicKey) }))
    .filter(({ result }) => result !== null);

  if (results.length === 0) {
    console.log('Aucun marqueur de provenance trouvé.');
    process.exit(1);
  }
  for (const { file, result } of results) {
    if (result.valid) {
      const s = result.statement;
      console.log(`VALIDE   ${file}\n         ${s.oeuvre} — ${s.auteur} <${s.email}> — signé le ${s.date}\n         empreinte des sources : ${s.empreinte_sources_sha256}`);
    } else {
      console.log(`INVALIDE ${file} (marqueur présent mais signature non vérifiable)`);
    }
  }
  process.exit(results.some(({ result }) => result.valid) ? 0 : 1);
}

main();
