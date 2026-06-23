import { Gift } from 'lucide-react'
import { t, cardBase, BONUS_TIERS } from './constants'

export default function BonusTiersCard() {
  return (
    <div style={{ ...cardBase, borderTop: '3px solid #f59e0b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <Gift size={17} color="#f59e0b" />
        <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Tiers de bônus</span>
      </div>
      {BONUS_TIERS.map(({ label, range, bonus, bg, border, color }) => (
        <div key={label} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 10px', borderRadius: '8px', marginBottom: '6px',
          background: bg, border: `1px solid ${border}`,
        }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color }}>{label}</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: t.text, fontWeight: 600 }}>{bonus}</div>
            <div style={{ fontSize: '10px', color: t.muted }}>{range}</div>
          </div>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${t.border}`, marginTop: '6px', paddingTop: '8px', fontSize: '11px', color: t.muted, textAlign: 'center' }}>
        Quanto mais indica, mais ganha por indicação
      </div>
    </div>
  )
}
