-- WordPress publishing module
-- Credentials (application password) stored in app_settings, admin-only via RLS.
INSERT INTO app_settings (key, value) VALUES
  ('WORDPRESS_ENABLED', 'false'),
  ('WORDPRESS_URL', ''),
  ('WORDPRESS_USERNAME', ''),
  ('WORDPRESS_APP_PASSWORD', '')
ON CONFLICT (key) DO NOTHING;

-- Track the WordPress side of each delivery
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS wp_post_id INTEGER;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS wp_post_url TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS wp_status TEXT;
-- Full AI payload (categories, tags, Yoast, style music, main artist) kept for
-- the editorial team: fields that cannot be set reliably via REST (Yoast,
-- Style Music, Main Music Artist) are finished by hand in the classic editor.
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS wp_payload JSONB;
