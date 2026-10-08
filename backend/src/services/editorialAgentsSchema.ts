import { z } from 'zod';

/**
 * Schema des regles d'un agent web (onglet admin « Agents IA »). Transcription
 * structuree des fiches v0.1 de Denis (agent.md + une fiche par type de papier).
 */

const text = z.string().trim();
const nonEmpty = text.min(1, 'champ obligatoire');
const lines = z.array(nonEmpty).max(50);

export const END_BLOCKS = [
  'site_officiel', 'video', 'a_lire_aussi', 'note', 'tracklist', 'setlist', 'infos_pratiques', 'signature',
] as const;

export const END_BLOCK_LABELS: Record<(typeof END_BLOCKS)[number], string> = {
  site_officiel: 'Site officiel / lien de commande',
  video: 'Vidéo YouTube',
  a_lire_aussi: 'À lire aussi',
  note: 'Note (module review)',
  tracklist: 'Tracklist',
  setlist: 'Setlist',
  infos_pratiques: 'Infos pratiques',
  signature: 'Signature',
};

export const HEADINGS = ['interdits', 'journaliste', 'questions_h4', 'element_h4'] as const;

export const HEADING_LABELS: Record<(typeof HEADINGS)[number], string> = {
  interdits: 'Aucun intertitre',
  journaliste: 'Intertitres du journaliste seulement (h4)',
  questions_h4: 'Chaque question en Titre 4 (h4)',
  element_h4: 'Un Titre 4 (h4) par film / élément',
};

export const agentConfigSchema = z.object({
  categories: z.array(z.number().int().positive()).max(10),
  titleTemplates: z.array(z.object({ label: text.max(40), template: nonEmpty.max(200) })).min(1).max(5),
  chapo: z.object({
    // Decision du 08/10/2026 : le chapo n'est repris que s'il est fourni. `generate`
    // reste possible depuis l'admin, mais n'est jamais la valeur par defaut.
    ifMissing: z.enum(['none', 'generate']),
    maxWords: z.number().int().min(5).max(120).nullable(),
    maxSentences: z.number().int().min(1).max(5).nullable(),
  }),
  body: z.object({
    mode: z.enum(['article', 'groupe_hebdo']),
    photosMax: z.number().int().min(0).max(20),
    headings: z.enum(HEADINGS),
    minWordsBetweenPhotos: z.number().int().min(0).max(1000).nullable(),
  }),
  featuredImage: z.object({
    format: z.enum(['1280x853', '1000x1000']),
    source: nonEmpty.max(80),
    crop: z.enum(['recadrage_centre', 'entiere']),
    caption: text.max(120),
  }),
  endBlocks: z.array(z.enum(END_BLOCKS)).max(END_BLOCKS.length),
  signature: text.max(80),
  checks: lines,
});

export const leadConfigSchema = z.object({
  wpStatus: z.enum(['pending', 'draft']),
  editor: z.enum(['classique']),
  forbidden: lines,
  authors: z.array(z.object({ name: nonEmpty.max(80), wpId: z.number().int().positive().nullable() })).max(50),
  categoryIds: z.array(z.object({ name: nonEmpty.max(80), id: z.number().int().positive() })).max(50),
  htmlFormats: z.array(z.object({ element: nonEmpty.max(80), format: nonEmpty.max(400) })).max(30),
  finalChecks: lines,
  reportFormat: text.max(200),
});

export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type LeadConfig = z.infer<typeof leadConfigSchema>;

/** Champs modifiables depuis l'admin. `config` est valide selon le type d'agent par la route. */
export const agentUpdateSchema = z.object({
  name: nonEmpty.max(80).optional(),
  role: text.max(300).optional(),
  paper_types: z.array(nonEmpty.max(80)).max(10).optional(),
  subtype: text.max(40).nullable().optional(),
  is_active: z.boolean().optional(),
  config: z.unknown().optional(),
  notes_md: text.max(20000).optional(),
});
export type AgentUpdate = z.infer<typeof agentUpdateSchema>;
