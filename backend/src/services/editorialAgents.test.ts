import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AGENTS } from './editorialAgentsDefaults';
import { agentConfigSchema, leadConfigSchema, agentUpdateSchema } from './editorialAgentsSchema';
import { resolveAgentForPaperType, buildAgentRules, type EditorialAgent } from './editorialAgents';

const asRows = (): EditorialAgent[] => DEFAULT_AGENTS.map((a, i) => ({ ...a, id: `id-${i}`, version: 1, updated_at: '' }));
const lead = () => asRows().find((a) => a.is_lead)!;

test('11 agents dont un seul agent principal', () => {
  assert.equal(DEFAULT_AGENTS.length, 11);
  assert.equal(DEFAULT_AGENTS.filter((a) => a.is_lead).length, 1);
  assert.equal(new Set(DEFAULT_AGENTS.map((a) => a.slug)).size, 11);
});

test('chaque agent par defaut passe son schema', () => {
  for (const a of DEFAULT_AGENTS) {
    const r = (a.is_lead ? leadConfigSchema : agentConfigSchema).safeParse(a.config);
    assert.ok(r.success, `${a.name} : ${r.success ? '' : JSON.stringify(r.error.issues[0])}`);
  }
});

test('chapo genere par defaut (consigne du 08/10), sauf le cinema a introduction fixe', () => {
  for (const a of DEFAULT_AGENTS.filter((x) => !x.is_lead)) {
    const expected = a.slug === 'chroniqueur-cinema' ? 'none' : 'generate';
    assert.equal((a.config as any).chapo.ifMissing, expected, a.name);
  }
  const musique = DEFAULT_AGENTS.find((a) => a.slug === 'chroniqueur-musique')!;
  assert.match((musique.config as any).chapo.example, /Greta Van Fleet/);
});

test('interrupteur « chapo obligatoire » allume : les regles interdisent de generer', () => {
  const musique = asRows().find((a) => a.slug === 'chroniqueur-musique')!;
  assert.match(buildAgentRules(lead(), musique), /chapô neutre généré/);
  const strict = buildAgentRules(lead(), musique, { strictChapo: true });
  assert.match(strict, /aucun chapô généré/);
  assert.doesNotMatch(strict, /chapô neutre généré selon/);
});

test('chaque type de papier a un agent', () => {
  const rows = asRows();
  for (const t of ['Sujet de couv', 'Interview 3000', 'Chroniques', 'Chronique Cinema', 'Chronique Coup de Coeur',
    'Disque de la semaine', 'Frenchie', 'Livres et Expo', 'Live report']) {
    assert.ok(resolveAgentForPaperType(rows, t).agent, t);
  }
});

test('noms d\'agents demandes par Denis', () => {
  const names = DEFAULT_AGENTS.map((a) => a.name);
  for (const n of ['Chroniqueur cinéma', 'Chroniqueur littéraire', 'Agent intervieweur']) assert.ok(names.includes(n), n);
});

test('Livres et Expo : expo selon le sous-type, litteraire par defaut avec alerte', () => {
  const rows = asRows();
  assert.equal(resolveAgentForPaperType(rows, 'Livres et Expo', 'expo').agent?.name, 'Chroniqueur expo');
  const def = resolveAgentForPaperType(rows, 'Livres et Expo');
  assert.equal(def.agent?.name, 'Chroniqueur littéraire');
  assert.match(def.alerts.join(' '), /sous-type/);
});

test('un agent inactif est ignore, type inconnu = aucun agent', () => {
  const rows = asRows().map((a) => (a.slug === 'chroniqueur-cinema' ? { ...a, is_active: false } : a));
  assert.equal(resolveAgentForPaperType(rows, 'Chronique Cinema').agent, null);
  assert.equal(resolveAgentForPaperType(asRows(), 'Type inexistant').agent, null);
});

test('les regles pour l\'IA contiennent categories, titre, interdits et la regle du chapo', () => {
  const rows = asRows();
  const cinema = rows.find((a) => a.slug === 'chroniqueur-cinema')!;
  const txt = buildAgentRules(lead(), cinema);
  assert.match(txt, /Chroniqueur cinéma/);
  assert.match(txt, /6714/);
  assert.match(txt, /CINÉMA : \{N\} films/);
  assert.match(txt, /Ne jamais modifier, raccourcir/);
  assert.match(txt, /jamais une phrase ou un extrait du texte du journaliste/);
});

test('validation des modifications : categories numeriques, chapo borne', () => {
  assert.equal(agentUpdateSchema.safeParse({ name: '' }).success, false);
  const bad = { ...DEFAULT_AGENTS[1].config, categories: ['abc'] };
  assert.equal(agentConfigSchema.safeParse(bad).success, false);
  const ok = agentUpdateSchema.safeParse({ name: 'Chroniqueur cinéma', is_active: false });
  assert.ok(ok.success);
});
