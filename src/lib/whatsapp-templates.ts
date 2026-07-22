/**
 * Textos das mensagens de WhatsApp usadas em Score & Aniversários.
 * Edite livremente aqui — {nome} é substituído automaticamente pelo nome do membro.
 * Nenhuma mensagem é enviada automaticamente: isso só monta o link do WhatsApp
 * com o texto pronto; quem manda de verdade é a pessoa responsável, com um clique.
 */

export const TEMPLATE_ENCORAJAMENTO = (nome: string) =>
  `Olá ${nome}! 💙 Notamos que você tem estado um pouco distante ultimamente e queremos que saiba que estamos pensando em você e orando por você. Se precisar de algo, estamos aqui. Deus te ama e nós também!`;

export const TEMPLATE_CONTATO_GERAL = (nome: string) =>
  `Olá ${nome}! 😊 Passando aqui pra saber como você está. Deus te abençoe!`;

export const TEMPLATE_EVOLUCAO_ETAPA = (nome: string, novaEtapa: string) =>
  `Parabéns, ${nome}! 🎉 Ficamos muito felizes em ver seu crescimento — você avançou para "${novaEtapa}" na sua jornada com a CEC Family! Continue firme, estamos orgulhosos de você e orando pela sua caminhada. 🙏`;

export const TEMPLATE_ANIVERSARIO = (nome: string) =>
  `Parabéns, ${nome}! 🎉🎂 Toda a família CEC se alegra com você nesse dia especial. Que Deus continue te guiando e abençoando em todas as áreas da sua vida. Um forte abraço!`;

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`;
}
