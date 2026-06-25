import { ShieldCheck, ShieldAlert, ShieldX, Activity, MessageSquare, ShoppingCart, Bell, MessagesSquare, Loader2, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/dbServices';
import { apiFetch } from '../../lib/api';

interface SystemHealth {
  backend: { status: 'up' | 'down' };
  db: { status: 'up' | 'down'; latency_ms: number | null };
  checked_at: string;
}

interface SentryIssue {
  title: string;
  count: number;
  level: string;
  lastSeen: string;
  url: string;
  project: string;
}

interface SentryIssuesResponse {
  configured: boolean;
  issues: SentryIssue[];
}

const SLOW_THRESHOLD_MS = 800;

async function fetchSystemHealth(): Promise<SystemHealth & { backendLatencyMs: number; backendStatus: 'up' | 'down' }> {
  const start = Date.now();
  try {
    const res = await apiFetch('/api/admin/system-health');
    const backendLatencyMs = Date.now() - start;
    if (!res.ok) {
      return { backend: { status: 'down' }, db: { status: 'down', latency_ms: null }, checked_at: new Date().toISOString(), backendLatencyMs, backendStatus: 'down' };
    }
    const data = await res.json() as SystemHealth;
    return { ...data, backendLatencyMs, backendStatus: 'up' };
  } catch {
    return { backend: { status: 'down' }, db: { status: 'down', latency_ms: null }, checked_at: new Date().toISOString(), backendLatencyMs: Date.now() - start, backendStatus: 'down' };
  }
}

async function fetchSentryIssues(): Promise<SentryIssuesResponse> {
  try {
    const res = await apiFetch('/api/admin/sentry-issues');
    if (!res.ok) return { configured: false, issues: [] };
    return await res.json() as SentryIssuesResponse;
  } catch {
    return { configured: false, issues: [] };
  }
}

function nextStripeAuditRun(): string {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const next = new Date(now);
  next.setUTCHours(11, 0, 0, 0);
  if (utcHour >= 11) next.setUTCDate(next.getUTCDate() + 1);
  return next.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const LEVEL_COLOR: Record<string, string> = {
  fatal: '#f87171', error: '#f87171', warning: '#fbbf24', info: '#60a5fa',
};

export default function AdminObservabilidade() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['adminObservabilityMetrics'],
    queryFn: adminService.getObservabilityMetrics,
  });

  const { data: health, isLoading: healthLoading, refetch: refetchHealth, isFetching: healthFetching } = useQuery({
    queryKey: ['adminSystemHealth'],
    queryFn: fetchSystemHealth,
    refetchInterval: 60_000,
  });

  const { data: sentry, isLoading: sentryLoading } = useQuery({
    queryKey: ['adminSentryIssues'],
    queryFn: fetchSentryIssues,
    refetchInterval: 120_000,
  });

  const tableMetrics = [
    { label: 'CONVERSAS', value: metrics?.conversations ?? 0, icon: MessagesSquare, color: 'text-blue-400' },
    { label: 'MENSAGENS', value: metrics?.messages ?? 0, icon: MessageSquare, color: 'text-emerald-400' },
    { label: 'COMPRAS', value: metrics?.purchases ?? 0, icon: ShoppingCart, color: 'text-purple-400' },
    { label: 'NOTIFICAÇÕES', value: metrics?.notifications ?? 0, icon: Bell, color: 'text-yellow-400' },
  ];

  const backendDown = health?.backendStatus === 'down';
  const dbDown = health?.db.status === 'down';
  const anySlow = (health?.backendLatencyMs ?? 0) > SLOW_THRESHOLD_MS || (health?.db.latency_ms ?? 0) > SLOW_THRESHOLD_MS;

  const overall: { label: string; color: string; Icon: typeof ShieldCheck } =
    backendDown || dbDown
      ? { label: 'FORA DO AR', color: '#f87171', Icon: ShieldX }
      : anySlow
      ? { label: 'LENTO', color: '#fbbf24', Icon: ShieldAlert }
      : { label: 'OPERACIONAL', color: '#34d399', Icon: ShieldCheck };

  return (
    <div className="space-y-8 fade-in">
      <div>
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-8">
            <Activity className="text-red-500 w-8 h-8" />
            <h1 className="text-2xl font-bold text-slate-100">Observabilidade Operacional</h1>
          </div>
          <button
            onClick={() => refetchHealth()}
            disabled={healthFetching}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', color: '#94a3b8', fontSize: 12, fontWeight: 700, cursor: healthFetching ? 'default' : 'pointer' }}
          >
            <RefreshCw size={14} className={healthFetching ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
        <p className="text-[#94A3B8] mt-6">Checagem real de backend e banco — atualiza sozinho a cada 60s</p>
      </div>

      {/* STATUS REAL */}
      <div style={{ background: '#1C3454', border: `1px solid ${overall.color}33`, borderRadius: 12, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {healthLoading ? (
            <Loader2 size={48} className="animate-spin" style={{ color: '#4a6580' }} />
          ) : (
            <overall.Icon size={48} style={{ color: overall.color }} />
          )}
          <div>
            <p style={{ color: overall.color, fontWeight: 700, fontSize: 13, letterSpacing: '0.05em' }}>STATUS DO SISTEMA</p>
            <h2 style={{ color: overall.color, fontSize: 40, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
              {healthLoading ? 'Verificando...' : overall.label}
            </h2>
          </div>
        </div>

        {!healthLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(0,0,0,.15)', borderRadius: 10, padding: '0.875rem 1rem' }}>
              <p style={{ fontSize: 10, color: '#4a6580', fontWeight: 700, letterSpacing: '0.05em', margin: '0 0 4px' }}>BACKEND (API)</p>
              <p style={{ fontSize: 14, color: backendDown ? '#f87171' : 'white', fontWeight: 700, margin: 0 }}>
                {backendDown ? '🔴 Fora do ar' : `🟢 Respondendo — ${health?.backendLatencyMs}ms`}
              </p>
            </div>
            <div style={{ background: 'rgba(0,0,0,.15)', borderRadius: 10, padding: '0.875rem 1rem' }}>
              <p style={{ fontSize: 10, color: '#4a6580', fontWeight: 700, letterSpacing: '0.05em', margin: '0 0 4px' }}>BANCO (SUPABASE)</p>
              <p style={{ fontSize: 14, color: dbDown ? '#f87171' : 'white', fontWeight: 700, margin: 0 }}>
                {dbDown ? '🔴 Fora do ar' : `🟢 Respondendo — ${health?.db.latency_ms}ms`}
              </p>
            </div>
          </div>
        )}

        <p style={{ fontSize: 11, color: '#4a6580', margin: 0 }}>
          Auditoria Stripe (pagamentos órfãos) roda todo dia às 08:00 — próxima: {nextStripeAuditRun()}. Anomalias detectadas vão direto pro Telegram.
        </p>
      </div>

      {/* ATIVIDADE (total — métricas de uso, não de saúde) */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#4a6580', letterSpacing: '0.05em', marginBottom: 10 }}>ATIVIDADE</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-9">
          {tableMetrics.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="bg-[#1C3454] border border-slate-800/50 rounded-xl p-8 text-center flex flex-col items-center justify-center">
                {metricsLoading ? (
                  <Loader2 className="animate-spin text-slate-500 mb-7" size={32} />
                ) : (
                  <h3 className={`text-5xl font-black mb-2 ${stat.color}`}>{stat.value}</h3>
                )}
                <Icon size={18} className={`mb-1 ${stat.color} opacity-60`} />
                <p className="text-xs font-bold text-[#4A6580] tracking-wider font-mono">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* TIMELINE DE INCIDENTES — Sentry real */}
      <div className="bg-[#1C3454] border border-slate-800/50 rounded-xl max-h-[440px] overflow-y-auto">
        <div className="p-11 border-b border-[#1C3050] sticky top-0 bg-[#1C3454]/95 backdrop-blur z-10">
          <h2 className="text-lg font-bold text-white">Timeline de Incidentes</h2>
          <p style={{ fontSize: 11, color: '#4a6580', margin: '4px 0 0' }}>Issues não resolvidas no Sentry, últimas 24h</p>
        </div>

        {sentryLoading ? (
          <div className="p-16 flex items-center justify-center text-[#4A6580]">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : !sentry?.configured ? (
          <div style={{ padding: '1.5rem', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <AlertTriangle size={18} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
              Sentry não está conectado a essa página ainda. O backend já captura erros (Sentry.init já está ativo em produção),
              falta configurar <code style={{ color: '#fbbf24' }}>SENTRY_API_TOKEN</code>, <code style={{ color: '#fbbf24' }}>SENTRY_ORG_SLUG</code> e{' '}
              <code style={{ color: '#fbbf24' }}>SENTRY_PROJECT_SLUGS</code> no Render pra essa timeline puxar os issues de verdade.
            </p>
          </div>
        ) : sentry.issues.length === 0 ? (
          <div className="p-16 flex items-center justify-center text-[#4A6580] italic">
            Nenhum issue não-resolvido nas últimas 24h.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sentry.issues.map((issue, i) => (
              <a
                key={i}
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,.04)', textDecoration: 'none' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: LEVEL_COLOR[issue.level] ?? '#4a6580', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: 'white', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</p>
                  <p style={{ fontSize: 11, color: '#4a6580', margin: '2px 0 0' }}>
                    {issue.project} · {issue.count}x · {new Date(issue.lastSeen).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <ExternalLink size={14} style={{ color: '#4a6580', flexShrink: 0 }} />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
