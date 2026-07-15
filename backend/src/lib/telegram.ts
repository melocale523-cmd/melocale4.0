import { withRetry, retryableHttpError, isRetryableProviderError } from "./retry.js";

export async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID ausentes — alerta ignorado");
    return;
  }
  try {
    await withRetry(async () => {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
      });
      if (!res.ok) throw retryableHttpError(res.status, await res.text());
    }, { shouldRetry: (error) => isRetryableProviderError(error) });
  } catch (err) {
    console.error("[telegram] erro após retries:", err instanceof Error ? err.message : String(err));
  }
}
