import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Ticket, Coins, RefreshCw, ChevronRight } from 'lucide-react';
import { adminService } from '../../services/statsService';
import { apiFetch } from '../../lib/api';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ['adminDashboardSummary'],
    queryFn: adminService.getDashboardSummary,
    staleTime: 60_000,
  });

  const { data: activeUsers } = useQuery({
    queryKey: ['adminActiveUsers'],
    queryFn: async () => {
      const res = await apiFetch('/api/admin/active-users');
      const json = await res.json();
      return (json.count as number) ?? 0;
    },
  });

  const { data: recentPros } = useQuery({
    queryKey: ['adminRecentPros'],
    queryFn: () => adminService.getUsers({ role: 'professional' }),
  });

  const { data: cityData } = useQuery({
    queryKey: ['adminCityData'],
    queryFn: async () => {
      const [prosRes, leadsRes] = await Promise.all([
        supabase.from('professionals').select('city'),
        supabase.from('leads').select('city').eq('status', 'open'),
      ]);
      const pros: Record<string, number> = {};
      const leads: Record<string, number> = {};
      (prosRes.data ?? []).forEach((p: { city: string | null }) => { if (p.city) pros[p.city] = (pros[p.city] ?? 0) + 1; });
      (leadsRes.data ?? []).forEach((l: { city: string | null }) => { if (l.city) leads[l.city] = (leads[l.city] ?? 0) + 1; });
      const cities = [...new Set([...Object.keys(pros), 'Jacobina', 'Feira de Santana', 'Irecê', 'Senhor do Bonfim'])];
      return cities.map(c => ({ city: c, pros: pros[c] ?? 0, leads: leads[c] ?? 0 }));
    },
  });

  if (isLoading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="animate-spin text-emerald-500" size={40} />
    </div>
  );

  const s = summary!;
  const monthKeys = Object.keys(s.monthlyRevenue).sort().slice(-3);
  const maxMonthRevenue = Math.max(...monthKeys.map(k => s.monthlyRevenue[k] ?? 0), 1);

  const MONTH_NAMES: Record<string, string> = {
    '01':'Jan','02':'Fev','03':'Mar','04':'Abr','05':'Mai','06':'Jun',
    '07':'Jul','08':'Ago','09':'Set','10':'Out','11':'Nov','12':'Dez',
  };
  const fmtMonth = (key: string) => MONTH_NAMES[key.split('-')[1]] ?? key;
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const subEntries = Object.entries(s.packageBreakdown)
    .filter(([k]) => k.startsWith('plan_'))
    .sort((a, b) => b[1].total - a[1].total);

  const coinEntries = Object.entries(s.packageBreakdown)
    .filter(([k]) => !k.startsWith('plan_'))
    .sort((a, b) => b[1].total - a[1].total);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem', maxWidth:1200, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'white', margin:'0 0 3px' }}>Painel Administrativo</h1>
          <p style={{ fontSize:12, color:'#4a6580', margin:0 }}>MeloCalé · visão geral do ecossistema</p>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          {(s.openTickets ?? 0) > 0 && (
            <Link to="/admin/suporte" style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:8, padding:'5px 12px', textDecoration:'none' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444' }} />
              <span style={{ fontSize:12, color:'#f87171', fontWeight:700 }}>{s.openTickets} tickets abertos</span>
            </Link>
          )}
          <button onClick={() => refetch()} style={{ display:'flex', alignItems:'center', gap:5, background:'#132540', border:'1px solid rgba(255,255,255,.06)', borderRadius:8, padding:'5px 12px', color:'#4a6580', cursor:'pointer', fontSize:12 }}>
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>
      </div>

      {/* ROW 1: KPIs críticos */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.625rem' }}>
        {[
          { label:'MRR', value:`R$${s.mrr}`, sub: s.mrr === 0 ? '0 assinaturas ativas' : `${Object.values(s.packageBreakdown).filter((_, i) => Object.keys(s.packageBreakdown)[i]?.startsWith('plan_')).length} planos`, color:'#10b981', border:'rgba(16,185,129,.3)', bg:'linear-gradient(135deg,#0b2818,#0f3020)', warn: s.mrr === 0 },
          { label:'Faturamento total', value:`R$${Math.round(s.totalRevenue).toLocaleString('pt-BR')}`, sub:`${Object.values(s.packageBreakdown).reduce((a, b) => a + b.qtd, 0)} pagamentos`, color:'white', border:'rgba(255,255,255,.06)', bg:'#132540' },
          { label:'Profissionais', value: String(s.totalProfessionals), sub:`Ativos (24h): ${activeUsers ?? '—'}`, color:'white', border:'rgba(255,255,255,.06)', bg:'#132540' },
          { label:'Churn', value: String(s.churnCount), sub: s.churnCount > 0 ? 'cancelando agora' : 'nenhum cancelamento', color: s.churnCount > 0 ? '#f87171' : '#34d399', border: s.churnCount > 0 ? 'rgba(239,68,68,.25)' : 'rgba(255,255,255,.06)', bg:'#132540', warn: s.churnCount > 0 },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, border:`1px solid ${k.border}`, borderRadius:12, padding:'1rem', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background: k.color === '#10b981' ? 'linear-gradient(90deg,#10b981,#059669)' : k.color === '#f87171' ? '#ef4444' : '#3b82f6' }} />
            <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color: k.color === 'white' ? '#4a6580' : k.color, margin:'0 0 6px' }}>{k.label}</p>
            <p style={{ fontSize:22, fontWeight:700, color: k.color, margin:0, lineHeight:1 }}>{k.value}</p>
            <p style={{ fontSize:10, color: k.warn ? '#f87171' : '#4a6580', margin:'4px 0 0' }}>{k.warn && k.label === 'MRR' ? '⚠ ' : ''}{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ROW 2: Gráfico mensal + Funil */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>

        {/* Gráfico mensal */}
        <div style={{ background:'#132540', border:'1px solid rgba(255,255,255,.06)', borderRadius:12, padding:'1.25rem' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
            <p style={{ fontSize:13, fontWeight:700, color:'white', margin:0 }}>Faturamento mensal</p>
            <div style={{ display:'flex', gap:8, fontSize:10 }}>
              <span style={{ display:'flex', alignItems:'center', gap:3, color:'#4a6580' }}><span style={{ width:8, height:3, background:'#10b981', borderRadius:2, display:'inline-block' }}></span>Assinaturas</span>
              <span style={{ display:'flex', alignItems:'center', gap:3, color:'#4a6580' }}><span style={{ width:8, height:3, background:'#f59e0b', borderRadius:2, display:'inline-block' }}></span>Moedas</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:'0.75rem', alignItems:'flex-end', height:90, marginBottom:'0.5rem' }}>
            {monthKeys.map(k => {
              const h = Math.round(((s.monthlyRevenue[k] ?? 0) / maxMonthRevenue) * 80);
              return (
                <div key={k} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                  <span style={{ fontSize:10, color:'#94a3b8', fontWeight:600 }}>R${Math.round(s.monthlyRevenue[k] ?? 0)}</span>
                  <div style={{ width:'100%', background:'#10b981', borderRadius:'4px 4px 0 0', height:h || 4 }} />
                  <span style={{ fontSize:10, color:'#4a6580' }}>{fmtMonth(k)}</span>
                </div>
              );
            })}
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <span style={{ fontSize:10, color:'#4a6580' }}>—</span>
              <div style={{ width:'100%', background:'rgba(255,255,255,.04)', border:'1px dashed rgba(255,255,255,.08)', borderRadius:4, height:10 }} />
              <span style={{ fontSize:10, color:'#4a6580' }}>Jun</span>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'0.75rem', borderTop:'1px solid rgba(255,255,255,.05)' }}>
            <span style={{ fontSize:11, color:'#4a6580' }}>Ticket médio</span>
            <span style={{ fontSize:11, color:'white', fontWeight:600 }}>R${fmtBRL(s.totalRevenue / Math.max(Object.values(s.packageBreakdown).reduce((a, b) => a + b.qtd, 0), 1))}</span>
          </div>
        </div>

        {/* Funil */}
        <div style={{ background:'#132540', border:'1px solid rgba(255,255,255,.06)', borderRadius:12, padding:'1.25rem' }}>
          <p style={{ fontSize:13, fontWeight:700, color:'white', margin:'0 0 1rem' }}>Funil de conversão</p>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {[
              { label:'Cadastros totais', value: s.totalUsers, pct: 100, color:'#3b82f6' },
              { label:'Profissionais', value: s.totalProfessionals, pct: s.totalUsers ? Math.round((s.totalProfessionals / s.totalUsers) * 100) : 0, color:'#8b5cf6' },
              { label:'Pagaram', value: Object.keys(s.packageBreakdown).length > 0 ? 1 : 0, pct: s.totalProfessionals ? Math.round((1 / Math.max(s.totalProfessionals, 1)) * 100) : 0, color:'#10b981' },
              { label:'Ativos agora (MRR)', value: s.mrr > 0 ? 1 : 0, pct: 0, color:'#ef4444' },
            ].map(f => (
              <div key={f.label}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:11, color:'#94a3b8' }}>{f.label}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:'white' }}>{f.value} {f.pct > 0 && f.pct < 100 && <span style={{ color:'#4a6580', fontWeight:400 }}>({f.pct}%)</span>}</span>
                </div>
                <div style={{ height:5, background:'rgba(255,255,255,.06)', borderRadius:4 }}>
                  <div style={{ width:`${f.pct}%`, height:'100%', background:f.color, borderRadius:4 }} />
                </div>
              </div>
            ))}
            {s.mrr === 0 && (
              <div style={{ marginTop:4, padding:'8px', background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.15)', borderRadius:8 }}>
                <p style={{ fontSize:11, color:'#f87171', margin:0, fontWeight:600 }}>⚠ Foco em reativar assinatura cancelando</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 3: Assinaturas + Moedas avulsas */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>

        {/* Assinaturas */}
        <div style={{ background:'#132540', border:'1px solid rgba(255,255,255,.06)', borderRadius:12, padding:'1.25rem' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
            <p style={{ fontSize:13, fontWeight:700, color:'white', margin:0 }}>Assinaturas</p>
            <span style={{ fontSize:11, fontWeight:700, color:'#34d399' }}>R${fmtBRL(s.revenueSubscriptions)} total</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {subEntries.length > 0 ? subEntries.map(([pkg, data]) => (
              <div key={pkg} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(0,0,0,.2)', borderRadius:8, padding:'0.625rem 0.875rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#34d399', flexShrink:0 }} />
                  <div>
                    <p style={{ fontSize:12, color:'white', fontWeight:600, margin:0 }}>{pkg}</p>
                    <p style={{ fontSize:10, color:'#4a6580', margin:0 }}>{data.qtd} pagamentos</p>
                  </div>
                </div>
                <p style={{ fontSize:13, fontWeight:700, color:'#34d399', margin:0 }}>R${fmtBRL(data.total)}</p>
              </div>
            )) : (
              <p style={{ fontSize:12, color:'#4a6580', textAlign:'center', padding:'1rem 0' }}>Nenhuma assinatura ainda</p>
            )}
            {s.churnCount > 0 && (
              <div style={{ padding:'8px 12px', background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.15)', borderRadius:8 }}>
                <p style={{ fontSize:11, color:'#f87171', margin:0, fontWeight:600 }}>⚠ {s.churnCount} assinatura(s) cancelando</p>
              </div>
            )}
          </div>
        </div>

        {/* Moedas avulsas */}
        <div style={{ background:'#132540', border:'1px solid rgba(255,255,255,.06)', borderRadius:12, padding:'1.25rem' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
            <p style={{ fontSize:13, fontWeight:700, color:'white', margin:0 }}>Moedas avulsas</p>
            <span style={{ fontSize:11, fontWeight:700, color:'#fbbf24' }}>R${fmtBRL(s.revenueCoinPacks)} total</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {coinEntries.length > 0 ? coinEntries.map(([pkg, data]) => (
              <div key={pkg} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(0,0,0,.2)', borderRadius:8, padding:'0.625rem 0.875rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#fbbf24', flexShrink:0 }} />
                  <div>
                    <p style={{ fontSize:12, color:'white', fontWeight:600, margin:0 }}>{pkg}</p>
                    <p style={{ fontSize:10, color:'#4a6580', margin:0 }}>{data.qtd} vendas</p>
                  </div>
                </div>
                <p style={{ fontSize:13, fontWeight:700, color:'#fbbf24', margin:0 }}>R${fmtBRL(data.total)}</p>
              </div>
            )) : (
              <p style={{ fontSize:12, color:'#4a6580', textAlign:'center', padding:'1rem 0' }}>Nenhuma venda ainda</p>
            )}
            <div style={{ padding:'8px 12px', background:'rgba(251,191,36,.06)', border:'1px solid rgba(251,191,36,.12)', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, color:'#4a6580', display:'flex', alignItems:'center', gap:5 }}><Coins size={12} color="#fbbf24" /> Em circulação</span>
              <span style={{ fontSize:11, fontWeight:700, color:'#fbbf24' }}>{s.totalCoinsCirculation} moedas</span>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 4: Oferta vs Demanda + Alertas */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>

        {/* Oferta vs Demanda */}
        <div style={{ background:'#132540', border:'1px solid rgba(255,255,255,.06)', borderRadius:12, padding:'1.25rem' }}>
          <p style={{ fontSize:13, fontWeight:700, color:'white', margin:'0 0 1rem' }}>Oferta vs Demanda por cidade</p>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {(cityData ?? [
              { city:'Jacobina', pros:0, leads:0 },
              { city:'Feira de Santana', pros:0, leads:0 },
              { city:'Irecê', pros:0, leads:0 },
              { city:'Senhor do Bonfim', pros:0, leads:0 },
            ]).map(c => (
              <div key={c.city} style={{ background:'rgba(0,0,0,.2)', borderRadius:8, padding:'0.75rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:12, fontWeight:600, color: c.pros > 0 ? 'white' : '#4a6580' }}>{c.city}</span>
                  <span style={{ fontSize:10, color: c.pros === 0 && c.leads === 0 ? '#4a6580' : c.pros > 0 && c.leads === 0 ? '#fbbf24' : '#34d399', fontWeight:600 }}>
                    {c.pros === 0 && c.leads === 0 ? 'sem dados' : c.pros > 0 && c.leads === 0 ? 'sem demanda' : 'ativo'}
                  </span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, textAlign:'center' }}>
                  <div><p style={{ fontSize:16, fontWeight:700, color:'#34d399', margin:0 }}>{c.pros}</p><p style={{ fontSize:10, color:'#4a6580', margin:0 }}>profissionais</p></div>
                  <div><p style={{ fontSize:16, fontWeight:700, color:'#60a5fa', margin:0 }}>{c.leads}</p><p style={{ fontSize:10, color:'#4a6580', margin:0 }}>pedidos abertos</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas + Últimos profissionais */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          <div style={{ background:'#132540', border:'1px solid rgba(255,255,255,.06)', borderRadius:12, padding:'1.25rem', flex:1 }}>
            <p style={{ fontSize:13, fontWeight:700, color:'white', margin:'0 0 0.875rem' }}>Alertas operacionais</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {[
                { icon:<Ticket size={14} />, label:`${s.openTickets ?? 0} tickets de suporte`, sub: (s.openTickets ?? 0) > 0 ? 'Requer atenção hoje' : 'Tudo em ordem', color: (s.openTickets ?? 0) > 0 ? '#f87171' : '#34d399', bg: (s.openTickets ?? 0) > 0 ? 'rgba(239,68,68,.06)' : 'rgba(16,185,129,.06)', border: (s.openTickets ?? 0) > 0 ? 'rgba(239,68,68,.15)' : 'rgba(16,185,129,.15)' },
                { icon:<AlertTriangle size={14} />, label:`${s.churnCount} cancelando`, sub: s.churnCount > 0 ? 'Oportunidade de retenção' : 'Sem cancelamentos', color: s.churnCount > 0 ? '#fbbf24' : '#34d399', bg: s.churnCount > 0 ? 'rgba(245,158,11,.06)' : 'rgba(16,185,129,.06)', border: s.churnCount > 0 ? 'rgba(245,158,11,.15)' : 'rgba(16,185,129,.15)' },
                { icon:<AlertTriangle size={14} />, label:`${s.pendingDisputes} denúncias`, sub: s.pendingDisputes > 0 ? 'Requer atenção' : 'Tudo em ordem', color: s.pendingDisputes > 0 ? '#f87171' : '#34d399', bg: s.pendingDisputes > 0 ? 'rgba(239,68,68,.06)' : 'rgba(16,185,129,.06)', border: s.pendingDisputes > 0 ? 'rgba(239,68,68,.15)' : 'rgba(16,185,129,.15)' },
              ].map((a, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, background:a.bg, border:`1px solid ${a.border}`, borderRadius:8, padding:'0.625rem 0.875rem' }}>
                  <span style={{ color:a.color, flexShrink:0 }}>{a.icon}</span>
                  <div>
                    <p style={{ fontSize:12, fontWeight:600, color:a.color, margin:0 }}>{a.label}</p>
                    <p style={{ fontSize:11, color:'#4a6580', margin:'2px 0 0' }}>{a.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:'#132540', border:'1px solid rgba(255,255,255,.06)', borderRadius:12, padding:'1.25rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.75rem' }}>
              <p style={{ fontSize:13, fontWeight:700, color:'white', margin:0 }}>Últimos profissionais</p>
              <Link to="/admin/usuarios" style={{ fontSize:11, color:'#34d399', textDecoration:'none', display:'flex', alignItems:'center', gap:3 }}>Ver todos <ChevronRight size={11} /></Link>
            </div>
            {(recentPros ?? []).slice(0, 2).map((pro: { id: string; full_name?: string | null; email?: string | null; category?: string | null; created_at?: string | null }) => (
              <div key={pro.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'0.5rem' }}>
                <div style={{ width:32, height:32, borderRadius:8, background:'rgba(16,185,129,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#34d399', flexShrink:0 }}>
                  {(pro.full_name || pro.email || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:12, fontWeight:600, color:'white', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pro.full_name || pro.email || '—'}</p>
                  <p style={{ fontSize:10, color:'#4a6580', margin:0 }}>{pro.category || 'Profissional'} · {pro.created_at ? new Date(pro.created_at).toLocaleDateString('pt-BR') : '—'}</p>
                </div>
              </div>
            ))}
            {!(recentPros ?? []).length && <p style={{ fontSize:12, color:'#4a6580' }}>Nenhum profissional ainda.</p>}
          </div>
        </div>
      </div>

    </div>
  );
}
