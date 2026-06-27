export default function Footer() {
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
            {['Como funciona', 'Para profissionais', 'Para clientes', 'Planos e preços', 'Cidades atendidas'].map(l => (
              <a key={l} href="#" style={{ display: 'block', fontSize: 15, color: '#6a9ab8', textDecoration: 'none', marginBottom: 10, transition: 'color .15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#10b981')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6a9ab8')}
              >{l}</a>
            ))}
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
    </footer>
  );
}
