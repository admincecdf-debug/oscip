-- ============================================================
-- CEC FAMILY — B2: conteudo institucional
-- Tabelas: church_info (cultos por igreja) + daily_words (palavra).
-- RLS: leitura publica (anon) para ativos; escrita restrita a admin.
-- Idempotente: pode rodar varias vezes sem quebrar.
-- ============================================================

-- ---------- CHURCH_INFO (horarios de culto) ----------
create table if not exists public.church_info (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  weekday     weekday not null,
  time        time    not null,
  description text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_church_info_church on public.church_info(church_id);

drop trigger if exists trg_church_info_updated on public.church_info;
create trigger trg_church_info_updated before update on public.church_info
  for each row execute function public.set_updated_at();

alter table public.church_info enable row level security;

-- leitura PUBLICA (anonimos) para registros ativos
drop policy if exists church_info_public_read on public.church_info;
create policy church_info_public_read on public.church_info for select to anon
  using (is_active);

-- leitura autenticada (todos da rede da igreja)
drop policy if exists church_info_select on public.church_info;
create policy church_info_select on public.church_info for select to authenticated
  using (in_my_network(church_id));

-- escrita restrita a admin da rede
drop policy if exists church_info_write on public.church_info;
create policy church_info_write on public.church_info for all to authenticated
  using (is_admin() and in_my_network(church_id))
  with check (is_admin() and in_my_network(church_id));

-- ---------- DAILY_WORDS (palavra do dia/semana) ----------
create table if not exists public.daily_words (
  id          uuid primary key default gen_random_uuid(),
  date        date    not null,                            -- data alvo
  title       text    not null,
  verse_ref   text,                                         -- ex: "Salmos 23:1"
  verse_text  text,
  reflection  text,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_daily_words_date on public.daily_words(date desc);

drop trigger if exists trg_daily_words_updated on public.daily_words;
create trigger trg_daily_words_updated before update on public.daily_words
  for each row execute function public.set_updated_at();

alter table public.daily_words enable row level security;

-- leitura PUBLICA (anonimos) para a palavra atual
drop policy if exists daily_words_public_read on public.daily_words;
create policy daily_words_public_read on public.daily_words for select to anon
  using (is_active and date <= current_date);

-- leitura autenticada (todos)
drop policy if exists daily_words_select on public.daily_words;
create policy daily_words_select on public.daily_words for select to authenticated
  using (true);

-- escrita restrita a admin
drop policy if exists daily_words_write on public.daily_words;
create policy daily_words_write on public.daily_words for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- Funcao auxiliar: a palavra de hoje (ou a mais recente <= hoje) ----------
create or replace function public.get_todays_word()
returns public.daily_words
language sql stable security definer set search_path=public as $$
  select * from public.daily_words
  where is_active and date <= current_date
  order by date desc
  limit 1;
$$;

-- ---------- SEED inicial (so se a tabela estiver vazia) ----------
-- Horarios da CEC Manaus Sede (conforme caderno tecnico):
-- Domingos: 08h, 16h, 18h. Quarta: 19:30 (oracao/ensino).
do $$
declare v_sede uuid;
begin
  select id into v_sede from public.churches where name='CEC Manaus - Sede' limit 1;
  if v_sede is not null and not exists (select 1 from public.church_info where church_id = v_sede) then
    insert into public.church_info (church_id, weekday, time, description, sort_order) values
      (v_sede, 'domingo', '08:00', 'Culto da manha', 1),
      (v_sede, 'domingo', '16:00', 'Culto da tarde', 2),
      (v_sede, 'domingo', '18:00', 'Culto da noite', 3),
      (v_sede, 'quarta',  '19:30', 'Culto de oracao e ensino', 4);
  end if;
end $$;

-- Palavra inicial (Salmos 23:1), so se nao houver nenhuma palavra cadastrada
insert into public.daily_words (date, title, verse_ref, verse_text, reflection)
select current_date, 'Palavra do dia',
       'Salmos 23:1',
       'O Senhor e o meu pastor; nada me faltara.',
       'Permita que Ele guie seu dia.'
where not exists (select 1 from public.daily_words);
