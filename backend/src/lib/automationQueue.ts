import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../config.js";

export type AutomationQueueRow = { id: string; job_name: string; payload: Record<string, unknown>; status: string; attempts: number; max_attempts: number; last_error: string | null };

export async function enqueueAutomationJob(jobName: string, payload: Record<string, unknown> = {}, maxAttempts = 3): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc("enqueue_automation_job", { p_job_name: jobName, p_payload: payload, p_max_attempts: maxAttempts, p_available_at: new Date().toISOString() });
  if (error) { console.error(`[queue] enqueue ${jobName}:`, error.message); return null; }
  return data as string | null;
}

export async function claimAutomationJob(): Promise<AutomationQueueRow | null> {
  const { data, error } = await supabaseAdmin.rpc("claim_automation_job", { p_worker_id: `${process.env.RENDER_INSTANCE_ID ?? "backend"}-${randomUUID()}`, p_lease_seconds: 900 });
  if (error) { console.error("[queue] claim:", error.message); return null; }
  return (Array.isArray(data) ? data[0] : data) as AutomationQueueRow | null;
}

export async function finishAutomationJob(id: string, success: boolean, errorMessage?: string, result: Record<string, unknown> = {}): Promise<void> {
  const { error } = await supabaseAdmin.rpc("finish_automation_queue_job", { p_id: id, p_success: success, p_error: errorMessage ?? null, p_result: result });
  if (error) console.error("[queue] finish:", error.message);
}