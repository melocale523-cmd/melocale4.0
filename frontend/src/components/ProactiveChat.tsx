import { useEffect, useRef, useState } from 'react';
import { X, MessageCircle } from 'lucide-react';

const WA_NUMBER = '5574999215307';
const SESSION_KEY = 'proactive_chat_shown';
const DELAY_MS = 25_000;

interface Props {
  userCity: string;
}

type Section = 'hero' | 'planos' | 'como-funciona' | null;

function buildMessage(section: Section, city: string): string {
  const c = city || 'sua cidade';
  if (section === 'hero')
    return `Oi! Tem profissionais verificados em ${c} disponíveis agora. Quer receber orçamentos grátis hoje?`;
  if (section === 'planos')
    return `A maioria dos profissionais em ${c} começa pelo plano grátis e já recebe clientes no mesmo dia. Posso te ajudar a escolher?`;
  if (section === 'como-funciona')
    return `Em menos de 5 minutos você já pode estar recebendo clientes em ${c}. Vamos começar?`;
  return `Oi! Tem clientes procurando profissionais em ${c} agora mesmo. Cadastre-se grátis e comece a receber leads hoje!`;
}

export default function ProactiveChat({ userCity }: Props) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const sectionRef = useRef<Section>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;

    // Observe main sections to pick context-aware message
    const ids: Section[] = ['hero', 'planos', 'como-funciona'];
    const observers: IntersectionObserver[] = [];

    ids.forEach(id => {
      const el = document.getElementById(id ?? '');
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) sectionRef.current = id; },
        { threshold: 0.3 },
      );
      obs.observe(el);
      observers.push(obs);
    });

    timerRef.current = setTimeout(() => {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      const city = sessionStorage.getItem('user_city') || userCity;
      setMessage(buildMessage(sectionRef.current, city));
      setVisible(true);
    }, DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      observers.forEach(o => o.disconnect());
    };
  }, [userCity]);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(SESSION_KEY, '1');
  };

  const openWhatsApp = () => {
    const text = encodeURIComponent(message);
    window.open(`https://wa.me/${WA_NUMBER}?text=${text}`, '_blank', 'noopener');
    dismiss();
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '5rem',
        right: '0.75rem',
        zIndex: 85,
        width: 300,
        maxWidth: 'calc(100vw - 1.5rem)',
        animation: 'proactiveChatSlideUp 0.4s ease-out forwards',
      }}
    >
      <style>{`
        @keyframes proactiveChatSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .proactive-pulse {
          animation: proactivePulse 2s infinite;
        }
        @keyframes proactivePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div style={{ background:'#0E1C32', border:'1px solid rgba(16,185,129,.25)', borderRadius:16, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}>

        {/* Header */}
        <div style={{ background:'#0f5c3a', padding:'0.875rem 1rem' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:38, height:38, borderRadius:'50%', background:'#10b981', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, color:'#fff', flexShrink:0, border:'2px solid rgba(255,255,255,.2)' }}>MC</div>
              <div>
                <p style={{ fontSize:14, fontWeight:700, color:'#fff', margin:0 }}>MeloCalé</p>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2 }}>
                  <div className="proactive-pulse" style={{ width:7, height:7, borderRadius:'50%', background:'#4ade80' }} />
                  <p style={{ fontSize:11, color:'rgba(255,255,255,.75)', margin:0 }}>Online agora</p>
                </div>
              </div>
            </div>
            <button onClick={dismiss} style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,.1)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
              <X size={14} style={{ color:'rgba(255,255,255,.8)' }} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding:'1rem', maxHeight:'60vh', overflowY:'auto' }}>

          {/* Mensagem bolha */}
          <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:'1rem' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'#10b981', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0, marginTop:2 }}>MC</div>
            <div style={{ background:'#132540', borderRadius:'0 10px 10px 10px', padding:'0.75rem', flex:1 }}>
              <p style={{ fontSize:13, color:'#e2e8f0', margin:0, lineHeight:1.55 }}>{message}</p>
            </div>
          </div>

          {/* Tempo de resposta */}
          <div style={{ background:'#132540', borderRadius:10, padding:'0.625rem 0.875rem', marginBottom:'0.875rem', display:'flex', alignItems:'center', gap:8 }}>
            <MessageCircle size={14} style={{ color:'#10b981', flexShrink:0 }} />
            <p style={{ fontSize:12, color:'#94a3b8', margin:0 }}>Tempo médio de resposta: <span style={{ color:'#34d399', fontWeight:700 }}>menos de 5 min</span></p>
          </div>

          {/* 3 métricas */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:'0.875rem' }}>
            {[
              { value:'371+', label:'profissionais' },
              { value:'4.8★', label:'avaliação' },
              { value:'grátis', label:'1º pedido' },
            ].map(m => (
              <div key={m.label} style={{ background:'#132540', borderRadius:8, padding:'0.5rem', textAlign:'center' }}>
                <p style={{ fontSize:15, fontWeight:700, color:'#10b981', margin:0, lineHeight:1 }}>{m.value}</p>
                <p style={{ fontSize:10, color:'#4A6580', margin:'3px 0 0' }}>{m.label}</p>
              </div>
            ))}
          </div>

          {/* CTA WhatsApp */}
          <button
            onClick={openWhatsApp}
            style={{ width:'100%', background:'#25d366', border:'none', borderRadius:10, padding:'0.75rem', display:'flex', alignItems:'center', justifyContent:'center', gap:8, cursor:'pointer', marginBottom:'0.5rem' }}
          >
            <svg viewBox="0 0 24 24" style={{ width:16, height:16, fill:'white', flexShrink:0 }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            <span style={{ fontSize:13, fontWeight:700, color:'white' }}>Falar no WhatsApp</span>
          </button>

          {/* CTA Cadastro */}
          <button
            onClick={() => { dismiss(); window.location.href = '/login?mode=signup'; }}
            style={{ width:'100%', background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.2)', borderRadius:10, padding:'0.5rem', cursor:'pointer', marginBottom:'0.5rem' }}
          >
            <span style={{ fontSize:12, fontWeight:700, color:'#34d399' }}>Cadastrar agora →</span>
          </button>

          {/* Agora não */}
          <p onClick={dismiss} style={{ fontSize:11, color:'#4A6580', textAlign:'center', margin:'0.5rem 0 0', cursor:'pointer' }}>Agora não</p>

        </div>
      </div>
    </div>
  );
}
