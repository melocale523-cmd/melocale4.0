import { useState } from 'react';
import { X, MapPin, Coins, TrendingUp, Users, CheckCircle } from 'lucide-react';
import type { ClientProfile } from '../../types/chat';

interface ClientProfileModalProps {
  profile: ClientProfile;
  onClose: () => void;
  onBuyLead?: (leadId: string, coinPrice: number) => Promise<void>;
  professionalCoins?: number;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  open:       { bg: 'rgba(59,130,246,.12)',  color: '#60a5fa', border: 'rgba(59,130,246,.25)',  label: 'em aberto' },
  'orçando':  { bg: 'rgba(245,158,11,.12)', color: '#fbbf24', border: 'rgba(245,158,11,.25)', label: 'orçando' },
  finalizado: { bg: 'rgba(16,185,129,.12)', color: '#34d399', border: 'rgba(16,185,129,.25)', label: 'finalizado' },
  cancelado:  { bg: 'rgba(239,68,68,.12)',  color: '#f87171', border: 'rgba(239,68,68,.25)',  label: 'cancelado' },
};

export function ClientProfileModal({ profile, onClose, onBuyLead, professionalCoins = 0 }: ClientProfileModalProps) {
  const [buying, setBuying] = useState<string | null>(null);
  const [bought, setBought] = useState<Set<string>>(new Set());

  const initials = (profile.full_name ?? 'C').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const finalizedCount = profile.recent_leads.filter(l => l.status === 'finalizado').length;
  const taxaFechamento = profile.total_leads > 0 ? Math.round((finalizedCount / profile.total_leads) * 100) : 0;

  const unboughtLeads = profile.recent_leads.filter(l => !l.purchased && !bought.has(l.id) && l.price_coins);
  const totalCost = unboughtLeads.reduce((acc, l) => acc + (l.price_coins ?? 0), 0);

  async function handleBuy(leadId: string, price: number) {
    if (!onBuyLead) return;
    setBuying(leadId);
    try {
      await onBuyLead(leadId, price);
      setBought(prev => new Set([...prev, leadId]));
    } finally {
      setBuying(null);
    }
  }

  async function handleBuyAll() {
    for (const lead of unboughtLeads) {
      if (lead.price_coins) await handleBuy(lead.id, lead.price_coins);
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.75)', backdropFilter:'blur(4px)' }} onClick={onClose} />
      <div style={{ position:'relative', width:'100%', maxWidth:380, background:'#0E1C32', border:'1px solid rgba(255,255,255,.09)', borderRadius:20, overflow:'hidden', maxHeight:'92vh', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ background:'#132540', padding:'1rem 1.25rem 0', flexShrink:0, position:'relative' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#10b981,#38bdf8)' }} />
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', paddingTop:4 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:'#1e40af', border:'2px solid rgba(59,130,246,.3)', display:'flex', alignItems:'center', justifyContent:'center', color:'#93c5fd', fontWeight:700, fontSize:17, flexShrink:0, overflow:'hidden' }}>
                {profile.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : initials}
              </div>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                  <p style={{ fontSize:15, fontWeight:800, color:'white', margin:0 }}>{profile.full_name ?? 'Cliente'}</p>
                  <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4, background:'rgba(16,185,129,.15)', color:'#34d399', border:'1px solid rgba(16,185,129,.2)' }}>ATIVO</span>
                </div>
                {(profile.city || profile.state) && (
                  <p style={{ fontSize:12, color:'#4A6580', margin:0, display:'flex', alignItems:'center', gap:4 }}>
                    <MapPin size={11} /> {[profile.city, profile.state].filter(Boolean).join(', ')}
                  </p>
                )}
                <p style={{ fontSize:11, color:'#4A6580', margin:'2px 0 0' }}>
                  Cliente desde {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
            <button onClick={onClose} style={{ width:28, height:28, borderRadius:7, background:'rgba(0,0,0,.3)', border:'none', color:'#4A6580', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, margin:'1rem 0 0' }}>
            {[
              { value: profile.total_leads, label: 'Pedidos', color: '#fbbf24' },
              { value: finalizedCount, label: 'Finalizados', color: '#34d399' },
              { value: `${taxaFechamento}%`, label: 'Taxa', color: '#60a5fa' },
            ].map(s => (
              <div key={s.label} style={{ background:'#0E1C32', border:'1px solid rgba(255,255,255,.06)', borderRadius:10, padding:'0.5rem', textAlign:'center' }}>
                <p style={{ fontSize:18, fontWeight:800, color:s.color, margin:0, lineHeight:1 }}>{s.value}</p>
                <p style={{ fontSize:10, color:'#4A6580', margin:'3px 0 0', textTransform:'uppercase', letterSpacing:'.05em' }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div style={{ height:1, background:'rgba(255,255,255,.06)', margin:'1rem -1.25rem 0' }} />
        </div>

        {/* Body */}
        <div style={{ overflowY:'auto', flex:1, padding:'0.875rem 1.25rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>

          {taxaFechamento >= 50 && (
            <div style={{ background:'rgba(16,185,129,.07)', border:'1px solid rgba(16,185,129,.18)', borderRadius:10, padding:'0.625rem 0.875rem', display:'flex', alignItems:'center', gap:8 }}>
              <TrendingUp size={15} style={{ color:'#34d399', flexShrink:0 }} />
              <div>
                <p style={{ fontSize:12, fontWeight:700, color:'#34d399', margin:0 }}>Cliente com alta taxa de fechamento</p>
                <p style={{ fontSize:11, color:'#4A6580', margin:'2px 0 0' }}>Vale a pena investir — aceita propostas com frequência</p>
              </div>
            </div>
          )}

          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
              <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'#4A6580', margin:0 }}>Pedidos deste cliente</p>
              <span style={{ fontSize:11, color:'#4A6580', display:'flex', alignItems:'center', gap:3 }}>
                <Coins size={12} style={{ color:'#fbbf24' }} /> {professionalCoins} moedas
              </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.375rem' }}>
              {profile.recent_leads.map(lead => {
                const isPurchased = lead.purchased || bought.has(lead.id);
                const isBuying = buying === lead.id;
                const sc = STATUS_COLORS[lead.status] ?? STATUS_COLORS['open'];
                const budget = lead.budget_min && lead.budget_max
                  ? `R$${lead.budget_min}–R$${lead.budget_max}`
                  : lead.budget_max ? `até R$${lead.budget_max}` : null;
                const canAfford = professionalCoins >= (lead.price_coins ?? 0);

                return (
                  <div key={lead.id} style={{ background:'#132540', border:`1px solid ${isPurchased ? 'rgba(16,185,129,.25)' : 'rgba(255,255,255,.06)'}`, borderRadius:10, padding:'0.625rem 0.875rem' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                          <p style={{ fontSize:13, color:'white', fontWeight:600, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.title}</p>
                          <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:4, background:sc.bg, color:sc.color, border:`1px solid ${sc.border}`, flexShrink:0 }}>{sc.label}</span>
                        </div>
                        <p style={{ fontSize:11, color:'#4A6580', margin:0 }}>
                          {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                          {budget && <span style={{ color:'#94a3b8', marginLeft:6 }}>· {budget}</span>}
                        </p>
                      </div>
                      {isPurchased ? (
                        <div style={{ display:'flex', alignItems:'center', gap:4, color:'#34d399', fontSize:11, fontWeight:700, flexShrink:0 }}>
                          <CheckCircle size={13} /> Desbloqueado
                        </div>
                      ) : lead.price_coins ? (
                        <button
                          onClick={() => handleBuy(lead.id, lead.price_coins!)}
                          disabled={isBuying || !canAfford}
                          style={{ height:28, padding:'0 10px', background: canAfford ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.04)', border:`1px solid ${canAfford ? 'rgba(245,158,11,.3)' : 'rgba(255,255,255,.08)'}`, borderRadius:7, color: canAfford ? '#fbbf24' : '#4A6580', fontSize:11, fontWeight:700, cursor: canAfford ? 'pointer' : 'not-allowed', flexShrink:0, display:'flex', alignItems:'center', gap:4, opacity: isBuying ? .5 : 1 }}
                        >
                          <Coins size={11} /> {isBuying ? '...' : `${lead.price_coins} moedas`}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {unboughtLeads.length > 1 && (
            <div style={{ background:'rgba(245,158,11,.06)', border:'1px solid rgba(245,158,11,.15)', borderRadius:10, padding:'0.625rem 0.875rem', display:'flex', alignItems:'center', gap:8 }}>
              <Users size={14} style={{ color:'#fbbf24', flexShrink:0 }} />
              <p style={{ fontSize:11, color:'#94a3b8', margin:0, flex:1 }}>
                Comprar todos = <span style={{ color:'#fbbf24', fontWeight:700 }}>{totalCost} moedas</span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'0.75rem 1.25rem', borderTop:'1px solid rgba(255,255,255,.06)', flexShrink:0, display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          {unboughtLeads.length > 1 && onBuyLead && (
            <button
              onClick={handleBuyAll}
              disabled={!!buying || professionalCoins < totalCost}
              style={{ width:'100%', height:40, background: professionalCoins >= totalCost ? '#10b981' : 'rgba(255,255,255,.06)', border:'none', borderRadius:10, color: professionalCoins >= totalCost ? 'white' : '#4A6580', fontWeight:700, fontSize:14, cursor: professionalCoins >= totalCost ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
            >
              <Coins size={15} /> Comprar todos · {totalCost} moedas
            </button>
          )}
          <button onClick={onClose} style={{ width:'100%', height:34, background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:10, color:'#94a3b8', fontWeight:600, fontSize:13, cursor:'pointer' }}>
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
