-- ================================================
-- RS HEBDO DELIVERY PLATFORM - Supabase Schema
-- ================================================

-- 1. Profiles (extends Supabase Auth users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'journalist' CHECK (role IN ('journalist', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Paper Types (managed by admins)
CREATE TABLE paper_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sign_limit INTEGER NOT NULL DEFAULT 2500,
  drive_folder_name TEXT NOT NULL,
  fields_config JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Hebdo Config (current issue number)
CREATE TABLE hebdo_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER NOT NULL,
  label TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Deliveries
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES profiles(id),
  hebdo_id UUID NOT NULL REFERENCES hebdo_config(id),
  paper_type_id UUID NOT NULL REFERENCES paper_types(id),
  title TEXT NOT NULL,
  subject TEXT,
  body_original TEXT NOT NULL,
  body_corrected TEXT NOT NULL,
  digital_link TEXT,
  image_filename TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  drive_folder_url TEXT,
  status TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('draft', 'corrected', 'delivered')),
  sign_count INTEGER NOT NULL DEFAULT 0,
  wp_post_id INTEGER,
  wp_post_url TEXT,
  wp_status TEXT,
  wp_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE hebdo_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own, admins can read all
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage profiles"
  ON profiles FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Paper types: everyone can read active, admins can manage
CREATE POLICY "Anyone can read active paper types"
  ON paper_types FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can read all paper types"
  ON paper_types FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage paper types"
  ON paper_types FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Hebdo config: everyone can read, admins can manage
CREATE POLICY "Anyone can read hebdo config"
  ON hebdo_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage hebdo config"
  ON hebdo_config FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Deliveries: users see own, admins see all
CREATE POLICY "Users can read own deliveries"
  ON deliveries FOR SELECT
  USING (auth.uid() = author_id);

CREATE POLICY "Users can insert own deliveries"
  ON deliveries FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Admins can read all deliveries"
  ON deliveries FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. Delivery Logs (error tracking for admin)
CREATE TABLE delivery_logs (
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

CREATE POLICY "Admins can read all logs"
  ON delivery_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-delete logs older than 90 days (run via Supabase cron or manual cleanup)
-- DELETE FROM delivery_logs WHERE created_at < now() - interval '90 days';

-- ================================================
-- SEED DATA: Default paper types
-- ================================================

INSERT INTO paper_types (name, sign_limit, drive_folder_name, fields_config, sort_order) VALUES
  ('Sujet de couv', 15000, 'Sujet de couv', '[
    {"key": "artiste", "label": "Artiste", "type": "text", "required": true},
    {"key": "accroche", "label": "Accroche", "type": "text", "required": true},
    {"key": "credits", "label": "Crédits", "type": "text", "required": false},
    {"key": "chapo", "label": "Chapo", "type": "textarea", "required": false},
    {"key": "corps", "label": "Corps du texte", "type": "textarea", "required": true},
    {"key": "lien_photos", "label": "Lien Drive photos", "type": "url", "required": true, "alternateKey": "photos"},
    {"key": "photos", "label": "Photos (3 minimum)", "type": "images", "required": true, "min": 3, "alternateKey": "lien_photos"}
  ]'::jsonb, 1),

  ('Interview 3000', 3000, 'Interview 3000', '[
    {"key": "artiste", "label": "Artiste", "type": "text", "required": true},
    {"key": "accroche", "label": "Accroche", "type": "text", "required": true},
    {"key": "credits", "label": "Crédits", "type": "text", "required": false},
    {"key": "chapo", "label": "Chapo", "type": "textarea", "required": false},
    {"key": "corps", "label": "Corps du texte", "type": "textarea", "required": true},
    {"key": "photos", "label": "3 photos minimum ou lien drive", "type": "images", "required": true, "min": 3}
  ]'::jsonb, 2),

  ('Disque de la semaine', 2500, 'Disque de la semaine', '[
    {"key": "artiste", "label": "Nom de l''artiste", "type": "text", "required": true},
    {"key": "album", "label": "Nom de l''album", "type": "text", "required": true},
    {"key": "accroche", "label": "Accroche - pourquoi faut-il écouter l''album?", "type": "text", "required": true},
    {"key": "corps", "label": "Corps du texte", "type": "textarea", "required": true},
    {"key": "lien", "label": "Lien", "type": "url", "required": false}
  ]'::jsonb, 3),

  ('Chroniques', 1500, 'Chroniques', '[
    {"key": "artiste", "label": "Nom de l''artiste", "type": "text", "required": true},
    {"key": "album", "label": "Nom de l''album", "type": "text", "required": true},
    {"key": "etoiles", "label": "Nombre d''etoiles (sur 5)", "type": "stars", "required": true, "max": 5},
    {"key": "corps", "label": "Corps du texte", "type": "textarea", "required": true},
    {"key": "lien", "label": "Lien", "type": "url", "required": false}
  ]'::jsonb, 4),

  ('Chronique Cinema', 1500, 'Chronique cinema', '[
    {"key": "artiste", "label": "Nom du film", "type": "text", "required": true},
    {"key": "album", "label": "Nom du realisateur", "type": "text", "required": true},
    {"key": "etoiles", "label": "Nombre d''etoiles (sur 5)", "type": "stars", "required": true, "max": 5},
    {"key": "corps", "label": "Corps du texte", "type": "textarea", "required": true},
    {"key": "lien", "label": "Lien", "type": "url", "required": false}
  ]'::jsonb, 5),

  ('Chronique Coup de Coeur', 2500, 'Chronique coup de coeur', '[
    {"key": "artiste", "label": "Artiste", "type": "text", "required": true},
    {"key": "album", "label": "Album", "type": "text", "required": true},
    {"key": "etoiles", "label": "Nombre d''etoiles (sur 5)", "type": "stars", "required": true, "max": 5},
    {"key": "accroche", "label": "Accroche", "type": "text", "required": true},
    {"key": "corps", "label": "Corps du texte", "type": "textarea", "required": true},
    {"key": "lien", "label": "Lien", "type": "url", "required": false}
  ]'::jsonb, 6),

  ('Frenchie', 2500, 'frenchie', '[
    {"key": "artiste", "label": "Artiste", "type": "text", "required": true},
    {"key": "album", "label": "Album", "type": "text", "required": true},
    {"key": "accroche", "label": "Accroche", "type": "text", "required": true},
    {"key": "corps", "label": "Corps du texte", "type": "textarea", "required": true},
    {"key": "lien", "label": "Lien", "type": "url", "required": false}
  ]'::jsonb, 7),

  ('Livres et Expo', 1500, 'Livres et expo', '[
    {"key": "artiste", "label": "Titre", "type": "text", "required": true},
    {"key": "album", "label": "Auteur / Commissaire", "type": "text", "required": true},
    {"key": "corps", "label": "Corps du texte", "type": "textarea", "required": true},
    {"key": "lien", "label": "Lien", "type": "url", "required": false}
  ]'::jsonb, 8);

-- 6. App Settings (API keys, config managed by admins)
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all settings"
  ON app_settings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage settings"
  ON app_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed default settings keys
INSERT INTO app_settings (key, value) VALUES
  ('REQUIRE_MFA', 'false'),
  ('ANTHROPIC_API_KEY', ''),
  ('DROPBOX_APP_KEY', ''),
  ('DROPBOX_APP_SECRET', ''),
  ('DROPBOX_REFRESH_TOKEN', ''),
  ('WORDPRESS_ENABLED', 'false'),
  ('WORDPRESS_URL', ''),
  ('WORDPRESS_USERNAME', ''),
  ('WORDPRESS_APP_PASSWORD', '');

-- First hebdo (adjust number as needed)
INSERT INTO hebdo_config (numero, label, start_date, end_date, is_current) VALUES
  (226, 'RSH226', '2026-03-25', '2026-03-29', true);
