-- Onglet admin « Agents IA » : equipe d'agents web (un par type de papier + un
-- agent principal aux regles communes). Les regles sont modifiables depuis
-- l'admin et injectees dans le prompt de l'IA WordPress.
-- Aucune donnee ici : l'equipe de depart (fiches v0.1 de Denis, 08/10/2026) est
-- inseree par le backend au premier affichage (editorialAgentsDefaults.ts).
-- Le backend utilise la cle service_role (bypass RLS) ; les regles ci-dessous
-- protegent en cas d'acces direct via la cle anon.

CREATE TABLE IF NOT EXISTS editorial_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  is_lead BOOLEAN NOT NULL DEFAULT false,
  paper_types TEXT[] NOT NULL DEFAULT '{}',
  subtype TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes_md TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

-- Un seul agent principal.
CREATE UNIQUE INDEX IF NOT EXISTS editorial_agents_one_lead ON editorial_agents (is_lead) WHERE is_lead;

CREATE TABLE IF NOT EXISTS editorial_agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES editorial_agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  paper_types TEXT[] NOT NULL DEFAULT '{}',
  subtype TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL,
  notes_md TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  UNIQUE (agent_id, version)
);

ALTER TABLE editorial_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE editorial_agent_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage editorial agents" ON editorial_agents;
CREATE POLICY "Admins manage editorial agents"
  ON editorial_agents FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'cto')));

DROP POLICY IF EXISTS "Admins read editorial agent versions" ON editorial_agent_versions;
CREATE POLICY "Admins read editorial agent versions"
  ON editorial_agent_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'cto')));
