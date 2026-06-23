import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from './constants';

interface Props {
  buyingId: string | null;
  onSubscribe: (planId: string) => void;
  isMobile: boolean;
}

const SubscriptionPlansSection = forwardRef<HTMLDivElement, Props>(({ buyingId, onSubscribe, isMobile }, ref) => {
  return (
    <div ref={ref} style={{ marginTop: '2rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, color: 'white', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          ✨ Planos de Pagamento Recorrente
        </h2>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4A6580' }}>
          Desconto automático em todas as compras de moedas enquanto o plano estiver ativo.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, alignItems: 'start' }}>
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isPopular = plan.popular;
          const borderColor = isPopular ? 'rgba(16,185,129,.35)' : plan.color === 'blue' ? 'rgba(55,138,221,.18)' : 'rgba(250,177,68,.2)';
          const topGradient = isPopular ? 'linear-gradient(90deg,#10b981,#059669)' : plan.color === 'blue' ? 'linear-gradient(90deg,#378ADD,#1d6fa8)' : 'linear-gradient(90deg,#f59e0b,#d97706)';
          const btnBg = isPopular ? 'linear-gradient(135deg,#10b981,#059669)' : plan.color === 'blue' ? 'linear-gradient(135deg,#378ADD,#1d6fa8)' : 'linear-gradient(135deg,#f59e0b,#d97706)';
          const btnShadow = isPopular ? '0 4px 20px rgba(16,185,129,.3)' : plan.color === 'blue' ? '0 4px 20px rgba(55,138,221,.2)' : '0 4px 20px rgba(245,158,11,.2)';
          const accentColor = isPopular ? '#34d399' : plan.color === 'blue' ? '#60a5fa' : '#fbbf24';
          const bgGradient = isPopular ? 'linear-gradient(145deg,#071e30,#0a2a1a)' : plan.color === 'blue' ? 'linear-gradient(145deg,#071e30,#0a1e35)' : 'linear-gradient(145deg,#1a1200,#0e2038)';
          const glowColor = isPopular ? 'rgba(16,185,129,.06)' : plan.color === 'blue' ? 'rgba(55,138,221,.06)' : 'rgba(245,158,11,.06)';
          const pack200cost = plan.id === 'plan_basic' ? '44,93' : plan.id === 'plan_pro' ? '35,94' : '26,96';
          return (
            <div key={plan.id} style={{ background: bgGradient, border: `1px solid ${borderColor}`, borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', transition: 'transform .25s', marginTop: isMobile ? 0 : isPopular ? 0 : 16 }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: topGradient }} />
              <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, background: `radial-gradient(circle,${glowColor},transparent 70%)`, pointerEvents: 'none' }} />
              {isPopular && (
                <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 14px', borderRadius: '0 0 10px 10px', whiteSpace: 'nowrap', zIndex: 1 }}>
                  🔥 Mais Popular — Melhor ROI
                </div>
              )}
              <div style={{ padding: '1.5rem', paddingTop: isPopular ? '2rem' : '1.5rem' }}>
                <div style={{ display: 'inline-block', background: `rgba(${isPopular ? '16,185,129' : plan.color === 'blue' ? '55,138,221' : '245,158,11'},.12)`, color: accentColor, border: `1px solid ${borderColor}`, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, marginBottom: 8 }}>
                  {plan.discount} OFF
                </div>
                <p style={{ fontSize: 20, fontWeight: 900, color: 'white', marginBottom: 2 }}>{plan.name}</p>
                <p style={{ fontSize: 11, color: '#4A6580', marginBottom: 12 }}>{plan.description}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>R$</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 36, fontWeight: 900, color: 'white', lineHeight: 1 }}>{plan.price}</span>
                  <span style={{ fontSize: 12, color: '#4A6580' }}>/mês</span>
                </div>
                <p style={{ fontSize: 12, color: accentColor, marginBottom: 4 }}>= R$ {(parseFloat(plan.price) / 30).toFixed(2)}/dia</p>
                <div style={{ marginBottom: 14 }}>
                  <span style={{ background: 'rgba(250,177,68,.1)', color: '#fbbf24', border: '1px solid rgba(250,177,68,.2)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    🎁 {plan.welcomeCoins} moedas de boas-vindas
                  </span>
                </div>
                <button
                  disabled={!!buyingId}
                  onClick={() => onSubscribe(plan.id)}
                  style={{ width: '100%', height: 44, background: btnBg, border: 'none', borderRadius: 12, color: plan.color === 'yellow' ? '#000' : 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: btnShadow, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: buyingId ? .5 : 1 }}
                >
                  {buyingId === plan.id ? <Loader2 size={14} className="animate-spin" /> :
                    isPopular ? 'Quero receber clientes agora →' :
                    plan.color === 'blue' ? 'Quero começar agora →' :
                    'Quero dominar minha região →'}
                </button>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {plan.features.map((feature, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#94a3b8' }}>
                      <span style={{ color: accentColor, flexShrink: 0, marginTop: 1 }}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div style={{ background: 'rgba(0,0,0,.3)', border: `1px solid ${borderColor}`, borderRadius: 10, padding: '10px 12px' }}>
                  <p style={{ fontSize: 11, color: '#4A6580', marginBottom: 2 }}>Pac. 200 moedas com este plano:</p>
                  <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: accentColor }}>R$ {pack200cost} <span style={{ fontSize: 10, color: '#4A6580', fontWeight: 400 }}>vs. R$59,90 sem plano</span></p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

SubscriptionPlansSection.displayName = 'SubscriptionPlansSection';

export default SubscriptionPlansSection;
