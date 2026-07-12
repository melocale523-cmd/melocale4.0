import { useState } from 'react';
import { Bot, MessageSquare, Users, ArrowRightLeft, Coins, RefreshCw, Loader2, AudioLines } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import LoadingLogo from '../../components/LoadingLogo';

interface BotStats {
  period_days: number;
  total_inbound_messages: number;
  total_conversations: number;
  total_handoffs: number;
  handoff_rate_pct: number;
  audio_messages_transcribed: number;
  estimated_cost_brl: number;
  estimated_cost_note: string;
  messages_per_day: Array<{ date: string; count: number }>;
}

async function fetchBotStats(days: number): Promise<BotStats> {
  const res = await apiFetch(`/api/admin/bot-stats?days=${days}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<BotStats>;
}

function formatDateLabel(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: typeof Bot; label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ background: '#1C3454', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '1rem 1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={14} style={{ color }} />
        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <p style={{ fontSize: 24, fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.02em' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#4a6580', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0f1f38', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ fontSize: 10, color: '#4a6580', margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 12, color: '#60a5fa', fontWeight: 700, margin: 0 }}>{payload[0].value} mensagens</p>
    </div>
  );
}

export default function AdminBotStats() {
  const [days, setDays] = useState<7 | 30>(7);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['adminBotStats', days],
    queryFn: () => fetchBotStats(days),
    retry: false,
  });

  const chartData = (data?.messages_per_day ?? []).map((d) => ({ label: formatDateLabel(d.date), count: d.count }));

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <Bot className="text-emerald-400 w-6 h-6" />
            <h1 className="text-2xl font-bold text-slate-100">Bot do WhatsApp</h1>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', color: '#94a3b8', fontSize: 12, fontWeight: 700, cursor: isFetching ? 'default' : 'pointer' }}
          >
            {isFetching ? <LoadingLogo size={16} showLabel={false} /> : <RefreshCw size={13} />}
            Atualizar
          </button>
        </div>
        <p className="text-[#94A3B8] mt-2 text-sm">Uso real do bot — mensagens, handoffs e custo estimado</p>
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6 }}>
        {([7, 30] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              height: 34, padding: '0 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: days === d ? '1px solid rgba(52,211,153,.3)' : '1px solid rgba(255,255,255,.08)',
              background: days === d ? 'rgba(52,211,153,.12)' : 'transparent',
              color: days === d ? '#34d399' : '#64748b',
            }}
          >
            {d} dias
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#4a6580' }} />
        </div>
      ) : data ? (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '0.75rem' }}>
            <StatCard icon={MessageSquare} label="Mensagens recebidas" value={String(data.total_inbound_messages)} color="#60a5fa" />
            <StatCard icon={Users} label="Conversas ativas" value={String(data.total_conversations)} color="#a78bfa" />
            <StatCard icon={ArrowRightLeft} label="Handoffs" value={String(data.total_handoffs)} color="#fbbf24" />
            <StatCard icon={ArrowRightLeft} label="Taxa de handoff" value={`${data.handoff_rate_pct}%`} sub="handoffs / conversas" color={data.handoff_rate_pct > 40 ? '#f87171' : '#34d399'} />
            <StatCard icon={Coins} label="Custo estimado" value={`R$${data.estimated_cost_brl.toFixed(2)}`} sub={data.estimated_cost_note} color="#f472b6" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#4a6580' }}>
            <AudioLines size={13} />
            {data.audio_messages_transcribed} mensagens de áudio transcritas no período (incluídas no custo estimado)
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div style={{ background: '#1C3454', borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(255,255,255,.06)', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <MessageSquare size={13} style={{ color: '#60a5fa' }} />
                <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, margin: 0 }}>MENSAGENS RECEBIDAS POR DIA</p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,.04)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#4a6580' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#4a6580' }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : (
        <div style={{ background: '#1C3454', borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(255,255,255,.06)', textAlign: 'center', color: '#4a6580', fontSize: 13 }}>
          Não foi possível carregar as estatísticas.
        </div>
      )}
    </div>
  );
}
