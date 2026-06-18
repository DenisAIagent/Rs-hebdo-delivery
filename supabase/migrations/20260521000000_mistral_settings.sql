-- Add Mistral AI as a third correction engine option
INSERT INTO app_settings (key, value) VALUES
  ('MISTRAL_API_KEY', '')
ON CONFLICT (key) DO NOTHING;
