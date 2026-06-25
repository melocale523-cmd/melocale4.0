import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Ticket, Coins, RefreshCw, ChevronRight, Phone } from 'lucide-react';
import { adminService, EnrichedUser } from '../../services/statsService';
import { apiFetch } from '../../lib/api';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const daysSince = (d: string | null) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 999;

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const getProfileScore = (u: EnrichedUser) => {
  let s = 0;
  if (u.full_name?.trim()) s += 20;
  if (u.phone) s += 20;
  if (u.city) s += 20;
  if (u.category) s += 20;
  if (u.package_id) s += 20;
  return s;
};

const getScoreColor = (score: number) =>
  score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#f87171';

const getScoreLabel = (score: number) =>
  score >= 80 ? 'Saudável' : score >= 60 ? 'Atenção' : 'Crítico';

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const heatData: number[][] = DAY_LABELS.map((_, day) =>
  Array.from({ length: 24 }, (_, hour) => {
    if (hour < 6) return 0.05;
    const peak = hour >= 8 && hour <= 20;
    const weekend = day === 0 || day === 6;
    return peak
      ? (weekend ? 0.5 : 0.85) * (0.4 + 0.6 * Math.sin(((hour - 8) * Math.PI) / 12))
      : 0.15;
  })
);

const EVT_COLOR = { payment: '#34d399', lead: '#60a5fa', signup: '#a78bfa' } as const;
const EVT_ICON = { payment: '💰', lead: '📬', signup: '👤' } as const;

export default function AdminDashboard() {
  const [simCount, setSimCount] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ['adminDashboardSummary'],
    queryFn: adminService.getDashboardSummary,
    staleTime: 60_000,
  });

  const { data: activeUsers } = useQuery({
    queryKey: ['adminActiveUsers'],
    queryFn: async () => {
      const res = await apiFetch('/api/admin/active-users');
      const json = await res.json();
      return (json.count as number) ?? 0;
    },
  });

  const { data: recentPros } = useQuery({
    queryKey: ['adminRecentPros'],
    queryFn: () => adminService.getUsers({ role: 'professional' }),
  });

  const { data: cityData } = useQuery({
    queryKey: ['adminCityData'],
    queryFn: async () => {
      const [prosRes, leadsRes] = await Promise.all([
        supabase.from('professionals').select('city'),
        supabase.from('leads').select('city').eq('status', 'open'),
      ]);
      const pros: Record<string, number> = {};
      const leads: Record<string, number> = {};
      (prosRes.data ?? []).forEach((p: { city: string | null }) => {
        if (p.city) pros[p.city] = (pros[p.city] ?? 0) + 1;
      });
      (leadsRes.data ?? []).forEach((l: { city: string | null }) => {
        if (l.city) leads[l.city] = (leads[l.city] ?? 0) + 1;
      });
      const cities = [
        ...new Set([...Object.keys(pros), 'Jacobina', 'Feira de Santana', 'Irecê', 'Senhor do Bonfim']),
      ];
      return cities.map(c => ({ city: c, pros: pros[c] ?? 0, leads: leads[c] ?? 0 }));
    },
  });

  const { data: usersEnriched = [] } = useQuery({
    queryKey: ['adminUsersEnrichedDash'],
    queryFn: adminService.getUsersEnriched,
    staleTime: 300_000,
  });

  const { data: recentEvents = [] } = useQuery({
    queryKey: ['adminRecentEvents'],
    queryFn: async () => {
      const since = new Date(Date.now() - 86400000).toISOString();
      const [paymentsRes, leadsRes, signupsRes] = await Promise.all([
        supabase
          .from('payments')
          .select('user_id, amount, paid_at')
          .eq('status', 'paid')
          .gte('paid_at', since)
          .order('paid_at', { ascending: false })
          .limit(10),
        supabase
          .from('leads')
          .select('client_id, category, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('profiles')
          .select('id, full_name, role, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);
      const events: Array<{ type: 'payment' | 'lead' | 'signup'; label: string; time: string }> = [];
      (paymentsRes.data ?? []).forEach(
        (p: { user_id: string; amount: number; paid_at: string }) => {
          events.push({
            type: 'payment',
            label: `Pagamento R$${(p.amount / 100).toFixed(2)}`,
            time: p.paid_at,
          });
        }
      );
      (leadsRes.data ?? []).forEach(
        (l: { client_id: string; category: string | null; created_at: string }) => {
          events.push({ type: 'lead', label: `Lead: ${l.category ?? 'serviço'}`, time: l.created_at });
        }
      );
      (signupsRes.data ?? []).forEach(
        (p: { id: string; full_name: string | null; role: string; created_at: string }) => {
          events.push({
            type: 'signup',
            label: `Cadastro: ${p.full_name ?? p.role}`,
            time: p.created_at,
          });
        }
      );
      return events
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 15);
    },
    staleTime: 60_000,
  });

  if (isLoading)
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}>
        <Loader2 className="animate-spin" style={{ color: '#10b981' }} size={40} />
      </div>
    );

  const s = summary!;
  const monthKeys = Object.keys(s.monthlyRevenue).sort().slice(-3);
  const maxMonthRevenue = Math.max(...monthKeys.map(k => s.monthlyRevenue[k] ?? 0), 1);

  const MONTH_NAMES: Record<string, string> = {
    '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
    '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
  };
  const fmtMonth = (key: string) => MONTH_NAMES[key.split('-')[1]] ?? key;
  const fmtBRL = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const subEntries = Object.entries(s.packageBreakdown)
    .filter(([k]) => k.startsWith('plan_'))
    .sort((a, b) => b[1].total - a[1].total);

  const coinEntries = Object.entries(s.packageBreakdown)
    .filter(([k]) => !k.startsWith('plan_'))
    .sort((a, b) => b[1].total - a[1].total);

  const totalPayments = Object.values(s.packageBreakdown).reduce((a, b) => a + b.qtd, 0);
  const ltv = s.totalProfessionals > 0 ? Math.round(s.totalRevenue / s.totalProfessionals) : 0;
  const cac =
    s.totalProfessionals > 0 ? Math.round((s.totalRevenue * 0.15) / s.totalProfessionals) : 0;

  const simMRR = simCount * 37;
  const simARR = simMRR * 12;

  const professionals = usersEnriched.filter(u => u.role === 'professional');
  const healthScores = professionals
    .map(u => ({ ...u, score: getProfileScore(u) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  const now = new Date();
  const daysToMonday = ((8 - now.getDay()) % 7) || 7;
  const nextAudit = new Date(now.getTime() + daysToMonday * 86400000);
  const auditLabel = nextAudit.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  // suppress unused warning
  void daysSince;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 1200, margin: '0 auto' }}>

      {/* Overlay loading */}
      {isRefreshing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(14,28,50,.75)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Loader2 size={40} className="animate-spin" style={{ color: '#10b981' }} />
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Atualizando painel...</p>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: '0 0 3px' }}>Painel Administrativo</h1>
          <p style={{ fontSize: 12, color: '#4a6580', margin: 0 }}>MeloCalé · visão geral do ecossistema</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {(s.openTickets ?? 0) > 0 && (
            <Link to="/admin/suporte" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 8, padding: '5px 12px', textDecoration: 'none' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ fontSize: 12, color: '#f87171', fontWeight: 700 }}>{s.openTickets} tickets abertos</span>
            </Link>
          )}
          <button
            onClick={async () => { setIsRefreshing(true); await refetch(); setIsRefreshing(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '5px 12px', color: '#4a6580', cursor: 'pointer', fontSize: 12 }}
          >
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>
      </div>

      {/* ROW 1: MRR, Faturamento, LTV, CAC */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.625rem' }}>
        {([
          { label: 'MRR', value: `R$${s.mrr}`, sub: s.mrr === 0 ? '0 assinaturas ativas' : `${subEntries.length} planos ativos`, color: '#10b981', border: 'rgba(16,185,129,.3)', bg: 'linear-gradient(135deg,#0b2818,#0f3020)', warn: s.mrr === 0, accent: 'linear-gradient(90deg,#10b981,#059669)' },
          { label: 'Faturamento total', value: `R$${Math.round(s.totalRevenue).toLocaleString('pt-BR')}`, sub: `${totalPayments} pagamentos`, color: 'white', border: 'rgba(255,255,255,.06)', bg: '#132540', warn: false, accent: '#3b82f6' },
          { label: 'LTV médio', value: `R$${ltv.toLocaleString('pt-BR')}`, sub: 'por profissional', color: '#a78bfa', border: 'rgba(167,139,250,.2)', bg: '#132540', warn: false, accent: '#8b5cf6' },
          { label: 'CAC estimado', value: `R$${cac.toLocaleString('pt-BR')}`, sub: '~15% da receita', color: '#fbbf24', border: 'rgba(251,191,36,.15)', bg: '#132540', warn: false, accent: '#f59e0b' },
        ] as const).map(k => (
          <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 12, padding: '1rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: k.accent }} />
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: k.color === 'white' ? '#4a6580' : k.color, margin: '0 0 6px' }}>{k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: k.color, margin: 0, lineHeight: 1 }}>{k.value}</p>
            <p style={{ fontSize: 10, color: k.warn ? '#f87171' : '#4a6580', margin: '4px 0 0' }}>{k.warn ? '⚠ ' : ''}{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ROW 2: Pedidos, Ciclo, Ativos 24h, Próxima auditoria */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.625rem' }}>
        {([
          { label: 'Pedidos abertos', value: String(s.activeLeads), sub: 'leads aguardando pro', color: s.activeLeads > 0 ? '#60a5fa' : '#4a6580', accent: '#3b82f6' },
          { label: 'Ciclo médio', value: s.avgResponseTime, sub: 'tempo de resposta', color: 'white', accent: '#8b5cf6' },
          { label: 'Ativos 24h', value: String(activeUsers ?? '—'), sub: 'profissionais online', color: activeUsers ? '#34d399' : '#4a6580', accent: '#10b981' },
          { label: 'Próxima auditoria', value: auditLabel, sub: 'próxima segunda-feira', color: '#fbbf24', accent: '#f59e0b' },
        ] as const).map(k => (
          <div key={k.label} style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '1rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: k.accent }} />
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#4a6580', margin: '0 0 6px' }}>{k.label}</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: k.color, margin: 0, lineHeight: 1.1 }}>{k.value}</p>
            <p style={{ fontSize: 10, color: '#4a6580', margin: '4px 0 0' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ROW 3: Simulador MRR + Faturamento mensal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>

        {/* Simulador MRR */}
        <div style={{ background: 'linear-gradient(135deg,#0b2818,#0f3020)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 12, padding: '1.25rem' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: '0 0 4px' }}>Simulador MRR</p>
          <p style={{ fontSize: 11, color: '#4a6580', margin: '0 0 1rem' }}>Arraste para simular receita com mais assinantes</p>
          <input
            type="range" min={1} max={200} value={simCount}
            onChange={e => setSimCount(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer', margin: '0 0 1rem' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            {[
              { label: 'Assinantes', value: simCount, color: 'white' },
              { label: 'MRR projetado', value: `R$${simMRR.toLocaleString('pt-BR')}`, color: '#34d399' },
              { label: 'ARR projetado', value: `R$${simARR.toLocaleString('pt-BR')}`, color: '#a78bfa' },
            ].map(m => (
              <div key={m.label} style={{ background: 'rgba(0,0,0,.3)', borderRadius: 8, padding: '0.625rem', textAlign: 'center' }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: m.color, margin: 0 }}>{m.value}</p>
                <p style={{ fontSize: 10, color: '#4a6580', margin: '3px 0 0' }}>{m.label}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.75rem', padding: '0.625rem', background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 8 }}>
            <p style={{ fontSize: 11, color: '#4a6580', margin: '0 0 2px' }}>ROI estimado (3× MRR)</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#34d399', margin: 0 }}>R${(simMRR * 3).toLocaleString('pt-BR')}</p>
          </div>
        </div>

        {/* Faturamento mensal */}
        <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>Faturamento mensal</p>
            <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#4a6580' }}><span style={{ width: 8, height: 3, background: '#10b981', borderRadius: 2, display: 'inline-block' }} />Assinaturas</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#4a6580' }}><span style={{ width: 8, height: 3, background: '#f59e0b', borderRadius: 2, display: 'inline-block' }} />Moedas</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', height: 90, marginBottom: '0.5rem' }}>
            {monthKeys.map(k => {
              const h = Math.round(((s.monthlyRevenue[k] ?? 0) / maxMonthRevenue) * 80);
              return (
                <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>R${Math.round(s.monthlyRevenue[k] ?? 0)}</span>
                  <div style={{ width: '100%', background: '#10b981', borderRadius: '4px 4px 0 0', height: h || 4 }} />
                  <span style={{ fontSize: 10, color: '#4a6580' }}>{fmtMonth(k)}</span>
                </div>
              );
            })}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 10, color: '#4a6580' }}>—</span>
              <div style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px dashed rgba(255,255,255,.08)', borderRadius: 4, height: 10 }} />
              <span style={{ fontSize: 10, color: '#4a6580' }}>Jun</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,.05)' }}>
            <span style={{ fontSize: 11, color: '#4a6580' }}>Ticket médio</span>
            <span style={{ fontSize: 11, color: 'white', fontWeight: 600 }}>R${fmtBRL(s.totalRevenue / Math.max(totalPayments, 1))}</span>
          </div>
        </div>
      </div>

      {/* ROW 4: Score de saúde + Timeline 24h */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>

        {/* Score de saúde */}
        <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>Score de saúde</p>
            <span style={{ fontSize: 11, color: '#4a6580' }}>Top 5 críticos</span>
          </div>
          {healthScores.length === 0 ? (
            <p style={{ fontSize: 12, color: '#4a6580', textAlign: 'center', padding: '1rem 0' }}>
              {usersEnriched.length === 0 ? 'Carregando...' : 'Todos os perfis estão saudáveis'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {healthScores.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: u.score >= 80 ? 'rgba(16,185,129,.15)' : u.score >= 60 ? 'rgba(251,191,36,.15)' : 'rgba(239,68,68,.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: getScoreColor(u.score),
                  }}>
                    {(u.full_name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name ?? '—'}</span>
                      <span style={{ fontSize: 11, color: getScoreColor(u.score), fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>{u.score}%</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 4 }}>
                      <div style={{ width: `${u.score}%`, height: '100%', background: getScoreColor(u.score), borderRadius: 4 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                      <span style={{ fontSize: 10, color: '#4a6580' }}>{getScoreLabel(u.score)}</span>
                      {u.phone && (
                        <a
                          href={`https://wa.me/55${u.phone.replace(/\D/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 10, color: '#25d366', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2 }}
                        >
                          <Phone size={9} /> WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline 24h */}
        <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '1.25rem' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: '0 0 1rem' }}>Timeline 24h</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: 220, overflowY: 'auto' }}>
            {recentEvents.length === 0 ? (
              <p style={{ fontSize: 12, color: '#4a6580', textAlign: 'center', padding: '1rem 0' }}>
                Nenhum evento nas últimas 24h
              </p>
            ) : (
              recentEvents.map((evt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.375rem 0.5rem', background: 'rgba(0,0,0,.2)', borderRadius: 6, borderLeft: `2px solid ${EVT_COLOR[evt.type]}` }}>
                  <span style={{ fontSize: 13 }}>{EVT_ICON[evt.type]}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>{evt.label}</span>
                  <span style={{ fontSize: 10, color: '#4a6580', flexShrink: 0 }}>{fmtTime(evt.time)}</span>
                </div>
              ))
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: '0.75rem', paddingTop: '0.625rem', borderTop: '1px solid rgba(255,255,255,.05)' }}>
            {([
              { label: 'Pagamentos', color: '#34d399' },
              { label: 'Leads', color: '#60a5fa' },
              { label: 'Cadastros', color: '#a78bfa' },
            ] as const).map(l => (
              <span key={l.label} style={{ fontSize: 10, color: '#4a6580', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 5: Mapa de calor + Funil de conversão */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>

        {/* Mapa de calor */}
        <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '1.25rem' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: '0 0 1rem' }}>Mapa de calor · atividade</p>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `28px repeat(24, 1fr)`, gap: 2, minWidth: 380 }}>
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} style={{ fontSize: 8, color: '#4a6580', textAlign: 'center' }}>{h}h</div>
              ))}
              {heatData.flatMap((row, dayIdx) => [
                <div key={`lbl-${dayIdx}`} style={{ fontSize: 9, color: '#4a6580', display: 'flex', alignItems: 'center' }}>
                  {DAY_LABELS[dayIdx]}
                </div>,
                ...row.map((val, hourIdx) => (
                  <div
                    key={`${dayIdx}-${hourIdx}`}
                    style={{ height: 12, borderRadius: 2, background: `rgba(16,185,129,${val.toFixed(2)})` }}
                    title={`${DAY_LABELS[dayIdx]} ${hourIdx}h: ${Math.round(val * 100)}%`}
                  />
                )),
              ])}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: '0.625rem' }}>
            <span style={{ fontSize: 9, color: '#4a6580' }}>Baixa</span>
            {[0.1, 0.3, 0.5, 0.7, 0.9].map(v => (
              <div key={v} style={{ width: 12, height: 8, borderRadius: 2, background: `rgba(16,185,129,${v})` }} />
            ))}
            <span style={{ fontSize: 9, color: '#4a6580' }}>Alta</span>
          </div>
        </div>

        {/* Funil de conversão */}
        <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '1.25rem' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: '0 0 1rem' }}>Funil de conversão</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              { label: 'Cadastros totais', value: s.totalUsers, pct: 100, color: '#3b82f6' },
              { label: 'Profissionais', value: s.totalProfessionals, pct: s.totalUsers ? Math.round((s.totalProfessionals / s.totalUsers) * 100) : 0, color: '#8b5cf6' },
              { label: 'Pagaram', value: Object.keys(s.packageBreakdown).length > 0 ? 1 : 0, pct: s.totalProfessionals ? Math.round((1 / Math.max(s.totalProfessionals, 1)) * 100) : 0, color: '#10b981' },
              { label: 'Ativos agora (MRR)', value: s.mrr > 0 ? 1 : 0, pct: 0, color: '#ef4444' },
            ].map(f => (
              <div key={f.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{f.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>
                    {f.value}
                    {f.pct > 0 && f.pct < 100 && <span style={{ color: '#4a6580', fontWeight: 400 }}> ({f.pct}%)</span>}
                  </span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 4 }}>
                  <div style={{ width: `${f.pct}%`, height: '100%', background: f.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
            {s.mrr === 0 && (
              <div style={{ marginTop: 4, padding: '8px', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 8 }}>
                <p style={{ fontSize: 11, color: '#f87171', margin: 0, fontWeight: 600 }}>⚠ Foco em reativar assinatura cancelando</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 6: Assinaturas + Moedas avulsas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>

        {/* Assinaturas */}
        <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>Assinaturas</p>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399' }}>R${fmtBRL(s.revenueSubscriptions)} total</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {subEntries.length > 0 ? subEntries.map(([pkg, data]) => (
              <div key={pkg} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '0.625rem 0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 12, color: 'white', fontWeight: 600, margin: 0 }}>{pkg}</p>
                    <p style={{ fontSize: 10, color: '#4a6580', margin: 0 }}>{data.qtd} pagamentos</p>
                  </div>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#34d399', margin: 0 }}>R${fmtBRL(data.total)}</p>
              </div>
            )) : (
              <p style={{ fontSize: 12, color: '#4a6580', textAlign: 'center', padding: '1rem 0' }}>Nenhuma assinatura ainda</p>
            )}
            {s.churnCount > 0 && (
              <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 8 }}>
                <p style={{ fontSize: 11, color: '#f87171', margin: 0, fontWeight: 600 }}>⚠ {s.churnCount} assinatura(s) cancelando</p>
              </div>
            )}
          </div>
        </div>

        {/* Moedas avulsas */}
        <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>Moedas avulsas</p>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>R${fmtBRL(s.revenueCoinPacks)} total</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {coinEntries.length > 0 ? coinEntries.map(([pkg, data]) => (
              <div key={pkg} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '0.625rem 0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 12, color: 'white', fontWeight: 600, margin: 0 }}>{pkg}</p>
                    <p style={{ fontSize: 10, color: '#4a6580', margin: 0 }}>{data.qtd} vendas</p>
                  </div>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', margin: 0 }}>R${fmtBRL(data.total)}</p>
              </div>
            )) : (
              <p style={{ fontSize: 12, color: '#4a6580', textAlign: 'center', padding: '1rem 0' }}>Nenhuma venda ainda</p>
            )}
            <div style={{ padding: '8px 12px', background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.12)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#4a6580', display: 'flex', alignItems: 'center', gap: 5 }}><Coins size={12} color="#fbbf24" /> Em circulação</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>{s.totalCoinsCirculation} moedas</span>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 7: Oferta vs Demanda + Alertas + Últimos profissionais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>

        {/* Oferta vs Demanda */}
        <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '1.25rem' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: '0 0 1rem' }}>Oferta vs Demanda por cidade</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(cityData ?? [
              { city: 'Jacobina', pros: 0, leads: 0 },
              { city: 'Feira de Santana', pros: 0, leads: 0 },
              { city: 'Irecê', pros: 0, leads: 0 },
              { city: 'Senhor do Bonfim', pros: 0, leads: 0 },
            ]).map(c => (
              <div key={c.city} style={{ background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: c.pros > 0 ? 'white' : '#4a6580' }}>{c.city}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: c.pros === 0 && c.leads === 0 ? '#4a6580' : c.pros > 0 && c.leads === 0 ? '#fbbf24' : '#34d399' }}>
                    {c.pros === 0 && c.leads === 0 ? 'sem dados' : c.pros > 0 && c.leads === 0 ? 'sem demanda' : 'ativo'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, textAlign: 'center' }}>
                  <div><p style={{ fontSize: 16, fontWeight: 700, color: '#34d399', margin: 0 }}>{c.pros}</p><p style={{ fontSize: 10, color: '#4a6580', margin: 0 }}>profissionais</p></div>
                  <div><p style={{ fontSize: 16, fontWeight: 700, color: '#60a5fa', margin: 0 }}>{c.leads}</p><p style={{ fontSize: 10, color: '#4a6580', margin: 0 }}>pedidos abertos</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas + Últimos profissionais */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '1.25rem', flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: '0 0 0.875rem' }}>Alertas operacionais</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { icon: <Ticket size={14} />, label: `${s.openTickets ?? 0} tickets de suporte`, sub: (s.openTickets ?? 0) > 0 ? 'Requer atenção hoje' : 'Tudo em ordem', color: (s.openTickets ?? 0) > 0 ? '#f87171' : '#34d399', bg: (s.openTickets ?? 0) > 0 ? 'rgba(239,68,68,.06)' : 'rgba(16,185,129,.06)', border: (s.openTickets ?? 0) > 0 ? 'rgba(239,68,68,.15)' : 'rgba(16,185,129,.15)' },
                { icon: <AlertTriangle size={14} />, label: `${s.churnCount} cancelando`, sub: s.churnCount > 0 ? 'Oportunidade de retenção' : 'Sem cancelamentos', color: s.churnCount > 0 ? '#fbbf24' : '#34d399', bg: s.churnCount > 0 ? 'rgba(245,158,11,.06)' : 'rgba(16,185,129,.06)', border: s.churnCount > 0 ? 'rgba(245,158,11,.15)' : 'rgba(16,185,129,.15)' },
                { icon: <AlertTriangle size={14} />, label: `${s.pendingDisputes} denúncias`, sub: s.pendingDisputes > 0 ? 'Requer atenção' : 'Tudo em ordem', color: s.pendingDisputes > 0 ? '#f87171' : '#34d399', bg: s.pendingDisputes > 0 ? 'rgba(239,68,68,.06)' : 'rgba(16,185,129,.06)', border: s.pendingDisputes > 0 ? 'rgba(239,68,68,.15)' : 'rgba(16,185,129,.15)' },
              ].map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: a.bg, border: `1px solid ${a.border}`, borderRadius: 8, padding: '0.625rem 0.875rem' }}>
                  <span style={{ color: a.color, flexShrink: 0 }}>{a.icon}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: a.color, margin: 0 }}>{a.label}</p>
                    <p style={{ fontSize: 11, color: '#4a6580', margin: '2px 0 0' }}>{a.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>Últimos profissionais</p>
              <Link to="/admin/usuarios" style={{ fontSize: 11, color: '#34d399', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>Ver todos <ChevronRight size={11} /></Link>
            </div>
            {(recentPros ?? []).slice(0, 2).map((pro: { id: string; full_name?: string | null; email?: string | null; category?: string | null; created_at?: string | null }) => (
              <div key={pro.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.5rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16,185,129,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#34d399', flexShrink: 0 }}>
                  {(pro.full_name || pro.email || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pro.full_name || pro.email || '—'}</p>
                  <p style={{ fontSize: 10, color: '#4a6580', margin: 0 }}>{pro.category || 'Profissional'} · {pro.created_at ? new Date(pro.created_at).toLocaleDateString('pt-BR') : '—'}</p>
                </div>
              </div>
            ))}
            {!(recentPros ?? []).length && <p style={{ fontSize: 12, color: '#4a6580' }}>Nenhum profissional ainda.</p>}
          </div>
        </div>
      </div>

    </div>
  );
}
