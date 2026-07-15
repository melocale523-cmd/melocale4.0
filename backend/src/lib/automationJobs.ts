import { supabaseAdmin } from "../config.js";

type JobResult = number | void;

export async function runTrackedJob(jobName: string, task: () => Promise<JobResult>, leaseSeconds = 900): Promise<void> {
  if (process.env.AUTOMATION_RUN_HISTORY_ENABLED !== "true") {
    await task();
    return;
  }

  const { data: runId, error: startError } = await supabaseAdmin.rpc("start_automation_job", {
    p_job_name: jobName,
    p_lease_seconds: leaseSeconds,
  });
  if (startError) {
    console.error(`[job:${jobName}] não foi possível adquirir lock:`, startError.message);
    return;
  }
  if (!runId) {
    console.log(`[job:${jobName}] execução ignorada: outra instância está ativa`);
    return;
  }

  try {
    const processedCount = await task();
    await supabaseAdmin.rpc("finish_automation_job", {
      p_run_id: runId,
      p_status: "succeeded",
      p_processed_count: typeof processedCount === "number" ? processedCount : null,
      p_error_message: null,
      p_metadata: {},
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabaseAdmin.rpc("finish_automation_job", {
      p_run_id: runId,
      p_status: "failed",
      p_processed_count: null,
      p_error_message: message,
      p_metadata: {},
    });
    console.error(`[job:${jobName}] execução falhou:`, message);
  }
}
