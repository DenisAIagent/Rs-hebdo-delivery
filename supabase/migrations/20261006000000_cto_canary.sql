-- Role CTO + canari (surveillance croisee, alertes par email au CTO).
--
-- * Le serveur Railway controle la base toutes les heures (backend/src/services/canary.ts).
-- * La base controle le serveur Railway toutes les heures (ce fichier) : pg_cron appelle
--   GET <CANARY_APP_URL>/api/health via pg_net a hh:00, lit la reponse a hh:02 et,
--   au debut d'une panne comme au retour a la normale, envoie un email Resend aux
--   comptes actifs de role 'cto' (cle et expediteur : app_settings, onglet Email).

-- ── Role CTO (memes droits qu'un admin dans l'app) ──────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('journalist', 'admin', 'cto'));

-- ── Etat du canari (une ligne par composant surveille) ──────────────────────
create table if not exists public.canary_state (
  component       text primary key check (component in ('supabase', 'railway')),
  status          text not null check (status in ('ok', 'down')),
  since           timestamptz not null default now(),
  detail          text,
  last_checked    timestamptz,
  last_request_id bigint
);
-- Lu et ecrit uniquement par le serveur (cle service) et les fonctions ci-dessous.
alter table public.canary_state enable row level security;
revoke all on public.canary_state from anon, authenticated;

-- Adresse publique de l'app surveillee (modifiable dans app_settings).
insert into public.app_settings (key, value)
values ('CANARY_APP_URL', 'https://rs-hebdo-delivery-production.up.railway.app')
on conflict (key) do nothing;

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ── Envoi d'une alerte aux CTO via Resend ───────────────────────────────────
create or replace function public.canary_send_alert(p_component text, p_transition text, p_detail text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key     text;
  v_from    text;
  v_url     text;
  v_to      jsonb;
  v_label   text := case p_component when 'railway' then 'Serveur Railway' else 'Base Supabase' end;
  v_word    text := case p_transition when 'up' then 'rétabli' else 'en panne' end;
  v_color   text := case p_transition when 'up' then '#1F7A3A' else '#B30E1F' end;
  v_lead    text := case p_transition
                      when 'up' then 'Le contrôle horaire repasse au vert.'
                      else 'Le canari a détecté un échec lors du contrôle horaire.'
                    end;
  v_when    text := to_char(now() at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI');
  v_detail  text := replace(replace(replace(coalesce(p_detail, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  v_subject text;
  v_html    text;
  v_text    text;
begin
  select value into v_key from app_settings where key = 'RESEND_API_KEY';
  select value into v_from from app_settings where key = 'RESEND_FROM_EMAIL';
  select value into v_url from app_settings where key = 'CANARY_APP_URL';
  select jsonb_agg(email) into v_to from profiles where role = 'cto' and is_active and email <> '';

  if coalesce(v_key, '') = '' or v_to is null then
    raise warning 'canary: alerte % % non envoyée (clé Resend ou CTO manquant)', p_component, p_transition;
    return;
  end if;

  v_subject := case p_transition when 'up' then '🟢' else '🔴' end
               || ' [RS Hebdo] ' || v_label || ' ' || v_word;
  v_html := format(
    '<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;background:#FBF8F2;border:1px solid #E8E2D2;border-top:6px solid %s;border-radius:6px;padding:28px 32px;color:#16140F">'
    || '<p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#6A6557">RS Hebdo Delivery · Canari</p>'
    || '<h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:normal;font-size:26px;color:%s">%s %s</h1>'
    || '<p style="margin:0 0 16px;font-size:15px;line-height:1.55">%s</p>'
    || '<p style="margin:0 0 4px;font-size:14px"><span style="color:#6A6557">%s :</span> %s</p>'
    || '%s'
    || '<p style="margin:20px 0 0;font-size:12px;color:#6A6557">Vous recevez cette alerte en tant que CTO de RS Hebdo Delivery · %s</p></div>',
    v_color, v_color, v_label, v_word, v_lead,
    case p_transition when 'up' then 'Rétabli le' else 'Depuis le' end, v_when,
    case when v_detail <> '' then '<p style="margin:0;font-size:14px"><span style="color:#6A6557">Détail :</span> ' || v_detail || '</p>' else '' end,
    coalesce(v_url, '')
  );
  v_text := v_label || ' ' || v_word || E'\n' || v_lead || E'\n' || v_when
            || case when coalesce(p_detail, '') <> '' then E'\nDétail : ' || p_detail else '' end
            || E'\n' || coalesce(v_url, '');

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    body := jsonb_build_object(
      'from', coalesce(nullif(v_from, ''), 'RS Hebdo <onboarding@resend.dev>'),
      'to', v_to, 'subject', v_subject, 'html', v_html, 'text', v_text),
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    timeout_milliseconds := 20000
  );
end;
$$;

-- ── Ping du serveur Railway (hh:00) ─────────────────────────────────────────
create or replace function public.canary_ping_railway()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_id  bigint;
begin
  select value into v_url from app_settings where key = 'CANARY_APP_URL';
  if coalesce(v_url, '') = '' then
    return;
  end if;
  v_id := net.http_get(url := rtrim(v_url, '/') || '/api/health', timeout_milliseconds := 20000);
  insert into canary_state (component, status, last_request_id)
  values ('railway', 'ok', v_id)
  on conflict (component) do update set last_request_id = excluded.last_request_id;
end;
$$;

-- ── Lecture de la reponse et alerte au changement d'etat (hh:02) ────────────
create or replace function public.canary_check_railway()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state  canary_state%rowtype;
  v_code   integer;
  v_tout   boolean;
  v_err    text;
  v_ok     boolean;
  v_detail text;
  v_new    text;
begin
  select * into v_state from canary_state where component = 'railway';
  if not found or v_state.last_request_id is null then
    return;
  end if;

  select status_code, timed_out, error_msg into v_code, v_tout, v_err
  from net._http_response where id = v_state.last_request_id;

  if not found then
    v_ok := false; v_detail := 'Aucune réponse du serveur';
  elsif v_tout then
    v_ok := false; v_detail := 'Délai de réponse dépassé (20 s)';
  elsif v_code = 200 then
    v_ok := true; v_detail := null;
  else
    v_ok := false; v_detail := coalesce('HTTP ' || v_code, v_err, 'Erreur inconnue');
  end if;

  v_new := case when v_ok then 'ok' else 'down' end;
  if v_new <> v_state.status then
    update canary_state set status = v_new, since = now(), detail = v_detail, last_checked = now()
    where component = 'railway';
    perform canary_send_alert('railway', case when v_ok then 'up' else 'down' end, v_detail);
  else
    update canary_state set detail = v_detail, last_checked = now() where component = 'railway';
  end if;
end;
$$;

revoke all on function public.canary_send_alert(text, text, text) from public, anon, authenticated;
revoke all on function public.canary_ping_railway() from public, anon, authenticated;
revoke all on function public.canary_check_railway() from public, anon, authenticated;

select cron.schedule('canary-railway-ping', '0 * * * *', 'select public.canary_ping_railway()');
select cron.schedule('canary-railway-check', '2 * * * *', 'select public.canary_check_railway()');
