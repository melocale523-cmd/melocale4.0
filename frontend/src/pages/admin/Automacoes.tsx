import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';

type JobRun = { id: string; job_name: string; status: 'running' | 'succeeded' | 'failed'; started_at: string; finished_at: string | null; duration_ms: number | null; processed_count: number | null; error_message: string | null };

export default function Automacoes() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-automation-jobs'], refetchInterval: 30000,
    queryFn: async () => { const response = await apiFetch('/api/admin/automation-jobs?limit=100'); if (!response.ok) throw new Error((await response.json()).error ?? 'Falha ao carregar automações'); return (await response.json()) as { runs: JobRun[] }; },
  });
  const runs = data?.runs ?? [];
  const statusIcon = (status: JobRun['status']) => status === 'succeeded' ? <CheckCircle2 className="text-emerald-400" size={18} /> : status === 'failed' ? <XCircle className="text-red-400" size={18} /> : <Clock3 className="text-amber-400" size={18} />;
  return <section className="space-y-5">
    <div><h1 className="text-2xl font-bold text-white">Automações</h1><p className="mt-1 text-sm text-slate-400">Histórico, lock distribuído e falhas recentes dos jobs.</p></div>
    {isLoading && <p className="text-slate-400">Carregando histórico…</p>}
    {error && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">{(error as Error).message}</div>}
    {!isLoading && !error && <div className="overflow-hidden rounded-xl border border-[#1C3050] bg-[#132540]"><div className="flex items-center gap-2 border-b border-[#1C3050] px-4 py-3 text-slate-300"><Activity size={18} /> Últimas execuções</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th className="px-4 py-3">Job</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Início</th><th className="px-4 py-3">Duração</th><th className="px-4 py-3">Processados</th><th className="px-4 py-3">Erro</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id} className="border-t border-[#1C3050] text-slate-300"><td className="px-4 py-3 font-medium">{run.job_name}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-2">{statusIcon(run.status)}{run.status}</span></td><td className="px-4 py-3">{new Date(run.started_at).toLocaleString('pt-BR')}</td><td className="px-4 py-3">{run.duration_ms == null ? '—' : `${run.duration_ms} ms`}</td><td className="px-4 py-3">{run.processed_count ?? '—'}</td><td className="max-w-xs truncate px-4 py-3 text-red-300">{run.error_message ?? '—'}</td></tr>)}</tbody></table></div>{!runs.length && <p className="p-6 text-slate-400">Nenhuma execução registrada. Aplique a migração e ative AUTOMATION_RUN_HISTORY_ENABLED no backend.</p>}</div>}
  </section>;
}