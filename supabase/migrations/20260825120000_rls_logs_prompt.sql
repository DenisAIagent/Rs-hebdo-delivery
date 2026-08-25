-- Défense en profondeur + rattrapage de divergence schéma/migrations.
-- Le backend utilise la clé service_role (bypass RLS) : aucun impact fonctionnel ;
-- ces règles protègent en cas d'accès direct via la clé anon.

-- delivery_logs : définie dans supabase-schema.sql mais absente des migrations.
-- On la (re)crée si besoin pour que les bases montées via migrations l'aient.
CREATE TABLE IF NOT EXISTS delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  step TEXT NOT NULL,
  message TEXT NOT NULL,
  detail TEXT,
  journalist_id UUID REFERENCES profiles(id),
  journalist_name TEXT,
  hebdo_label TEXT,
  paper_type_name TEXT,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_prompt ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read delivery logs" ON delivery_logs;
CREATE POLICY "Admins read delivery logs"
  ON delivery_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins manage correction prompt" ON correction_prompt;
CREATE POLICY "Admins manage correction prompt"
  ON correction_prompt FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
