import { supabaseAdmin } from "../config.js";
import { withTimeout } from "./timeout.js";

// Opt-out explícito (whatsapp_marketing_opt_in === false) é a única barreira
// pra campanhas de WhatsApp (reengajamento, broadcast em massa) — sem linha
// de preferências = opt-in por padrão. Extraído de whatsappReengagement.ts
// pra não duplicar entre o job e a rota de broadcast /admin.
export async function filterOptedIn(userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const { data: prefs } = await withTimeout(
    supabaseAdmin
      .from("user_notification_preferences")
      .select("user_id, whatsapp_marketing_opt_in")
      .in("user_id", userIds)
  );
  const optedOut = new Set(
    ((prefs ?? []) as { user_id: string; whatsapp_marketing_opt_in: boolean | null }[])
      .filter((p) => p.whatsapp_marketing_opt_in === false)
      .map((p) => p.user_id)
  );
  return new Set(userIds.filter((id) => !optedOut.has(id)));
}
