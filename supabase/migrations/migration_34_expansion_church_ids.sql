-- ============================================================
-- MIGRATION 34 — Fix vw_expansion_cities: adiciona church_ids
-- CEC Family · AGILIZE Tecnologia · Junho 2026
-- Necessário para o Painel Executivo Territorial do Mapa
-- ============================================================

-- Recriar a view adicionando array de church_ids
CREATE OR REPLACE VIEW public.vw_expansion_cities AS
SELECT
  c.state,
  c.city,
  COUNT(DISTINCT c.id)::int                              AS churches_count,
  COUNT(DISTINCT lg.id)::int                             AS lgs_count,
  COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'ativo')::int AS members_count,
  ARRAY_AGG(DISTINCT c.name ORDER BY c.name)             AS church_names,
  ARRAY_AGG(DISTINCT c.type ORDER BY c.type)             AS church_types,
  ARRAY_AGG(DISTINCT c.id::text ORDER BY c.name)        AS church_ids
FROM public.churches c
LEFT JOIN public.life_groups lg ON lg.church_id = c.id AND lg.is_active = true
LEFT JOIN public.members m      ON m.life_group_id = lg.id
WHERE c.is_active = true
  AND c.city IS NOT NULL
  AND c.state IS NOT NULL
GROUP BY c.state, c.city
ORDER BY members_count DESC;
