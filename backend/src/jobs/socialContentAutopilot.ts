import { createHash } from "node:crypto";
import { supabaseAdmin } from "../config.js";
import { runTrackedJob } from "../lib/automationJobs.js";
import { createSocialDraft, createSocialImage, type SocialContentRequest } from "../services/socialContentStudio.js";

type Campaign = {
  id: string; city: string; service: string | null; audience: SocialContentRequest["audience"];
  objective: SocialContentRequest["objective"]; weekly_generation_limit: number; budget_cents: number;
  spent_cents: number; auto_generate_images: boolean; research_enabled: boolean;
  trend_radar_enabled: boolean; evergreen_enabled: boolean; seasonal_enabled: boolean; multichannel_enabled: boolean;
};
type PlannedItem = { id: string; title: string; format: SocialContentRequest["format"]; brief: Record<string, unknown>; planned_for: string | null; duplicate_key: string | null };

function duplicateKey(value: string): string {
  return createHash("sha256").update(value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim()).digest("hex").slice(0, 32);
}

function weekStart(): string {
  const date = new Date();
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

export async function runSocialContentAutopilotTask(maxItems = 5): Promise<number> {
  const { data: campaigns, error } = await supabaseAdmin.from("social_content_campaigns")
    .select("id, city, service, audience, objective, weekly_generation_limit, budget_cents, spent_cents, auto_generate_images, research_enabled, trend_radar_enabled, evergreen_enabled, seasonal_enabled, multichannel_enabled")
    .eq("status", "active").eq("auto_generate", true).limit(20);
  if (error) throw error;
  let processed = 0;

  for (const campaign of (campaigns ?? []) as Campaign[]) {
    if (processed >= maxItems) break;
    if (campaign.budget_cents <= 0) {
      await supabaseAdmin.from("social_content_campaigns").update({ status: "paused", auto_generate: false, last_error: "Campanha pausada: defina um orcamento maior que zero para limitar o consumo das APIs de IA.", updated_at: new Date().toISOString() }).eq("id", campaign.id);
      continue;
    }
    if (campaign.spent_cents >= campaign.budget_cents) continue;
    const { count } = await supabaseAdmin.from("social_content_items").select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id).eq("generated_by_autopilot", true).gte("created_at", weekStart());
    if ((count ?? 0) >= campaign.weekly_generation_limit) continue;

    const dueFilter = "scheduled_for.is.null,scheduled_for.lte." + new Date().toISOString();
    const { data: planned } = await supabaseAdmin.from("social_content_items")
      .select("id, title, format, brief, planned_for, duplicate_key")
      .eq("campaign_id", campaign.id).eq("generation_status", "pending").or(dueFilter)
      .order("planned_for", { ascending: true, nullsFirst: true }).limit(1);
    const item = (planned?.[0] ?? null) as PlannedItem | null;
    if (!item) continue;

    const brief = item.brief ?? {};
    const topic = typeof brief.topic === "string" ? brief.topic : item.title.replace(/^Planejado:\s*/i, "");
    const key = duplicateKey(campaign.city + "|" + (campaign.service ?? "") + "|" + topic);
    const { data: duplicate } = await supabaseAdmin.from("social_content_items").select("id")
      .eq("campaign_id", campaign.id).eq("duplicate_key", key).neq("id", item.id).limit(1).maybeSingle();
    if (duplicate) {
      await supabaseAdmin.from("social_content_items").update({ generation_status: "failed", automation_note: "Tema repetido: revise a pauta ou troque o angulo.", duplicate_key: key, updated_at: new Date().toISOString() }).eq("id", item.id);
      continue;
    }

    await supabaseAdmin.from("social_content_items").update({ generation_status: "generating", generated_by_autopilot: true, duplicate_key: key, automation_note: "Gerando copy automaticamente; publicacao ainda depende de aprovacao humana.", updated_at: new Date().toISOString() }).eq("id", item.id);
    try {
      const request: SocialContentRequest = {
        objective: campaign.objective, audience: campaign.audience, format: item.format,
        city: campaign.city, service: campaign.service ?? undefined, topic,
        research: campaign.research_enabled || campaign.trend_radar_enabled,
      };
      const generated = await createSocialDraft(request);
      let storagePath: string | null = null;
      let visualModel: string | null = null;
      let visualUsage: Record<string, unknown> = {};
      let totalCost = generated.estimatedCostCents;
      if (campaign.auto_generate_images && generated.draft.visualPrompt) {
        try {
          const image = await createSocialImage(item.id, generated.draft.visualPrompt);
          storagePath = image.storagePath; visualModel = image.model; visualUsage = image.usage; totalCost += image.estimatedCostCents;
        } catch (imageError) {
          console.warn("[social-autopilot] imagem:", imageError instanceof Error ? imageError.message : String(imageError));
        }
      }
      if (campaign.spent_cents + totalCost > campaign.budget_cents) {
        await supabaseAdmin.from("social_content_items").update({ generation_status: "failed", failure_code: "budget_exceeded", failure_details: "O custo estimado desta pauta ultrapassaria o orÃƒÆ’Ã‚Â§amento restante da campanha.", automation_note: "Limite de orcamento atingido antes de concluir esta pauta.", updated_at: new Date().toISOString() }).eq("id", item.id);
        continue;
      }
      const channels = campaign.multichannel_enabled ? { instagram: "ready_for_approval", facebook: "repurpose_pending", whatsapp: "repurpose_pending" } : { instagram: "ready_for_approval" };
      const variants: Array<{ type: string; status: string }> = campaign.evergreen_enabled ? [{ type: "evergreen", status: "pending" }] : [];
      if (campaign.seasonal_enabled) variants.push({ type: "seasonal", status: "pending" });
      const note = [campaign.trend_radar_enabled ? "Tema orientado por radar de duvidas publicas." : "", campaign.evergreen_enabled ? "Versao evergreen reservada para reaproveitamento." : ""].filter(Boolean).join(" ");
      const { error: updateError } = await supabaseAdmin.from("social_content_items").update({
        title: generated.draft.title, content: { hook: generated.draft.hook, caption: generated.draft.caption, cta: generated.draft.cta, slides: generated.draft.slides },
        visual_prompt: generated.draft.visualPrompt, image_storage_path: storagePath, visual_model: visualModel, visual_usage: visualUsage,
        safety_notes: generated.draft.safetyNotes, research_sources: generated.sources, strategy_model: process.env.SOCIAL_STRATEGY_MODEL ?? "claude-sonnet-4-5",
        strategy_usage: generated.usage, estimated_cost_cents: totalCost, generation_status: "ready", channels, variants,
        automation_note: note + " Aguardando aprovacao humana.", updated_at: new Date().toISOString(),
      }).eq("id", item.id);
      if (updateError) throw updateError;
      await supabaseAdmin.from("social_content_campaigns").update({ spent_cents: campaign.spent_cents + totalCost, last_generated_at: new Date().toISOString(), last_autopilot_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", campaign.id);
      campaign.spent_cents += totalCost;
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabaseAdmin.from("social_content_items").update({ generation_status: "failed", automation_note: message.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", item.id);
      console.error("[social-autopilot] geracao:", message);
    }
  }
  return processed;
}

export function startSocialContentAutopilotJob(): void {
  if (process.env.SOCIAL_AUTOPILOT_ENABLED !== "true") { console.log("[social-autopilot] desativado"); return; }
  setInterval(() => void runTrackedJob("social_content_autopilot", () => runSocialContentAutopilotTask(5)), 15 * 60 * 1000);
  void runTrackedJob("social_content_autopilot", () => runSocialContentAutopilotTask(5));
  console.log("[social-autopilot] ativo: ciclo a cada 15 minutos");
}