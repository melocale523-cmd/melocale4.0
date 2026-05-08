import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { leadService, walletService } from '../../services/dbServices';
import { MapPin, Loader2, ShoppingCart, SlidersHorizontal, Ghost, CheckCircle2, ArrowRight, Navigation, Coins, Search, X, DollarSign, Plus, Trash2, Filter, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import LoadingSpinner from '../../components/LoadingSpinner';
import { cn } from '../../lib/utils';

export default function ProfessionalLeads() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    category: 'Todas',
    specialty: 'Todas',
    city: '',
    radius: 30,
    minBudget: 0,
    maxBudget: 10000,
    coinCost: 500,
  });

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: leadService.getAvailableLeads,
  });

  const categories = ['Todas', ...new Set(leads?.map(l => l.category).filter(Boolean) || [])];
  const specialties = ['Todas', 'Pintura', 'Elétrica', 'Hidráulica', 'Alvenaria', 'Gesso', 'Marcenaria', 'Jardinagem', 'Limpeza'];

  const filteredLeads = leads?.filter(lead => {
    const title = lead.title.toLowerCase();
    const location = (lead.location || lead.city || '').toLowerCase();
    const search = filters.search.toLowerCase();
    const city = filters.city.toLowerCase();

    const matchesSearch = !filters.search || title.includes(search) || location.includes(search);
    const matchesCategory = filters.category === 'Todas' || lead.category === filters.category;
    const matchesSpecialty = filters.specialty === 'Todas' || lead.title.includes(filters.specialty) || lead.category === filters.specialty;
    const matchesCity = !filters.city || location.includes(city);
    
    const price = lead.price_coins || lead.budget_coins || 0;
    const matchesCoinCost = price <= filters.coinCost;
    
    const leadBudget = lead.budget_max || lead.budget_min || 0;
    const matchesBudget = leadBudget === 0 || (leadBudget >= filters.minBudget && leadBudget <= filters.maxBudget);
    const matchesRadius = true;

    return matchesSearch && matchesCategory && matchesSpecialty && matchesCity && matchesCoinCost && matchesBudget && matchesRadius;
  });

  const { data: balance, isLoading: walletLoading } = useQuery({
    queryKey: ['walletBalance'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: walletService.getBalance,
  });

  const [purchasedLead, setPurchasedLead] = useState<{ title: string, price: number } | null>(null);
  const [lightboxImg, setLightboxImg] = useState<{ images: string[]; index: number } | null>(null);

  useEffect(() => {
    if (!lightboxImg) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxImg(null);
      if (e.key === 'ArrowRight') setLightboxImg(prev => prev && prev.index < prev.images.length - 1 ? { ...prev, index: prev.index + 1 } : prev);
      if (e.key === 'ArrowLeft') setLightboxImg(prev => prev && prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxImg]);

  const purchaseMutation = useMutation({
    mutationFn: ({ id, price, title }: { id: string, price: number, title: string }) =>
      leadService.purchaseLead(id).then(() => ({ id, price, title })),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
      setPurchasedLead(data);
    },
    onError: (error) => toast.error(`Erro: ${error.message}`)
  });

  const handlePurchase = (lead: { id: string; price_coins?: number; title: string }) => {
    const coinBalance = typeof balance === 'number' ? Math.floor(balance) : 0;
    const leadPrice = lead.price_coins || 1;
    if (coinBalance <= 0 || coinBalance < leadPrice) {
      toast.error(`Saldo insuficiente. Você tem ${coinBalance} moedas e este lead custa ${leadPrice}.`);
      return;
    }
    purchaseMutation.mutate({ id: lead.id, price: leadPrice, title: lead.title });
  };

  const getBadges = (lead: { expires_at?: string; created_at: string; budget_max?: number; category?: string; city?: string; location?: string }): { label: string; color: string; icon: string }[] => {
    const badges: { label: string; color: string; icon: string }[] = [];
    const now = new Date();
    const expires = lead.expires_at ? new Date(lead.expires_at) : null;
    const diffDays = expires ? (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) : null;
    const created = new Date(lead.created_at);
    const hoursOld = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

    if (diffDays !== null && diffDays < 3)
      badges.push({ label: 'Urgente', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: '🔥' });
    if ((lead.budget_max || 0) > 2000)
      badges.push({ label: 'Premium', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: '💰' });
    if (['Elétrica', 'Hidráulica', 'Gás'].some(c => lead.category?.includes(c)))
      badges.push({ label: 'Especializado', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: '⚡' });
    if (lead.city || lead.location)
      badges.push({ label: 'Localizado', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: '📍' });
    if (hoursOld < 24)
      badges.push({ label: 'Novo', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: '🆕' });

    return badges;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
           {/* Saldo Alert - Agora no topo */}
      <div className="bg-gradient-to-r from-[#14161B] to-[#0A0B0D] border border-white/5 rounded-[2rem] p-5 flex items-center justify-between shadow-2xl relative overflow-hidden group">
         <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
         <div className="flex items-center gap-4 relative z-10">
           <div className="w-14 h-14 bg-yellow-500/10 text-yellow-500 rounded-2xl flex items-center justify-center shadow-inner">
             <Coins size={32} />
           </div>
           <div>
             <p className="text-[12px] text-slate-500 font-bold uppercase tracking-widest mb-1">Saldo Disponível</p>
             <p className="text-4xl font-black text-white leading-none">
               {walletLoading ? '...' : (typeof balance === 'number' ? Math.floor(balance) : 0)} <span className="text-lg font-bold text-yellow-500 uppercase tracking-widest ml-1">moedas</span>
             </p>
           </div>
         </div>
         <Link to="/profissional/carteira" className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20 active:scale-95 relative z-10 flex items-center gap-2">
            <Plus size={18} /> Recarregar Saldo
         </Link>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 group w-full">
          <input 
            type="text" 
            placeholder="Qual serviço você procura? (ex: Pintura, Elétrica...)"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="w-full bg-[#14161B] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium shadow-lg"
          />
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={() => setIsFilterOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#14161B] border border-white/5 hover:border-emerald-500/30 text-white font-bold px-6 py-4 rounded-2xl text-sm transition-all shadow-lg hover:shadow-emerald-500/10"
          >
             <SlidersHorizontal size={20} /> Filtros Avançados
          </button>
          
          {(filters.search || filters.city || filters.category !== 'Todas' || filters.specialty !== 'Todas' || filters.minBudget > 0) && (
            <button 
              onClick={() => setFilters({ search: '', category: 'Todas', specialty: 'Todas', city: '', radius: 30, minBudget: 0, maxBudget: 10000, coinCost: 500 })}
              className="p-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-lg"
              title="Limpar todos os filtros"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Popover/Modal de Filtros Avançados */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsFilterOpen(false)}></div>
          <div className="relative bg-[#0A0B0D] border border-white/10 rounded-[2.5rem] p-8 sm:p-10 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 ring-1 ring-white/5">
            <button 
              onClick={() => setIsFilterOpen(false)}
              className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
              <Filter className="text-emerald-500" /> Filtros Detalhados
            </h3>
            <p className="text-slate-500 text-sm mb-8">Refine sua busca para encontrar os clientes ideais.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <MapPin size={14} className="text-emerald-500" /> Cidade
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ex: São Paulo"
                    value={filters.city}
                    onChange={e => setFilters(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full bg-[#14161B] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all font-medium"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Navigation size={14} className="text-emerald-500" /> Raio Máximo (KM)
                  </label>
                  <input 
                    type="range" min="5" max="100" step="5"
                    value={filters.radius}
                    onChange={e => setFilters(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
                    className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-xs font-mono text-slate-500 font-bold">
                    <span>5km</span>
                    <span className="text-emerald-400 bg-emerald-500/10 px-2 rounded">{filters.radius}km</span>
                    <span>100km</span>
                  </div>
                </div>

                <div className="space-y-3 relative">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Star size={14} className="text-emerald-500" /> Especialidade
                  </label>
                  <div className="relative">
                    <select 
                      value={filters.specialty}
                      onChange={(e) => setFilters(prev => ({ ...prev, specialty: e.target.value }))}
                      className="w-full bg-[#14161B] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none cursor-pointer appearance-none font-medium"
                    >
                      {specialties.map(spec => (
                        <option key={spec} value={spec}>{spec}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 relative">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <ShoppingCart size={14} className="text-emerald-500" /> Categoria
                  </label>
                  <div className="relative">
                    <select 
                      value={filters.category}
                      onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-[#14161B] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none cursor-pointer appearance-none font-medium"
                    >
                      <option value="Todas">⭐️ Todas as Categorias</option>
                      {categories.filter(c => c !== 'Todas').map(cat => (
                        <option key={cat} value={cat}>🛠️ {cat}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <DollarSign size={14} className="text-emerald-500" /> Orçamento Prestado
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                      <input 
                        type="number" placeholder="Mínimo"
                        value={filters.minBudget}
                        onChange={e => setFilters(prev => ({ ...prev, minBudget: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-[#14161B] border border-white/5 rounded-xl pl-9 pr-3 py-3 text-white text-sm focus:outline-none font-medium"
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                      <input 
                        type="number" placeholder="Máximo"
                        value={filters.maxBudget}
                        onChange={e => setFilters(prev => ({ ...prev, maxBudget: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-[#14161B] border border-white/5 rounded-xl pl-9 pr-3 py-3 text-white text-sm focus:outline-none font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Coins size={14} className="text-yellow-500" /> Custo Contato (Moedas)
                  </label>
                  <input 
                    type="range" min="10" max="1000" step="10"
                    value={filters.coinCost}
                    onChange={e => setFilters(prev => ({ ...prev, coinCost: parseInt(e.target.value) }))}
                    className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                  />
                  <div className="flex justify-between text-xs font-mono text-slate-500 font-bold">
                    <span>10</span>
                    <span className="text-yellow-400 bg-yellow-500/10 px-2 rounded">{filters.coinCost} moedas</span>
                    <span>1000</span>
                  </div>
                </div>
                
                <div className="pt-10 flex gap-4">
                  <button 
                    onClick={() => {
                      setFilters({ search: '', category: 'Todas', specialty: 'Todas', city: '', radius: 30, minBudget: 0, maxBudget: 10000, coinCost: 500 });
                    }}
                    className="flex-1 py-4 border border-white/5 hover:bg-red-500/10 hover:text-red-500 text-slate-400 font-bold rounded-2xl transition-all text-xs uppercase flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} /> Resetar Filtros
                  </button>
                  <button 
                    onClick={() => setIsFilterOpen(false)}
                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all text-xs uppercase shadow-lg shadow-emerald-500/20"
                  >
                    Aplicar Filtros
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Success Modal */}
      {purchasedLead && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPurchasedLead(null)}></div>
          <div className="relative bg-[#14161B] border border-emerald-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-bold text-white text-center mb-2">Cliente Adquirido!</h2>
            <p className="text-slate-400 text-center mb-8">
              Você agora tem acesso completo aos dados do cliente <span className="text-white font-bold">{purchasedLead.title}</span>.
            </p>
            
            <div className="bg-[#0A0B0D] border border-white/5 rounded-2xl p-4 mb-8">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Investimento:</span>
                <span className="text-emerald-400 font-bold font-mono">{purchasedLead.price} moedas</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => navigate('/profissional/meus-leads')} 
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                Ver Meus Clientes <ArrowRight size={18} />
              </button>
              <button 
                onClick={() => setPurchasedLead(null)} 
                className="w-full py-3 text-slate-500 hover:text-white font-medium transition-colors text-sm"
              >
                Continuar Comprando
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          Clientes Disponíveis 
          <span className="text-xs font-medium px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-slate-500">
            {filteredLeads?.length || 0} encontrados
          </span>
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {leadsLoading ? (
          <div className="col-span-full py-24 flex justify-center">
             <LoadingSpinner size={32} label="Buscando novos clientes..." />
          </div>
        ) : (
          filteredLeads?.map((lead) => (
             <div key={lead.id} className={cn(
                "bg-[#14161B] border rounded-[2rem] p-6 flex flex-col transition-all group relative overflow-hidden text-left",
                getBadges(lead).some(b => b.label === 'Urgente')
                  ? "border-red-500/40 animate-pulse"
                  : "border-white/5 hover:border-emerald-500/30"
             )}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-emerald-500/10 transition-all"></div>
                
                <div className="flex-1 relative z-10">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                       {getBadges(lead).length > 0 && (
                         <div className="flex flex-wrap gap-1.5 mb-3">
                           {getBadges(lead).map((b, i) => (
                             <span key={i} className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-lg border ${b.color}`}>
                               {b.icon} {b.label}
                             </span>
                           ))}
                         </div>
                       )}
                     </div>
                     <div className="text-right shrink-0 ml-2">
                       <span className="text-xl font-mono font-bold text-emerald-400 block tracking-tighter">{lead.price_coins || 1}</span>
                       <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">moedas</span>
                     </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 leading-tight group-hover:text-emerald-400 transition-colors">
                    {lead.title}
                  </h3>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                      <MapPin size={14} className="text-blue-500" />
                      {lead.location || lead.city || 'São Paulo, SP'}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                      <DollarSign size={14} className="text-emerald-500" />
                      {lead.budget_min && lead.budget_max ? `R$ ${lead.budget_min.toLocaleString('pt-BR')} – R$ ${lead.budget_max.toLocaleString('pt-BR')}` : 'A combinar'}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                      <Navigation size={14} className="text-purple-500" />
                      {lead.location || 'Localização não informada'}
                    </div>

                    {lead.description && (
                      <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">{lead.description}</p>
                    )}

                    {lead.event_date && (
                      <div className="text-slate-500 text-xs font-medium">
                        📅 Para: {new Date(lead.event_date as string).toLocaleDateString('pt-BR')}
                      </div>
                    )}

                    {(() => {
                      const max = lead.max_purchases as number | undefined;
                      const count = (lead.purchases_count as number | undefined) ?? 0;
                      if (max == null) return null;
                      const remaining = max - count;
                      if (remaining <= 1) return <div className="text-xs font-bold text-red-400">🏆 Última vaga!</div>;
                      return <div className="text-xs font-medium text-slate-500">👥 {remaining} vagas restantes</div>;
                    })()}

                    {((lead.purchases_count as number | undefined) ?? 0) > 0 && (
                      <div className="text-xs font-medium text-amber-400/80">⚡ {lead.purchases_count as number} profissionais interessados</div>
                    )}

                    {Array.isArray(lead.images) && (lead.images as string[]).length > 0 && (
                      <div className="flex gap-1.5 overflow-x-auto pb-1 mt-1" style={{ scrollbarWidth: 'none' }}>
                        {(lead.images as string[]).map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`Foto ${idx + 1}`}
                            onClick={(e) => { e.stopPropagation(); setLightboxImg({ images: lead.images as string[], index: idx }); }}
                            className="w-16 h-16 rounded-lg object-cover shrink-0 border border-white/10 cursor-zoom-in hover:opacity-80 transition-opacity"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => handlePurchase(lead)}
                  disabled={purchaseMutation.isPending}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all border border-emerald-500/30 text-xs uppercase tracking-widest flex items-center justify-center gap-2 group/btn relative z-10 shadow-lg"
                >
                   {purchaseMutation.isPending ? <Loader2 className="animate-spin" size={16}/> : <><ShoppingCart size={18} className="group-hover/btn:scale-110 transition-transform" /> Adquirir Cliente</>}
                </button>
             </div>
          ))
        )}
      </div>

      {(!leadsLoading && (!filteredLeads || filteredLeads.length === 0)) && (
        <div className="py-32 flex flex-col items-center justify-center text-center bg-[#14161B]/30 rounded-[3rem] border border-dashed border-white/5">
          <Ghost size={64} className="text-slate-800 mb-6" />
          <h3 className="text-xl font-bold text-slate-300 mb-2">Nenhum cliente encontrado</h3>
          <p className="text-slate-500 font-medium max-w-sm">Tente ajustar seus filtros para encontrar novos clientes em sua região.</p>
          <button
            onClick={() => setFilters({ search: '', category: 'Todas', specialty: 'Todas', city: '', radius: 30, minBudget: 0, maxBudget: 10000, coinCost: 500 })}
            className="mt-8 text-emerald-500 font-bold text-sm hover:underline"
          >
            Limpar todos os filtros
          </button>
        </div>
      )}

      {lightboxImg && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90"
          onClick={() => setLightboxImg(null)}
        >
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
          >
            <X size={24} />
          </button>

          {lightboxImg.index > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxImg(prev => prev ? { ...prev, index: prev.index - 1 } : prev); }}
              className="absolute left-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          <img
            src={lightboxImg.images[lightboxImg.index]}
            alt={`Foto ${lightboxImg.index + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
          />

          {lightboxImg.index < lightboxImg.images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxImg(prev => prev ? { ...prev, index: prev.index + 1 } : prev); }}
              className="absolute right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
            >
              <ChevronRight size={28} />
            </button>
          )}

          {lightboxImg.images.length > 1 && (
            <div className="absolute bottom-4 flex gap-1.5">
              {lightboxImg.images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setLightboxImg(prev => prev ? { ...prev, index: i } : prev); }}
                  className={cn('w-2 h-2 rounded-full transition-all', i === lightboxImg.index ? 'bg-white' : 'bg-white/30 hover:bg-white/60')}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
