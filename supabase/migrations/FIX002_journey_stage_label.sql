-- ============================================================
-- CEC FAMILY — Fix: erro "function journey_stage_label(journey_stage)
-- does not exist" ao mudar a Situação Ministerial de um membro.
--
-- Causa: o gatilho log_journey_stage_change() chama
-- journey_stage_label()/journey_stage_rank() passando o valor do
-- tipo enum "journey_stage" direto, mas essas funções esperam
-- "text" — faltava o cast explícito ::text.
--
-- Aproveitado pra completar as duas funções com os cargos novos
-- (Pastor Principal/Auxiliar, Apóstolo, Supervisores específicos,
-- Diácono, Líder de LG) que ainda não estavam nelas.
-- ============================================================

create or replace function public.journey_stage_label(p_stage text)
returns text
language sql immutable as $$
  select case p_stage
    when 'visitante'           then 'Visitante'
    when 'novo_convertido'     then 'Novo Convertido'
    when 'consolidacao'        then 'Consolidação'
    when 'discipulado'         then 'Discipulado'
    when 'batismo'             then 'Batismo'
    when 'membro_ativo'        then 'Membro Ativo'
    when 'membro_efetivo'      then 'Membro Efetivo'
    when 'servo'               then 'Servo'
    when 'lider_formacao'      then 'Líder em Formação'
    when 'lider'               then 'Líder'
    when 'lider_lg'            then 'Líder de Life Group'
    when 'diacono'             then 'Diácono(a)'
    when 'supervisor'          then 'Supervisor'
    when 'supervisor_setor'    then 'Supervisor(a) de Setor'
    when 'supervisor_area'     then 'Supervisor(a) de Área'
    when 'supervisor_distrito' then 'Supervisor(a) de Distrito'
    when 'pastor_auxiliar'     then 'Pastor(a) Auxiliar'
    when 'pastor_principal'    then 'Pastor(a) Principal'
    when 'apostolo'            then 'Apóstolo(a)'
    when 'missionario'         then 'Missionário'
    else p_stage
  end;
$$;

create or replace function public.journey_stage_rank(p_stage text)
returns int
language sql immutable as $$
  select case p_stage
    when 'visitante'           then 1
    when 'novo_convertido'     then 2
    when 'consolidacao'        then 3
    when 'discipulado'         then 4
    when 'batismo'             then 5
    when 'membro_ativo'        then 6
    when 'membro_efetivo'      then 7
    when 'servo'               then 8
    when 'lider_formacao'      then 9
    when 'lider'               then 10
    when 'lider_lg'            then 10
    when 'diacono'             then 11
    when 'supervisor'          then 12
    when 'supervisor_setor'    then 12
    when 'supervisor_area'     then 13
    when 'supervisor_distrito' then 14
    when 'pastor_auxiliar'     then 15
    when 'pastor_principal'    then 16
    when 'apostolo'            then 17
    when 'missionario'         then 11
    else 0
  end;
$$;

create or replace function public.log_journey_stage_change()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.journey_stage is distinct from old.journey_stage then
    insert into public.pastoral_timeline (member_id, event_type, title, from_stage, to_stage, is_progression, event_date)
    values (
      new.id,
      'mudanca_etapa',
      'Mudou de etapa: ' || public.journey_stage_label(old.journey_stage::text) || ' → ' || public.journey_stage_label(new.journey_stage::text),
      old.journey_stage,
      new.journey_stage,
      public.journey_stage_rank(new.journey_stage::text) > public.journey_stage_rank(old.journey_stage::text),
      current_date
    );
  end if;
  return new;
end; $$;
