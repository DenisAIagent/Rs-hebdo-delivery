-- Ensure app_settings table exists (was declared in supabase-schema.sql but missing from initial migration)
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read all settings" ON app_settings;
CREATE POLICY "Admins can read all settings"
  ON app_settings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage settings" ON app_settings;
CREATE POLICY "Admins can manage settings"
  ON app_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed default keys (existing rows preserved)
INSERT INTO app_settings (key, value) VALUES
  ('ANTHROPIC_API_KEY', ''),
  ('DROPBOX_APP_KEY', ''),
  ('DROPBOX_APP_SECRET', ''),
  ('DROPBOX_REFRESH_TOKEN', ''),
  ('AI_PROVIDER', 'anthropic'),
  ('GEMINI_API_KEY', '')
ON CONFLICT (key) DO NOTHING;
