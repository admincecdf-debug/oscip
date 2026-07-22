import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Política de Privacidade — CEC Family" };

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-[#0E2A47] px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-2xl">
        <Link href="/" className="mb-6 flex items-center gap-2 text-sm font-semibold text-[#0E2A47] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="font-display text-3xl font-bold text-[#0E2A47]">Política de Privacidade</h1>
        <div className="my-3 h-[3px] w-16 rounded bg-[#C9A227]" />
        <p className="text-xs text-muted-foreground mb-6">Última atualização: junho de 2025 · Em conformidade com a <strong>LGPD (Lei 13.709/2018)</strong></p>

        <div className="prose prose-sm max-w-none space-y-4 text-gray-700">
          <h2 className="font-bold text-[#0E2A47]">1. Controlador dos dados</h2>
          <p>
            A <strong>Comunidade Evangélica Cristã (CEC Brasil)</strong> é a controladora dos dados pessoais
            coletados nesta plataforma, conforme definição da LGPD.
          </p>

          <h2 className="font-bold text-[#0E2A47]">2. Quais dados coletamos</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Identificação:</strong> nome completo, e-mail, telefone/WhatsApp;</li>
            <li><strong>Localização aproximada:</strong> cidade, estado, CEP (para indicação de células);</li>
            <li><strong>Dados ministeriais:</strong> Life Group, estágio de discipulado, ministérios;</li>
            <li><strong>Dados de acesso:</strong> logs de login e ações realizadas na plataforma.</li>
          </ul>

          <h2 className="font-bold text-[#0E2A47]">3. Finalidade do tratamento</h2>
          <p>Seus dados são utilizados para:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Gestão pastoral e acompanhamento de membros e visitantes;</li>
            <li>Comunicação interna da comunidade;</li>
            <li>Organização de células e grupos de discipulado;</li>
            <li>Geração de relatórios ministeriais internos;</li>
            <li>Segurança e autenticação na plataforma.</li>
          </ul>

          <h2 className="font-bold text-[#0E2A47]">4. Base legal (LGPD, Art. 7º)</h2>
          <p>
            O tratamento de dados é realizado com base no <strong>consentimento explícito</strong> do titular (Art. 7º, I)
            e no <strong>legítimo interesse</strong> da organização religiosa para fins pastorais (Art. 7º, IX).
          </p>

          <h2 className="font-bold text-[#0E2A47]">5. Compartilhamento de dados</h2>
          <p>
            Não vendemos, alugamos ou cedemos seus dados a terceiros com fins comerciais. Os dados podem ser
            acessados por líderes autorizados da CEC (pastores, coordenadores) estritamente para fins ministeriais.
            Utilizamos o Supabase (servidor na nuvem) para armazenamento seguro dos dados.
          </p>

          <h2 className="font-bold text-[#0E2A47]">6. Retenção dos dados</h2>
          <p>
            Os dados são mantidos enquanto a conta estiver ativa ou enquanto necessário para fins ministeriais.
            Após solicitação de exclusão, os dados são removidos em até 30 dias, ressalvadas obrigações legais.
          </p>

          <h2 className="font-bold text-[#0E2A47]">7. Seus direitos (LGPD, Art. 18)</h2>
          <p>Você tem direito a:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Confirmar a existência de tratamento dos seus dados;</li>
            <li>Acessar seus dados;</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
            <li>Solicitar a anonimização, bloqueio ou eliminação dos dados;</li>
            <li>Revogar o consentimento a qualquer momento;</li>
            <li>Solicitar a portabilidade dos seus dados.</li>
          </ul>
          <p>Para exercer seus direitos, entre em contato com a liderança da sua comunidade CEC.</p>

          <h2 className="font-bold text-[#0E2A47]">8. Segurança</h2>
          <p>
            Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo autenticação segura,
            controle de acesso por perfil e criptografia em trânsito (HTTPS).
          </p>

          <h2 className="font-bold text-[#0E2A47]">9. Cookies</h2>
          <p>
            Utilizamos apenas cookies essenciais para manter sua sessão autenticada. Não utilizamos cookies de
            rastreamento ou publicidade.
          </p>

          <h2 className="font-bold text-[#0E2A47]">10. Contato</h2>
          <p>
            Dúvidas sobre esta política? Entre em contato com a liderança da CEC Brasil.
            Consulte também nossos <Link href="/termos" className="text-[#C9A227] hover:underline">Termos de Uso</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
