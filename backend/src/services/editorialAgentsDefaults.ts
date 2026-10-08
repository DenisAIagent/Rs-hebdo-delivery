import type { AgentConfig, LeadConfig } from './editorialAgentsSchema';

/**
 * Equipe de depart de l'onglet « Agents IA », transcrite des fiches v0.1 de Denis
 * (docs/agents-web/*.md, 08/10/2026). Inseree en base au premier affichage si la
 * table est vide ; ensuite, seule la base fait foi (modifications depuis l'admin).
 * Chapo (consigne du 08/10) : celui du journaliste, sinon un chapo neutre genere
 * tant que l'interrupteur « chapo obligatoire » (Reglages) est coupe ; jamais une
 * phrase du journaliste. Le chroniqueur cinema garde son introduction fixe.
 */
export interface DefaultAgent {
  slug: string;
  name: string;
  role: string;
  is_lead: boolean;
  paper_types: string[];
  subtype: string | null;
  is_active: boolean;
  config: AgentConfig | LeadConfig;
  notes_md: string;
}

/** Exemple de Denis (08/10/2026) pour le ton d'un chapo genere. */
export const CHAPO_EXAMPLE_MUSIQUE = 'Porté par la voix de Josh Kiszka, Greta Van Fleet revient avec Palace For The People (Polydor), un disque au souffle mystique.';

const genChapo = (maxWords: number | null, maxSentences: number | null, example = '') =>
  ({ ifMissing: 'generate' as const, maxWords, maxSentences, example });
const noChapo = (maxWords: number | null, maxSentences: number | null) =>
  ({ ifMissing: 'none' as const, maxWords, maxSentences, example: '' });

const COMMON_CHECKS_NO_PHOTO = ['Corps sans <img> ni [caption]'];

const lead: LeadConfig = {
  wpStatus: 'pending',
  editor: 'classique',
  forbidden: [
    'Ne jamais modifier, raccourcir, résumer ou réécrire le texte du journaliste. Seules corrections admises : espaces insécables avant « : ; ! ? » et « ».',
    'Ne jamais déplacer une partie du texte du journaliste dans le chapô. Le chapô s\'ajoute au texte, il ne le remplace pas.',
    'Chapô : celui du journaliste s\'il est fourni. Sinon, tant que l\'interrupteur « chapô obligatoire » (Réglages) est coupé, une phrase neutre générée avec les seuls éléments de la livraison ; jamais une phrase ou un extrait du texte du journaliste. Interrupteur allumé : plus aucun chapô généré.',
    'Ne jamais ajouter un fait absent de la livraison : date, chiffre, numéro d\'album, label, nom, citation, classement, lieu.',
    'Ne jamais aller chercher soi-même une vidéo, un lien, une photo ou une note : seuls les éléments fournis dans la livraison sont utilisés.',
    'Ne jamais utiliser de blocs Gutenberg (<!-- wp:... -->), ni de <figure>, ni d\'<iframe>.',
    'Ne jamais publier : statut toujours « pending ».',
    'Ne jamais relancer la génération sur un article déjà relu ou modifié par un humain ; article déjà présent = ne rien écraser et le signaler.',
    'Règle d\'abstention : une information manque, on l\'omet et on le signale ; on ne la complète jamais.',
  ],
  authors: [
    { name: 'Xavier Bonnet', wpId: 5 },
    { name: 'Samuel Regnard', wpId: 30 },
    { name: 'Mathieu David', wpId: 376 },
    { name: 'Belkacem Bahlouli', wpId: null },
    { name: 'Loraine Adam', wpId: null },
    { name: 'Denis Roulleau', wpId: null },
  ],
  categoryIds: [
    { name: 'Musique', id: 3627 },
    { name: 'Chroniques Musique', id: 6716 },
    { name: 'Disque de la Semaine', id: 23176 },
    { name: 'Live Reports', id: 72709 },
    { name: 'Interviews Musique', id: 6708 },
    { name: 'Spécial Métal', id: 6275 },
    { name: 'Culture', id: 3619 },
    { name: 'Cinéma/Séries/TV', id: 3 },
    { name: 'Chroniques Films/TV', id: 6714 },
    { name: 'Chroniques Livres', id: 6715 },
    { name: 'Interviews Culture', id: 6709 },
    { name: 'News (Culture)', id: 6717 },
  ],
  htmlFormats: [
    { element: 'Chapô', format: '<h3>…</h3>, toujours le premier bloc, une seule fois (s\'il y a un chapô)' },
    { element: 'Intertitre / question d\'interview', format: '<h4>…</h4>' },
    { element: 'Intitulé de liste (tracklist, setlist)', format: '<h6>Voici la tracklist :</h6> ou <h6>Setlist :</h6>' },
    { element: 'Liste', format: '<ol><li>…</li></ol>' },
    { element: 'Paragraphe', format: 'texte brut séparé par une ligne vide (pas de <p>)' },
    { element: 'Vidéo', format: 'l\'URL YouTube seule sur sa ligne' },
    { element: 'Photo dans le texte', format: '[caption id="attachment_ID" align="aligncenter" width="1280"]<img … class="size-large wp-image-ID" /> © Photographe[/caption]' },
    { element: 'Italique', format: '<em>…</em> (titres d\'œuvres, citations, « À lire aussi : », signature)' },
    { element: 'Lien externe', format: '<a href="…" target="_blank" rel="noopener">…</a>' },
    { element: 'Lien interne rollingstone.fr', format: '<a href="…">…</a>' },
  ],
  finalChecks: [
    'S\'il y a un chapô : le premier bloc est un <h3>, et il n\'y en a qu\'un',
    'Le texte du journaliste est présent en entier dans le corps, mot pour mot',
    'Chapô fourni : longueur de la fiche indicative (alerte, non bloquant). Chapô généré : longueur maximale respectée, sinon article sans chapô',
    'Aucun nom propre ni chiffre du chapô généré n\'est absent de la livraison, et le chapô ne recopie aucune phrase du journaliste (sinon article sans chapô + alerte)',
    'Aucune balise interdite (h1, h2, h5, second h3, <br> en série), aucun bloc Gutenberg, aucune iframe',
    'Nombre de photos dans le corps ≤ maximum de la fiche du type',
    'Catégories = exactement celles de la fiche',
    'Image à la une présente, au bon format',
    'Statut = pending',
  ],
  reportFormat: 'RSH### | type | titre | créé / bloqué | alertes',
};

const chroniqueMusique: AgentConfig = {
  categories: [6716, 3627],
  titleTemplates: [{ label: 'Titre', template: '{Artiste} – {Album}' }],
  chapo: genChapo(35, 1, CHAPO_EXAMPLE_MUSIQUE),
  body: { mode: 'article', photosMax: 0, headings: 'interdits', minWordsBetweenPhotos: null },
  featuredImage: { format: '1280x853', source: 'pochette', crop: 'recadrage_centre', caption: '' },
  endBlocks: ['site_officiel', 'video', 'a_lire_aussi', 'note', 'signature'],
  signature: '<em>Par {Prénom Nom}</em>',
  checks: [...COMMON_CHECKS_NO_PHOTO, 'Aucun <h4>', 'Le dernier bloc commence par <em>Par ', 'Note : ligne [rwp-review-recap id="0"] toujours présente'],
};

const empty = (categories: number[]): AgentConfig => ({
  categories,
  titleTemplates: [{ label: 'Titre', template: '{Titre livré}' }],
  chapo: genChapo(40, 2),
  body: { mode: 'article', photosMax: 3, headings: 'journaliste', minWordsBetweenPhotos: 150 },
  featuredImage: { format: '1280x853', source: 'photo 1', crop: 'recadrage_centre', caption: '© {Photographe}' },
  endBlocks: ['signature'],
  signature: '<em>Par {Prénom Nom}</em>',
  checks: [],
});

export const DEFAULT_AGENTS: DefaultAgent[] = [
  {
    slug: 'chef-edition-web', name: 'Chef d\'édition web', is_lead: true, paper_types: [], subtype: null, is_active: true,
    role: 'Aiguille chaque papier vers son agent et fait respecter les règles communes à tous les types (agent.md).',
    config: lead,
    notes_md: [
      'Le type est lu dans le champ « Type de papier » de la livraison, jamais déduit du texte.',
      'Type absent, vide ou inconnu : ne rien créer, signaler « type de papier non reconnu ».',
      'En cas de conflit, la fiche du type prime, sauf pour les interdits absolus.',
      '',
      'À VALIDER :',
      '- ajouter un champ « sous-type » (livre, BD, expo) obligatoire pour « Livres et Expo » ;',
      '- l\'agent réattribue-t-il l\'auteur lui-même, ou Alma le fait-elle en relecture ?',
      '- plus de suffixe « [EN ATTENTE DE RELECTURE] » dans le titre (le statut pending suffit) ;',
      '- TAG Style Music, catégorie Spécial Métal et Yoast restent à la relecture humaine.',
    ].join('\n'),
  },
  {
    slug: 'chroniqueur-musique', name: 'Chroniqueur musique', is_lead: false, paper_types: ['Chroniques'], subtype: null, is_active: true,
    role: 'Met en forme les chroniques d\'albums (chronique.md).',
    config: chroniqueMusique,
    notes_md: [
      'Références site : 157996 (MeShell Ndegeocello), 157994 (Valley of the Sun) ; chroniques RSH241 corrigées par Alma (158889, 158891, 158893).',
      'Titre tel qu\'écrit dans la livraison (casse et accents conservés), sans préfixe « Chronique : ».',
      'Site officiel seulement s\'il est fourni, sinon alerte « lien de commande non fourni ». Vidéo : la première URL fournie, sinon alerte « vidéo non fournie ».',
      'À lire aussi : seulement si un article publié porte l\'étiquette exacte de l\'artiste (le plus récent).',
      'Étiquettes : artiste et musiciens cités déjà existants ; jamais d\'étiquette de genre.',
      '',
      'À VALIDER : note fournie par le journaliste ? ; image à la une : pochette entière sur fond flouté (préférence d\'Alma) ou recadrage centré.',
    ].join('\n'),
  },
  {
    slug: 'chroniqueur-coup-de-coeur', name: 'Chroniqueur coup de cœur', is_lead: false, paper_types: ['Chronique Coup de Coeur'], subtype: null, is_active: true,
    role: 'Met en forme les coups de cœur, comme une chronique musique (chronique.md, variante).',
    config: chroniqueMusique,
    notes_md: 'À VALIDER : aucun signe distinctif trouvé sur le site pour les coups de cœur (ni catégorie, ni étiquette, ni mention dans le titre). En attendant, même traitement qu\'une chronique, sans rien ajouter.',
  },
  {
    slug: 'chroniqueur-disque-semaine', name: 'Chroniqueur disque de la semaine', is_lead: false, paper_types: ['Disque de la semaine'], subtype: null, is_active: true,
    role: 'Met en forme le disque de la semaine (disque-semaine.md).',
    config: {
      categories: [6716, 23176, 3627],
      titleTemplates: [{ label: 'Titre', template: '{Artiste} – {Album}' }],
      chapo: genChapo(30, 1, CHAPO_EXAMPLE_MUSIQUE),
      body: { mode: 'article', photosMax: 0, headings: 'interdits', minWordsBetweenPhotos: null },
      featuredImage: { format: '1000x1000', source: 'pochette', crop: 'entiere', caption: '' },
      endBlocks: ['video', 'note', 'tracklist', 'signature'],
      signature: '<em>Par {Prénom Nom}</em>',
      checks: ['Image à la une en 1000×1000', 'Tracklist fournie : <h6>Voici la tracklist :</h6> puis <ol> avec un <li> par titre', 'Corps sans photo ni <h4>'],
    },
    notes_md: [
      'Références site : 157978 (Howlin\' Jaws), 157212 (Tom Morello).',
      'Texte de moins de 190 mots : alerte « disque de la semaine court » (non bloquant).',
      'Tracklist seulement si elle est fournie, sinon alerte « tracklist non fournie » ; ne jamais la chercher.',
      'Pochette non carrée : entière, centrée sur fond 1000×1000, alerte « pochette non carrée ».',
      '',
      'À VALIDER : [rwp-review] systématique ? ; signature toujours présente ? ; format 1000×1000 à confirmer avec Mathieu.',
    ].join('\n'),
  },
  {
    slug: 'agent-intervieweur', name: 'Agent intervieweur', is_lead: false, paper_types: ['Interview 3000'], subtype: null, is_active: true,
    role: 'Met en forme les interviews : questions en Titre 4, réponses en paragraphes (interview.md).',
    config: {
      categories: [6708, 3627],
      titleTemplates: [
        { label: 'Avec accroche', template: 'INTERVIEW : {Nom}, {accroche}' },
        { label: 'Sans accroche', template: 'INTERVIEW : {Nom}' },
      ],
      chapo: genChapo(45, 2, '{Nom}, {présentation reprise du texte}, revient sur {objet}.'),
      body: { mode: 'article', photosMax: 3, headings: 'questions_h4', minWordsBetweenPhotos: 200 },
      featuredImage: { format: '1280x853', source: 'photo 1', crop: 'recadrage_centre', caption: '© {Photographe}' },
      endBlocks: [],
      signature: '',
      checks: ['Au moins 2 <h4>', 'Aucun <h4> sans « ? » (alerte, non bloquant)', 'Aucun <strong> seul dans un paragraphe (ancien format des questions)', 'Aucune photo directement après un <h4>'],
    },
    notes_md: [
      'Références site : 157989 (Johnny Marr), 158471 (Mastodon), 158884 (Anthrax, validée par Alma une fois les questions en Titre 4).',
      'Variante culture (cinéma, livres, arts) : catégories 6709 + 3619 ; variante absente = musique et alerte « variante d\'interview à confirmer ».',
      'Questions : marquées dans la livraison (gras **…**, préfixe « Q »), sinon article bloqué « questions non identifiables ». Préfixes « Q : », « RS : », « R : » retirés ; didascalies conservées.',
      'Photos : 3 au maximum, toujours après une réponse, jamais entre une question et sa réponse.',
      '',
      'À VALIDER : comment les questions sont marquées dans le fichier livré par les journalistes.',
    ].join('\n'),
  },
  {
    slug: 'reporter-live', name: 'Reporter live', is_lead: false, paper_types: ['Live report'], subtype: null, is_active: true,
    role: 'Met en forme les live reports, photos réparties dans le texte (live-report.md).',
    config: {
      categories: [72709, 3627],
      titleTemplates: [{ label: 'Titre', template: 'LIVE REPORT : {Artiste} {au|à} {Salle}' }],
      chapo: genChapo(40, 2, '{Artiste} était sur la scène {de la salle} à {Ville} le {date}.'),
      body: { mode: 'article', photosMax: 3, headings: 'interdits', minWordsBetweenPhotos: 150 },
      featuredImage: { format: '1280x853', source: 'photo 1', crop: 'recadrage_centre', caption: '© {Photographe} pour Rolling Stone' },
      endBlocks: ['setlist'],
      signature: '',
      checks: ['Titre commençant par « LIVE REPORT : »', 'Au plus 2 [caption] dans le corps', 'Aucune photo dans les 150 premiers mots, ni deux [caption] consécutifs', 'Aucun <figure>, aucun <!-- wp:'],
    },
    notes_md: [
      'Références site : 158417 (Last Train, Mathieu), 157394 (BIGBANG), 158638 (The Cushings). Contre-exemple : 158883 (version automatique de Last Train, 9 photos en blocs Gutenberg).',
      'Ligne d\'en-tête « Artiste – Salle – Date » retirée du corps : elle sert au titre.',
      'Photos 2 et 3 dans le corps, après le premier puis le deuxième tiers ; texte de moins de 300 mots = une seule photo ; photos en trop ignorées avec alerte.',
      'Setlist seulement si fournie (<h6>Setlist :</h6> + <ol>).',
      '',
      'À VALIDER : nombre maximal de photos (ou galerie) ; absence de signature.',
    ].join('\n'),
  },
  {
    slug: 'chroniqueur-cinema', name: 'Chroniqueur cinéma', is_lead: false, paper_types: ['Chronique Cinema'], subtype: null, is_active: true,
    role: 'Regroupe les chroniques cinéma du numéro en une sélection hebdomadaire (chronique-cinema.md).',
    config: {
      categories: [6714, 3, 3619],
      titleTemplates: [{ label: 'Titre', template: 'CINÉMA : {N} films et séries à voir cette semaine – {JJ/MM/AAAA}' }],
      chapo: noChapo(null, null),
      body: { mode: 'groupe_hebdo', photosMax: 0, headings: 'element_h4', minWordsBetweenPhotos: null },
      featuredImage: { format: '1280x853', source: 'visuel de la semaine (sinon affiche du premier film)', crop: 'recadrage_centre', caption: '' },
      endBlocks: ['video'],
      signature: '<em>{Prénom Nom}</em>',
      checks: ['Nombre de <h4> = nombre de chroniques livrées = {N} du titre', 'Chaque <h4> est suivi d\'une signature <em>…</em> avant le suivant'],
    },
    notes_md: [
      'Références site : 158640 (« CINÉMA : 4 films et séries à voir cette semaine – 07/10/2026 »), 157772.',
      'Bloc par film, dans l\'ordre livré : <h4>{Titre} de {Réalisateur}</h4>, étoiles ★★★ si livrées, texte intégral, <em>{Prénom Nom}</em>, bande-annonce seule sur sa ligne.',
      'Introduction fixe (texte du site, seule la date change) : « L\'équipe de Rolling Stone France vous propose sa sélection à voir au cinéma ou ailleurs la semaine du {JJ mois AAAA}. »',
      '',
      'À VALIDER EN PREMIER : un article groupé par semaine (pratique du site) ou un article par film ? ; comment savoir que toutes les chroniques sont livrées ? ; qui produit le visuel de la sélection ?',
    ].join('\n'),
  },
  {
    slug: 'chroniqueur-litteraire', name: 'Chroniqueur littéraire', is_lead: false, paper_types: ['Livres et Expo'], subtype: null, is_active: true,
    role: 'Met en forme les chroniques de livres et de BD (livres.md). Agent par défaut de « Livres et Expo ».',
    config: {
      categories: [6715, 3619],
      titleTemplates: [
        { label: 'BD', template: 'BD : {Titre} – {accroche}' },
        { label: 'Roman', template: '{Titre}, le nouveau roman de {Auteur}' },
        { label: 'Autre', template: '{Titre}, de {Auteur}' },
      ],
      chapo: genChapo(35, 2, '{Auteur} signe {Titre}, {genre} paru chez {Éditeur}.'),
      body: { mode: 'article', photosMax: 0, headings: 'journaliste', minWordsBetweenPhotos: null },
      featuredImage: { format: '1280x853', source: 'couverture', crop: 'recadrage_centre', caption: '' },
      endBlocks: ['note', 'signature'],
      signature: '<em>{Prénom Nom}</em>',
      checks: ['Aucune photo dans le corps', 'Le dernier bloc est une signature <em>…</em>', 'Titre sans « Chronique : »'],
    },
    notes_md: [
      'Références site : 156061 (BD « Billy the Kid », Loraine Adam), 149647 et 148832 (romans).',
      'Roman seulement si la livraison le dit. [rwp-review] seulement si une note est fournie.',
      '',
      'À VALIDER : renvoi vers le numéro de l\'hebdo en fin d\'article ? ; couverture entière sur fond flouté ?',
    ].join('\n'),
  },
  {
    slug: 'chroniqueur-expo', name: 'Chroniqueur expo', is_lead: false, paper_types: ['Livres et Expo'], subtype: 'expo', is_active: true,
    role: 'Met en forme les chroniques d\'exposition (expo.md). Utilisé quand le sous-type est « expo ».',
    config: {
      categories: [3619, 6717],
      titleTemplates: [
        { label: 'Avec accroche', template: '{Nom de l\'exposition} : {accroche}' },
        { label: 'Sans accroche', template: '{Nom de l\'exposition}' },
      ],
      chapo: genChapo(40, 2, '{Lieu} consacre l\'exposition {Nom} à {Sujet}, du {date} au {date}.'),
      body: { mode: 'article', photosMax: 2, headings: 'interdits', minWordsBetweenPhotos: 150 },
      featuredImage: { format: '1280x853', source: 'visuel 1', crop: 'recadrage_centre', caption: '© {crédit}' },
      endBlocks: ['infos_pratiques', 'signature'],
      signature: '<em>{Prénom Nom}</em>',
      checks: ['Infos pratiques <em>{Lieu} – {dates}</em> seulement si lieu et dates sont livrés'],
    },
    notes_md: 'Aucun précédent sur le site : fiche entière à valider (rubrique Culture + News ?, format du titre, bloc infos pratiques). Référence : brouillon 158904 (« Remember Me »).',
  },
  {
    slug: 'redacteur-couv', name: 'Rédacteur couv', is_lead: false, paper_types: ['Sujet de couv'], subtype: null, is_active: true,
    role: 'Met en forme le sujet de couverture. Fiche à compléter : seules les règles communes s\'appliquent.',
    config: empty([6713, 3627]),
    notes_md: 'À COMPLÉTER : aucune fiche fournie pour la couv. Catégories reprises de l\'outil actuel (grand format musique 6713 + 3627 ; culture : 6712 + 3619).',
  },
  {
    slug: 'chroniqueur-frenchie', name: 'Chroniqueur Frenchie', is_lead: false, paper_types: ['Frenchie'], subtype: null, is_active: true,
    role: 'Met en forme le Frenchie. Fiche à compléter : seules les règles communes s\'appliquent.',
    config: { ...empty([6716, 3627]), chapo: genChapo(35, 1, CHAPO_EXAMPLE_MUSIQUE), body: { mode: 'article', photosMax: 0, headings: 'interdits', minWordsBetweenPhotos: null } },
    notes_md: 'À COMPLÉTER : aucune fiche fournie pour le Frenchie. Catégories de départ : celles d\'une chronique musique.',
  },
];
