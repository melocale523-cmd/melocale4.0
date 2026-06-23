import { BarChart2 } from 'lucide-react'
import { t, cardBase, kpiCard, ReferralCode } from './constants'

interface Props {
  referralData: ReferralCode | undefined
  isMobile: boolean
  isPro: boolean
  totalEarned: number
  baseReward: number
}

export default function ReferralResultsCard({ referralData, isMobile, isPro, totalEarned, baseReward }: Props) {
  return (
    <div style={cardBase}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <BarChart2 size={17} color={t.accent} />
        <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Seus resultados</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: '10px' }}>
        <div style={kpiCard}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.5rem', fontWeight: 700, color: t.text }}>
            {referralData?.stats.total ?? 0}
          </span>
          <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.muted }}>Indicados</span>
        </div>
        <div style={kpiCard}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>
            {referralData?.stats.converted ?? 0}
          </span>
          <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.muted }}>Ativos</span>
        </div>
        <div style={kpiCard}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.5rem', fontWeight: 700, color: t.accent }}>
            {isPro ? totalEarned : `R$${(totalEarned / 3).toFixed(0)}`}
          </span>
          <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.muted }}>Ganhos</span>
        </div>
      </div>
    </div>
  )
}
