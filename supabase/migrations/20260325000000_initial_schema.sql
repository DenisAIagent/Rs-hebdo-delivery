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
  drive_folder_url TEXT,
  status TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('draft', 'corrected', 'delivered')),
  sign_count INTEGER NOT NULL DEFAULT 0,
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

-- ================================================
-- SEED DATA: Default paper types
-- ================================================

-- Noms alignes sur la production (voir supabase-schema.sql pour fields_config).
INSERT INTO paper_types (name, sign_limit, drive_folder_name, sort_order) VALUES
  ('Sujet de couv', 15000, 'Sujet de couv', 1),
  ('Interview 3000', 3000, 'Interview 3000', 2),
  ('Disque de la semaine', 2500, 'Disque de la semaine', 3),
  ('Chroniques', 1500, 'Chroniques', 4),
  ('Chronique Cinema', 1500, 'Chronique cinema', 5),
  ('Chronique Coup de Coeur', 2500, 'Chronique coup de coeur', 6),
  ('Frenchie', 2500, 'frenchie', 7),
  ('Livres et Expo', 1500, 'Livres et expo', 8);

-- First hebdo (adjust number as needed)
INSERT INTO hebdo_config (numero, label, is_current) VALUES
  (226, 'RSH226', true);
