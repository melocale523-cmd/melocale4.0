import { Resend } from "resend";
import { supabaseAdmin, RESEND_API_KEY, EMAIL_FROM } from "../config.js";
import { withRetry, isRetryableProviderError } from "../lib/retry.js";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/**
 * Envia um email transacional via Resend.
 * Best-effort: nunca lança — falhas são logadas e o fluxo principal segue.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!resend) return false;
  try {
    const { error } = await withRetry(() => resend.emails.send({ from: EMAIL_FROM, to, subject, html }), { shouldRetry: (err) => isRetryableProviderError(err) });
    if (error) {
      console.error(`[email] falha ao enviar para ${to}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[email] exceção ao enviar para ${to}:`, err instanceof Error ? err.message : String(err));
    return false;
  }
}

type EmailPrefColumn = "email_new_lead" | "email_messages";

/**
 * Resolve o email do usuário (auth.users) respeitando o opt-out em
 * user_notification_preferences. Retorna null se o usuário optou por não
 * receber ou se não tem email.
 */
export async function getOptedInEmail(userId: string, prefColumn: EmailPrefColumn): Promise<string | null> {
  try {
    const { data: pref } = await supabaseAdmin
      .from("user_notification_preferences")
      .select(prefColumn)
      .eq("user_id", userId)
      .maybeSingle();
    // Sem linha de preferências = default true (mesmo default das colunas no banco)
    const optedIn = (pref as Record<string, boolean | null> | null)?.[prefColumn];
    if (optedIn === false) return null;

    const { data: userData, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !userData?.user?.email) return null;
    return userData.user.email;
  } catch (err) {
    console.error(`[email] erro ao resolver email de ${userId}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// --- Templates (dark, verde emerald — identidade MeloCale) ---

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function baseLayout(preheader: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#0a0f0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0f0d;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#111816;border:1px solid #1d2a25;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:1px solid #1d2a25;">
            <span style="font-size:22px;font-weight:800;color:#10b981;letter-spacing:-0.5px;">MeloCale</span>
          </td>
        </tr>
        <tr><td style="padding:28px 32px;">${content}</td></tr>
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #1d2a25;">
            <p style="margin:0;font-size:12px;line-height:18px;color:#5c6f68;">
              Você recebeu este email porque tem uma conta na MeloCale.
              Para deixar de receber, ajuste suas preferências de notificação em
              <a href="https://www.melocale.com.br" style="color:#10b981;text-decoration:none;">melocale.com.br</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;"><tr>
    <td style="background-color:#10b981;border-radius:10px;">
      <a href="${url}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#04120c;text-decoration:none;">${escapeHtml(label)}</a>
    </td>
  </tr></table>`;
}

/** Template (a) — Profissional: novo pedido disponível na categoria/cidade */
export function newLeadEmailTemplate(params: {
  leadTitle: string;
  category: string;
  location: string;
}): { subject: string; html: string } {
  const { leadTitle, category, location } = params;
  const subject = `Novo pedido de ${category} em ${location.split(" - ")[0].trim()}`;
  const content = `
    <h1 style="margin:0 0 12px;font-size:20px;line-height:28px;color:#e8f5f0;font-weight:800;">
      Novo pedido disponível na sua área 🔧
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:23px;color:#a3b8b0;">
      Um cliente acabou de publicar um pedido que combina com o seu perfil. Quem responde primeiro tem mais chance de fechar o serviço.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d1512;border:1px solid #1d2a25;border-radius:12px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#e8f5f0;">${escapeHtml(leadTitle)}</p>
        <p style="margin:0;font-size:13px;line-height:20px;color:#a3b8b0;">
          <span style="color:#10b981;font-weight:600;">${escapeHtml(category)}</span> &nbsp;·&nbsp; 📍 ${escapeHtml(location)}
        </p>
      </td></tr>
    </table>
    ${ctaButton("https://www.melocale.com.br/profissional/leads", "Ver pedido e enviar proposta")}
  `;
  return { subject, html: baseLayout(`Novo pedido: ${leadTitle} em ${location}`, content) };
}

/** Template (b) — Cliente: proposta recebida de [profissional] */
export function proposalReceivedEmailTemplate(params: {
  professionalName: string;
}): { subject: string; html: string } {
  const { professionalName } = params;
  const subject = `${professionalName} enviou uma proposta para o seu pedido`;
  const content = `
    <h1 style="margin:0 0 12px;font-size:20px;line-height:28px;color:#e8f5f0;font-weight:800;">
      Você recebeu uma proposta! 🎉
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:23px;color:#a3b8b0;">
      <strong style="color:#e8f5f0;">${escapeHtml(professionalName)}</strong> tem interesse no seu pedido e enviou um orçamento. Acesse a plataforma para ver os detalhes e responder.
    </p>
    ${ctaButton("https://www.melocale.com.br/cliente/pedidos", "Ver proposta")}
    <p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#5c6f68;">
      Dica: responder rápido aumenta suas chances de agendar o serviço no melhor horário.
    </p>
  `;
  return { subject, html: baseLayout(`${professionalName} enviou uma proposta`, content) };
}
