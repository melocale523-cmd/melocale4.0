// Helper único de envio pro Telegram — antes duplicado em stripeAudit.ts e
// newUserAlert.ts (cada um com uma variação ligeiramente diferente). parse_mode
// 'Markdown' porque newUserAlert.ts já depende de *negrito* nas mensagens; as
// mensagens de stripeAudit.ts e dos alertas de health check são texto puro, então
// não são afetadas por isso.
export async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID ausentes — alerta ignorado");
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    if (!res.ok) {
      console.error("[telegram] API error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[telegram] erro ao enviar:", err instanceof Error ? err.message : String(err));
  }
}
