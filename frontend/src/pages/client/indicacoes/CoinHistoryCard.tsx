import { BarChart2 } from 'lucide-react'
import { t, cardBase, kindLabel, CoinTx } from './constants'

interface Props {
  coinHistory: CoinTx[]
}

export default function CoinHistoryCard({ coinHistory }: Props) {
  const visible = coinHistory.slice(0, 10)

  return (
    <div style={cardBase}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <BarChart2 size={17} color={t.accent} />
        <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Histórico de moedas</span>
        <span style={{ marginLeft: 'auto', background: t.border, color: t.muted, fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontFamily: 'DM Mono, monospace' }}>
          {coinHistory.length}
        </span>
      </div>
      {visible.map((tx, i) => {
        const { icon, label } = kindLabel(tx.kind)
        const isCredit = tx.amount > 0
        return (
          <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < visible.length - 1 ? `1px solid ${t.border}` : 'none' }}>
            <span style={{ fontSize: '16px', width: '24px', textAlign: 'center' }}>{icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', color: t.text, fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: '10px', color: t.muted }}>
                {new Date(tx.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 700, color: isCredit ? t.accent : '#f87171' }}>
              {isCredit ? '+' : ''}{tx.amount}
            </span>
          </div>
        )
      })}
    </div>
  )
}
