-- ============================================================
-- CEC FAMILY — M3: Cadastro inteligente + Visitor Pipeline
-- Tabela: visitor_pipeline (anteciparmos do M4)
-- RPC: visitor_pipeline_create() — usada na etapa 5 do wizard
-- Idempotente.
-- ============================================================

-- ---------- 1) Enums ----------
do $$ begin
  create type pipeline_stage as enum (
    'novo','aguardando_contato','contato_realizado','convidado_culto',
    'convidado_life_group','participou','discipulado','consolidacao',
    'batizado','membro','servo','lider'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type pipeline_intent as enum (
    'lifegroup','discipulado','acompanhamento_pastoral','visita',
    'conhecer','batismo','servir','outro'
  );
exception when duplicate_object then null; end $$;

-- ---------- 2) Tabela visitor_pipeline ----------
create table if not exists public.visitor_pipeline (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid references auth.users(id) on delete set null,
  profile_id               uuid references public.profiles(id) on delete set null,
  community_id             uuid references public.churches(id) on delete set null,

  -- snapshot de dados ao criar (preserva caso usuario edite o profile)
  full_name                text not null,
  phone                    text,
  email                    text,
  state                    text,
  city                     text,
  cep                      text,

  intent                   pipeline_intent not null default 'conhecer',
  stage                    pipeline_stage  not null default 'novo',
  source                   text default 'site_publico',

  assigned_to              uuid references public.profiles(id) on delete set null,
  internal_notes           text,

  first_contact_at         timestamptz,
  life_group_invite_at     timestamptz,
  discipleship_started_at  timestamptz,
  baptism_date             date,
  member_date              date,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_vp_stage     on public.visitor_pipeline(stage);
create index if not exists idx_vp_community on public.visitor_pipeline(community_id);
create index if not exists idx_vp_user      on public.visitor_pipeline(user_id);
create index if not exists idx_vp_created   on public.visitor_pipeline(created_at desc);

drop trigger if exists trg_vp_updated on public.visitor_pipeline;
create trigger trg_vp_updated before update on public.visitor_pipeline
  for each row execute function public.set_updated_at();

alter table public.visitor_pipeline enable row level security;

-- Anon NAO pode ler nem inserir direto: usar a RPC abaixo
-- Admin/pastor le e gerencia
drop policy if exists vp_admin_all on public.visitor_pipeline;
create policy vp_admin_all on public.visitor_pipeline for all to authenticated
  using (is_admin() and (community_id is null or in_my_network(community_id)))
  with check (is_admin() and (community_id is null or in_my_network(community_id)));

-- Usuario ve sua propria entrada
drop policy if exists vp_owner_select on public.visitor_pipeline;
create policy vp_owner_select on public.visitor_pipeline for select to authenticated
  using (user_id = auth.uid());

-- ---------- 3) RPC para etapa 5 do wizard ----------
-- E usada apos o signUp do supabase auth (que ja cria profile via trigger).
-- Chamada autenticada como o proprio usuario recem-criado.
create or replace function public.visitor_pipeline_create(
  p_community_id uuid,
  p_intent       pipeline_intent,
  p_full_name    text,
  p_phone        text,
  p_email        text default null,
  p_state        text default null,
  p_city         text default null,
  p_cep          text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  -- profile do usuario logado (criado pelo trigger on_auth_user_created)
  select id into v_profile_id from public.profiles where id = auth.uid();

  insert into public.visitor_pipeline (
    user_id, profile_id, community_id,
    full_name, phone, email, state, city, cep,
    intent, stage, source
  ) values (
    auth.uid(), v_profile_id, p_community_id,
    p_full_name, p_phone, p_email, p_state, p_city, p_cep,
    p_intent, 'novo', 'site_publico'
  ) returning id into v_id;

  return v_id;
end; $$;

-- Permite chamada por usuarios autenticados
grant execute on function public.visitor_pipeline_create(uuid, pipeline_intent, text, text, text, text, text, text)
  to authenticated;

-- ---------- 4) Update do get_pending_counts ----------
-- Inclui visitantes novos no contador de pendentes
-- (Drop antes do recreate porque o tipo de retorno mudou de 2 para 3 colunas)
drop function if exists public.get_pending_counts();
create or replace function public.get_pending_counts()
returns table(prayer_pending bigint, visit_pending bigint, pipeline_new bigint)
language sql stable security definer set search_path=public as $$
  select
    (select count(*) from public.public_prayer_requests where status = 'novo') as prayer_pending,
    (select count(*) from public.visit_requests          where status = 'novo') as visit_pending,
    (select count(*) from public.visitor_pipeline        where stage  = 'novo') as pipeline_new;
$$;
