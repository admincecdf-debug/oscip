-- ============================================================
-- CEC FAMILY — CECmais Fase 3: Catálogo de Ofertas
--
-- 5 tipos distintos de oferta, cada um com seu próprio fluxo
-- (Seção 12 da especificação):
--   produto            → Conhecer → Comprar → Pagamento → Entrega
--   conteudo_digital    → Conhecer → Comprar/liberar → Minha Biblioteca
--   curso               → Conhecer → Matricular → Pagamento → Estudar → Conclusão
--   assinatura           → Conhecer → Plano → Titular/dependentes → Pagamento recorrente
--   servico_plano        → Conhecer → Simular → Personalizar → Proposta → Contratar
--
-- Essa migration cria só o CATÁLOGO (Fase 3). Contratação/pagamento
-- de verdade fica pra Fase 5 — por enquanto as ofertas só são
-- "conhecidas", sem checkout funcional.
-- ============================================================

do $$ begin
  create type cecmais_categoria as enum ('saude','protecao','formacao','fe','leitura','vantagens');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cecmais_oferta_tipo as enum ('produto','conteudo_digital','curso','assinatura','servico_plano');
exception when duplicate_object then null; end $$;

create table if not exists public.cecmais_ofertas (
  id                uuid primary key default gen_random_uuid(),
  categoria         cecmais_categoria not null,
  tipo              cecmais_oferta_tipo not null,
  nome              text not null,
  descricao_curta   text,
  descricao_completa text,
  imagem_url        text,
  parceiro_nome     text,

  -- Produto / Conteúdo Digital
  preco             numeric(10,2),
  estoque           int,
  arquivo_url        text,   -- e-book/apostila digital

  -- Curso
  carga_horaria_horas int,
  numero_modulos      int,
  emite_certificado    boolean default false,

  -- Assinatura / Serviço-Plano
  preco_recorrente    numeric(10,2),
  periodicidade       text,   -- 'mensal' | 'anual' | etc (livre, sem enum pra flexibilidade)
  permite_dependentes boolean default false,
  carencia_dias       int,

  is_active         boolean not null default true,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
comment on table public.cecmais_ofertas is 'Catálogo de ofertas do CECmais (Fase 3) — produtos, conteúdo digital, cursos, assinaturas e serviços/planos.';

create index if not exists idx_cecmais_ofertas_categoria on public.cecmais_ofertas(categoria) where is_active;

alter table public.cecmais_ofertas enable row level security;

drop policy if exists cecmais_ofertas_read on public.cecmais_ofertas;
create policy cecmais_ofertas_read on public.cecmais_ofertas for select to authenticated
  using (is_active);

drop policy if exists cecmais_ofertas_write on public.cecmais_ofertas;
create policy cecmais_ofertas_write on public.cecmais_ofertas for all to authenticated
  using (public.is_apostle())
  with check (public.is_apostle());

grant select on public.cecmais_ofertas to authenticated;
