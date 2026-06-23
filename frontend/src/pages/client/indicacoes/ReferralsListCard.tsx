import { Users, Gift } from 'lucide-react'
import { t, cardBase, getAvatarInfo, ReferralItem } from './constants'

interface Props {
  referrals: ReferralItem[]
  isListLoading: boolean
  isPro: boolean
  baseReward: number
}

export default function ReferralsListCard({ referrals, isListLoading, isPro, baseReward }: Props) {
  return (
    <div style={cardBase}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <Users size={17} color={t.accent} />
        <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Suas indicações</span>
        {referrals.length > 0 && (
          <span style={{
            marginLeft: 'auto', background: t.border, color: t.muted,
            fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontFamily: 'DM Mono, monospace',
          }}>
            {referrals.length}
          </span>
        )}
      </div>

      {isListLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '48px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : referrals.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0', textAlign: 'center', gap: '10px' }}>
          <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Gift size={24} color={t.border} />
          </div>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', fontWeight: 500, margin: 0 }}>Nenhuma indicação ainda.</p>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', margin: 0 }}>Compartilhe seu link e comece a ganhar!</p>
        </div>
      ) : (
        <div>
          {referrals.map((r) => {
            const name = r.referred_name || 'Usuário'
            const { initials, colorClass } = getAvatarInfo(name)
            const isCredited = r.status === 'credited'
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: `1px solid ${t.border}` }}>
                <div className={`${colorClass} w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: t.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                  <p style={{ fontSize: '11px', color: t.muted, margin: 0 }}>
                    {isCredited ? 'Ativo' : 'Pendente'}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {isCredited ? (
                    <span style={{ fontFamily: 'DM Mono, monospace', color: t.accent, fontSize: '13px', fontWeight: 700 }}>
                      +{isPro ? `${r.reward_amount || baseReward}` : `R$${((r.reward_amount || baseReward) / 3).toFixed(0)}`}
                    </span>
                  ) : (
                    <span style={{ color: t.muted, fontSize: '11px' }}>Aguardando</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
