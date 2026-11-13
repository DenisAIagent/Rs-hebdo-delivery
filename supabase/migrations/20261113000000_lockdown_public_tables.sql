-- Verrouillage des tables applicatives (audit securite du 13/11/2026).
--
-- Constat : les policies admin de `profiles` lisaient `profiles` (recursion
-- 42P17). Toute lecture echouait donc par accident, alors que `anon` et
-- `authenticated` avaient TOUS les droits sur les tables. Le jour ou la
-- recursion aurait ete « reparee », la cle publique du navigateur aurait suffi
-- pour lire les profils, les papiers et les secrets de app_settings.
--
-- L'application n'a besoin d'aucun acces direct : le frontend n'utilise que
-- supabase.auth, et le backend passe par la cle service_role (qui ignore la RLS).
-- On retire donc tous les droits et toutes les policies : RLS activee sans
-- policy = aucun acces hors service_role.

DO $$
DECLARE
  t text;
  p record;
  locked text[] := ARRAY[
    'profiles', 'deliveries', 'delivery_logs', 'app_settings', 'correction_prompt',
    'paper_types', 'hebdo_config', 'editorial_agents', 'editorial_agent_versions',
    'canary_state'
  ];
BEGIN
  FOREACH t IN ARRAY locked LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated, PUBLIC', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- Les futures tables creees dans `public` ne sont plus ouvertes par defaut.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC;
