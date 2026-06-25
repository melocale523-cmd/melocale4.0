import cron from "node-cron";
import { supabaseAdmin } from "../config.js";
import { runHealthCheck } from "../lib/systemHealthCheck.js";

async function recordHealthCheck(): Promise<void> {
  try {
    const result = await runHealthCheck();
    const { error } = await supabaseAdmin.from("system_health_checks").insert({
      backend_status: "up", // se este código tá rodando, o processo backend está de pé
      db_status: result.dbStatus,
      db_latency_ms: result.dbLatencyMs,
      stripe_status: result.stripeStatus,
      stripe_latency_ms: result.stripeLatencyMs,
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
    void recordHealthCheck();
  });
  console.log("[healthCheck] job agendado (a cada 5 minutos)");
}
