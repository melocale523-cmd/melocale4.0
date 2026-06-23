import { Zap } from 'lucide-react'
import { t, BonusConfig } from './constants'

interface Props {
  rewardLabel: string
  rewardDesc: string
  hasDoubleBonus: boolean
  bonusConfig: BonusConfig | undefined
}

export default function IndicacoesHeader({ rewardLabel, rewardDesc, hasDoubleBonus, bonusConfig }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
      <div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: t.accentBg, border: `1px solid ${t.accentBorder}`,
          borderRadius: '999px', padding: '4px 12px', marginBottom: '12px',
        }}>
          <span style={{ fontSize: '14px', lineHeight: 1 }}>🎁</span>
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: t.accent }}>
            Programa de Indicações
          </span>
        </div>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 900, color: t.text, margin: '0 0 8px' }}>
          Indique e Ganhe
        </h1>
        <p style={{ color: t.muted, fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
          Compartilhe seu link. Quando seu indicado ativar, você recebe{' '}
          <span style={{ color: t.accent, fontWeight: 700 }}>{rewardLabel}</span>{' '}
          {rewardDesc}.
        </p>
      </div>

      {hasDoubleBonus && (
        <div style={{
          flexShrink: 0,
          background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)',
          borderRadius: '1rem', padding: '12px 16px', textAlign: 'center',
        }}>
          <div style={{ color: '#facc15', fontSize: '11px', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={11} style={{ fill: '#facc15' }} /> Bônus {bonusConfig!.multiplier}×
          </div>
          <div style={{ color: '#fde047', fontSize: '10px', marginTop: '2px' }}>
            {bonusConfig?.label ?? 'ativo agora!'}
          </div>
          {bonusConfig?.expires_at && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', marginTop: '2px' }}>
              até {new Date(bonusConfig.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
