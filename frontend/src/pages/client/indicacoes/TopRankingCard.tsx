import { Trophy } from 'lucide-react'
import { t, cardBase, getAvatarInfo, RankingItem } from './constants'

interface Props {
  ranking: RankingItem[]
  onShowAll: () => void
}

export default function TopRankingCard({ ranking, onShowAll }: Props) {
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div style={{ ...cardBase, borderTop: '3px solid #f59e0b', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Trophy size={17} color="#f59e0b" />
        <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Top indicadores do mês</span>
        <button
          onClick={onShowAll}
          style={{ marginLeft: 'auto', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '6px', padding: '4px 10px', fontSize: '11px', color: t.muted, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
        >
          Ver todos →
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {ranking.slice(0, 3).map((r, i) => {
          const { initials, colorClass } = getAvatarInfo(r.full_name || 'U')
          return (
            <div key={r.user_id} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '8px 10px' }}>
              <span style={{ fontSize: '16px' }}>{medals[i]}</span>
              <div className={`${colorClass} w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0`}>{initials}</div>
              <span style={{ flex: 1, fontSize: '12px', color: t.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.full_name || 'Usuário'}</span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: t.accent, fontWeight: 700 }}>{r.total_earned}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
