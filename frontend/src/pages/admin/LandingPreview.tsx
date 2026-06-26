import { useState } from 'react';

const BASE_URL = 'https://melocale.com.br';

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

type ViewId = typeof VIEWS[number]['id'];

export default function LandingPreview() {
  const [active, setActive] = useState<ViewId>('profissional');

  const current = VIEWS.find(v => v.id === active)!;
  const previewUrl = `${BASE_URL}/${current.param}`;

  return (
    <div style={{ color: '#f0f6ff', fontFamily: "'DM Sans', sans-serif" }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f6ff', margin: '0 0 6px' }}>Preview da Landing Page</h1>
        <p style={{ fontSize: 13, color: '#6a9ab8', margin: 0 }}>Visualize como cada audiência vê a página antes de publicar alterações</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setActive(v.id)}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: `1px solid ${active === v.id ? v.border : 'rgba(255,255,255,.1)'}`,
              background: active === v.id ? v.bg : 'transparent',
              color: active === v.id ? v.color : '#6a9ab8',
              fontWeight: active === v.id ? 700 : 400,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all .15s',
            }}
          >
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1e2d45', border: `1px solid ${current.border}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: '#6a9ab8' }}>{current.desc}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: current.color, fontFamily: 'monospace' }}>{previewUrl}</p>
        </div>
        <button
          onClick={() => window.open(previewUrl, '_blank')}
          style={{ padding: '7px 14px', background: current.bg, border: `1px solid ${current.border}`, color: current.color, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          Abrir em nova aba →
        </button>
      </div>

      <div style={{ borderRadius: 14, overflow: 'hidden', border: `2px solid ${current.border}` }}>
        <div style={{ background: '#1e2d45', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${current.border}` }}>
          <div style={{ display: 'flex', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
          </div>
          <div style={{ flex: 1, background: '#0f172a', borderRadius: 6, padding: '4px 12px', fontSize: 11, color: '#6a9ab8', fontFamily: 'monospace' }}>
            {previewUrl}
          </div>
        </div>
        <iframe
          key={active}
          src={previewUrl}
          style={{ width: '100%', height: '80vh', border: 'none', display: 'block' }}
          title={`Preview ${current.label}`}
        />
      </div>

    </div>
  );
}
