-- 2FA pilotee depuis l'admin (Parametres > Double authentification)
INSERT INTO app_settings (key, value) VALUES ('REQUIRE_MFA', 'false')
ON CONFLICT (key) DO NOTHING;
