import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { CheckCircle, XCircle, Loader2, PlayCircle, RefreshCw, Clock, TestTube2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TestResult {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  duration: number;
}

interface RunTestsResponse {
  summary: { total: number; passed: number; failed: number };
  results: TestResult[];
  ran_at: string;
}

export default function AdminTestes() {
  const { data, isFetching, refetch, isSuccess } = useQuery<RunTestsResponse>({
    queryKey: ['admin_e2e_tests'],
    queryFn: async () => {
      const res = await apiFetch('/api/admin/run-tests');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<RunTestsResponse>;
    },
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const allPassed = isSuccess && data && data.summary.failed === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <TestTube2 size={24} className="text-emerald-400" />
            Testes E2E
          </h1>
          <p className="text-[#94A3B8] mt-1">Valida o fluxo completo: login → lead → compra → chat → mensagem.</p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg',
            isFetching
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : isSuccess
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
          )}
        >
          {isFetching ? (
            <><Loader2 size={16} className="animate-spin" /> Rodando...</>
          ) : isSuccess ? (
            <><RefreshCw size={16} /> Rodar novamente</>
          ) : (
            <><PlayCircle size={16} /> Rodar todos os testes</>
          )}
        </button>
      </div>

      {/* Idle state */}
      {!isFetching && !isSuccess && (
        <div className="bg-[#1C3454] border border-slate-800/50 rounded-2xl p-12 text-center">
          <TestTube2 size={48} className="text-slate-600 mx-auto mb-4" />
          <p className="text-[#94A3B8] font-medium">Clique em "Rodar todos os testes" para iniciar.</p>
          <p className="text-[#4A6580] text-sm mt-1">Os testes criam e limpam dados automaticamente.</p>
        </div>
      )}

      {/* Loading */}
      {isFetching && (
        <div className="bg-[#1C3454] border border-slate-800/50 rounded-2xl p-12 text-center">
          <Loader2 size={48} className="text-emerald-500 mx-auto mb-4 animate-spin" />
          <p className="text-white font-semibold">Executando testes...</p>
          <p className="text-[#94A3B8] text-sm mt-1">Isso pode levar alguns segundos.</p>
        </div>
      )}

      {/* Results */}
      {isSuccess && data && !isFetching && (
        <>
          {/* Summary banner */}
          <div className={cn(
            'rounded-2xl p-6 border flex items-center justify-between flex-wrap gap-4',
            allPassed
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/30'
          )}>
            <div className="flex items-center gap-3">
              {allPassed
                ? <CheckCircle size={28} className="text-emerald-400" />
                : <XCircle size={28} className="text-red-400" />
              }
              <div>
                <p className={cn('font-bold text-lg', allPassed ? 'text-emerald-400' : 'text-red-400')}>
                  {allPassed ? 'Todos os testes passaram' : `${data.summary.failed} teste(s) falharam`}
                </p>
                <p className="text-[#94A3B8] text-sm">
                  {data.summary.passed}/{data.summary.total} passaram
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[#4A6580] text-xs">
              <Clock size={12} />
              {new Date(data.ran_at).toLocaleString('pt-BR')}
            </div>
          </div>

          {/* Individual results */}
          <div className="space-y-3">
            {data.results.map((r) => (
              <div
                key={r.id}
                className={cn(
                  'bg-[#1C3454] border rounded-xl px-5 py-4 flex items-start gap-4',
                  r.status === 'pass' ? 'border-emerald-500/20' : 'border-red-500/30'
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {r.status === 'pass'
                    ? <CheckCircle size={18} className="text-emerald-400" />
                    : r.status === 'fail'
                      ? <XCircle size={18} className="text-red-400" />
                      : <Clock size={18} className="text-slate-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">{r.name}</p>
                    <span className="text-[10px] text-[#4A6580] font-mono shrink-0">{r.duration}ms</span>
                  </div>
                  <p className={cn(
                    'text-xs mt-1 break-all',
                    r.status === 'pass' ? 'text-emerald-400/80' : 'text-red-400'
                  )}>
                    {r.message}
                  </p>
                </div>
                <span className={cn(
                  'text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0',
                  r.status === 'pass'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                )}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
