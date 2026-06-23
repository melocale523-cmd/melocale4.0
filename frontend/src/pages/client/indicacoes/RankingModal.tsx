import { X } from 'lucide-react'
import { t, getAvatarInfo, RankingItem } from './constants'

interface Props {
  show: boolean
  onClose: () => void
  ranking: RankingItem[]
}

export default function RankingModal({ show, onClose, ranking }: Props) {
  if (!show) return null

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ background: '#132236', border: '1px solid #1C3050', borderRadius: '1rem', padding: '1.5rem', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>🏆 Top indicadores do mês</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {ranking.slice(0, 100).map((r, i) => {
            const { initials, colorClass } = getAvatarInfo(r.full_name || 'U')
            return (
              <div key={r.user_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${t.border}` }}>
                <span style={{ fontSize: '16px', width: '28px', textAlign: 'center' }}>{medals[i] ?? `${i + 1}º`}</span>
                <div className={`${colorClass} w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0`}>{initials}</div>
                <span style={{ flex: 1, fontSize: '13px', color: t.text, fontWeight: 500 }}>{r.full_name || 'Usuário'}</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: t.accent, fontWeight: 700 }}>{r.total_earned} pts</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
