import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Trophy } from 'lucide-react';
import { adminService, type RankedProfessional } from '../../services/statsService';
import { useIsMobile } from '../../hooks/useIsMobile';
import LoadingLogo from '../../components/LoadingLogo';

// ── palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:       '#0E1C32',
  card:     '#1C3454',
  cardSec:  '#132236',
  text:     '#F1F5F9',
  textSec:  '#94A3B8',
  textTert: '#64748B',
  border:   'rgba(255,255,255,0.08)',
  gold1:    '#BA7517',
  gold2:    '#EF9F27',
  silver1:  '#888780',
  silver2:  '#B4B2A9',
  bronze1:  '#993C1D',
  bronze2:  '#D85A30',
  green:    '#1D9E75',
  blue:     '#185FA5',
  red:      '#A32D2D',
  amber:    '#EF9F27',
  emerald:  '#10b981',
};

const RANK = [
  { grad: `linear-gradient(135deg,${C.gold2},${C.gold1})`,     medal: '🥇', label: 'Ouro'   },
  { grad: `linear-gradient(135deg,${C.silver2},${C.silver1})`, medal: '🥈', label: 'Prata'  },
  { grad: `linear-gradient(135deg,${C.bronze2},${C.bronze1})`, medal: '🥉', label: 'Bronze' },
];

const PLAN_NAMES: Record<string, string> = {
  plan_basic:    'Starter',
  plan_pro:      'PRO',
  plan_business: 'Elite',
};

const QUICK_COINS = [10, 30, 50, 100, 200];

type TabId = 'score' | 'coins' | 'subs' | 'spent';
const TABS: { id: TabId; label: string }[] = [
  { id: 'score',  label: 'Score'       },
  { id: 'coins',  label: 'Moedas'      },
  { id: 'subs',   label: 'Assinaturas' },
  { id: 'spent',  label: 'Gasto total' },
];

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '??';
}

function tempoNaPlataforma(created_at: string) {
  const days = Math.floor((Date.now() - new Date(created_at).getTime()) / 86_400_000);
  if (days < 1) return 'Hoje';
  if (days < 30) return `${days}d`;
  const m = Math.floor(days / 30);
  return m < 12 ? `${m}m` : `${Math.floor(m / 12)}a`;
}

function getBadges(p: RankedProfessional, maxCoins: number) {
  const sevenAgo = Date.now() - 7 * 86_400_000;
  const badges: { label: string; color: string; bg: string }[] = [];
  if (p.plan) {
    badges.push({ label: `Plano ${PLAN_NAMES[p.plan] ?? p.plan}`, color: C.green, bg: `${C.green}25` });
  }
  if (p.coins > 0 && p.coins === maxCoins) {
    badges.push({ label: '🔥 Top comprador', color: C.amber, bg: `${C.amber}25` });
  }
  if (new Date(p.created_at).getTime() > sevenAgo) {
    badges.push({ label: '✨ Novo', color: C.blue, bg: `${C.blue}25` });
  }
  if (p.coins === 0 && p.payment_count === 0) {
    badges.push({ label: 'Inativo', color: C.red, bg: `${C.red}25` });
  } else if (!p.plan && p.coins > 0) {
    badges.push({ label: 'Potencial', color: C.blue, bg: `${C.blue}25` });
  }
  return badges;
}

// ── Score ring (SVG) ──────────────────────────────────────────────────────────
const R = 28;
const CIRC = 2 * Math.PI * R;

function ScoreRing({ score, size = 70 }: { score: number; size?: number }) {
  const offset = CIRC * (1 - Math.min(score, 100) / 100);
  return (
    <svg width={size} height={size} viewBox="0 0 70 70">
      <circle cx={35} cy={35} r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={5} />
      <circle
        cx={35} cy={35} r={R} fill="none"
        stroke={C.emerald} strokeWidth={5}
        strokeDasharray={CIRC} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 35 35)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={35} y={35} textAnchor="middle" dominantBaseline="central"
        fill={C.text} fontSize={13} fontWeight={700}>{score}</text>
    </svg>
  );
}

// ── Mini progress bar ─────────────────────────────────────────────────────────
function MiniBar({ value, max, color = C.emerald }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'rgba(255,255,255,0.07)',
      animation: 'skeleton-pulse 1.4s ease-in-out infinite',
    }} />
  );
}

function SkeletonPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <style>{`@keyframes skeleton-pulse{0%,100%{opacity:.6}50%{opacity:1}}`}</style>
      <Skeleton h={32} w="40%" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
        {[0,1,2,3].map(i => <Skeleton key={i} h={88} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
        {[0,1,2].map(i => <Skeleton key={i} h={260} />)}
      </div>
      <Skeleton h={320} />
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ p, size = 48 }: { p: RankedProfessional; size?: number }) {
  if (p.avatar_url) {
    return (
      <img src={p.avatar_url} alt={p.full_name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,#1C3454,#0E1C32)',
      border: `2px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.3, fontWeight: 700, color: C.textSec,
    }}>
      {initials(p.full_name)}
    </div>
  );
}

// ── Premiar Modal ─────────────────────────────────────────────────────────────
interface PremiarModalProps {
  professional: RankedProfessional;
  onClose: () => void;
}

function PremiarModal({ professional, onClose }: PremiarModalProps) {
  const qc = useQueryClient();
  const [coins, setCoins] = useState(30);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await adminService.premiarProfissional(professional.user_id, coins, motivo || undefined);
      setSuccess(true);
      void qc.invalidateQueries({ queryKey: ['adminRanking'] });
      setTimeout(onClose, 2000);
    } catch {
      alert('Erro ao premiar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.card, borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '1.5rem', maxWidth: 420, width: '90%',
        }}
      >
        {success ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Prêmio enviado!</div>
            <div style={{ fontSize: 13, color: C.textSec, marginTop: 4 }}>
              {coins} moedas creditadas para {professional.full_name}
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>Premiar profissional</div>
              <div style={{ fontSize: 13, color: C.textSec, marginTop: 3 }}>
                {professional.full_name}
              </div>
            </div>

            {/* Quick coins */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: 12, color: C.textTert, marginBottom: 8, fontWeight: 600 }}>
                Moedas a conceder
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {QUICK_COINS.map(v => (
                  <button
                    key={v}
                    onClick={() => setCoins(v)}
                    style={{
                      padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      background: coins === v ? C.emerald : C.cardSec,
                      color: coins === v ? '#fff' : C.textSec,
                      border: `1px solid ${coins === v ? C.emerald : 'rgba(255,255,255,0.1)'}`,
                      transition: 'all 0.15s',
                    }}
                  >{v}</button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={10000}
                value={coins}
                onChange={e => setCoins(Math.max(1, Math.min(10000, Number(e.target.value))))}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: C.cardSec, border: '1px solid rgba(255,255,255,0.1)',
                  color: C.text, borderRadius: 8, padding: '8px 12px',
                  fontSize: 14, outline: 'none',
                }}
              />
            </div>

            {/* Motivo */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 12, color: C.textTert, marginBottom: 8, fontWeight: 600 }}>
                Motivo (opcional)
              </div>
              <input
                type="text"
                placeholder="Ex: Melhor profissional do mês"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: C.cardSec, border: '1px solid rgba(255,255,255,0.1)',
                  color: C.text, borderRadius: 8, padding: '8px 12px',
                  fontSize: 13, outline: 'none',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: 'transparent', color: C.textSec,
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >Cancelar</button>
              <button
                onClick={() => void handleConfirm()}
                disabled={loading}
                style={{
                  padding: '10px 20px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 700,
                  background: loading ? `${C.emerald}80` : C.emerald, color: '#fff',
                  border: 'none', opacity: loading ? 0.8 : 1,
                }}
              >{loading ? 'Enviando…' : `Premiar ${coins} moedas`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Podium card (top 3) ───────────────────────────────────────────────────────
function PodiumCard({
  p, rank, maxCoins, onPremiar, isMobile = false,
}: {
  p: RankedProfessional;
  rank: number;
  maxCoins: number;
  onPremiar: (p: RankedProfessional) => void;
  isMobile?: boolean;
}) {
  const { grad, medal } = RANK[rank];
  const isFirst = rank === 0;
  const badges = getBadges(p, maxCoins);

  return (
    <div style={{
      background: C.card, borderRadius: 16, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      transform: isFirst && !isMobile ? 'scale(1.03)' : 'none',
      boxShadow: isFirst ? '0 8px 32px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.2)',
      border: `1px solid ${C.border}`,
    }}>
      <div style={{ height: 5, background: grad }} />

      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* header: medal + Premiar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 22 }}>{medal}</span>
          <button
            onClick={() => onPremiar(p)}
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 20,
              background: `${C.gold1}20`, color: C.gold2,
              border: `1px solid ${C.gold1}50`, cursor: 'pointer', fontWeight: 600,
            }}>Premiar</button>
        </div>

        {/* avatar + name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', textAlign: 'center' }}>
          <Avatar p={p} size={isFirst ? 60 : 48} />
          <div>
            <div style={{ fontWeight: 700, fontSize: isFirst ? 15 : 13, color: C.text }}>{p.full_name}</div>
            {p.category && <div style={{ fontSize: 11, color: C.textSec }}>{p.category}</div>}
            {(p.city || p.state) && (
              <div style={{ fontSize: 11, color: C.textTert }}>
                {[p.city, p.state].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </div>

        {/* score ring */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ScoreRing score={p.score} size={isFirst ? 72 : 64} />
        </div>

        {/* 4 mini-cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          {[
            { label: 'Moedas',        value: p.coins.toLocaleString('pt-BR') },
            { label: 'Gasto',         value: `R$${fmtBRL(p.total_spent)}` },
            { label: 'Pagamentos',    value: p.payment_count },
            { label: 'Na plataforma', value: tempoNaPlataforma(p.created_at) },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: C.cardSec, borderRadius: 8, padding: '6px 8px',
              border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 10, color: C.textTert }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{value}</div>
            </div>
          ))}
        </div>

        {/* badges */}
        {badges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {badges.map(b => (
              <span key={b.label} style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 20,
                background: b.bg, color: b.color,
                border: `1px solid ${b.color}40`, fontWeight: 600,
              }}>{b.label}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Ranking() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabId>('score');
  const [premiarTarget, setPremiarTarget] = useState<RankedProfessional | null>(null);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['adminRanking'],
    queryFn: adminService.getRankingProfissionais,
    staleTime: 60_000,
  });

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      if (activeTab === 'coins') return b.coins - a.coins;
      if (activeTab === 'subs')  return (b.plan ? 1 : 0) - (a.plan ? 1 : 0) || b.coins - a.coins;
      if (activeTab === 'spent') return b.total_spent - a.total_spent;
      return b.score - a.score;
    });
  }, [data, activeTab]);

  const maxCoins    = useMemo(() => Math.max(...(sorted).map(p => p.coins), 1), [sorted]);
  const maxPayments = useMemo(() => Math.max(...(sorted).map(p => p.payment_count), 1), [sorted]);
  const maxScore    = useMemo(() => Math.max(...(sorted).map(p => p.score), 1), [sorted]);

  const kpi = useMemo(() => {
    if (!data) return null;
    const totalCoins   = data.reduce((s, p) => s + p.coins, 0);
    const totalRevenue = data.reduce((s, p) => s + p.total_spent, 0);
    const withPlan     = data.filter(p => !!p.plan).length;
    const avgScore     = data.length ? Math.round(data.reduce((s, p) => s + p.score, 0) / data.length) : 0;
    return { totalCoins, totalRevenue, withPlan, avgScore };
  }, [data]);

  // podium order: 2nd(left), 1st(center), 3rd(right) — driven by `sorted`
  const podium      = [sorted[1], sorted[0], sorted[2]].filter(Boolean) as RankedProfessional[];
  const podiumRanks = [1, 0, 2]; // maps podium slot → RANK[] index

  const openPremiar = (p: RankedProfessional) => setPremiarTarget(p);

  if (isLoading) return <SkeletonPage />;

  if (isError) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '1rem', height: 300, color: C.textSec,
    }}>
      <div style={{ fontSize: 14 }}>Erro ao carregar o ranking. Tente novamente.</div>
      <button onClick={() => void refetch()} style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
        background: C.card, color: C.text, border: `1px solid ${C.border}`, fontSize: 13,
      }}>
        <RefreshCw size={14} /> Tentar novamente
      </button>
    </div>
  );

  const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trophy size={20} color={C.gold2} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Ranking de profissionais</h1>
          </div>
          <p style={{ fontSize: 12, color: C.textTert, margin: '3px 0 0' }}>
            {sorted.length} profissionais · atualizado em {now}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: `${C.green}15`, border: `1px solid ${C.green}40`,
            borderRadius: 20, padding: '4px 10px',
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', background: C.green,
              boxShadow: `0 0 6px ${C.green}`,
              animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
            }} />
            <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>Tempo real</span>
          </div>
          <button onClick={() => void refetch()} style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
            background: C.card, color: C.textSec, border: `1px solid ${C.border}`, fontSize: 12,
          }}>
            {isFetching ? <LoadingLogo size={16} showLabel={false} /> : <RefreshCw size={13} />} Atualizar
          </button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '6px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: active ? C.emerald : C.card,
              color: active ? '#fff' : C.textSec,
              border: `1px solid ${active ? C.emerald : C.border}`,
              transition: 'all 0.2s',
            }}>{tab.label}</button>
          );
        })}
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      {kpi && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem' }}>
          {[
            { label: 'Moedas ativas (total)', value: kpi.totalCoins.toLocaleString('pt-BR'), sub: 'saldo somado de todos' },
            { label: 'Receita total',          value: `R$ ${fmtBRL(kpi.totalRevenue)}`,      sub: 'payments com status paid' },
            { label: 'Com plano ativo',        value: `${kpi.withPlan} / ${sorted.length}`,  sub: 'active + canceling' },
            { label: 'Score médio',            value: kpi.avgScore.toString(),               sub: 'média da plataforma' },
          ].map(({ label, value, sub }) => (
            <div key={label} style={{
              background: C.card, borderRadius: 12, padding: '1rem',
              border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: 11, color: C.textTert, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{value}</div>
              <div style={{ fontSize: 11, color: C.textTert, marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pódio top 3 ─────────────────────────────────────────────────── */}
      {sorted.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textSec, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Pódio
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: '1rem', alignItems: isMobile ? 'stretch' : 'end' }}>
            {podium.map((p, i) => (
              <PodiumCard
                key={p.user_id}
                p={p}
                rank={podiumRanks[i]}
                maxCoins={maxCoins}
                onPremiar={openPremiar}
                isMobile={isMobile}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Tabela completa ──────────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textSec, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
          Ranking completo
        </div>

        {sorted.length === 0 ? (
          <div style={{
            background: C.card, borderRadius: 12, padding: '3rem', textAlign: 'center',
            border: `1px solid ${C.border}`, color: C.textSec, fontSize: 14,
          }}>
            Nenhum profissional cadastrado ainda.
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sorted.map((p, idx) => {
              const badges = getBadges(p, maxCoins);
              return (
                <div key={p.user_id} style={{
                  background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
                  padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
                }}>
                  {/* header: posição + avatar + nome + categoria/cidade */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: idx < 3 ? C.gold2 : C.textTert, width: 20, flexShrink: 0, textAlign: 'center' }}>
                      {idx < 3 ? RANK[idx].medal : idx + 1}
                    </div>
                    <Avatar p={p} size={36} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.full_name}
                      </div>
                      <div style={{ fontSize: 11, color: C.textTert, display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {p.category && <span>{p.category}</span>}
                        {p.city && <span>· {p.city}</span>}
                      </div>
                    </div>
                  </div>

                  {badges.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {badges.map(b => (
                        <span key={b.label} style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 20,
                          background: b.bg, color: b.color, fontWeight: 600,
                        }}>{b.label}</span>
                      ))}
                    </div>
                  )}

                  {/* corpo: score, moedas, pagamentos, plano */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, color: C.textTert, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{p.score}</span>
                      <MiniBar value={p.score} max={maxScore} color={C.emerald} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, color: C.textTert, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Moedas</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.coins.toLocaleString('pt-BR')}</span>
                      <MiniBar value={p.coins} max={maxCoins} color={C.amber} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, color: C.textTert, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pagamentos</span>
                      <span style={{ fontSize: 13, color: C.text }}>{p.payment_count}</span>
                      <MiniBar value={p.payment_count} max={maxPayments} color={C.blue} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, color: C.textTert, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plano</span>
                      {p.plan ? (
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, alignSelf: 'flex-start',
                          background: `${C.green}20`, color: C.green, border: `1px solid ${C.green}40`,
                        }}>{PLAN_NAMES[p.plan] ?? p.plan}</span>
                      ) : (
                        <span style={{ fontSize: 11, color: C.textTert }}>—</span>
                      )}
                    </div>
                  </div>

                  {/* ação */}
                  <button
                    onClick={() => openPremiar(p)}
                    style={{
                      fontSize: 12, padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                      background: `${C.gold1}20`, color: C.gold2,
                      border: `1px solid ${C.gold1}40`, fontWeight: 600, width: '100%',
                    }}>Premiar</button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 640 }}>
            {/* thead */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 80px 100px 100px 90px 90px',
              padding: '10px 16px',
              background: C.cardSec,
              borderBottom: `1px solid ${C.border}`,
            }}>
              {['#', 'Profissional', 'Score', 'Moedas', 'Pagamentos', 'Plano', 'Ação'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: C.textTert, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
              ))}
            </div>

            {/* rows */}
            {sorted.map((p, idx) => {
              const badges = getBadges(p, maxCoins);
              return (
                <div key={p.user_id} style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 80px 100px 100px 90px 90px',
                  padding: '10px 16px', alignItems: 'center',
                  borderBottom: idx < sorted.length - 1 ? `1px solid ${C.border}` : 'none',
                  transition: 'background 0.15s',
                }}>
                  {/* # */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: idx < 3 ? C.gold2 : C.textTert }}>
                    {idx < 3 ? RANK[idx].medal : idx + 1}
                  </div>

                  {/* profissional */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                    <Avatar p={p} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.full_name}
                      </div>
                      <div style={{ fontSize: 11, color: C.textTert, display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {p.category && <span>{p.category}</span>}
                        {p.city && <span>· {p.city}</span>}
                        {badges.map(b => (
                          <span key={b.label} style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 20,
                            background: b.bg, color: b.color, fontWeight: 600,
                          }}>{b.label}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* score */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{p.score}</span>
                    <MiniBar value={p.score} max={maxScore} color={C.emerald} />
                  </div>

                  {/* moedas */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.coins.toLocaleString('pt-BR')}</span>
                    <MiniBar value={p.coins} max={maxCoins} color={C.amber} />
                  </div>

                  {/* pagamentos */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 13, color: C.text }}>{p.payment_count}</span>
                    <MiniBar value={p.payment_count} max={maxPayments} color={C.blue} />
                  </div>

                  {/* plano */}
                  <div>
                    {p.plan ? (
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                        background: `${C.green}20`, color: C.green, border: `1px solid ${C.green}40`,
                      }}>{PLAN_NAMES[p.plan] ?? p.plan}</span>
                    ) : (
                      <span style={{ fontSize: 11, color: C.textTert }}>—</span>
                    )}
                  </div>

                  {/* ação */}
                  <div>
                    <button
                      onClick={() => openPremiar(p)}
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        background: `${C.gold1}20`, color: C.gold2,
                        border: `1px solid ${C.gold1}40`, fontWeight: 600,
                      }}>Premiar</button>
                  </div>
                </div>
              );
            })}
            </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Rodapé / legenda ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
        padding: '0.75rem 1rem', background: C.card, borderRadius: 10,
        border: `1px solid ${C.border}`, fontSize: 12, color: C.textSec,
      }}>
        <span style={{ fontWeight: 600, color: C.textTert }}>Fórmula do score:</span>
        {[
          { color: C.emerald, label: 'Moedas 50%'     },
          { color: C.blue,    label: 'Pagamentos 30%' },
          { color: C.green,   label: 'Plano ativo 20%'},
        ].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>

      {/* ── Premiar Modal ────────────────────────────────────────────────── */}
      {premiarTarget && (
        <PremiarModal
          professional={premiarTarget}
          onClose={() => setPremiarTarget(null)}
        />
      )}

      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(1.6); opacity: 0; } }
      `}</style>
    </div>
  );
}
