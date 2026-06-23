import { Coins } from 'lucide-react'
import { t, cardBase, WithdrawalHistoryItem } from './constants'

interface Props {
  withdrawalHistory: WithdrawalHistoryItem[]
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: 'rgba(234,179,8,0.1)',   color: '#fde047', label: '⏳ Pendente'  },
  approved: { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa', label: '✅ Aprovado'  },
  paid:     { bg: 'rgba(52,211,153,0.1)',  color: '#34d399', label: '💸 Pago'       },
  rejected: { bg: 'rgba(248,113,113,0.1)', color: '#f87171', label: '❌ Rejeitado' },
}

export default function WithdrawalHistoryTable({ withdrawalHistory }: Props) {
  return (
    <div style={{ ...cardBase, marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <Coins size={17} color={t.muted} />
        <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Histórico de saques</span>
        <span style={{ marginLeft: 'auto', background: t.border, color: t.muted, fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontFamily: 'DM Mono, monospace' }}>
          {withdrawalHistory.length}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
              {['Data', 'Moedas', 'Valor R$', 'Chave Pix', 'Status', 'Nota'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: t.muted, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withdrawalHistory.map((w, i) => {
              const s = STATUS_COLORS[w.status] ?? STATUS_COLORS.pending
              return (
                <tr key={w.id} style={{ borderBottom: i < withdrawalHistory.length - 1 ? `1px solid rgba(255,255,255,0.05)` : 'none' }}>
                  <td style={{ padding: '8px 10px', color: t.muted, whiteSpace: 'nowrap' }}>
                    {new Date(w.requested_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  <td style={{ padding: '8px 10px', fontFamily: 'DM Mono, monospace', color: t.text, fontWeight: 700 }}>
                    {w.coins_amount.toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '8px 10px', fontFamily: 'DM Mono, monospace', color: '#1D9E75', fontWeight: 700 }}>
                    R${(w.brl_amount ?? (w.coins_amount / 100)).toFixed(2).replace('.', ',')}
                  </td>
                  <td style={{ padding: '8px 10px', color: t.subtle, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px' }}>{w.pix_key}</span>
                    <span style={{ marginLeft: '4px', fontSize: '9px', color: t.muted, background: t.input, padding: '1px 5px', borderRadius: '4px' }}>{w.pix_key_type}</span>
                  </td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    <span style={{ background: s.bg, color: s.color, fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px' }}>
                      {s.label}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', color: t.muted, fontSize: '11px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.admin_note ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
