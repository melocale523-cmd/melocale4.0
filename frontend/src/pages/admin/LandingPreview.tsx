const VIEWS = [
  {
    id: 'profissional',
    label: 'Versão Profissional',
    param: '?tipo=profissional',
    color: '#10b981',
    bg: 'rgba(16,185,129,.12)',
    border: 'rgba(16,185,129,.35)',
    desc: 'Como aparece para quem clica no anúncio de profissional',
    icon: '🔧',
  },
  {
    id: 'cliente',
    label: 'Versão Cliente',
    param: '?tipo=cliente',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,.12)',
    border: 'rgba(56,189,248,.35)',
    desc: 'Como aparece para quem clica no anúncio de cliente',
    icon: '🏠',
  },
  {
    id: 'organico',
    label: 'Versão Orgânica',
    param: '',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,.10)',
    border: 'rgba(245,158,11,.35)',
    desc: 'Como aparece para quem acessa diretamente (Google, link direto)',
    icon: '🌐',
  },
] as const;

export default function LandingPreview() {
  return (
    <div style={{ color: '#f0f6ff', fontFamily: "'DM Sans', sans-serif" }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f6ff', margin: '0 0 6px' }}>Preview da Landing Page</h1>
        <p style={{ fontSize: 13, color: '#6a9ab8', margin: 0 }}>Visualize como cada audiência vê a página antes de publicar alterações</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {VIEWS.map(v => (
          <div
            key={v.id}
            onClick={() => window.open(`https://melocale.com.br/${v.param}`, '_blank')}
            style={{ background: '#1e2d45', border: `1px solid ${v.border}`, borderRadius: 12, padding: '20px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, transition: 'all .15s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: v.bg, border: `1px solid ${v.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{v.icon}</div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f0f6ff' }}>{v.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6a9ab8' }}>{v.desc}</p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: v.color, fontFamily: 'monospace' }}>https://melocale.com.br/{v.param}</p>
              </div>
            </div>
            <div style={{ padding: '8px 16px', background: v.bg, border: `1px solid ${v.border}`, color: v.color, borderRadius: 8, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
              Abrir →
            </div>
          </div>
        ))}

        <div style={{ background: '#162032', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#4a6a80', textAlign: 'center' }}>
          O preview abre em nova aba porque o navegador bloqueia iframes de sites externos por segurança (X-Frame-Options).
        </div>
      </div>

    </div>
  );
}
