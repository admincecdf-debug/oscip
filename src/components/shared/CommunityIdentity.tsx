import Image from "next/image";

export interface CommunityIdentityProps {
  communityName: string;
  logoUrl?: string | null;
  organizationalUnitName?: string | null;
  roleName?: string | null;
  userName?: string | null;
  variant?: "registration" | "sidebar" | "dashboard";
}

const DEFAULT_LOGO = "/images/cec-family-logo.png";

/**
 * Identidade visual da comunidade — reaproveitada no card de primeiro
 * acesso (registration) e no card de boas-vindas do Dashboard (dashboard).
 * Nunca hardcoda nome/logo: vem sempre por props, resolvidas no servidor
 * a partir do convite (validate_invite_token) ou do perfil logado.
 */
export function CommunityIdentity({
  communityName, logoUrl, organizationalUnitName, roleName, userName, variant = "dashboard",
}: CommunityIdentityProps) {
  const finalLogoUrl = logoUrl || DEFAULT_LOGO;

  if (variant === "registration") {
    return (
      <section className="flex flex-col items-center text-center">
        <div className="relative mb-4 h-24 w-24">
          <Image src={finalLogoUrl} alt={`Logomarca da ${communityName}`} fill priority className="object-contain" />
        </div>
        <h1 className="font-display text-xl font-bold text-navy">{communityName}</h1>
        {organizationalUnitName && <p className="mt-1 text-sm text-muted">{organizationalUnitName}</p>}
        {roleName && (
          <p className="mt-3 rounded-full bg-gold/10 px-4 py-1.5 text-sm font-medium text-gold">
            Convite para: {roleName}
          </p>
        )}
      </section>
    );
  }

  if (variant === "sidebar") {
    return (
      <div className="flex flex-col items-center gap-2 px-3 py-4 text-center text-white">
        <div className="relative h-14 w-14">
          <Image src={finalLogoUrl} alt={`Logomarca da ${communityName}`} fill className="object-contain" />
        </div>
        <p className="font-display text-xs font-bold leading-tight">{communityName}</p>
        {userName && <p className="mt-1 text-[11px] text-white/70">{userName}</p>}
        {roleName && <p className="text-[10px] uppercase tracking-wider text-gold">{roleName}</p>}
      </div>
    );
  }

  // variant "dashboard": card de boas-vindas
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
      <div className="relative h-16 w-16 shrink-0">
        <Image src={finalLogoUrl} alt={`Logomarca da ${communityName}`} fill className="object-contain" />
      </div>
      <div className="min-w-0">
        <p className="font-display text-lg font-bold text-navy">{communityName}</p>
        {organizationalUnitName && <p className="text-xs text-muted">{organizationalUnitName}</p>}
        {(userName || roleName) && (
          <p className="mt-1 text-sm text-muted">
            {userName && <>Bem-vindo(a), <b className="text-navy">{userName}</b></>}
            {roleName && <span className="ml-2 rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">{roleName}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
