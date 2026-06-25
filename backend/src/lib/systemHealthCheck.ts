import { supabaseAdmin, stripe } from "../config.js";
import { withTimeout } from "./timeout.js";

export interface HealthCheckResult {
  dbStatus: "up" | "down";
  dbLatencyMs: number;
  stripeStatus: "up" | "down";
  stripeLatencyMs: number;
  eventLoopLagMs: number;
  dbSizeMb: number | null;
}

// Mede quanto tempo um setImmediate demora pra de fato executar — se o event loop
// está livre, isso roda quase instantaneamente (<1ms); se o processo está sobrecarregado
// (CPU travada em algum loop síncrono pesado, GC longo, etc.), esse tempo sobe. É a forma
// mais simples e sem dependências de medir "o processo Node está enrosacado agora".
function measureEventLoopLag(): Promise<number> {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lagMs = Number(process.hrtime.bigint() - start) / 1e6;
      resolve(Math.round(lagMs * 10) / 10);
    });
  });
}

// Checagem real compartilhada entre a rota /api/admin/system-health (live, sob demanda)
// e o cron healthCheck.ts (a cada 5min, persiste em system_health_checks). Mantida num
// lugar só pra não duplicar a lógica e os dois ficarem divergindo com o tempo.
export async function runHealthCheck(): Promise<HealthCheckResult> {
  const dbStart = Date.now();
  let dbStatus: "up" | "down" = "up";
  try {
    const { error } = await withTimeout(
      supabaseAdmin.from("profiles").select("id", { head: true, count: "exact" }).limit(1),
      3000
    );
    if (error) dbStatus = "down";
  } catch {
    dbStatus = "down";
  }
  const dbLatencyMs = Date.now() - dbStart;

  const stripeStart = Date.now();
  let stripeStatus: "up" | "down" = "up";
  try {
    await withTimeout(stripe.balance.retrieve(), 3000);
  } catch {
    stripeStatus = "down";
  }
  const stripeLatencyMs = Date.now() - stripeStart;

  const eventLoopLagMs = await measureEventLoopLag();

  let dbSizeMb: number | null = null;
  try {
    const { data } = await withTimeout(supabaseAdmin.rpc("get_database_size_mb"), 3000);
    dbSizeMb = typeof data === "number" ? data : null;
  } catch {
    dbSizeMb = null;
  }

  return { dbStatus, dbLatencyMs, stripeStatus, stripeLatencyMs, eventLoopLagMs, dbSizeMb };
}

// Carga estimada do sistema (0-100%) — heurística combinando memória, lag do event loop
// e latência do banco. NÃO é uma métrica de CPU real do SO (Node não expõe isso de forma
// confiável em todo ambiente) — é um indicador composto pra dar noção de "tá perto do limite?".
// <40% azul (tranquilo) · 40-69% amarelo (atenção) · >=70% vermelho (sobrecarregado).
export function estimateSystemLoadPct(params: {
  heapUsedMb: number;
  heapTotalMb: number;
  eventLoopLagMs: number;
  dbLatencyMs: number;
}): number {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const memoryPct = clamp((params.heapUsedMb / Math.max(params.heapTotalMb, 1)) * 100);
  const eventLoopPct = clamp((params.eventLoopLagMs / 100) * 100); // 100ms de lag = 100%
  const dbLatencyPct = clamp((params.dbLatencyMs / 1000) * 100); // 1s de latência = 100%
  return Math.round(memoryPct * 0.4 + eventLoopPct * 0.35 + dbLatencyPct * 0.25);
}
