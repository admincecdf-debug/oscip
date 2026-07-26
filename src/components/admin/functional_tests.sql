-- Testes funcionais (não fazem parte da migration, só validação local)

-- Setup: dois tenants, cada um com uma organização
insert into public.tenants (id, name, slug, segment) values
  ('11111111-1111-1111-1111-111111111111', 'CEC', 'cec-teste', 'RELIGIOUS'),
  ('22222222-2222-2222-2222-222222222222', 'FAM', 'fam-teste', 'SOCIAL_OSC');

insert into public.organizations (id, name, type, is_active, tenant_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'CEC Manaus - Sede', 'sede', true, '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'FAM Sede', 'sede', true, '22222222-2222-2222-2222-222222222222');

-- Apóstolo do tenant CEC
insert into public.profiles (id, role, organization_id, tenant_id, full_name, email)
values ('cccccccc-0000-0000-0000-000000000001', 'apostolo', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Apostolo CEC', 'apostolo@cec.com');

-- TESTE 1: accessible_organization_ids do apóstolo da CEC não deve incluir a org da FAM
create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'cccccccc-0000-0000-0000-000000000001'::uuid $$;

do $$
declare
  v_count int;
  v_leaked int;
begin
  select count(*) into v_count from public.accessible_organization_ids();
  select count(*) into v_leaked from public.accessible_organization_ids()
    where accessible_organization_ids = 'bbbbbbbb-0000-0000-0000-000000000001';

  raise notice 'TESTE 1 — accessible_organization_ids do apóstolo CEC: % organização(ões) visível(is), % vazamento(s) da FAM', v_count, v_leaked;
  if v_leaked > 0 then
    raise exception 'FALHOU: apóstolo da CEC está vendo organização de outro tenant (FAM)!';
  else
    raise notice 'PASSOU: nenhum vazamento entre tenants.';
  end if;
end $$;

-- TESTE 2: has_permission do apóstolo CEC não deve valer pra organização da FAM
do $$
declare
  v_result boolean;
begin
  select public.has_permission('cccccccc-0000-0000-0000-000000000001', 'qualquer.coisa', 'bbbbbbbb-0000-0000-0000-000000000001') into v_result;
  raise notice 'TESTE 2 — has_permission do apóstolo CEC sobre organização da FAM: %', v_result;
  if v_result then
    raise exception 'FALHOU: apóstolo da CEC tem permissão sobre organização de outro tenant!';
  else
    raise notice 'PASSOU: bypass de apóstolo não vaza entre tenants.';
  end if;
end $$;

-- TESTE 3: consume_invite_link com convite "só Life Group, sem organization_id
-- direto" deve deduzir a organização e criar o membro (fix do FIX003 que
-- antes nunca rodava por causa do overload)
insert into public.life_groups (id, organization_id, name) values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'LG Teste');

insert into public.invite_links (id, token, kind, organization_id, life_group_id, target_role, created_by)
values ('eeeeeeee-0000-0000-0000-000000000001', 'token-teste-lg-sem-org', 'membro',
        null, -- organization_id NULO de propósito — só tem life_group_id
        'dddddddd-0000-0000-0000-000000000001', 'membro', 'cccccccc-0000-0000-0000-000000000001');

insert into public.profiles (id, role, full_name, email, tenant_id)
values ('ffffffff-0000-0000-0000-000000000001', 'membro', 'Novo Membro Teste', 'novomembro@teste.com', '11111111-1111-1111-1111-111111111111');

create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'ffffffff-0000-0000-0000-000000000001'::uuid $$;

select public.consume_invite_link('token-teste-lg-sem-org', null, null, '11999999999', 'ffffffff-0000-0000-0000-000000000001');

do $$
declare
  v_member_org uuid;
  v_member_lg uuid;
begin
  select organization_id, life_group_id into v_member_org, v_member_lg
  from public.members where profile_id = 'ffffffff-0000-0000-0000-000000000001';

  raise notice 'TESTE 3 — membro criado com organization_id=% (esperado: aaaaaaaa...0001, deduzido do life group) e life_group_id=%', v_member_org, v_member_lg;

  if v_member_org is null then
    raise exception 'FALHOU: membro criado sem organization_id — dedução via life_group não funcionou.';
  elsif v_member_org <> 'aaaaaaaa-0000-0000-0000-000000000001' then
    raise exception 'FALHOU: organization_id do membro está errado.';
  else
    raise notice 'PASSOU: organização deduzida corretamente a partir do life group.';
  end if;
end $$;

-- TESTE 4: convite de pastor deve gravar role=pastor no profile (bug original relatado)
insert into public.invite_links (id, token, kind, organization_id, target_role, created_by)
values ('eeeeeeee-0000-0000-0000-000000000002', 'token-teste-pastor', 'pastor',
        'aaaaaaaa-0000-0000-0000-000000000001', 'pastor', 'cccccccc-0000-0000-0000-000000000001');

insert into public.profiles (id, role, full_name, email, tenant_id)
values ('ffffffff-0000-0000-0000-000000000002', 'membro', 'Novo Pastor Teste', 'novopastor@teste.com', '11111111-1111-1111-1111-111111111111');

create or replace function auth.uid() returns uuid language sql stable as
  $$ select 'ffffffff-0000-0000-0000-000000000002'::uuid $$;

select public.consume_invite_link('token-teste-pastor', null, null, '11988887777', 'ffffffff-0000-0000-0000-000000000002');

do $$
declare
  v_role user_role;
begin
  select role into v_role from public.profiles where id = 'ffffffff-0000-0000-0000-000000000002';
  raise notice 'TESTE 4 — role do profile após consumir convite de pastor: %', v_role;
  if v_role <> 'pastor' then
    raise exception 'FALHOU: role deveria ser pastor, ficou %', v_role;
  else
    raise notice 'PASSOU: role de pastor aplicado corretamente.';
  end if;
end $$;

raise notice '=== TODOS OS TESTES PASSARAM ===';
