import { Loader2 } from 'lucide-react';
import { CREDIT_PACKAGES } from '../../../lib/coinPackages';

interface Props {
  hasActivePlan: boolean;
  planDiscount: number;
  buyingId: string | null;
  onBuy: (packageId: string) => void;
  isMobile: boolean;
}

export default function CoinPackageSection({ hasActivePlan, planDiscount, buyingId, onBuy, isMobile }: Props) {
  return (
    <div style={{ marginTop: '2.5rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, color: 'white', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          🪙 Pacotes de Créditos Avulsos
        </h2>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4A6580' }}>
          Recarregue sua carteira conforme a necessidade. {hasActivePlan ? `Com seu plano, você paga ${planDiscount}% menos.` : 'Preço cheio, sem plano.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
        {CREDIT_PACKAGES.map((pkg) => {
          const totalCoins = pkg.coins + pkg.bonus;
          const isPopular = 'popular' in pkg && pkg.popular;
          const discountMultiplier = hasActivePlan ? (1 - planDiscount / 100) : 1;
          const yourPrice = (pkg.priceNum * discountMultiplier).toFixed(2);
          const borderColor = isPopular ? 'rgba(16,185,129,.35)' : 'rgba(55,138,221,.18)';
          const topColor = isPopular ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#378ADD,#1d6fa8)';
          return (
            <div key={pkg.id} style={{ background: 'linear-gradient(145deg,#0a1928,#0d1e35)', border: `1px solid ${borderColor}`, borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', transition: 'transform .25s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: topColor }} />
              {isPopular && (
                <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                  ★ Melhor Custo-Benefício
                </div>
              )}
              <div style={{ padding: '1.25rem 1.25rem .75rem', paddingTop: isPopular ? '1.75rem' : '1.25rem' }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#4A6580', marginBottom: 6 }}>{pkg.name}</p>
                <p style={{ fontSize: 11, color: '#4A6580', marginBottom: 10 }}>{pkg.description}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>R$</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 900, color: 'white', lineHeight: 1 }}>{pkg.price}</span>
                  {hasActivePlan && <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700 }}>→ R${yourPrice} c/ plano</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(250,177,68,.12)', color: '#fbbf24', border: '1px solid rgba(250,177,68,.2)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>⭐ {totalCoins} moedas</span>
                  {pkg.bonus > 0 && <span style={{ background: 'rgba(16,185,129,.1)', color: '#34d399', border: '1px solid rgba(16,185,129,.2)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>+{pkg.bonus} bônus</span>}
                </div>
                <div style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#4A6580', marginBottom: 6 }}>Custo por moeda</p>
                  {[
                    { label: 'Sem plano', cost: (pkg.priceNum / totalCoins), color: hasActivePlan ? '#4A6580' : '#f87171', tag: !hasActivePlan ? 'você' : null },
                    { label: 'Starter (25% off)', cost: (pkg.priceNum * 0.75 / totalCoins), color: '#60a5fa', tag: hasActivePlan && planDiscount === 25 ? 'você' : null },
                    { label: 'PRO (40% off)', cost: (pkg.priceNum * 0.60 / totalCoins), color: '#34d399', tag: hasActivePlan && planDiscount === 40 ? 'você' : null },
                    { label: 'Elite (55% off)', cost: (pkg.priceNum * 0.45 / totalCoins), color: '#fbbf24', tag: hasActivePlan && planDiscount === 55 ? 'você' : null },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,.03)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 11, color: row.tag ? 'white' : '#4A6580' }}>{row.label}</span>
                        {row.tag && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 20, background: 'rgba(16,185,129,.12)', color: '#34d399', border: '1px solid rgba(16,185,129,.2)' }}>você</span>}
                      </div>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: row.color }}>R${row.cost.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '0 1.25rem 1.25rem', marginTop: 'auto' }}>
                <button
                  disabled={!!buyingId}
                  onClick={() => onBuy(pkg.id)}
                  style={{ width: '100%', height: 40, background: isPopular ? 'linear-gradient(135deg,#10b981,#059669)' : 'rgba(255,255,255,.05)', border: isPopular ? 'none' : '1px solid rgba(255,255,255,.1)', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: isPopular ? '0 4px 16px rgba(16,185,129,.25)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: buyingId ? .5 : 1 }}
                >
                  {buyingId === pkg.id ? <Loader2 size={14} className="animate-spin" /> : '🪙 Comprar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
