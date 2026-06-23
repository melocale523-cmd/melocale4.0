import { Coins } from 'lucide-react'
import { t, cardBase, HOW_TO_EARN_ACTIONS } from './constants'

interface Props {
  isMobile: boolean
}

export default function HowToEarnCard({ isMobile }: Props) {
  return (
    <div style={{ ...cardBase, marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Coins size={17} color={t.accent} />
        <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Como ganhar moedas</span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: t.muted }}>100 moedas = R$1,00 · mín. 1.000 para sacar</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: '8px' }}>
        {HOW_TO_EARN_ACTIONS.map(({ icon, label, coins }) => (
          <div key={label} style={{ background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', marginBottom: '6px' }}>{icon}</div>
            <div style={{ fontSize: '11px', color: t.text, fontWeight: 600, marginBottom: '6px', lineHeight: 1.3 }}>{label}</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: t.accent, fontWeight: 700, background: '#0b2818', border: '1px solid #10b98140', borderRadius: '999px', padding: '2px 8px', display: 'inline-block' }}>+{coins}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
