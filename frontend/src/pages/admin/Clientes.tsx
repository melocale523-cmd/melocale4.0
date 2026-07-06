import { useMemo, useState } from 'react';
import { Search, Loader2, MapPin, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminService, type EnrichedUser } from '../../services/dbServices';

type ChipFilter = 'all' | 'never' | 'recurring';

const PAGE_SIZE = 20;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function initials(name: string | null): string {
  if (!name?.trim()) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const full = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${full}`;
}

const ORIGIN_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  meta_ads: { label: 'Meta Ads', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' },
  organic:  { label: 'Orgânico', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)' },
  referral: { label: 'Indicação', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)' },
};

function OriginBadge({ origin }: { origin: string | null }) {
  const b = origin ? ORIGIN_BADGE[origin] : undefined;
  if (!b) return <span style={{ fontSize: 12, color: '#4a6580' }}>—</span>;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: b.bg, color: b.color, border: `0.5px solid ${b.border}` }}>
      {b.label}
    </span>
  );
}

// Mesmo padrão do Hint de Aprovados.tsx, adaptado pro contexto de cliente
function ClientInsight({ totalLeads }: { totalLeads: number }) {
  if (totalLeads === 0)
    return <span style={{ fontSize: 11, color: '#f59e0b' }}>⚠ Nunca criou pedido</span>;
  return <span style={{ fontSize: 11, color: '#34d399' }}>✓ Criou {totalLeads} pedido{totalLeads === 1 ? '' : 's'}</span>;
}

export default function AdminClientes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [chip, setChip] = useState<ChipFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  // Mesma query (e queryKey) da tela Usuários — cache compartilhado
  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['adminUsersEnriched'],
    queryFn: async () => {
      const [users, authData] = await Promise.all([
        adminService.getUsersEnriched(),
        adminService.getUserAuthData(),
      ]);
      return users.map(u => ({
        ...u,
        email: authData[u.id]?.email ?? u.email,
        last_sign_in_at: authData[u.id]?.last_sign_in_at ?? u.last_sign_in_at,
      }));
    },
    staleTime: 60_000,
  });

  const clientes = useMemo(() => usuarios.filter(u => u.role === 'client'), [usuarios]);

  const kpis = useMemo(() => {
    const total = clientes.length;
    const never = clientes.filter(c => c.total_leads === 0).length;
    const recurring = clientes.filter(c => c.total_leads > 1).length;
    const metaAds = clientes.filter(c => c.origin === 'meta_ads').length;
    const metaPct = total > 0 ? Math.round((metaAds / total) * 100) : 0;
    return [
      { label: 'Total clientes', value: String(total), color: 'white' },
      { label: 'Nunca pediram', value: String(never), color: '#f59e0b' },
      { label: 'Recorrentes', value: String(recurring), color: '#34d399' },
      { label: 'Via Meta Ads', value: `${metaAds} (${metaPct}%)`, color: '#a78bfa' },
    ];
  }, [clientes]);

  const chipCounts: Record<ChipFilter, number> = useMemo(() => ({
    all: clientes.length,
    never: clientes.filter(c => c.total_leads === 0).length,
    recurring: clientes.filter(c => c.total_leads > 1).length,
  }), [clientes]);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return clientes.filter(c => {
      const matchChip =
        chip === 'all' ||
        (chip === 'never' && c.total_leads === 0) ||
        (chip === 'recurring' && c.total_leads > 1);
      const matchSearch = !q ||
        (c.full_name ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q);
      return matchChip && matchSearch;
    });
  }, [clientes, chip, searchTerm]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedClients = filtered.filter(c => selected.has(c.id));

  const contactSelected = async () => {
    const phones = selectedClients
      .map(c => c.phone?.replace(/\D/g, ''))
      .filter((d): d is string => !!d)
      .map(d => `+${d.startsWith('55') ? d : `55${d}`}`);
    if (phones.length === 0) {
      toast.error('Nenhum cliente selecionado tem telefone cadastrado.');
      return;
    }
    try {
      await navigator.clipboard.writeText(phones.join('\n'));
      toast.success(`${phones.length} número${phones.length === 1 ? '' : 's'} copiado${phones.length === 1 ? '' : 's'} para a área de transferência.`);
    } catch {
      toast.error('Não foi possível copiar. Tente novamente.');
    }
  };

  const exportCSV = (rows: EnrichedUser[]) => {
    const headers = ['Nome', 'Email', 'Telefone', 'Cidade', 'Origem', 'Pedidos criados', 'Agendamentos', 'Último acesso', 'Cadastro'];
    const body = rows.map(c => [
      c.full_name ?? '', c.email ?? '', c.phone ?? '', c.city ?? '',
      c.origin ?? '', String(c.total_leads), String(c.total_appointments),
      c.last_sign_in_at ?? '', c.created_at,
    ]);
    const csv = [headers, ...body].map(r => r.map(x => `"${x}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'clientes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const chipLabels: Record<ChipFilter, string> = { all: 'Todos', never: 'Nunca pediram', recurring: 'Recorrentes' };
  const kpiColors = ['white', '#f59e0b', '#34d399', '#a78bfa'];

  return (
    <div className="space-y-11 animate-in fade-in duration-500">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Clientes</h1>
          <p className="text-[#94A3B8] mt-6">Lista de todos os usuários com o perfil de cliente.</p>
        </div>
        <button
          onClick={() => exportCSV(filtered)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#132540', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, color: '#4a6580', fontSize: 12, cursor: 'pointer' }}
        >
          Exportar CSV
        </button>
      </div>

      {/* KPIs — mesmo estilo dos cards de Aprovados */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.625rem' }}>
        {kpis.map((k, i) => (
          <div key={k.label} style={{ background: '#132540', border: '1.5px solid rgba(255,255,255,0.07)', borderRadius: '.5rem', padding: '.875rem 1rem', display: 'flex', alignItems: 'stretch', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: kpiColors[i] }} />
            <div style={{ paddingLeft: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', margin: '0 0 5px' }}>{k.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: kpiColors[i], margin: 0, lineHeight: 1 }}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar: chips + busca */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {(['all', 'never', 'recurring'] as ChipFilter[]).map(c => (
            <button
              key={c}
              onClick={() => { setChip(c); setPage(0); }}
              style={{ height: 34, padding: '0 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: chip === c ? '1px solid rgba(29,158,117,0.3)' : '1px solid rgba(255,255,255,0.08)', background: chip === c ? 'rgba(29,158,117,0.12)' : 'transparent', color: chip === c ? '#34d399' : '#64748b' }}
            >
              {chipLabels[c]} <span style={{ opacity: .6 }}>({chipCounts[c]})</span>
            </button>
          ))}
        </div>
        <div className="flex-1 relative group" style={{ minWidth: 220 }}>
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A6580] group-focus-within:text-emerald-500 transition-colors" size={16} />
           <input
             type="text"
             value={searchTerm}
             onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
             placeholder="Buscar por nome, email ou cidade..."
             maxLength={255}
             className="w-full bg-[#1C3454] border border-slate-800 rounded-xl pl-12 pr-4 py-8 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
           />
        </div>
      </div>

      {/* Barra de seleção em massa */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.625rem 1rem', background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: 10 }}>
          <span style={{ fontSize: 13, color: '#34d399', fontWeight: 600 }}>
            {selected.size} cliente{selected.size === 1 ? '' : 's'} selecionado{selected.size === 1 ? '' : 's'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={contactSelected}
              style={{ height: 32, padding: '0 14px', borderRadius: 8, background: '#1D9E75', border: 'none', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <MessageSquare size={12} /> Contatar selecionados
            </button>
            <button
              onClick={() => setSelected(new Set())}
              style={{ height: 32, padding: '0 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-[#1C3454] border border-slate-800 rounded-2xl overflow-hidden">
         {isLoading ? (
           <div className="flex justify-center p-12"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
         ) : (
           <div className="overflow-x-auto">
           <table className="w-full text-left">
             <thead>
               <tr className="border-b border-[#1C3050] text-sm text-[#94A3B8] font-medium">
                 <th className="p-9 pl-6" style={{ width: 36 }}>
                   <input
                     type="checkbox"
                     checked={pageItems.length > 0 && pageItems.every(c => selected.has(c.id))}
                     onChange={e => {
                       setSelected(prev => {
                         const next = new Set(prev);
                         pageItems.forEach(c => { if (e.target.checked) next.add(c.id); else next.delete(c.id); });
                         return next;
                       });
                     }}
                     style={{ accentColor: '#1D9E75', cursor: 'pointer' }}
                   />
                 </th>
                 <th className="p-9">Cliente</th>
                 <th className="p-9">Origem</th>
                 <th className="p-9">Pedidos criados</th>
                 <th className="p-9">Agendamentos</th>
                 <th className="p-9">Último acesso</th>
                 <th className="p-9">Insight</th>
                 <th className="p-9 pr-6">Ação</th>
               </tr>
             </thead>
             <tbody>
               {pageItems.map(c => (
                 <tr key={c.id} className="border-b border-[#1C3050] hover:bg-slate-800/20 transition-colors group">
                   <td className="p-9 pl-6">
                     <input
                       type="checkbox"
                       checked={selected.has(c.id)}
                       onChange={() => toggleSelect(c.id)}
                       style={{ accentColor: '#1D9E75', cursor: 'pointer' }}
                     />
                   </td>
                   <td className="p-9">
                     <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                       {c.avatar_url ? (
                         <img src={c.avatar_url} alt={c.full_name ?? ''} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                       ) : (
                         <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#60a5fa', flexShrink: 0 }}>
                           {initials(c.full_name)}
                         </div>
                       )}
                       <div style={{ minWidth: 0 }}>
                         <p style={{ fontSize: 13, fontWeight: 600, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name ?? 'Sem nome'}</p>
                         <p style={{ fontSize: 11, color: '#64748b', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                           <MapPin size={9} /> {c.city ?? 'Cidade não informada'}
                           {c.email && <><span style={{ opacity: .4 }}>·</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{c.email}</span></>}
                         </p>
                       </div>
                     </div>
                   </td>
                   <td className="p-9"><OriginBadge origin={c.origin} /></td>
                   <td className="p-9 text-white font-medium">{c.total_leads}</td>
                   <td className="p-9 text-[#94A3B8]">{c.total_appointments}</td>
                   <td className="p-9 text-[#94A3B8]">{formatDate(c.last_sign_in_at)}</td>
                   <td className="p-9"><ClientInsight totalLeads={c.total_leads} /></td>
                   <td className="p-9 pr-6">
                     {c.phone ? (
                       <a
                         href={waLink(c.phone)}
                         target="_blank"
                         rel="noopener noreferrer"
                         style={{ height: 30, padding: '0 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(29,158,117,0.35)', color: '#34d399', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                       >
                         <MessageSquare size={11} /> Contatar
                       </a>
                     ) : (
                       <span style={{ fontSize: 11, color: '#4a6580' }}>Sem telefone</span>
                     )}
                   </td>
                 </tr>
               ))}
               {pageItems.length === 0 && (
                 <tr>
                   <td colSpan={8} className="p-8 text-center text-[#4A6580]">Nenhum cliente encontrado.</td>
                 </tr>
               )}
             </tbody>
           </table>
           </div>
         )}

         {/* Paginação */}
         {!isLoading && filtered.length > 0 && (
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
             <span style={{ fontSize: 12, color: '#64748b' }}>
               Mostrando {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
             </span>
             <div style={{ display: 'flex', gap: 6 }}>
               <button
                 onClick={() => setPage(p => Math.max(0, p - 1))}
                 disabled={safePage === 0}
                 style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: safePage === 0 ? '#33465e' : '#94a3b8', cursor: safePage === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
               >
                 <ChevronLeft size={14} />
               </button>
               <button
                 onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                 disabled={safePage >= pageCount - 1}
                 style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: safePage >= pageCount - 1 ? '#33465e' : '#94a3b8', cursor: safePage >= pageCount - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
               >
                 <ChevronRight size={14} />
               </button>
             </div>
           </div>
         )}
      </div>
    </div>
  );
}
