import { Loader2 } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from './constants';

interface Props {
  buyingId: string | null;
  onSubscribe: (planId: string) => void;
}

export default function PlanComparisonTable({ buyingId, onSubscribe }: Props) {
  return (
    <div style={{ background: 'linear-gradient(145deg,#0a1928,#0d1e35)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 18, overflow: 'hidden', marginTop: '1.5rem' }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <p style={{ fontSize: 16, fontWeight: 900, color: 'white', marginBottom: 2 }}>📊 Comparativo de Planos</p>
        <p style={{ fontSize: 11, color: '#4A6580' }}>Veja exatamente o que você ganha em cada plano</p>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,.25)' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#4A6580', textTransform: 'uppercase', letterSpacing: '.06em' }}>Benefício</th>
              {[
                { name: 'Sem plano', color: '#f87171' },
                { name: 'Starter', color: '#60a5fa' },
                { name: 'PRO', color: '#34d399' },
                { name: 'Elite', color: '#fbbf24' },
              ].map((col, i) => (
                <th key={i} style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: col.color, background: col.name === 'PRO' ? 'rgba(16,185,129,.03)' : 'transparent' }}>{col.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Preço', vals: ['Grátis', 'R$37/mês', 'R$67/mês', 'R$127/mês'] },
              { label: 'Desconto moedas', vals: ['0%', '25%', '40%', '55%'] },
              { label: 'Pac. 200 moedas', vals: ['R$59,90', 'R$44,93', 'R$35,94', 'R$26,96'] },
              { label: 'Visibilidade buscas', vals: ['Padrão', 'Normal', '2× mais', 'Topo absoluto'] },
              { label: 'Moedas expiram', vals: ['90 dias', '90 dias', 'Nunca', 'Nunca'] },
              { label: 'Badge no perfil', vals: ['Nenhum', '✅ Verificado', '⚡ PRO', '🏆 Elite'] },
              { label: 'Moedas boas-vindas', vals: ['—', '30', '80', '200'] },
              { label: 'Suporte', vals: ['—', 'Chat', 'Prioritário 2h', 'Gerente dedicado'] },
            ].map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,.03)', cursor: 'default' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.015)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 16px', fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{row.label}</td>
                {row.vals.map((val, vi) => (
                  <td key={vi} style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, fontWeight: 500, background: vi === 2 ? 'rgba(16,185,129,.03)' : 'transparent', color: vi === 0 ? '#4A6580' : vi === 1 ? '#60a5fa' : vi === 2 ? '#34d399' : '#fbbf24' }}>{val}</td>
                ))}
              </tr>
            ))}
            <tr style={{ background: 'rgba(16,185,129,.03)', borderTop: '1px solid rgba(16,185,129,.1)' }}>
              <td style={{ padding: '12px 16px', fontSize: 12, color: '#4A6580' }}>Assinar</td>
              <td style={{ padding: '12px 16px', textAlign: 'center' }}><span style={{ color: '#4A6580', fontSize: 12 }}>—</span></td>
              {SUBSCRIPTION_PLANS.map((plan) => (
                <td key={plan.id} style={{ padding: '12px 16px', textAlign: 'center', background: plan.popular ? 'rgba(16,185,129,.03)' : 'transparent' }}>
                  <button disabled={!!buyingId} onClick={() => onSubscribe(plan.id)}
                    style={{ padding: '5px 12px', background: plan.popular ? 'linear-gradient(135deg,#10b981,#059669)' : plan.color === 'blue' ? 'linear-gradient(135deg,#378ADD,#1d6fa8)' : 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', borderRadius: 20, color: plan.color === 'yellow' ? '#000' : 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: buyingId ? .5 : 1 }}>
                    {plan.popular ? '⚡ PRO' : plan.color === 'blue' ? 'Starter' : '🏆 Elite'}
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
