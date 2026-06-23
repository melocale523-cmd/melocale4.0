import { t } from './constants'

interface Props {
  balanceLabel: string
}

export default function ReferralBalanceHighlight({ balanceLabel }: Props) {
  return (
    <div style={{
      background: '#0b2818', border: `1px solid ${t.accent}`,
      borderRadius: '1rem', padding: '1.25rem', fontFamily: 'DM Sans, sans-serif',
    }}>
      <p style={{ fontSize: '13px', fontWeight: 700, color: t.accent, margin: '0 0 8px' }}>💰 Saldo de indicações</p>
      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.75rem', fontWeight: 700, color: t.accent, margin: '0 0 4px' }}>
        {balanceLabel}
      </p>
      <p style={{ fontSize: '11px', color: '#4ade80', margin: 0 }}>
        Crédito aplicado no próximo pedido automaticamente.
      </p>
    </div>
  )
}
