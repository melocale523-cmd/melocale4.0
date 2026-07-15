import { claimAutomationJob, finishAutomationJob } from "./automationQueue.js";
import { jobLembrete24h } from "../jobs/reminders.js";
import { runReferralBonusJob } from "../jobs/referralBonus.js";
import { runAiChatResponder } from "../jobs/aiChatResponder.js";
import { runWhatsappReengagement } from "../jobs/whatsappReengagement.js";

const HANDLERS: Record<string, () => Promise<unknown>> = {
  appointment_reminders: jobLembrete24h,
  referral_bonus: runReferralBonusJob,
  ai_chat_responder: runAiChatResponder,
  whatsapp_reengagement: runWhatsappReengagement,
};

async function pollQueue(): Promise<void> {
  const job = await claimAutomationJob();
  if (!job) return;
  const handler = HANDLERS[job.job_name];
  if (!handler) { await finishAutomationJob(job.id, false, `Job não permitido: ${job.job_name}`); return; }
  try { await handler(); await finishAutomationJob(job.id, true); }
  catch (error) { await finishAutomationJob(job.id, false, error instanceof Error ? error.message : String(error)); }
}

export function startAutomationQueueWorker(): void {
  if (process.env.AUTOMATION_QUEUE_ENABLED !== "true") { console.log("[queue] worker desativado"); return; }
  setInterval(() => void pollQueue(), 15_000);
  void pollQueue();
  console.log("[queue] worker iniciado (poll a cada 15s)");
}