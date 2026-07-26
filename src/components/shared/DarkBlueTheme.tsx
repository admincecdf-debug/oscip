import type { ReactNode } from "react";

/**
 * Wrapper de fundo azul-marinho institucional usado nas telas públicas
 * (cadastro, login, recuperação de senha). Antes esse gradiente estava
 * hard-coded em cada tela (ex.: LoginForm.tsx tinha o mesmo
 * bg-[radial-gradient(...)] direto no <main>); virou componente
 * compartilhado pra não repetir e pra dar pra trocar a identidade
 * visual num lugar só.
 */
export function DarkBlueTheme({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative min-h-screen bg-[radial-gradient(circle_at_30%_20%,#16345A,#0E2A47_60%)] ${className}`}>
      {children}
    </div>
  );
}
