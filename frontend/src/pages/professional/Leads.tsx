import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadService, walletService } from '../../services/dbServices';
import { MapPin, Loader2, ShoppingCart, SlidersHorizontal, Ghost, CheckCircle2, ArrowRight, Navigation, Coins, Search, X, DollarSign, Plus, Trash2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
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

  const filteredLeads = leads?.filter(lead => {
    const title = lead.title.toLowerCase();
    const location = (lead.location || lead.city || '').toLowerCase();
    const search = filters.search.toLowerCase();
    const city = filters.city.toLowerCase();

    const matchesSearch = !filters.search || title.includes(search) || location.includes(search);
    const matchesCategory = filters.category === 'Todas' || lead.category === filters.category;
    const matchesCity = !filters.city || location.includes(city);

    const price = lead.price_coins || 0;
    const matchesCoinCost = price <= filters.coinCost;

    const leadBudget = lead.budget_max || lead.budget_min || 0;
    const matchesBudget = leadBudget === 0 || (leadBudget >= filters.minBudget && leadBudget <= filters.maxBudget);

    return matchesSearch && matchesCategory && matchesCity && matchesCoinCost && matchesBudget;
  });

  const { data: balance, isLoading: walletLoading } = useQuery({
    queryKey: ['walletBalance'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: walletService.getBalance,
  });

  const [purchasedLead, setPurchasedLead] = useState<{ title: string, price: number } | null>(null);
  const [lightboxImg, setLightboxImg] = useState<{ images: string[]; index: number } | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<{
    id: string;
    price_coins: number;
    title: string;
    idempotencyKey: string;
  } | null>(null);

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
    mutationFn: ({ id, price, title, idempotencyKey }: { id: string, price: number, title: string, idempotencyKey: string }) =>
      leadService.purchaseLead(id, idempotencyKey).then(() => ({ id, price, title })),
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
    setPendingPurchase({ id: lead.id, price_coins: leadPrice, title: lead.title, idempotencyKey: crypto.randomUUID() });
  };

  const confirmPurchase = () => {
    if (!pendingPurchase) return;
    purchaseMutation.mutate({
      id: pendingPurchase.id,
      price: pendingPurchase.price_coins,
      title: pendingPurchase.title,
      idempotencyKey: pendingPurchase.idempotencyKey,
    });
    setPendingPurchase(null);
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
    // space-y-4 = mesmo respiro validado no dashboard (#378); os marginTop
    // inline que existiam entre as seções eram workaround da era do bug de
    // cascade layers e brigavam com o space-y
    <div className="w-full space-y-4">

      {/* Saldo Alert */}
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-xl p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-500/10 text-yellow-500 rounded-lg flex items-center justify-center shrink-0">
              <Coins size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Saldo Disponível</p>
              <p className="text-2xl font-bold text-white leading-none">
                {walletLoading ? '...' : (typeof balance === 'number' ? Math.floor(balance) : 0)}
                <span className="text-xs font-semibold text-yellow-500 uppercase tracking-wide ml-1">moedas</span>
              </p>
            </div>
          </div>
          <Link to="/profissional/carteira" className="h-8 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all flex items-center gap-1.5">
            <Plus size={13} /> Recarregar
          </Link>
        </div>
        {/* Mini KPIs de conversão */}
        <div className="flex items-center gap-3 mb-1 flex-wrap" style={{ marginTop: '1rem' }}>
          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
            🟢 {leads?.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length ?? 0} novos hoje
          </span>
          <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-1">
            ⚡ {leads?.filter(l => l.max_purchases && (l.max_purchases - ((l.purchases_count as number) ?? 0)) <= 2).length ?? 0} quase esgotados
          </span>
          <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-2.5 py-1">
            🏆 Seja o 1º a fechar negócio
          </span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Buscar serviço... (ex: Pintura, Elétrica)"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="w-full h-11 bg-[#1C3454] border border-[#1C3050] rounded-lg pl-8 pr-3 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all"
          />
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>

        <button
          onClick={() => setIsFilterOpen(true)}
          className="h-8 px-4 text-xs font-semibold bg-[#1C3454] border border-[#1C3050] hover:border-emerald-500/30 text-white rounded-lg transition-all flex items-center gap-1.5"
        >
          <SlidersHorizontal size={13} /> Filtros
        </button>

        {(filters.search || filters.city || filters.category !== 'Todas' || filters.minBudget > 0) && (
          <button
            onClick={() => setFilters({ search: '', category: 'Todas', city: '', radius: 30, minBudget: 0, maxBudget: 10000, coinCost: 500 })}
            className="h-8 w-8 flex items-center justify-center bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500 hover:text-white transition-all"
            title="Limpar todos os filtros"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Filter Modal */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsFilterOpen(false)} />
          <div className="relative bg-[#0E1C32] border border-[#243F6A] rounded-xl p-5 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 ring-1 ring-white/5">
            <button
              onClick={() => setIsFilterOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Filter size={16} className="text-emerald-500" /> Filtros Detalhados
            </h3>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-4">Refine sua busca para encontrar os clientes ideais.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                    <MapPin size={12} className="text-emerald-500" /> Cidade
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: São Paulo"
                    value={filters.city}
                    onChange={e => setFilters(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full h-8 bg-[#1C3454] border border-[#1C3050] rounded-lg px-3 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                    <Navigation size={12} className="text-emerald-500" /> Raio Máximo (KM)
                  </label>
                  <input
                    type="range" min="5" max="100" step="5"
                    value={filters.radius}
                    onChange={e => setFilters(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
                    className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>5km</span>
                    <span className="text-emerald-400 bg-emerald-500/10 px-2 rounded">{filters.radius}km</span>
                    <span>100km</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                    <ShoppingCart size={12} className="text-emerald-500" /> Categoria
                  </label>
                  <div className="relative">
                    <select
                      value={filters.category}
                      onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full h-8 bg-[#1C3454] border border-[#1C3050] rounded-lg px-3 text-xs text-white focus:outline-none cursor-pointer appearance-none"
                    >
                      <option value="Todas">⭐️ Todas as Categorias</option>
                      {categories.filter(c => c !== 'Todas').map(cat => (
                        <option key={cat} value={cat}>🛠️ {cat}</option>
                      ))}
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                    <DollarSign size={12} className="text-emerald-500" /> Orçamento Prestado
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">R$</span>
                      <input
                        type="number" placeholder="Mínimo"
                        value={filters.minBudget}
                        onChange={e => setFilters(prev => ({ ...prev, minBudget: parseInt(e.target.value) || 0 }))}
                        className="w-full h-8 bg-[#1C3454] border border-[#1C3050] rounded-lg pl-8 pr-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">R$</span>
                      <input
                        type="number" placeholder="Máximo"
                        value={filters.maxBudget}
                        onChange={e => setFilters(prev => ({ ...prev, maxBudget: parseInt(e.target.value) || 0 }))}
                        className="w-full h-8 bg-[#1C3454] border border-[#1C3050] rounded-lg pl-8 pr-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                    <Coins size={12} className="text-yellow-500" /> Custo Contato (Moedas)
                  </label>
                  <input
                    type="range" min="10" max="1000" step="10"
                    value={filters.coinCost}
                    onChange={e => setFilters(prev => ({ ...prev, coinCost: parseInt(e.target.value) }))}
                    className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>10</span>
                    <span className="text-yellow-400 bg-yellow-500/10 px-2 rounded">{filters.coinCost} moedas</span>
                    <span>1000</span>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => setFilters({ search: '', category: 'Todas', city: '', radius: 30, minBudget: 0, maxBudget: 10000, coinCost: 500 })}
                    className="flex-1 h-8 border border-[#1C3050] hover:bg-red-500/10 hover:text-red-400 text-slate-400 font-semibold rounded-lg transition-all text-xs flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={12} /> Resetar
                  </button>
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-all text-xs"
                  >
                    Aplicar
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
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPurchasedLead(null)} />
          <div className="relative bg-[#1C3454] border border-emerald-500/30 rounded-xl p-5 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-lg font-bold text-white text-center mb-1">Cliente Adquirido!</h2>
            <p className="text-slate-400 text-xs text-center mb-3">
              Você agora tem acesso completo aos dados do cliente <span className="text-white font-bold">{purchasedLead.title}</span>.
            </p>

            <div className="bg-[#0E1C32] border border-[#1C3050] rounded-lg p-3 mb-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Investimento:</span>
                <span className="text-emerald-400 font-bold">{purchasedLead.price} moedas</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate('/profissional/meus-leads')}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
              >
                Ver Meus Clientes <ArrowRight size={15} />
              </button>
              <button
                onClick={() => setPurchasedLead(null)}
                className="w-full h-8 text-slate-500 hover:text-white font-medium transition-colors text-xs"
              >
                Continuar Comprando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          Clientes Disponíveis
          <span className="text-xs font-medium px-2 py-0.5 bg-white/5 border border-[#243F6A] rounded-md text-slate-500">
            {filteredLeads?.length || 0}
          </span>
        </h1>
      </div>

      {/* Lead Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-xl">
        {leadsLoading ? (
          <div className="col-span-full py-16 flex justify-center">
            <LoadingSpinner size={28} label="Buscando novos clientes..." />
          </div>
        ) : (
          filteredLeads?.map((lead) => {
            const badges = getBadges(lead);
            return (
              <div
                key={lead.id}
                className={cn(
                  "bg-[#132236] border rounded-2xl p-5 space-y-3 flex flex-col",
                  badges.some(b => b.label === 'Urgente')
                    ? "border-red-500/40 animate-pulse"
                    : "border-white/[0.06]"
                )}
              >
                {/* Header: badges left, price right */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {badges.map((b, i) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded-md font-semibold border ${b.color}`}>
                        {b.icon} {b.label}
                      </span>
                    ))}
                  </div>
                  <span className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg px-2.5 py-1 text-xs font-bold shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Coins size={13} className="shrink-0" />
                    {lead.price_coins || 1} moedas
                  </span>
                </div>

                {/* Title */}
                <h3 className="mt-1 font-bold text-white text-sm leading-snug line-clamp-2">
                  {lead.title}
                </h3>

                {/* Info grid 2 cols */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <MapPin size={12} className="text-blue-400 shrink-0" />
                    <span className="truncate">{lead.location || lead.city || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <DollarSign size={12} className="shrink-0" />
                    <span className="truncate">
                      {lead.budget_min && lead.budget_max
                        ? `R$ ${lead.budget_min.toLocaleString('pt-BR')} – R$ ${lead.budget_max.toLocaleString('pt-BR')}`
                        : 'A combinar'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Navigation size={12} className="text-purple-400 shrink-0" />
                    <span className="truncate">{lead.location || 'Localização não informada'}</span>
                  </div>
                  {(() => {
                    const max = lead.max_purchases as number | undefined;
                    const count = (lead.purchases_count as number | undefined) ?? 0;
                    if (max == null) return <div />;
                    const remaining = max - count;
                    if (remaining <= 1)
                      return <div className="font-bold text-red-400">🏆 Última vaga!</div>;
                    return <div className="text-slate-400">👥 {remaining} vagas restantes</div>;
                  })()}
                </div>

                {/* Description */}
                {lead.description && (
                  <p className="text-xs text-slate-400 bg-white/5 rounded-lg px-3 py-2 leading-relaxed line-clamp-3">
                    {lead.description}
                  </p>
                )}

                {/* Extra info preserved */}
                {lead.event_date && (
                  <div className="text-slate-500 text-xs">
                    📅 Para: {new Date(lead.event_date as string).toLocaleDateString('pt-BR')}
                  </div>
                )}
                {((lead.purchases_count as number | undefined) ?? 0) > 0 && (
                  <div className="text-xs text-amber-400/80">⚡ {lead.purchases_count as number} profissionais interessados</div>
                )}
                {Array.isArray(lead.images) && (lead.images as string[]).length > 0 && (
                  <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {(lead.images as string[]).map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`Foto ${idx + 1}`}
                        loading="lazy"
                        role="button"
                        aria-label="Ver imagem em tela cheia"
                        onClick={(e) => { e.stopPropagation(); setLightboxImg({ images: lead.images as string[], index: idx }); }}
                        className="w-16 h-16 rounded-lg object-cover shrink-0 border border-[#243F6A] cursor-zoom-in hover:opacity-80 transition-opacity"
                      />
                    ))}
                  </div>
                )}

                {/* Purchase button */}
                <button
                  onClick={() => handlePurchase(lead)}
                  disabled={purchaseMutation.isPending}
                  className="w-full h-9 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all mt-auto text-xs"
                >
                  {purchaseMutation.isPending
                    ? <Loader2 className="animate-spin" size={15} />
                    : <><ShoppingCart size={15} /> Adquirir Cliente · {lead.price_coins || 1} moedas</>
                  }
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Empty State */}
      {(!leadsLoading && (!filteredLeads || filteredLeads.length === 0)) && (
        <div className="py-16 flex flex-col items-center justify-center text-center bg-[#1C3454]/30 rounded-xl border border-dashed border-[#1C3050]">
          <Ghost size={40} className="text-slate-700 mb-3" />
          <h3 className="text-sm font-bold text-slate-300 mb-1">Nenhum cliente encontrado</h3>
          <p className="text-slate-500 text-xs max-w-xs">Tente ajustar seus filtros para encontrar novos clientes em sua região.</p>
          <button
            onClick={() => setFilters({ search: '', category: 'Todas', city: '', radius: 30, minBudget: 0, maxBudget: 10000, coinCost: 500 })}
            className="mt-3 text-emerald-500 font-semibold text-xs hover:underline"
          >
            Limpar todos os filtros
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90"
          onClick={() => setLightboxImg(null)}
        >
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
          >
            <X size={20} />
          </button>

          {lightboxImg.index > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxImg(prev => prev ? { ...prev, index: prev.index - 1 } : prev); }}
              className="absolute left-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          <img
            src={lightboxImg.images[lightboxImg.index]}
            alt={`Foto ${lightboxImg.index + 1}`}
            loading="lazy"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
          />

          {lightboxImg.index < lightboxImg.images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxImg(prev => prev ? { ...prev, index: prev.index + 1 } : prev); }}
              className="absolute right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
            >
              <ChevronRight size={22} />
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

      {/* Confirm Purchase Modal */}
      {pendingPurchase && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPendingPurchase(null)} />
          <div className="relative w-full max-w-sm bg-[#1C3454] border border-slate-700 rounded-xl shadow-2xl p-5 flex flex-col gap-3">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mx-auto">
                <ShoppingCart size={24} className="text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-white">Confirmar aquisição?</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Você irá adquirir <span className="text-white font-bold">"{pendingPurchase.title}"</span> por{' '}
                <span className="text-emerald-400 font-bold">{pendingPurchase.price_coins} moedas</span>.
              </p>
              <p className="text-slate-600 text-xs">Esta ação não pode ser desfeita.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingPurchase(null)}
                className="flex-1 h-8 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold rounded-lg transition-all text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmPurchase}
                disabled={purchaseMutation.isPending}
                className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-1.5"
              >
                {purchaseMutation.isPending
                  ? <Loader2 size={13} className="animate-spin" />
                  : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
