import cron from "node-cron";
import { runTrackedJob } from "../lib/automationJobs.js";
import { supabaseAdmin } from "../config.js";
import { runHealthCheck } from "../lib/systemHealthCheck.js";
import { sendTelegram } from "../lib/telegram.js";

// Alerta só na TRANSIÇÃO de status (up→down ou down→up), nunca a cada 5min
// enquanto o estado se mantém — senão vira spam no Telegram.
async function alertOnTransition(
  provider: string,
  previous: "up" | "down" | null | undefined,
  current: "up" | "down"
): Promise<void> {
  if (previous === "up" && current === "down") {
    void sendTelegram(`🔴 ${provider} (bot do WhatsApp) está fora do ar ou sem crédito.`);
  } else if (previous === "down" && current === "up") {
    void sendTelegram(`✅ ${provider} voltou ao normal.`);
  }
}

async function recordHealthCheck(): Promise<void> {
  try {
    const result = await runHealthCheck();

    const { data: last } = await supabaseAdmin
      .from("system_health_checks")
      .select("anthropic_status, openai_status")
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await alertOnTransition("Anthropic", last?.anthropic_status as "up" | "down" | null, result.anthropicStatus);
    await alertOnTransition("OpenAI", last?.openai_status as "up" | "down" | null, result.openaiStatus);

    const { error } = await supabaseAdmin.from("system_health_checks").insert({
      backend_status: "up", // se este código tá rodando, o processo backend está de pé
      db_status: result.dbStatus,
      db_latency_ms: result.dbLatencyMs,
      stripe_status: result.stripeStatus,
      stripe_latency_ms: result.stripeLatencyMs,
      anthropic_status: result.anthropicStatus,
      anthropic_latency_ms: result.anthropicLatencyMs,
      openai_status: result.openaiStatus,
      openai_latency_ms: result.openaiLatencyMs,
      event_loop_lag_ms: result.eventLoopLagMs,
      db_size_mb: result.dbSizeMb,
    });
    if (error) console.error("[healthCheck] insert error:", error.message);
  } catch (err) {
    console.error("[healthCheck] erro inesperado:", err instanceof Error ? err.message : String(err));
  }
}

export function startHealthCheckJob(): void {
  cron.schedule("*/5 * * * *", () => {
    void runTrackedJob("health_check", recordHealthCheck);
  });
  console.log("[healthCheck] job agendado (a cada 5 minutos)");
}
