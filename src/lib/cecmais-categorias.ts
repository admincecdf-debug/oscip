export interface CECmaisCategoria {
  slug: string;
  nome: string;
  descricao: string;
  ofertas: string[];
}

export const CECMAIS_CATEGORIAS: CECmaisCategoria[] = [
  {
    slug: "saude",
    nome: "Saúde",
    descricao: "Cuidado para você e sua família.",
    ofertas: ["Telemedicina", "Odontologia", "Serviços de saúde", "Programas de bem-estar", "Parceiros de saúde"],
  },
  {
    slug: "protecao",
    nome: "Proteção",
    descricao: "Segurança e tranquilidade para quem você ama.",
    ofertas: ["Seguro de vida", "Assistência familiar", "Assistências", "Serviços de proteção de parceiros"],
  },
  {
    slug: "formacao",
    nome: "Formação",
    descricao: "Conhecimento para desenvolver seus dons e habilidades.",
    ofertas: ["Cursos", "Minicursos", "Desenvolvimento intelectual", "Formação profissional", "Capacitações", "Liderança"],
  },
  {
    slug: "fe",
    nome: "Fé",
    descricao: "Crescimento bíblico, teológico e espiritual.",
    ofertas: ["Cursos teológicos", "Estudos bíblicos", "Formação cristã", "Desenvolvimento espiritual", "Escola de Líderes", "Conteúdos do MDA", "Discipulado"],
  },
  {
    slug: "leitura",
    nome: "Leitura",
    descricao: "Livros e conteúdos para continuar aprendendo.",
    ofertas: ["Livros físicos", "E-books", "Apostilas", "Conteúdos digitais", "Áudio", "Biblioteca digital"],
  },
  {
    slug: "vantagens",
    nome: "Vantagens",
    descricao: "Parcerias, oportunidades e condições para membros.",
    ofertas: ["Parceiros", "Descontos", "Condições especiais", "Campanhas", "Oportunidades"],
  },
];

export function getCategoria(slug: string): CECmaisCategoria | undefined {
  return CECMAIS_CATEGORIAS.find((c) => c.slug === slug);
}
