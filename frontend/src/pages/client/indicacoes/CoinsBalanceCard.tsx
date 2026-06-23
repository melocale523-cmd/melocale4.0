import { CoinsData, ReferralCode } from './constants'

interface Props {
  coinsData: CoinsData | undefined
  totalWithdrawn: number
  referralData: ReferralCode | undefined
  hasPendingWithdrawal: boolean
  onWithdraw: () => void
}

export default function CoinsBalanceCard({ coinsData, totalWithdrawn, referralData, hasPendingWithdrawal, onWithdraw }: Props) {
  const balance = coinsData?.balance ?? 0

  return (
    <div style={{ background: '#0d1e33', border: '1px solid #1e3a5f', borderRadius: '1rem', overflow: 'hidden' }}>
      <div style={{ height: '2px', background: 'linear-gradient(90deg, #10b981, #059669)' }} />
      <div style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '15px' }}>🪙</span>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748b' }}>SUAS MOEDAS</span>
          </div>
          {balance >= 1000 ? (
            <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16,185,129,0.12)', borderRadius: '999px', padding: '3px 8px', fontWeight: 600 }}>Saldo disponível</span>
          ) : (
            <span style={{ fontSize: '11px', color: '#f59e0b', background: 'rgba(245,158,11,0.12)', borderRadius: '999px', padding: '3px 8px', fontWeight: 600 }}>Saque indisponível</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '42px', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>
            {balance.toLocaleString('pt-BR')}
          </span>
          <span style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>moedas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '16px' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>
            R${(balance / 100).toFixed(2).replace('.', ',')}
          </span>
          <span style={{ fontSize: '12px', color: '#475569' }}>em reais</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          {[
            { label: 'Ganhas total', value: (coinsData?.total_earned ?? 0).toLocaleString('pt-BR') },
            { label: 'Já sacadas', value: totalWithdrawn.toLocaleString('pt-BR') },
            { label: 'Indicações', value: String(referralData?.stats.total ?? 0) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#0a1928', borderRadius: '0.625rem', padding: '0.75rem' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>{value}</div>
            </div>
          ))}
          <div style={{ background: '#0a1928', borderRadius: '0.625rem', padding: '0.75rem' }}>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '4px' }}>Mín. p/ saque</div>
            {balance >= 1000 ? (
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '16px', fontWeight: 700, color: '#10b981' }}>✓ OK</div>
            ) : (
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>
                Faltam {(1000 - balance).toLocaleString('pt-BR')}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onWithdraw}
          disabled={balance < 1000 || hasPendingWithdrawal}
          style={{
            width: '100%', background: '#10b981', color: '#fff', border: 'none',
            borderRadius: '0.75rem', padding: '12px 0', fontSize: '14px', fontWeight: 700,
            cursor: balance < 1000 || hasPendingWithdrawal ? 'not-allowed' : 'pointer',
            opacity: balance < 1000 || hasPendingWithdrawal ? 0.4 : 1,
            fontFamily: 'DM Sans, sans-serif', transition: 'opacity .2s',
          }}
        >
          {hasPendingWithdrawal ? '⏳ Saque em andamento' : 'Sacar via Pix'}
        </button>
      </div>
    </div>
  )
}
