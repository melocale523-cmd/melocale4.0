import { ArrowLeft, Users } from 'lucide-react';

interface StepLeadsProps {
  onNext: () => void;
  onBack: () => void;
}

export function StepLeads({ onNext, onBack }: StepLeadsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <Users size={24} color="#10b981" />
        </div>
        <h2 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Como você recebe clientes</h2>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Simples, direto e sem surpresas</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { n: '1', title: 'Cliente faz um pedido', desc: 'Ele descreve o serviço que precisa na sua cidade' },
          { n: '2', title: 'Você vê o pedido e decide', desc: 'Visualiza nome, serviço e cidade — sem gastar nada ainda' },
          { n: '3', title: 'Compra o contato com moedas', desc: 'Recebe o WhatsApp e fecha o orçamento direto com o cliente' },
        ].map(({ n, title, desc }) => (
          <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#0a1928', border: '1px solid #1C3050', borderRadius: '0.75rem', padding: '12px 14px' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#10b981', fontSize: 12, fontWeight: 700 }}>{n}</span>
            </div>
            <div>
              <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{title}</div>
              <div style={{ color: '#64748b', fontSize: 11, lineHeight: 1.5 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
        <button
          type="button"
          onClick={onNext}
          style={{ width: '100%', height: 52, background: '#10b981', border: 'none', borderRadius: '1rem', color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer', letterSpacing: '.05em', textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif' }}
        >
          Entendi, quero ver clientes!
        </button>
        <button
          type="button"
          onClick={onBack}
          style={{ width: '100%', height: 40, background: 'none', border: 'none', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'DM Sans, sans-serif' }}
        >
          <ArrowLeft size={14} /> Voltar
        </button>
      </div>
    </div>
  );
}
