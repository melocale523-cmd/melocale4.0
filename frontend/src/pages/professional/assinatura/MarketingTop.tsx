interface Props {
  onScrollToPlans: () => void;
}

export default function MarketingTop({ onScrollToPlans }: Props) {
  return (
    <>
      {/* CTA Assinatura */}
      <div style={{ background: 'linear-gradient(135deg,rgba(16,185,129,.08),rgba(5,150,105,.05))', border: '1px solid rgba(16,185,129,.2)', borderRadius: 18, padding: '1.25rem 1.5rem', position: 'relative', overflow: 'hidden', marginTop: '1.5rem' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#10b981,#059669)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ background: 'rgba(16,185,129,.12)', color: '#34d399', border: '1px solid rgba(16,185,129,.2)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, display: 'inline-block', marginBottom: 6 }}>Economia Inteligente</span>
            <p style={{ fontSize: 15, fontWeight: 900, color: 'white', marginBottom: 4 }}>Assinar é muito mais barato do que moedas avulsas!</p>
            <p style={{ fontSize: 12, color: '#6b7280' }}>Com plano PRO, cada compra de moedas custa <span style={{ color: '#34d399', fontWeight: 700 }}>40% menos</span>. O plano se paga na primeira recarga.</p>
          </div>
          <button onClick={onScrollToPlans} style={{ height: 40, padding: '0 20px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 16px rgba(16,185,129,.25)', whiteSpace: 'nowrap' }}>
            Ver Planos Mensais →
          </button>
        </div>
      </div>

      {/* ROI box */}
      <div style={{ background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 14, padding: '1rem 1.5rem', textAlign: 'center', marginTop: '1rem' }}>
        <p style={{ color: 'white', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
          💡 1 cliente de R$ 500 já paga o plano PRO por <span style={{ color: '#34d399' }}>7 meses</span>
        </p>
        <p style={{ color: '#4A6580', fontSize: 12 }}>E com 40% de desconto em moedas, você acessa muito mais pelo mesmo preço.</p>
      </div>

      {/* Footer Stripe */}
      <div className="flex justify-center pb-2">
        <p className="text-slate-500 text-xs flex gap-2 items-center">
          <span className="font-bold opacity-80">stripe</span>
          <span className="w-px h-3 bg-slate-700" />
          <span>Pagamento seguro via Stripe. Não armazenamos dados de cartão.</span>
        </p>
      </div>
    </>
  );
}
