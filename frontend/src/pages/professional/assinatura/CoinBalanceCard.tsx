import TransactionHistory from './TransactionHistory';
import { PLAN_NAMES } from './constants';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  description: string;
  amount: number;
  created_at: string;
}

interface Props {
  balanceNum: number;
  balanceLoading: boolean;
  costPerCoin: number;
  hasActivePlan: boolean;
  currentSubscriptionPackageId?: string;
  recentTransactions: Transaction[] | undefined;
  isTransactionsLoading: boolean;
  onNavigateToCarteira: () => void;
}

export default function CoinBalanceCard({
  balanceNum,
  balanceLoading,
  costPerCoin,
  hasActivePlan,
  currentSubscriptionPackageId,
  recentTransactions,
  isTransactionsLoading,
  onNavigateToCarteira,
}: Props) {
  return (
    <div style={{ background: 'linear-gradient(145deg,#0a1928,#0e2038,#110d2a)', border: '1px solid rgba(250,177,68,.2)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#f59e0b,#d97706)', borderRadius: '18px 18px 0 0' }} />
      <div style={{ position: 'absolute', top: -40, left: -40, width: 160, height: 160, background: 'radial-gradient(circle,rgba(250,177,68,.08),transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -40, right: -40, width: 160, height: 160, background: 'radial-gradient(circle,rgba(16,185,129,.06),transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,.06)', position: 'relative' }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4A6580', marginBottom: 4 }}>Saldo de Moedas</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 48, fontWeight: 900, lineHeight: 1, letterSpacing: '-2px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b,#d97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {balanceLoading ? '...' : balanceNum}
          </p>
          <span style={{ fontSize: 14, color: '#f59e0b', fontWeight: 700 }}>moedas</span>
        </div>
        <p style={{ fontSize: 12, color: '#4A6580', marginTop: 4 }}>≈ R$ {(balanceNum * costPerCoin).toFixed(2)} em leads com seu plano atual</p>
      </div>

      <div style={{ padding: '1rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4A6580', marginBottom: 8 }}>Custo por moeda nas suas {balanceNum} moedas</p>
          {[
            { label: hasActivePlan && currentSubscriptionPackageId ? `${PLAN_NAMES[currentSubscriptionPackageId]} (você)` : 'Sem plano (você)', cost: costPerCoin, color: hasActivePlan ? '#34d399' : '#f87171', tag: 'você' },
            { label: 'Com PRO — 40% off', cost: 0.249, color: '#6ee7b7', tag: null },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: i === 0 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{item.label}</span>
                {item.tag && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'rgba(16,185,129,.12)', color: '#34d399', border: '1px solid rgba(16,185,129,.2)' }}>você</span>}
              </div>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 500, color: item.color }}>R${item.cost.toFixed(3)}/moeda</span>
            </div>
          ))}
          {!hasActivePlan && balanceNum > 0 && (
            <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(251,191,36,.08)', borderRadius: 8, border: '1px solid rgba(251,191,36,.15)' }}>
              <p style={{ fontSize: 11, color: '#fbbf24' }}>💡 Com PRO você economizaria R$ {((0.415 - 0.249) * balanceNum).toFixed(2)} nas suas moedas atuais</p>
            </div>
          )}
        </div>

        <TransactionHistory transactions={recentTransactions} isLoading={isTransactionsLoading} />
      </div>

      <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <button onClick={onNavigateToCarteira} style={{ width: '100%', height: 42, background: 'linear-gradient(135deg,rgba(250,177,68,.15),rgba(217,119,6,.1))', border: '1px solid rgba(250,177,68,.25)', borderRadius: 12, color: '#fbbf24', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          🪙 Comprar Moedas Agora
        </button>
        <a href="/profissional/carteira" style={{ display: 'block', textAlign: 'center', marginTop: 8, fontSize: 12, color: '#4A6580', textDecoration: 'none' }}>Ver histórico completo →</a>
      </div>
    </div>
  );
}
