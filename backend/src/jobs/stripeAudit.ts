import cron from "node-cron";
import { runTrackedJob } from "../lib/automationJobs.js";
import { stripe, supabaseAdmin } from "../config.js";
import { sendTelegram } from "../lib/telegram.js";

function formatBRL(amountCents: number): string {
  return (amountCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function runStripeAudit(): Promise<void> {
  console.log("[stripeAudit] iniciando auditoria Stripe vs payments...");
  let checked = 0;
  let orphans = 0;

  try {
    for await (const pi of stripe.paymentIntents.list({ limit: 100 })) {
      if (pi.status !== "succeeded") continue;
      if (!pi.customer) continue;

      checked++;

      const { count, error } = await supabaseAdmin
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("stripe_payment_intent_id", pi.id);

      if (error) {
        console.error("[stripeAudit] supabase query error:", error.message);
        continue;
      }

      if ((count ?? 0) === 0) {
        orphans++;
        const customerId = typeof pi.customer === "string" ? pi.customer : pi.customer.id;
        const msg = [
          "🚨 MeloCalé Auditoria Stripe",
          `PI órfão: ${pi.id}`,
          `Valor: R$${formatBRL(pi.amount)}`,
          `Customer: ${customerId}`,
          `Criado: ${formatDate(pi.created)}`,
          `URL: https://dashboard.stripe.com/payments/${pi.id}`,
        ].join("\n");

        await sendTelegram(msg);
      }
    }

    console.log(`[stripeAudit] concluído — verificados: ${checked}, órfãos: ${orphans}`);

    const { error: insertErr } = await supabaseAdmin.from("stripe_audit_runs").insert({
      payments_checked: checked,
      orphans_found: orphans,
    });
    if (insertErr) console.error("[stripeAudit] falha ao persistir resultado:", insertErr.message);
  } catch (err: unknown) {
    console.error("[stripeAudit] erro inesperado:", err instanceof Error ? err.message : String(err));
  }
}

export function startStripeAuditJob(): void {
  // Roda todo dia às 08:00 horário de Brasília (= 11:00 UTC)
  cron.schedule("0 11 * * *", () => {
    void runTrackedJob("stripe_audit", runStripeAudit);
  });
  console.log("[stripeAudit] job agendado (diário às 11:00 UTC / 08:00 BRT)");
}
