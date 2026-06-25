import {
  ShieldCheck, ShieldAlert, ShieldX, Activity, RefreshCw, AlertTriangle,
  ExternalLink, CheckCircle2, XCircle, Loader2, Database, Zap, CreditCard,
  Server, Clock, MemoryStick, GitBranch, Package,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────────────

interface SystemHealth {
  backend: {
    status: 'up' | 'down';
    uptime_seconds: number;
    memory_mb: { heap_used: number; heap_total: number; rss: number };
    event_loop_lag_ms: number;
    deploy: { commit: string | null; branch: string | null };
  };
  db: { status: 'up' | 'down'; latency_ms: number; size_mb: number | null };
  stripe: { status: 'up' | 'down'; latency_ms: number };
  load_pct: number;
  last_payment_at: string | null;
  checked_at: string;
}

interface HealthHistorySeries {
  checked_at: string;
  db_latency_ms: number | null;
  stripe_latency_ms: number | null;
  event_loop_lag_ms: number | null;
}

interface HealthHistory {
  checks_count: number;
  series: HealthHistorySeries[];
  db_size_mb: number | null;
  uptime_24h: { backend: number | null; db: number | null; stripe: number | null };
  incidents: Array<{ target: 'backend' | 'db' | 'stripe'; started_at: string }>;
  last_stripe_audit: { payments_checked: number; orphans_found: number; ran_at: string } | null;
}

interface ConfigCheck {
  key: string;
  label: string;
  present: boolean;
  critical: boolean;
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

// ── Constants ─────────────────────────────────────────────────────────────────

interface ScheduledJob {
  name: string;
  schedule: string;
  description: string;
  note?: string;
}

const SCHEDULED_JOBS: ScheduledJob[] = [
  { name: 'Health Check', schedule: 'a cada 5 min', description: 'Mede latência de DB/Stripe, event loop lag e grava em system_health_checks' },
  { name: 'Lembrete de agendamento — janela 23–25h', schedule: 'a cada 1 hora (setInterval)', description: 'Push pro cliente e profissional quando o serviço está entre 23h e 25h no futuro (reminders.ts)', note: 'Dois jobs cobrem a mesma janela de 24h por implementações separadas — reminders.ts usa setInterval, appointmentReminder.ts usa cron "0 * * * *" e checa reminder_sent_at para evitar duplicata.' },
  { name: 'Lembrete de agendamento — cron horário', schedule: 'a cada 1 hora, no minuto 00', description: 'Mesma janela de 24h antes, lógica complementar com marca reminder_sent_at (appointmentReminder.ts)' },
  { name: 'Bônus de indicação', schedule: 'a cada 6 horas', description: 'Aplica bônus de moedas por indicações confirmadas no mês (referralBonus.ts)' },
  { name: 'Resposta automática da IA no chat', schedule: 'a cada 30 minutos', description: 'IA responde em nome da plataforma se o profissional não respondeu em 1h (aiChatResponder.ts)' },
  { name: 'Auditoria Stripe — pagamentos órfãos', schedule: 'diariamente às 08:00 BRT', description: 'Compara PaymentIntents do Stripe com a tabela payments, alerta no Telegram se achar órfão (stripeAudit.ts)' },
];

const SLOW_DB_MS = 600;
const SLOW_STRIPE_MS = 800;

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchSystemHealth(): Promise<SystemHealth> {
  const res = await apiFetch('/api/admin/system-health');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<SystemHealth>;
}

async function fetchHealthHistory(): Promise<HealthHistory> {
  const res = await apiFetch('/api/admin/health-history');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<HealthHistory>;
}

async function fetchConfigStatus(): Promise<{ checks: ConfigCheck[] }> {
  const res = await apiFetch('/api/admin/config-status');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ checks: ConfigCheck[] }>;
}

async function fetchSentryIssues(): Promise<SentryIssuesResponse> {
  try {
    const res = await apiFetch('/api/admin/sentry-issues');
    if (!res.ok) return { configured: false, issues: [] };
    return res.json() as Promise<SentryIssuesResponse>;
  } catch {
    return { configured: false, issues: [] };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function nextStripeAudit(): string {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(11, 0, 0, 0);
  if (now.getUTCHours() >= 11) next.setUTCDate(next.getUTCDate() + 1);
  return next.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const SENTRY_LEVEL_COLOR: Record<string, string> = {
  fatal: '#f87171', error: '#f87171', warning: '#fbbf24', info: '#60a5fa',
};

const TARGET_LABEL: Record<string, string> = { backend: 'Backend', db: 'Banco', stripe: 'Stripe' };

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBadge({ label, value, color = '#94a3b8' }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: 'rgba(0,0,0,.15)', borderRadius: 8, padding: '0.625rem 0.875rem' }}>
      <p style={{ fontSize: 10, color: '#4a6580', fontWeight: 700, letterSpacing: '0.05em', margin: '0 0 3px' }}>{label}</p>
      <p style={{ fontSize: 13, color, fontWeight: 700, margin: 0 }}>{value}</p>
    </div>
  );
}

function UptimeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: '#4a6580', fontSize: 11 }}>sem dados</span>;
  const color = pct >= 99.5 ? '#34d399' : pct >= 95 ? '#fbbf24' : '#f87171';
  return <span style={{ color, fontWeight: 700, fontSize: 11 }}>{pct}%</span>;
}

function LoadBar({ pct }: { pct: number }) {
  const color = pct < 40 ? '#34d399' : pct < 70 ? '#fbbf24' : '#f87171';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#4a6580', fontWeight: 700, letterSpacing: '0.05em' }}>CARGA ESTIMADA DO SISTEMA</span>
        <span style={{ fontSize: 11, color, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .4s ease' }} />
      </div>
      <p style={{ fontSize: 10, color: '#4a6580', margin: '4px 0 0' }}>
        Heurística: memória 40% + event loop 35% + latência DB 25% — {'<'}40% azul · 40–69% amarelo · ≥70% vermelho
      </p>
    </div>
  );
}

function LatencyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0f1f38', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ fontSize: 10, color: '#4a6580', margin: '0 0 6px' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ fontSize: 12, color: p.color, margin: '2px 0', fontWeight: 600 }}>
          {p.name}: {p.value}ms
        </p>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminObservabilidade() {
  const { data: health, isLoading: healthLoading, refetch: refetchHealth, isFetching: healthFetching } = useQuery({
    queryKey: ['adminSystemHealth'],
    queryFn: fetchSystemHealth,
    refetchInterval: 60_000,
    retry: false,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['adminHealthHistory'],
    queryFn: fetchHealthHistory,
    refetchInterval: 300_000,
    retry: false,
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['adminConfigStatus'],
    queryFn: fetchConfigStatus,
    staleTime: 600_000,
    retry: false,
  });

  const { data: sentry, isLoading: sentryLoading } = useQuery({
    queryKey: ['adminSentryIssues'],
    queryFn: fetchSentryIssues,
    refetchInterval: 120_000,
  });

  // Overall status
  const backendDown = !health || health.backend.status === 'down';
  const dbDown = health?.db.status === 'down';
  const stripeDown = health?.stripe.status === 'down';
  const anySlow = (health?.db.latency_ms ?? 0) > SLOW_DB_MS || (health?.stripe.latency_ms ?? 0) > SLOW_STRIPE_MS;

  const overall = backendDown || dbDown || stripeDown
    ? { label: 'FORA DO AR', color: '#f87171', Icon: ShieldX }
    : anySlow
    ? { label: 'DEGRADADO', color: '#fbbf24', Icon: ShieldAlert }
    : { label: 'OPERACIONAL', color: '#34d399', Icon: ShieldCheck };

  // Chart series — format time label as HH:mm
  const chartSeries = (history?.series ?? []).map((r) => ({
    t: new Date(r.checked_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
    db: r.db_latency_ms,
    stripe: r.stripe_latency_ms,
    loop: r.event_loop_lag_ms,
  }));

  // Stripe audit next
  const lastAudit = history?.last_stripe_audit ?? null;

  // Config
  const configChecks = config?.checks ?? [];
  const missingCritical = configChecks.filter((c) => c.critical && !c.present).length;
  const missingOptional = configChecks.filter((c) => !c.critical && !c.present).length;

  // Combined incidents
  const selfIncidents = history?.incidents ?? [];
  const sentryIncidents = sentry?.configured ? sentry.issues : [];

  return (
    <div className="space-y-8 fade-in">
      {/* ── Header ── */}
      <div>
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <Activity className="text-red-500 w-6 h-6" />
            <h1 className="text-2xl font-bold text-slate-100">Observabilidade</h1>
          </div>
          <button
            onClick={() => refetchHealth()}
            disabled={healthFetching}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', color: '#94a3b8', fontSize: 12, fontWeight: 700, cursor: healthFetching ? 'default' : 'pointer' }}
          >
            <RefreshCw size={13} className={healthFetching ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
        <p className="text-[#94A3B8] mt-2 text-sm">Métricas reais de backend — atualiza a cada 60s</p>
      </div>

      {/* ── Status card ── */}
      <div style={{ background: '#1C3454', border: `1px solid ${overall.color}33`, borderRadius: 12, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Overall label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {healthLoading ? (
            <Loader2 size={40} className="animate-spin" style={{ color: '#4a6580' }} />
          ) : (
            <overall.Icon size={40} style={{ color: overall.color }} />
          )}
          <div>
            <p style={{ color: overall.color, fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', margin: 0 }}>STATUS DO SISTEMA</p>
            <h2 style={{ color: overall.color, fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>
              {healthLoading ? 'Verificando…' : overall.label}
            </h2>
          </div>
        </div>

        {/* 3-service grid */}
        {!healthLoading && health && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.625rem' }}>
            {[
              { label: 'BACKEND (API)', icon: Server, status: health.backend.status, latency: null, uptime: history?.uptime_24h.backend ?? null },
              { label: 'BANCO (SUPABASE)', icon: Database, status: health.db.status, latency: health.db.latency_ms, uptime: history?.uptime_24h.db ?? null },
              { label: 'STRIPE', icon: CreditCard, status: health.stripe.status, latency: health.stripe.latency_ms, uptime: history?.uptime_24h.stripe ?? null },
            ].map(({ label, icon: Icon, status, latency, uptime }) => (
              <div key={label} style={{ background: 'rgba(0,0,0,.15)', borderRadius: 10, padding: '0.75rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Icon size={13} style={{ color: '#4a6580' }} />
                  <span style={{ fontSize: 10, color: '#4a6580', fontWeight: 700, letterSpacing: '0.05em' }}>{label}</span>
                </div>
                <p style={{ fontSize: 13, color: status === 'down' ? '#f87171' : 'white', fontWeight: 700, margin: '0 0 3px' }}>
                  {status === 'down' ? '🔴 Fora do ar' : latency !== null ? `🟢 ${latency}ms` : '🟢 OK'}
                </p>
                <p style={{ fontSize: 10, color: '#4a6580', margin: 0 }}>
                  uptime 24h: <UptimeBadge pct={uptime} />
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Load bar */}
        {!healthLoading && health && (
          <LoadBar pct={health.load_pct} />
        )}

        {/* System info row */}
        {!healthLoading && health && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem' }}>
            <StatBadge
              label="UPTIME DO PROCESSO"
              value={formatUptime(health.backend.uptime_seconds)}
              color="#60a5fa"
            />
            <StatBadge
              label="HEAP"
              value={`${health.backend.memory_mb.heap_used} / ${health.backend.memory_mb.heap_total} MB`}
              color="#a78bfa"
            />
            <StatBadge
              label="EVENT LOOP LAG"
              value={`${health.backend.event_loop_lag_ms}ms`}
              color={health.backend.event_loop_lag_ms > 50 ? '#fbbf24' : '#34d399'}
            />
            <StatBadge
              label="COMMIT / BRANCH"
              value={health.backend.deploy.commit
                ? `${health.backend.deploy.commit} (${health.backend.deploy.branch ?? '?'})`
                : 'local / dev'
              }
              color="#94a3b8"
            />
          </div>
        )}

        {/* DB size + last payment */}
        {!healthLoading && health && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <StatBadge
              label="TAMANHO DO BANCO"
              value={health.db.size_mb !== null ? `${health.db.size_mb} MB` : 'indisponível'}
              color="#94a3b8"
            />
            <StatBadge
              label="ÚLTIMO PAGAMENTO CONFIRMADO"
              value={health.last_payment_at ? formatTime(health.last_payment_at) : 'nenhum'}
              color="#94a3b8"
            />
          </div>
        )}
      </div>

      {/* ── Charts ── */}
      {!historyLoading && (history?.checks_count ?? 0) > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* DB + Stripe latency */}
          <div style={{ background: '#1C3454', borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Zap size={13} style={{ color: '#60a5fa' }} />
              <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, margin: 0 }}>LATÊNCIA 24H (ms)</p>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartSeries} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,.04)" />
                <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#4a6580' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: '#4a6580' }} />
                <Tooltip content={<LatencyTooltip />} />
                <Line type="monotone" dataKey="db" name="DB" stroke="#60a5fa" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="stripe" name="Stripe" stroke="#a78bfa" strokeWidth={1.5} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Event loop lag */}
          <div style={{ background: '#1C3454', borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Activity size={13} style={{ color: '#34d399' }} />
              <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, margin: 0 }}>EVENT LOOP LAG 24H (ms)</p>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartSeries} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,.04)" />
                <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#4a6580' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: '#4a6580' }} />
                <Tooltip content={<LatencyTooltip />} />
                <Line type="monotone" dataKey="loop" name="Event Loop" stroke="#34d399" strokeWidth={1.5} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : !historyLoading && (
        <div style={{ background: '#1C3454', borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(255,255,255,.06)', textAlign: 'center', color: '#4a6580', fontSize: 13 }}>
          Histórico de 24h ainda sem dados — os gráficos aparecem após o cron health check rodar pela primeira vez.
        </div>
      )}

      {/* ── Config checklist ── */}
      <div style={{ background: '#1C3454', borderRadius: 12, border: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={15} style={{ color: '#94a3b8' }} />
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0 }}>Variáveis de Ambiente</h2>
          </div>
          {!configLoading && configChecks.length > 0 && (
            <span style={{ fontSize: 11, color: missingCritical > 0 ? '#f87171' : missingOptional > 0 ? '#fbbf24' : '#34d399', fontWeight: 700 }}>
              {missingCritical > 0 ? `${missingCritical} crítica(s) faltando` : missingOptional > 0 ? `${missingOptional} opcional(is) faltando` : 'Tudo configurado'}
            </span>
          )}
        </div>
        {configLoading ? (
          <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={20} className="animate-spin" style={{ color: '#4a6580' }} />
          </div>
        ) : (
          <div style={{ padding: '0.75rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
            {configChecks.map((c) => (
              <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.4rem 0.5rem', borderRadius: 7, background: c.present ? 'transparent' : c.critical ? 'rgba(248,113,113,.06)' : 'rgba(251,191,36,.04)' }}>
                {c.present
                  ? <CheckCircle2 size={13} style={{ color: '#34d399', flexShrink: 0 }} />
                  : <XCircle size={13} style={{ color: c.critical ? '#f87171' : '#fbbf24', flexShrink: 0 }} />
                }
                <span style={{ fontSize: 12, color: c.present ? '#94a3b8' : c.critical ? '#fca5a5' : '#fde68a', fontWeight: c.present ? 400 : 600 }}>
                  {c.label}
                  {!c.present && !c.critical && <span style={{ color: '#4a6580', fontWeight: 400 }}> (opcional)</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Scheduled Jobs ── */}
      <div style={{ background: '#1C3454', borderRadius: 12, border: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={15} style={{ color: '#94a3b8' }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0 }}>Jobs Agendados</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {SCHEDULED_JOBS.map((job, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '0.75rem 1.25rem', borderBottom: i < SCHEDULED_JOBS.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'white', fontWeight: 600 }}>{job.name}</span>
                  <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700, background: 'rgba(96,165,250,.1)', padding: '2px 6px', borderRadius: 4 }}>{job.schedule}</span>
                </div>
                <p style={{ fontSize: 11, color: '#4a6580', margin: '2px 0 0' }}>{job.description}</p>
                {job.note && (
                  <p style={{ fontSize: 11, color: '#fbbf24', margin: '4px 0 0', display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                    <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
                    {job.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Stripe audit info */}
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid rgba(255,255,255,.06)', background: 'rgba(0,0,0,.1)' }}>
          {lastAudit ? (
            <p style={{ fontSize: 11, color: '#4a6580', margin: 0 }}>
              Última auditoria Stripe: {formatTime(lastAudit.ran_at)} — {lastAudit.payments_checked} PIs verificados,{' '}
              <span style={{ color: lastAudit.orphans_found > 0 ? '#f87171' : '#34d399', fontWeight: 700 }}>
                {lastAudit.orphans_found} órfãos
              </span>.{' '}
              Próxima: {nextStripeAudit()}.
            </p>
          ) : (
            <p style={{ fontSize: 11, color: '#4a6580', margin: 0 }}>
              Nenhuma auditoria Stripe registrada ainda. Próxima: {nextStripeAudit()}.
            </p>
          )}
        </div>
      </div>

      {/* ── Incident timeline ── */}
      <div style={{ background: '#1C3454', borderRadius: 12, border: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0 }}>Timeline de Incidentes</h2>
          <p style={{ fontSize: 11, color: '#4a6580', margin: '3px 0 0' }}>
            Transições up→down detectadas automaticamente (últimas 24h) + issues Sentry não-resolvidos
          </p>
        </div>

        {selfIncidents.length === 0 && sentryIncidents.length === 0 && !sentry?.configured && !historyLoading && !sentryLoading ? (
          <div>
            {/* Self-detected: no data */}
            {(history?.checks_count ?? 0) > 0 ? (
              <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', gap: 10, alignItems: 'center' }}>
                <CheckCircle2 size={15} style={{ color: '#34d399', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#94a3b8' }}>Nenhuma transição up→down nas últimas 24h.</span>
              </div>
            ) : (
              <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', gap: 10, alignItems: 'center' }}>
                <Loader2 size={15} style={{ color: '#4a6580', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#4a6580' }}>Aguardando primeiros dados do health check cron.</span>
              </div>
            )}

            {/* Sentry: not configured */}
            <div style={{ padding: '0.875rem 1.25rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertTriangle size={15} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                Sentry não conectado. Configure{' '}
                <code style={{ color: '#fbbf24', fontSize: 11 }}>SENTRY_API_TOKEN</code>,{' '}
                <code style={{ color: '#fbbf24', fontSize: 11 }}>SENTRY_ORG_SLUG</code> e{' '}
                <code style={{ color: '#fbbf24', fontSize: 11 }}>SENTRY_PROJECT_SLUGS</code> no Render para ver issues em tempo real.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {/* Self-detected incidents */}
            {selfIncidents.map((inc, i) => (
              <div key={`self-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', flexShrink: 0, marginTop: 4 }} />
                <div>
                  <p style={{ fontSize: 13, color: 'white', fontWeight: 600, margin: 0 }}>
                    {TARGET_LABEL[inc.target] ?? inc.target} ficou fora do ar
                  </p>
                  <p style={{ fontSize: 11, color: '#4a6580', margin: '2px 0 0' }}>
                    detectado às {formatTime(inc.started_at)} · health check automático
                  </p>
                </div>
              </div>
            ))}

            {/* No self-detected incidents but has data */}
            {selfIncidents.length === 0 && (history?.checks_count ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <CheckCircle2 size={14} style={{ color: '#34d399', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#4a6580' }}>Nenhuma queda detectada nas últimas 24h.</span>
              </div>
            )}

            {/* Sentry issues */}
            {sentry?.configured && (
              sentryLoading ? (
                <div style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'center' }}>
                  <Loader2 size={18} className="animate-spin" style={{ color: '#4a6580' }} />
                </div>
              ) : sentryIncidents.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1.25rem' }}>
                  <CheckCircle2 size={14} style={{ color: '#34d399', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#4a6580' }}>Nenhum issue Sentry não-resolvido nas últimas 24h.</span>
                </div>
              ) : (
                sentryIncidents.map((issue, i) => (
                  <a
                    key={`sentry-${i}`}
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,.04)', textDecoration: 'none' }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: SENTRY_LEVEL_COLOR[issue.level] ?? '#4a6580', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: 'white', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {issue.title}
                      </p>
                      <p style={{ fontSize: 11, color: '#4a6580', margin: '2px 0 0' }}>
                        {issue.project} · {issue.count}x · {formatTime(issue.lastSeen)} · Sentry
                      </p>
                    </div>
                    <ExternalLink size={13} style={{ color: '#4a6580', flexShrink: 0 }} />
                  </a>
                ))
              )
            )}

            {/* Sentry not configured but has other incidents */}
            {!sentry?.configured && (
              <div style={{ padding: '0.75rem 1.25rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: '#4a6580', lineHeight: 1.5, margin: 0 }}>
                  Sentry não configurado — issues de código não aparecem aqui.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Deploy info footer ── */}
      {!healthLoading && health?.backend.deploy.commit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GitBranch size={12} style={{ color: '#4a6580' }} />
          <span style={{ fontSize: 11, color: '#4a6580' }}>
            Commit <code style={{ color: '#60a5fa' }}>{health.backend.deploy.commit}</code> na branch{' '}
            <code style={{ color: '#60a5fa' }}>{health.backend.deploy.branch}</code>
          </span>
        </div>
      )}
    </div>
  );
}
