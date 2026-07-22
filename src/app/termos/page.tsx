import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Termos de Uso — CEC Family" };

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-[#0E2A47] px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-2xl">
        <Link href="/" className="mb-6 flex items-center gap-2 text-sm font-semibold text-[#0E2A47] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="font-display text-3xl font-bold text-[#0E2A47]">Termos de Uso</h1>
        <div className="my-3 h-[3px] w-16 rounded bg-[#C9A227]" />
        <p className="text-xs text-muted-foreground mb-6">Última atualização: junho de 2025</p>

        <div className="prose prose-sm max-w-none space-y-4 text-gray-700">
          <h2 className="font-bold text-[#0E2A47]">1. Aceitação dos Termos</h2>
          <p>
            Ao se cadastrar na plataforma <strong>CEC Family</strong>, você concorda com estes Termos de Uso e com
            a nossa <Link href="/privacidade" className="text-[#C9A227] hover:underline">Política de Privacidade</Link>.
            Caso não concorde, não realize o cadastro.
          </p>

          <h2 className="font-bold text-[#0E2A47]">2. Quem somos</h2>
          <p>
            A CEC Family é a plataforma digital da <strong>Comunidade Evangélica Cristã (CEC Brasil)</strong>,
            destinada à gestão de membros, células (Life Groups), discipulado e comunicação interna.
          </p>

          <h2 className="font-bold text-[#0E2A47]">3. Uso adequado</h2>
          <p>Você se compromete a:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Fornecer informações verdadeiras e atualizadas no cadastro;</li>
            <li>Manter sua senha em sigilo e não compartilhá-la com terceiros;</li>
            <li>Utilizar a plataforma exclusivamente para fins ministeriais e de comunhão;</li>
            <li>Não utilizar a plataforma para fins comerciais, difamatórios ou ilegais;</li>
            <li>Respeitar a privacidade dos demais membros cadastrados.</li>
          </ul>

          <h2 className="font-bold text-[#0E2A47]">4. Dados fornecidos</h2>
          <p>
            Os dados cadastrados (nome, telefone, e-mail, localização) são utilizados exclusivamente para fins
            pastorais e de gestão interna da CEC. Não vendemos, alugamos ou compartilhamos seus dados com terceiros
            sem seu consentimento, exceto quando exigido por lei.
          </p>

          <h2 className="font-bold text-[#0E2A47]">5. Conta e acesso</h2>
          <p>
            O acesso é vinculado ao seu e-mail e senha. Você é responsável por todas as ações realizadas com
            sua conta. Em caso de suspeita de acesso não autorizado, entre em contato imediatamente com a liderança.
          </p>

          <h2 className="font-bold text-[#0E2A47]">6. Encerramento de conta</h2>
          <p>
            Você pode solicitar o encerramento de sua conta e a exclusão dos seus dados a qualquer momento,
            entrando em contato com a liderança da sua comunidade ou através dos canais oficiais da CEC.
          </p>

          <h2 className="font-bold text-[#0E2A47]">7. Modificações</h2>
          <p>
            Estes termos podem ser atualizados periodicamente. Notificaremos os usuários em caso de alterações
            relevantes. O uso continuado da plataforma após as alterações implica aceitação dos novos termos.
          </p>

          <h2 className="font-bold text-[#0E2A47]">8. Contato</h2>
          <p>
            Dúvidas sobre estes termos? Entre em contato com a liderança da sua comunidade CEC.
          </p>
        </div>
      </div>
    </main>
  );
}
