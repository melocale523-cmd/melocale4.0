import { useState } from 'react';

export default function Footer() {
  const [showCitiesModal, setShowCitiesModal] = useState(false);
  const activeCities = ['Salvador', 'Feira de Santana', 'Jacobina', 'Irecê', 'Senhor do Bonfim'];
  const comingSoonCities = ['Vitória da Conquista', 'Ilhéus', 'Itabuna', 'Camaçari', 'Juazeiro', 'Barreiras'];

  return (
    <footer style={{ background: '#0a1020', borderTop: '2px solid #10b981', paddingTop: 48, paddingBottom: 32, color: '#f0f6ff', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ width: '100%', padding: '0 1.5rem', boxSizing: 'border-box' }}>
        <div className="flex flex-wrap lg:flex-nowrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginBottom: 40 }}>

          <div style={{ maxWidth: 280 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981', marginBottom: 10 }}>MeloCalé</div>
            <p style={{ fontSize: 15, color: '#6a9ab8', lineHeight: 1.7, marginBottom: 18 }}>
              O marketplace de serviços domésticos do interior da Bahia. Conectando profissionais qualificados a quem precisa.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {['Facebook', 'Instagram', 'WhatsApp'].map(s => (
                <a key={s} href="#" style={{ fontSize: 13, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 8, padding: '6px 12px', textDecoration: 'none' }}>{s}</a>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#f0f6ff', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>Plataforma</div>
            {['Como funciona', 'Para profissionais', 'Para clientes', 'Planos e preços'].map(l => (
              <a key={l} href="#" style={{ display: 'block', fontSize: 15, color: '#6a9ab8', textDecoration: 'none', marginBottom: 10, transition: 'color .15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#10b981')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6a9ab8')}
              >{l}</a>
            ))}
          </div>

          <div style={{ maxWidth: 230 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#f0f6ff', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>Cidades atendidas</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {activeCities.map(city => (
                <span key={city} style={{ fontSize: 13, color: '#94b8d4', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, padding: '5px 10px' }}>{city}</span>
              ))}
            </div>
            <span onClick={() => setShowCitiesModal(true)} style={{ fontSize: 13, color: '#10b981', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>Ver todas as cidades da Bahia →</span>
          </div>

          <div style={{ display: 'flex', gap: 56 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f0f6ff', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>Legal</div>
              {['Termos de uso', 'Política de privacidade', 'Política de cookies', 'Garantia e reembolso'].map(l => (
                <a key={l} href="#" style={{ display: 'block', fontSize: 15, color: '#6a9ab8', textDecoration: 'none', marginBottom: 10, transition: 'color .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#10b981')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#6a9ab8')}
                >{l}</a>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f0f6ff', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>Suporte</div>
              {['Central de ajuda', 'Fale conosco', 'WhatsApp suporte', 'Reportar problema'].map(l => (
                <a key={l} href="#" style={{ display: 'block', fontSize: 15, color: '#6a9ab8', textDecoration: 'none', marginBottom: 10, transition: 'color .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#10b981')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#6a9ab8')}
                >{l}</a>
              ))}
            </div>
          </div>

        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {['🔒 SSL', '⚡ 47 min', '🛡️ Garantia 7 dias', '✅ Verificados'].map(t => (
              <span key={t} style={{ fontSize: 13, color: '#4a6a80' }}>{t}</span>
            ))}
          </div>
          <p style={{ fontSize: 14, color: '#4a6a80', margin: 0 }}>© 2026 MeloCalé · Todos os direitos reservados</p>
        </div>
      </div>

      {showCitiesModal && (
        <div onClick={() => setShowCitiesModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f172a', border: '1px solid rgba(16,185,129,.3)', borderRadius: 16, padding: '28px 32px', maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>Cidades atendidas</h3>
              <span onClick={() => setShowCitiesModal(false)} style={{ fontSize: 18, color: '#6a9ab8', cursor: 'pointer' }}>✕</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeCities.map(city => (
                <div key={city} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(16,185,129,.08)', borderRadius: 8 }}>
                  <span style={{ fontSize: 14, color: '#e2e8f0' }}>{city}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,.15)', borderRadius: 6, padding: '3px 10px' }}>Atende</span>
                </div>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '6px 0' }} />
              {comingSoonCities.map(city => (
                <div key={city} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px' }}>
                  <span style={{ fontSize: 14, color: '#94b8d4' }}>{city}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,.12)', borderRadius: 6, padding: '3px 10px' }}>Em breve</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#6a9ab8', margin: '14px 0 0', textAlign: 'center' }}>
              Não achou sua cidade? <span style={{ color: '#10b981', textDecoration: 'underline', cursor: 'pointer' }}>Avise quando chegar</span>
            </p>
          </div>
        </div>
      )}
    </footer>
  );
}
