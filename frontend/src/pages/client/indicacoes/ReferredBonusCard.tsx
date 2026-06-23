import { Star } from 'lucide-react'
import { t, cardBase } from './constants'

export default function ReferredBonusCard() {
  return (
    <div style={{ ...cardBase, borderTop: '3px solid #f59e0b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <Star size={15} color="#f59e0b" />
        <span style={{ fontSize: '14px', fontWeight: 700, color: t.text }}>Seu indicado também ganha</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#0d1929', borderRadius: '8px', border: '1px solid #1C3050' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>20</div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: t.text }}>moedas de boas-vindas</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>ao se cadastrar pelo seu link</div>
        </div>
      </div>
      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>
        = R$0,20 de crédito para usar na plataforma
      </div>
    </div>
  )
}
