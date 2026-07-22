# CEC FAMILY — Painel Web (Bloco 1: Padrão Agilize)

Plataforma apostólica multi-igreja da **CEC Manaus**, com hierarquia MDA
(Igreja → Distrito → Área → Setor → Célula).

## Stack
- **Next.js 14** App Router + **TypeScript** estrito
- **Tailwind CSS** + **Shadcn/UI** (Radix + class-variance-authority)
- **React Hook Form** + **Zod** em todos os formulários
- **TanStack Query** para data fetching com cache
- **Supabase** (Auth + PostgreSQL + RLS)
- Deploy **Vercel**, repo **GitHub**

## Rotas

| Rota | Acesso | Função |
|------|--------|---------|
| `/` | público (sem login) | Início, Cultos, Vídeos, Agenda, Igrejas, Mapa de Células |
| `/entrar` | público | Login do membro |
| `/painel` | logado | Dashboard com KPIs e alertas MDA mínimo-3 |
| `/admin` | apóstolo/pastor | Pregações, Agenda, Estrutura MDA, Auditoria |

## Estrutura modular (padrão Agilize)

```
src/
├── app/                   # rotas Next.js
├── components/
│   ├── ui/                # primitivos Shadcn (Button, Input, Card, Tabs, Label)
│   ├── layout/            # QueryProvider
│   ├── public/            # PublicHome, LoginForm
│   ├── panel/             # PanelDashboard
│   └── admin/             # AdminPanel
├── lib/
│   ├── supabase/client.ts # cliente browser (lazy)
│   └── utils.ts           # cn()
├── services/              # chamadas Supabase organizadas
├── hooks/use-queries.ts   # hooks TanStack Query
├── schemas/index.ts       # validação Zod
├── types/domain.ts        # tipos do domínio
└── utils/
```

## Como publicar

### 1. GitHub
```bash
git init && git add . && git commit -m "cec family v2 padrão agilize"
git branch -M main
git remote add origin <SEU_REPO>
git push -u origin main
```

### 2. Vercel
- Importe o repo. Framework: Next.js (detectado).
- **Environment Variables** (importantíssimo, marque os 3 ambientes):

| Nome | Valor |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do seu projeto Supabase (só o domínio, **sem `/rest/v1/`**) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon (publishable) do Supabase |

- Clique **Deploy**.
- Sempre que mudar variável de ambiente, faça **Deployments → ⋯ → Redeploy**.

### 3. Banco Supabase
O banco precisa ter o schema completo do CEC FAMILY (tabelas + RLS + funções).
Use o arquivo `cec_bootstrap.sql` (entregue separadamente) — cole no **SQL Editor**
do Supabase e rode. É idempotente.

## Conteúdo público (decisão de produto)
- Pregações e eventos marcados como **publicados** (is_published = true) são
  visíveis sem login graças a uma política RLS para anon.
- Tudo mais (membros, células, relatórios, cuidado pastoral, finanças)
  exige login.

## Próximos blocos (roadmap Fase 1)
- **B3** — Área do membro: minha célula, meu discipulador, jornada, pedidos de oração, meu perfil
- **B4** — Área de gestão (admin): cadastro de membros, cadastro de células, relatório semanal, relatório mensal, financeiro, discipulado
- **B5** — 6 docs do padrão Agilize (ARQUITETURA, BANCO-DE-DADOS, PERMISSOES, DEPLOY, SEGURANCA, MODULOS) + checklist de entrega

## Identidade visual
- Cores: navy `#0E2A47` + gold `#C9A227`
- Fontes: Fraunces (display) + Archivo (corpo)
- Tema implementado em `tailwind.config.ts` + `globals.css`
