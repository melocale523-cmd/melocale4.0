import { Info, Link2 } from 'lucide-react'
import React from 'react'
import { t, cardBase } from './constants'

interface Props {
  isPro: boolean
  rewardLabel: string
}

export default function HowItWorksCard({ isPro, rewardLabel }: Props) {
  const steps = [
    {
      step: '1',
      title: 'Compartilhe seu link',
      desc: `Envie para outros ${isPro ? 'profissionais' : 'clientes'} pelo WhatsApp, Instagram ou onde quiser.`,
      circleStyle: { background: t.accent, color: '#fff' } as React.CSSProperties,
      isIcon: false,
    },
    {
      step: '2',
      title: 'Indicado se cadastra',
      desc: 'Quando alguém criar conta com seu link, você aparece no nosso radar.',
      circleStyle: { background: t.accent, color: '#fff' } as React.CSSProperties,
      isIcon: false,
    },
    {
      step: '3',
      title: `Você ganha ${rewardLabel}`,
      desc: isPro
        ? 'Assim que o indicado assinar qualquer plano, as moedas caem na sua carteira.'
        : 'Quando o indicado fizer o primeiro pedido, o crédito é adicionado.',
      circleStyle: { background: t.accent, color: '#fff' } as React.CSSProperties,
      isIcon: false,
    },
    {
      step: 'link',
      title: 'Bônus em cascata',
      desc: 'Quando seu indicado indica alguém, você ganha mais automaticamente!',
      circleStyle: { background: 'rgba(124,58,237,0.15)', color: '#a78bfa' } as React.CSSProperties,
      isIcon: true,
    },
  ]

  return (
    <div style={cardBase}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <Info size={17} color={t.accent} />
        <span style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Como funciona</span>
      </div>
      <div>
        {steps.map(({ step, title, desc, circleStyle, isIcon }) => (
          <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 0', borderBottom: `1px solid ${t.border}` }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: '2px', fontSize: '11px', fontWeight: 700,
              ...circleStyle,
            }}>
              {isIcon ? <Link2 size={11} /> : step}
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: t.text, margin: '0 0 3px' }}>{title}</p>
              <p style={{ fontSize: '11px', color: t.muted, margin: 0, lineHeight: 1.5 }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
