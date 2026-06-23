import { Target } from 'lucide-react'
import { t, cardBase, MonthlyStats } from './constants'

interface Props {
  monthlyStats: MonthlyStats | undefined
}

export default function MonthlyMissionCard({ monthlyStats }: Props) {
  const total = monthlyStats?.total_this_month ?? 0
  const goal = monthlyStats?.goal ?? 5
  const progress = Math.min((total / goal) * 100, 100)

  return (
    <div style={{ ...cardBase, borderTop: '3px solid #7c3aed' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <Target size={15} color="#a78bfa" />
        <span style={{ fontSize: '14px', fontWeight: 700, color: t.text }}>Missão do mês</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#a78bfa' }}>
          {total}/{goal}
        </span>
      </div>
      <div style={{ background: '#1C3050', borderRadius: '100px', height: '6px', marginBottom: '8px' }}>
        <div style={{ background: monthlyStats?.bonus_credited ? '#10b981' : '#7c3aed', borderRadius: '100px', height: '6px', width: `${progress}%`, transition: 'width .5s' }} />
      </div>
      {monthlyStats?.bonus_credited ? (
        <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>✅ Bônus de {monthlyStats.bonus_coins} moedas creditado!</div>
      ) : (
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Indique {Math.max(goal - total, 0)} pessoas esse mês e ganhe{' '}
          <span style={{ color: '#a78bfa', fontWeight: 700 }}>{monthlyStats?.bonus_coins ?? 500} moedas bônus</span>
        </div>
      )}
    </div>
  )
}
