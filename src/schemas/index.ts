import { z } from "zod";

const reqText = (label: string, min = 2) =>
  z.string({ required_error: `${label} e obrigatorio` }).trim().min(min, `${label} deve ter pelo menos ${min} caracteres`);
const optionalText = z.string().trim().optional().or(z.literal(""));

export const loginSchema = z.object({
  email: z.string({required_error:"E-mail e obrigatorio"}).trim().toLowerCase().email("E-mail invalido"),
  password: z.string({required_error:"Senha e obrigatoria"}).min(6, "Senha precisa ter ao menos 6 caracteres"),
});
export type LoginInput = z.infer<typeof loginSchema>;

const youtubeUrl = z.string().url("URL invalida")
  .refine((u) => /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[A-Za-z0-9_-]{11}/.test(u), "Link do YouTube invalido");

export const sermonSchema = z.object({
  title: reqText("Titulo", 3),
  youtube_url: youtubeUrl,
  reference: optionalText, speaker: optionalText, category: optionalText, duration: optionalText,
  published_at: optionalText, description: optionalText, pdf_url: optionalText,
  is_featured: z.boolean().default(false),
});
export type SermonInput = z.infer<typeof sermonSchema>;

export const eventSchema = z.object({
  title: reqText("Titulo", 3),
  starts_at: z.string().min(10, "Data e hora obrigatorias"),
  location: optionalText,
  status: z.enum(["abertas","encerradas","esgotado","em_breve"]).default("abertas"),
  event_type: z.enum(["culto","congresso","conferencia","encontro","ebd","outro"]).default("outro"),
  registration_url: z.string().url("URL invalida").optional().or(z.literal("")),
});
export type EventInput = z.infer<typeof eventSchema>;

export const memberSchema = z.object({
  full_name: reqText("Nome completo", 3),
  email: z.string().email("E-mail invalido").optional().or(z.literal("")),
  phone: optionalText,
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida").optional().or(z.literal("")),
  life_group_id: z.string().uuid().optional().nullable(),
  journey_stage: z.enum(["visitante","novo_convertido","consolidacao","discipulado","batismo","membro_ativo","membro_efetivo","servo","lider_formacao","lider","diacono","supervisor","supervisor_setor","supervisor_area","supervisor_distrito","pastor_auxiliar","pastor_principal","apostolo","missionario"]).default("visitante"),
});
export type MemberInput = z.infer<typeof memberSchema>;

// Para criar membro com acesso (auth.user). Exige email + filtros geo.
export const memberCreateSchema = z.object({
  full_name: reqText("Nome completo", 3),
  email: z.string({required_error:"E-mail obrigatorio"}).email("E-mail invalido"),
  phone: optionalText,
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida").optional().or(z.literal("")),
  state: optionalText,
  city: optionalText,
  church_id: optionalText,
  life_group_id: z.string().uuid().optional().or(z.literal("")),
  journey_stage: z.enum(["visitante","novo_convertido","consolidacao","discipulado","batismo","membro_ativo","membro_efetivo","servo","lider_formacao","lider","diacono","supervisor","supervisor_setor","supervisor_area","supervisor_distrito","pastor_auxiliar","pastor_principal","apostolo","missionario"]).default("visitante"),
});
export type MemberCreateInput = z.infer<typeof memberCreateSchema>;

// Editor completo do membro (script Cadastro/Realocação/Carteirinha, Seção 5)
export const memberFullEditSchema = z.object({
  full_name: reqText("Nome completo", 3),
  social_name: optionalText,
  email: z.string().email("E-mail invalido").optional().or(z.literal("")),
  phone: optionalText,
  phone_recado: optionalText,
  phone_recado_nome: optionalText,
  whatsapp: optionalText,
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida").optional().or(z.literal("")),
  gender: optionalText,
  marital_status: optionalText,
  nationality: optionalText,
  naturalidade: optionalText,
  cpf: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, "CPF invalido").optional().or(z.literal("")),
  rg: optionalText,
  rg_orgao_expedidor: optionalText,
  cnh: optionalText,
  cnh_validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida").optional().or(z.literal("")),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP invalido").optional().or(z.literal("")),
  address: optionalText,
  numero: optionalText,
  complemento: optionalText,
  neighborhood: optionalText,
  city: optionalText,
  state: optionalText,
  country: optionalText,
  photo_url: optionalText,
  journey_stage: z.enum(["visitante","novo_convertido","consolidacao","discipulado","batismo","membro_ativo","membro_efetivo","servo","lider_formacao","lider","diacono","supervisor","supervisor_setor","supervisor_area","supervisor_distrito","pastor_auxiliar","pastor_principal","apostolo","missionario"]),
  status: z.enum(["ativo","inativo","afastado"]),
});
export type MemberFullEditInput = z.infer<typeof memberFullEditSchema>;

export const cellSchema = z.object({
  name: reqText("Nome da celula"),
  sector_id: z.string().uuid("Setor invalido").optional().or(z.literal("")),
  church_id: z.string().uuid("Igreja invalida").optional().or(z.literal("")),
  address: optionalText,
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP invalido (00000-000)").optional().or(z.literal("")),
  numero: optionalText,
  complemento: optionalText,
  state: optionalText,
  city: optionalText,
  neighborhood: optionalText,
  meeting_weekday: z.enum(["domingo","segunda","terca","quarta","quinta","sexta","sabado"]).optional().nullable(),
  meeting_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora invalida (HH:MM)").optional().or(z.literal("")),
  leader_id: z.string().uuid().optional().nullable(),
  coleader_id: z.string().uuid().optional().nullable(),
  host_id: z.string().uuid().optional().nullable(),
  host_assistant_id: z.string().uuid().optional().nullable(),
  multiplication_target: z.coerce.number().int().min(3, "Minimo 3").max(50, "Maximo 50").default(12),
  target_audience: z.enum(["misto","jovens","adolescentes","adultos","casais","terceira_idade","mulheres","homens","outro"]).default("misto"),
  status_lg: z.enum(["em_formacao","ativo","em_multiplicacao","multiplicado","encerrado"]).default("ativo"),
  founded_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida").optional().or(z.literal("")),
}).refine((v) => !!v.sector_id || !!v.church_id, {
  message: "Selecione um Setor ou vincule direto a uma Igreja/Sede.",
  path: ["sector_id"],
});
export type CellInput = z.infer<typeof cellSchema>;

// ── Estrutura MDA: Distrito, Área, Setor ────────────────────────
export const stateSchema = z.object({
  name: reqText("Nome do estado"),
  uf: z.string().length(2, "Sigla deve ter 2 letras").transform((v) => v.toUpperCase()),
});
export type StateInput = z.infer<typeof stateSchema>;

export const nucleoSchema = z.object({
  name: reqText("Nome do núcleo"),
  state_id: z.string().uuid("Selecione o estado"),
  leader_id: z.string().uuid().optional().or(z.literal("")),
});
export type NucleoInput = z.infer<typeof nucleoSchema>;

export const districtSchema = z.object({
  name: reqText("Nome do distrito"),
  parent_level: z.enum(["estado","nucleo"]),
  parent_id: z.string().uuid("Selecione o destino"),
  mother_id: z.string().uuid().optional().or(z.literal("")),
  leader_id: z.string().uuid().optional().or(z.literal("")),
});
export type DistrictInput = z.infer<typeof districtSchema>;

export const areaSchema = z.object({
  name: reqText("Nome da área"),
  district_id: z.string().uuid("Selecione o distrito"),
  mother_id: z.string().uuid().optional().or(z.literal("")),
  leader_id: z.string().uuid().optional().or(z.literal("")),
});
export type AreaInput = z.infer<typeof areaSchema>;

export const sectorSchema = z.object({
  name: reqText("Nome do setor"),
  parent_level: z.enum(["nucleo","distrito"]),
  parent_id: z.string().uuid("Selecione o destino"),
  area_id: z.string().uuid().optional().or(z.literal("")),
  mother_id: z.string().uuid().optional().or(z.literal("")),
  leader_id: z.string().uuid().optional().or(z.literal("")),
});
export type SectorInput = z.infer<typeof sectorSchema>;

// ── Grupo de Evangelismo (C24) ──────────────────────────────────
export const evangelismGroupSchema = z.object({
  name: reqText("Nome do grupo"),
  cell_id: z.string().uuid("Selecione o Life Group responsável"),
  address: optionalText,
  neighborhood: optionalText,
  city: optionalText,
  state: optionalText,
  meeting_weekday: z.enum(["domingo","segunda","terca","quarta","quinta","sexta","sabado"]).optional().nullable(),
  meeting_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora invalida (HH:MM)").optional().or(z.literal("")),
  started_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional().or(z.literal("")),
  expected_end_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional().or(z.literal("")),
});
export type EvangelismGroupInput = z.infer<typeof evangelismGroupSchema>;

export const discipleshipAdminSchema = z.object({
  discipler_id: z.string().uuid("Discipulador obrigatorio"),
  disciple_id: z.string().uuid("Discipulo obrigatorio"),
  current_module: optionalText,
  notes: optionalText,
}).refine((d) => d.discipler_id !== d.disciple_id, {
  message: "Discipulador e discipulo devem ser pessoas diferentes",
  path: ["disciple_id"],
});
export type DiscipleshipAdminInput = z.infer<typeof discipleshipAdminSchema>;

export const prayerSchema = z.object({
  request: reqText("Pedido", 3),
  life_group_id: z.string().uuid().optional().nullable(),
});
export type PrayerInput = z.infer<typeof prayerSchema>;

// B2 — Conteudo institucional
export const serviceTimeSchema = z.object({
  church_id: z.string().uuid("Igreja invalida"),
  weekday: z.enum(["domingo","segunda","terca","quarta","quinta","sexta","sabado"]),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora invalida (HH:MM)"),
  description: optionalText,
  sort_order: z.coerce.number().int().min(0).default(0),
});
export type ServiceTimeInput = z.infer<typeof serviceTimeSchema>;

export const dailyWordSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida"),
  title: reqText("Titulo", 3),
  verse_ref: optionalText,
  verse_text: optionalText,
  reflection: optionalText,
  prayer: optionalText,
});
export type DailyWordInput = z.infer<typeof dailyWordSchema>;

// M1a — Conteudo publico
export const newsSchema = z.object({
  title: reqText("Titulo", 3),
  category: z.enum(["minha_comunidade","cec_manaus","cec_brasilia","geral"]).default("geral"),
  summary: optionalText,
  body: optionalText,
  cover_url: z.string().url("URL invalida").optional().or(z.literal("")),
  author_name: optionalText,
  is_published: z.boolean().default(false),
  meta_title: optionalText,
  meta_description: optionalText,
});
export type NewsInput = z.infer<typeof newsSchema>;

export const publicPrayerFormSchema = z.object({
  full_name: reqText("Nome", 2),
  email: z.string().email("E-mail invalido").optional().or(z.literal("")),
  phone: optionalText,
  city: optionalText,
  request: reqText("Pedido de oracao", 5),
  // honeypot (anti-spam): aceita qualquer string, mas deve vir vazia
  website: z.string().optional().default(""),
});
export type PublicPrayerFormInput = z.infer<typeof publicPrayerFormSchema>;

export const visitFormSchema = z.object({
  full_name: reqText("Nome", 2),
  email: z.string().email("E-mail invalido").optional().or(z.literal("")),
  phone: z.string({required_error:"Telefone e obrigatorio"}).trim().min(8, "Telefone invalido"),
  city: optionalText,
  address: optionalText,
  best_time: optionalText,
  reason: optionalText,
  // honeypot
  website: z.string().optional().default(""),
});
export type VisitFormInput = z.infer<typeof visitFormSchema>;

// B3 — Area do membro
export const profileEditSchema = z.object({
  full_name: reqText("Nome completo", 3),
  phone: optionalText,
});
export type ProfileEditInput = z.infer<typeof profileEditSchema>;

export const newPrayerSchema = z.object({
  request: reqText("Pedido", 3),
});
export type NewPrayerInput = z.infer<typeof newPrayerSchema>;

// B4b — Operação semanal
export const weeklyReportSchema = z.object({
  life_group_id: z.string().uuid("Célula obrigatória"),
  meeting_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  share_theme: optionalText,
  bible_text: optionalText,
  flowed: z.enum(["sim","nao","null"]).default("null"),
  flowed_reason: optionalText,
  decisions_count: z.coerce.number().int().min(0).default(0),
  needs: optionalText,
  summary: optionalText,
  // Indicadores semanais (Caderno 11-B parte 1)
  members_with_disciplers: z.coerce.number().int().min(0).default(0),
  mda_15_dias_happened: z.coerce.boolean().default(false),
  mda_15_dias_count: z.coerce.number().int().min(0).default(0),
  ge_happened: z.coerce.boolean().default(false),
  ge_location: optionalText,
  ge_when: optionalText,
  oferta_pix: z.coerce.number().min(0).default(0),
  oferta_especie: z.coerce.number().min(0).default(0),
  ebd_count: z.coerce.number().int().min(0).default(0),
  cc_count: z.coerce.number().int().min(0).default(0),
  cel_count: z.coerce.number().int().min(0).default(0),
  kg_amor: z.coerce.number().min(0).default(0),
  // Discipulado
  disc_realizados: z.coerce.number().int().min(0).default(0),
  disc_ativos: z.coerce.number().int().min(0).default(0),
  disc_encontros: z.coerce.number().int().min(0).default(0),
  disc_interrompidos: z.coerce.number().int().min(0).default(0),
  disc_novos: z.coerce.number().int().min(0).default(0),
  // Consolidação
  cons_retornantes: z.coerce.number().int().min(0).default(0),
  cons_acompanhamento: z.coerce.number().int().min(0).default(0),
  cons_integrados: z.coerce.number().int().min(0).default(0),
  cons_novos_membros: z.coerce.number().int().min(0).default(0),
  // Liderança
  lid_aux_treinamento: z.coerce.boolean().default(false),
  lid_em_formacao: z.coerce.boolean().default(false),
  lid_potencial_multiplicador: z.coerce.boolean().default(false),
  lid_observacoes: optionalText,
  // Multiplicação
  mult_filha_preparacao: z.coerce.boolean().default(false),
  mult_nova_lideranca: z.coerce.boolean().default(false),
  mult_potencial: z.coerce.boolean().default(false),
  // Saúde
  saude_status: z.enum(["muito_saudavel","saudavel","atencao","necessita_apoio",""]).default(""),
  saude_comentarios: optionalText,
  // Necessidades pastorais
  nec_oracao_urgente: z.coerce.boolean().default(false),
  nec_visita_pastoral: z.coerce.boolean().default(false),
  nec_problema_familiar: z.coerce.boolean().default(false),
  nec_problema_espiritual: z.coerce.boolean().default(false),
  nec_encaminhar_supervisor: z.coerce.boolean().default(false),
});
export type WeeklyReportFormInput = z.infer<typeof weeklyReportSchema>;

export const financeSchema = z.object({
  church_id: z.string().uuid("Igreja obrigatória"),
  direction: z.enum(["entrada","saida"]),
  kind: z.enum(["dizimo","oferta","primicia","missoes","construcao","outras_entradas",
                "salario","aluguel","energia","evangelismo","evento","investimento","outras_saidas"]),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  description: optionalText,
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  payer_name: optionalText,
});
export type FinanceFormInput = z.infer<typeof financeSchema>;

// M1b — Banners (Hero Carousel)
export const bannerSchema = z.object({
  title: reqText("Titulo", 3),
  subtitle: optionalText,
  image_url: z.string().url("URL invalida").optional().or(z.literal("")),
  cta_label: optionalText,
  cta_url: z.string().url("URL invalida").optional().or(z.literal("")),
  is_active: z.boolean().default(true),
  starts_at: optionalText,
  ends_at: optionalText,
});
export type BannerInput = z.infer<typeof bannerSchema>;

// M3 — Cadastro inteligente / Wizard
export const wizardStep1Schema = z.object({
  full_name: reqText("Nome completo", 3),
  phone: z.string({required_error:"Telefone obrigatório"}).trim().min(13, "Telefone incompleto"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
});
export const wizardStep2Schema = z.object({
  cep: z.string().optional().or(z.literal("")),
  state: optionalText,
  city: optionalText,
});
export const wizardStep3Schema = z.object({
  community_id: z.string().uuid("Selecione uma comunidade"),
});
export const wizardStep4Schema = z.object({
  intent: z.enum(["lifegroup","discipulado","acompanhamento_pastoral","visita","conhecer","batismo","servir","outro"]),
});
export const wizardStep5Schema = z.object({
  email: z.string({required_error:"E-mail obrigatório para criar conta"}).email("E-mail inválido"),
  password: z.string({required_error:"Senha obrigatória"}).min(6, "Senha precisa ter ao menos 6 caracteres"),
  password_confirm: z.string(),
}).refine((d) => d.password === d.password_confirm, {
  message: "Senhas não conferem", path: ["password_confirm"],
});
export type WizardStep1Input = z.infer<typeof wizardStep1Schema>;
export type WizardStep2Input = z.infer<typeof wizardStep2Schema>;
export type WizardStep3Input = z.infer<typeof wizardStep3Schema>;
export type WizardStep4Input = z.infer<typeof wizardStep4Schema>;
export type WizardStep5Input = z.infer<typeof wizardStep5Schema>;

// Ministérios
export const ministrySchema = z.object({
  name: reqText("Nome do ministério", 2),
  description: optionalText,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor hex inválida").optional().or(z.literal("")),
  icon: optionalText,
});
export type MinistryInput = z.infer<typeof ministrySchema>;

export const ministryPostSchema = z.object({
  title: reqText("Título", 3),
  body: optionalText,
  cover_url: z.string().url("URL inválida").optional().or(z.literal("")),
  is_published: z.boolean().default(true),
});
export type MinistryPostInput = z.infer<typeof ministryPostSchema>;

// Caderno 12 — Patrimônio
export const propertySchema = z.object({
  church_id: z.string().uuid("Comunidade obrigatória"),
  name: reqText("Nome do imóvel", 2),
  occupation_type: z.enum(["proprio","alugado","cedido","comodato","em_regularizacao"]).default("proprio"),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido").optional().or(z.literal("")),
  state: optionalText,
  city: optionalText,
  neighborhood: optionalText,
  address: optionalText,
  numero: optionalText,
  complemento: optionalText,
  acquired_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional().or(z.literal("")),
  contract_end_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional().or(z.literal("")),
  iptu_due_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional().or(z.literal("")),
  owner_name: optionalText,
  owner_document: optionalText,
  owner_phone: optionalText,
  observations: optionalText,
});
export type PropertyInput = z.infer<typeof propertySchema>;

export const assetSchema = z.object({
  church_id: z.string().uuid("Comunidade obrigatória"),
  property_id: z.string().uuid().optional().or(z.literal("")),
  patrimony_code: optionalText,
  tag_number: optionalText,
  name: reqText("Nome do bem", 2),
  category: z.enum(["mobiliario","equipamentos","som_multimidia","infraestrutura","nao_duravel"]),
  subcategory: optionalText,
  description: optionalText,
  manufacturer: optionalText,
  model: optionalText,
  serial_number: optionalText,
  location_text: optionalText,
  acquired_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").optional().or(z.literal("")),
  acquisition_value: z.coerce.number().min(0, "Valor inválido").default(0),
  origin: z.enum(["compra_nf","doacao","sem_nf","transferencia","comodato","outro"]).default("outro"),
  condition: z.enum(["novo","otimo","bom","regular","ruim","inutilizado","baixado"]).default("bom"),
  is_durable: z.coerce.boolean().default(true),
  observations: optionalText,
});
export type AssetInput = z.infer<typeof assetSchema>;
