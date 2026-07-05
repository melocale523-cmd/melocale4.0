// Número business do WhatsApp Cloud API (WHATSAPP_PHONE_NUMBER_ID=1257819924070892).
// E.164 sem "+". Pode ser sobrescrito via env se o número mudar.
export const WHATSAPP_BUSINESS_NUMBER =
  (import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER as string | undefined) || '557499669568';

const CONNECT_MESSAGE = 'Quero receber notificações de novos pedidos';

/** Link wa.me que abre conversa com o número business e a mensagem de ativação pré-preenchida */
export function getWhatsAppConnectLink(): string {
  return `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(CONNECT_MESSAGE)}`;
}

export const WHATSAPP_BANNER_DISMISSED_KEY = 'melocale_whatsapp_banner_dismissed';
