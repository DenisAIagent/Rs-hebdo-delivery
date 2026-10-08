import { supabaseAdmin } from '../utils/supabase';
import { DEFAULT_AGENTS } from './editorialAgentsDefaults';
import {
  agentConfigSchema, leadConfigSchema, END_BLOCK_LABELS, HEADING_LABELS,
  type AgentConfig, type AgentUpdate, type LeadConfig,
} from './editorialAgentsSchema';

/**
 * Equipe d'agents web (onglet admin « Agents IA »). Chaque type de papier a son
 * agent ; le « Chef d'edition web » porte les regles communes. Les regles sont
 * injectees dans le prompt de l'IA WordPress (wordpressRules.buildWpSystemPrompt).
 */
export interface EditorialAgent {
  id: string;
  slug: string;
  name: string;
  role: string;
  is_lead: boolean;
  paper_types: string[];
  subtype: string | null;
  is_active: boolean;
  config: AgentConfig | LeadConfig;
  notes_md: string;
  version: number;
  updated_at: string;
}

export interface AgentResolution {
  agent: EditorialAgent | null;
  alerts: string[];
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Agent actif du type de papier. « Livres et Expo » sans sous-type : agent sans sous-type + alerte. */
export function resolveAgentForPaperType(agents: EditorialAgent[], typeName: string, subtype?: string | null): AgentResolution {
  const candidates = agents.filter((a) => a.is_active && !a.is_lead && a.paper_types.some((t) => same(t, typeName)));
  if (candidates.length === 0) return { agent: null, alerts: [] };
  if (subtype) {
    const bySub = candidates.find((a) => a.subtype && same(a.subtype, subtype));
    if (bySub) return { agent: bySub, alerts: [] };
  }
  const fallback = candidates.find((a) => !a.subtype) || candidates[0];
  const needsSubtype = candidates.some((a) => a.subtype);
  return { agent: fallback, alerts: needsSubtype && !subtype ? [`sous-type à confirmer (agent ${fallback.name} appliqué par défaut)`] : [] };
}

const bullet = (items: string[]) => items.map((x) => `- ${x}`).join('\n');

function leadRules(lead: LeadConfig): string {
  return [
    `Statut WordPress : ${lead.wpStatus}. Éditeur : ${lead.editor}.`,
    'INTERDITS ABSOLUS :', bullet(lead.forbidden),
    'FORMATS HTML :', bullet(lead.htmlFormats.map((f) => `${f.element} : ${f.format}`)),
    'CONTRÔLE FINAL :', bullet(lead.finalChecks),
  ].join('\n');
}

function agentRules(agent: EditorialAgent, cfg: AgentConfig): string {
  const chapo = cfg.chapo.ifMissing === 'none'
    ? 'Chapô : uniquement celui fourni par le journaliste. Ne jamais generer de chapo ; s\'il manque, aucun chapô et alerte « chapô non fourni ».'
    : 'Chapô : celui du journaliste ; s\'il manque, une phrase neutre construite uniquement avec les éléments de la livraison.';
  const limits = [cfg.chapo.maxWords && `${cfg.chapo.maxWords} mots`, cfg.chapo.maxSentences && `${cfg.chapo.maxSentences} phrase(s)`].filter(Boolean);
  return [
    `RÈGLES DE L'AGENT « ${agent.name} » (types : ${agent.paper_types.join(', ')}${agent.subtype ? `, sous-type ${agent.subtype}` : ''}, version ${agent.version}) :`,
    `Rôle : ${agent.role}`,
    `Catégories (IDs, exactement) : ${cfg.categories.join(', ')}`,
    `Titre : ${cfg.titleTemplates.map((t) => `${t.label} = « ${t.template} »`).join(' ; ')}`,
    chapo + (limits.length ? ` Longueur indicative : ${limits.join(', ')} (au-delà : alerte, sans couper).` : ''),
    `Corps : ${cfg.body.mode === 'groupe_hebdo' ? 'un seul article groupé pour le numéro ; ' : ''}${HEADING_LABELS[cfg.body.headings]} ; ${cfg.body.photosMax} photo(s) au maximum dans le corps${cfg.body.minWordsBetweenPhotos ? `, au moins ${cfg.body.minWordsBetweenPhotos} mots entre deux photos` : ''}.`,
    `Image à la une : ${cfg.featuredImage.format}, source ${cfg.featuredImage.source}, ${cfg.featuredImage.crop === 'entiere' ? 'entière sans recadrage' : 'recadrage centré'}${cfg.featuredImage.caption ? `, légende « ${cfg.featuredImage.caption} »` : ''}.`,
    `Fin d'article, dans cet ordre : ${cfg.endBlocks.length ? cfg.endBlocks.map((b) => END_BLOCK_LABELS[b]).join(' → ') : 'aucun élément'}.`,
    `Signature : ${cfg.signature || 'aucune'}.`,
    cfg.checks.length ? `Contrôles propres :\n${bullet(cfg.checks)}` : '',
    agent.notes_md ? `Règles détaillées :\n${agent.notes_md}` : '',
  ].filter(Boolean).join('\n');
}

/** Bloc de regles en texte, pour le prompt systeme de l'IA WordPress. */
export function buildAgentRules(lead: EditorialAgent | null, agent: EditorialAgent): string {
  const parts: string[] = [];
  if (lead && lead.is_active) parts.push(`RÈGLES COMMUNES (${lead.name}, version ${lead.version}) :\n${leadRules(lead.config as LeadConfig)}`);
  parts.push(agentRules(agent, agent.config as AgentConfig));
  return parts.join('\n\n');
}

/** Valide la config selon le type d'agent (principal ou non). Renvoie un message FR en cas d'erreur. */
export function validateAgentConfig(isLead: boolean, config: unknown): { ok: true; value: AgentConfig | LeadConfig } | { ok: false; error: string } {
  const r = (isLead ? leadConfigSchema : agentConfigSchema).safeParse(config);
  if (r.success) return { ok: true, value: r.data };
  const issue = r.error.issues[0];
  return { ok: false, error: `Règle invalide (${issue.path.join('.') || 'config'}) : ${issue.message}` };
}

// --- Acces base ---------------------------------------------------------------

const AGENT_COLUMNS = 'id, slug, name, role, is_lead, paper_types, subtype, is_active, config, notes_md, version, updated_at';

/** Insere l'equipe de depart si la table est vide (premier affichage). */
export async function ensureDefaultAgents(): Promise<void> {
  const { count, error } = await supabaseAdmin.from('editorial_agents').select('id', { count: 'exact', head: true });
  if (error) throw new Error(`Table editorial_agents illisible : ${error.message}`);
  if ((count || 0) > 0) return;
  const { error: insErr } = await supabaseAdmin.from('editorial_agents').insert(DEFAULT_AGENTS.map((a) => ({ ...a, version: 1 })));
  if (insErr) throw new Error(`Création de l'équipe impossible : ${insErr.message}`);
}

export async function listAgents(): Promise<EditorialAgent[]> {
  const { data, error } = await supabaseAdmin.from('editorial_agents').select(AGENT_COLUMNS)
    .order('is_lead', { ascending: false }).order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as EditorialAgent[];
}

/** Agent (et agent principal) du type de papier, pour la publication WordPress. Ne leve jamais. */
export async function loadAgentRulesForPaperType(typeName: string, subtype?: string | null): Promise<{ rules: string; agent: EditorialAgent | null; alerts: string[] }> {
  try {
    const agents = await listAgents();
    const { agent, alerts } = resolveAgentForPaperType(agents, typeName, subtype);
    if (!agent) return { rules: '', agent: null, alerts };
    return { rules: buildAgentRules(agents.find((a) => a.is_lead) || null, agent), agent, alerts };
  } catch (err) {
    console.error('[agents] chargement des agents impossible:', err instanceof Error ? err.message : err);
    return { rules: '', agent: null, alerts: [] };
  }
}

export async function updateAgent(id: string, patch: AgentUpdate, userId: string | null): Promise<EditorialAgent> {
  const { data: current, error } = await supabaseAdmin.from('editorial_agents').select(AGENT_COLUMNS).eq('id', id).single();
  if (error || !current) throw new Error('Agent introuvable');
  const cur = current as EditorialAgent;
  let config = cur.config;
  if (patch.config !== undefined) {
    const v = validateAgentConfig(cur.is_lead, patch.config);
    if (!v.ok) throw new Error(v.error);
    config = v.value;
  }
  // Historique : on archive la version courante avant de la remplacer.
  const { error: histErr } = await supabaseAdmin.from('editorial_agent_versions').insert({
    agent_id: id, version: cur.version, config: cur.config, notes_md: cur.notes_md,
    name: cur.name, role: cur.role, paper_types: cur.paper_types, subtype: cur.subtype, is_active: cur.is_active,
    created_by: userId,
  });
  if (histErr) throw new Error(`Historique impossible : ${histErr.message}`);
  const next = {
    name: patch.name ?? cur.name,
    role: patch.role ?? cur.role,
    paper_types: cur.is_lead ? [] : (patch.paper_types ?? cur.paper_types),
    subtype: patch.subtype === undefined ? cur.subtype : patch.subtype || null,
    is_active: patch.is_active ?? cur.is_active,
    config,
    notes_md: patch.notes_md ?? cur.notes_md,
    version: cur.version + 1,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };
  const { data, error: upErr } = await supabaseAdmin.from('editorial_agents').update(next).eq('id', id).select(AGENT_COLUMNS).single();
  if (upErr || !data) throw new Error(upErr?.message || 'Mise à jour impossible');
  return data as EditorialAgent;
}

export async function listVersions(id: string) {
  const { data, error } = await supabaseAdmin.from('editorial_agent_versions')
    .select('version, name, created_at, created_by').eq('agent_id', id).order('version', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return data || [];
}

/** Restaure une version archivee (cree une nouvelle version, rien n'est perdu). */
export async function restoreVersion(id: string, version: number, userId: string | null): Promise<EditorialAgent> {
  const { data, error } = await supabaseAdmin.from('editorial_agent_versions').select('*').eq('agent_id', id).eq('version', version).single();
  if (error || !data) throw new Error('Version introuvable');
  return updateAgent(id, {
    name: data.name, role: data.role, paper_types: data.paper_types, subtype: data.subtype,
    is_active: data.is_active, config: data.config, notes_md: data.notes_md,
  }, userId);
}
