/**
 * Identidade visual do módulo CECmais (CECmais_ESPECIFICACAO_FUNCIONAL_IDENTIDADE_VISUAL.md).
 *
 * "CEC"  → tipografia institucional (font-display), azul-marinho, sólida.
 * "mais" → cursiva (Dancing Script), amarelo/dourado, leve inclinação,
 *          aparência de assinatura pessoal. Mesma identidade em toda
 *          aplicação: CECmais, mais Saúde, mais Proteção, mais Formação,
 *          mais Fé, mais Leitura, mais Vantagens.
 *
 * Não usar "CEC+" como marca — o sinal gráfico "+" nunca aparece.
 */

export function Mais({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block -rotate-3 font-script text-gold ${className}`}
      style={{ textShadow: "0 1px 0 rgba(201,162,39,0.15)" }}
    >
      mais
    </span>
  );
}

/** "CECmais" completo — para o logotipo do módulo. */
export function CECmaisLogo({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = { sm: "text-lg", md: "text-2xl", lg: "text-4xl" };
  return (
    <span className={`font-display font-bold text-navy ${sizes[size]} ${className}`}>
      CEC<Mais className={size === "lg" ? "text-4xl" : size === "md" ? "text-2xl" : "text-lg"} />
    </span>
  );
}

/**
 * "mais Categoria" — ex: <MaisCategoria nome="Saúde" />  →  "mais Saúde"
 * "Categoria" usa tipografia institucional (não cursiva), só "mais" é assinatura.
 */
export function MaisCategoria({ nome, size = "md", className = "" }: { nome: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = { sm: "text-base", md: "text-xl", lg: "text-3xl" };
  return (
    <span className={`font-display font-semibold text-navy ${sizes[size]} ${className}`}>
      <Mais className={sizes[size]} /> {nome}
    </span>
  );
}
