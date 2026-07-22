# CEC Painel — Publicar (GitHub + Vercel)

Painel web **independente** (Next.js puro, sem monorepo). Deploy direto, sem complicação.
O banco multi-tenant (Supabase) já está pronto e no ar.

## Pré-requisitos
- GitHub · Supabase · Vercel · Node.js 18+

---

## 1. GitHub
1. Descompacte → pasta `cec-painel`.
2. Crie repositório privado em https://github.com/new (nome: `cec-painel`).
3. "uploading an existing file" → arraste **o conteúdo de dentro** da pasta `cec-painel`
   (package.json, next.config.mjs, src/, etc.) → Commit.

## 2. Vercel
1. https://vercel.com → entre com GitHub → **Add New → Project** → importe `cec-painel`.
2. Framework: **Next.js** (detectado sozinho). Não precisa mexer em Build/Output.
3. **Environment Variables** — adicione as duas:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xueuilapfwbtqbmvyaxe.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_OgTidKVtbJ0Gczf2Um3Obg__I1_d2Uq` |

4. **Deploy**. Em ~2 min: link tipo `https://cec-painel.vercel.app`.

## 3. Primeiro acesso
1. Abra o link → crie uma conta.
2. Supabase → Table Editor → `profiles` → seu `role` = **pastor**;
   confirme `church_id` = CEC Manaus - Sede.
3. Recarregue → dashboard por setor + botão **Administração ✦**.

---

## Rodar local (opcional)
```bash
npm install
cp .env.example .env.local
npm run dev    # http://localhost:3000
```

## Notas
- **Multi-tenant:** o isolamento por igreja vive no banco (Supabase/RLS), já testado.
  Este painel só consome — qualquer igreja da rede aparece conforme o papel do usuário.
- O bug "supabaseUrl is required" foi corrigido (cliente criado só no navegador).
- Aviso de vulnerabilidade do Next 14.2.5 é só aviso; não impede deploy. Para atualizar:
  `npm i next@latest`.
