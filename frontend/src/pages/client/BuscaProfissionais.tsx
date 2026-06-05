import { useState } from 'react';
import {
  Search, MapPin, Tag, Star, Inbox, Loader2, ExternalLink, ChevronDown,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useBuscaProfissionais, type ProfissionalResult } from '../../hooks/useBuscaProfissionais';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import SolicitarOrcamentoModal from '../../components/SolicitarOrcamentoModal';
import PerfilProfissionalModal from '../../components/PerfilProfissionalModal';

interface Category {
  id: string;
  name: string;
}

function StarRow({ rating, count }: { rating: number; count: number }) {
  const filled = Math.round(rating);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(s => (
          <Star
            key={s}
            size={11}
            className={cn(s <= filled ? 'text-yellow-400 fill-yellow-400' : 'text-[#1C3050] fill-[#1C3050]')}
          />
        ))}
      </div>
      <span className="text-[10px] text-[#94A3B8]">
        {count > 0 ? `${rating.toFixed(1)} (${count})` : 'Sem avaliações'}
      </span>
    </div>
  );
}

function ProfCard({ prof }: { prof: ProfissionalResult }) {
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [orcamentoOpen, setOrcamentoOpen] = useState(false);

  const isFeatured = !!(prof.featuredUntil && new Date(prof.featuredUntil) > new Date());
  const initials = (prof.fullName || 'P')
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <div className={cn(
        'bg-[#132236] rounded-xl p-4 border flex flex-col gap-0 transition-all cursor-default',
        isFeatured
          ? 'border-yellow-500/30 hover:border-yellow-400/50 shadow-lg shadow-yellow-500/5'
          : 'border-white/5 hover:border-emerald-500/20',
      )}>
        {/* Top: avatar + info */}
        <div className="flex gap-3">
          {prof.avatarUrl ? (
            <img
              src={prof.avatarUrl}
              alt={prof.fullName}
              className={cn(
                'w-12 h-12 rounded-xl object-cover shrink-0',
                isFeatured ? 'border-2 border-yellow-500/40' : 'border border-white/10',
              )}
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[#0e1d30] border border-white/5 flex items-center justify-center shrink-0 text-sm font-black text-[#4a6580]">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5 flex-wrap mb-0.5">
              <h3 className="text-sm font-bold text-white truncate">{prof.fullName || 'Profissional'}</h3>
              {isFeatured && (
                <span className="inline-flex items-center gap-1 text-[9px] font-black text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded px-1.5 py-0.5 uppercase shrink-0">
                  <Star size={8} className="fill-yellow-400" /> Destaque
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-1">
              {prof.category && (
                <span className="flex items-center gap-1 text-[11px] text-[#7a9ebf]">
                  <Tag size={10} className="text-emerald-500 shrink-0" />
                  {prof.category}
                </span>
              )}
              {prof.city && (
                <span className="flex items-center gap-1 text-[11px] text-[#7a9ebf]">
                  <MapPin size={10} className="text-[#4a6580] shrink-0" />
                  {prof.city}
                </span>
              )}
            </div>
            <StarRow rating={prof.avgRating} count={prof.reviewCount} />
          </div>
        </div>

        {/* Bio */}
        {prof.bio && (
          <p className="text-[11px] text-[#4a6580] line-clamp-2 leading-relaxed mt-2">{prof.bio}</p>
        )}

        {/* Footer buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setPerfilOpen(true)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-white/10 hover:border-emerald-500/30 text-[#7a9ebf] hover:text-emerald-400 text-[11px] font-bold rounded-lg transition-all"
          >
            <ExternalLink size={11} />
            Ver perfil
          </button>
          <button
            onClick={() => setOrcamentoOpen(true)}
            className="flex-[2] py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition-all"
          >
            Solicitar orçamento
          </button>
        </div>
      </div>

      <PerfilProfissionalModal
        open={perfilOpen}
        onClose={() => setPerfilOpen(false)}
        prof={prof}
        onSolicitarOrcamento={() => {
          setPerfilOpen(false);
          setOrcamentoOpen(true);
        }}
      />
      <SolicitarOrcamentoModal
        open={orcamentoOpen}
        onClose={() => setOrcamentoOpen(false)}
        professionalId={prof.id}
        professionalUserId={prof.userId}
        professionalName={prof.fullName || 'Profissional'}
        defaultCategory={prof.category ?? ''}
      />
    </>
  );
}

const SORT_OPTIONS: { value: 'rating' | 'city' | 'created_at'; label: string }[] = [
  { value: 'rating', label: 'Melhor avaliados' },
  { value: 'city', label: 'Por cidade' },
  { value: 'created_at', label: 'Mais recentes' },
];

export default function BuscaProfissionais() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState<'rating' | 'city' | 'created_at'>('rating');

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { profissionais, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useBuscaProfissionais({ query: search, category, city, minRating, sortBy }, user?.id);

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500">

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-black text-white tracking-tight mb-1">Buscar Profissionais</h1>
        <p className="text-[#94A3B8] text-sm">Encontre o profissional certo para o seu serviço.</p>
      </div>

      {/* Filtros */}
      <div className="bg-[#132236] border border-white/5 rounded-xl p-4 mb-4">
        {/* Row 1 */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 group">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6580] group-focus-within:text-emerald-500 transition-colors"
            />
            <input
              type="text"
              placeholder="Nome ou categoria..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#0e1d30] border border-white/5 rounded-lg py-2 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-emerald-500/40 transition-all placeholder:text-[#4A6580]"
            />
          </div>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="bg-[#0e1d30] border border-white/5 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-emerald-500/40 transition-all sm:w-44"
          >
            <option value="">Todas as categorias</option>
            {(categories ?? []).map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <div className="relative group sm:w-36">
            <MapPin
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6580] group-focus-within:text-emerald-500 transition-colors"
            />
            <input
              type="text"
              placeholder="Cidade..."
              value={city}
              onChange={e => setCity(e.target.value)}
              className="w-full bg-[#0e1d30] border border-white/5 rounded-lg py-2 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-emerald-500/40 transition-all placeholder:text-[#4A6580]"
            />
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest shrink-0">Avaliação mín:</span>
            <button
              onClick={() => setMinRating(0)}
              className={cn(
                'text-[10px] px-2 py-1 rounded border transition-all font-bold',
                minRating === 0
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                  : 'border-white/10 text-[#4A6580] hover:text-white',
              )}
            >
              Qualquer
            </button>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  onClick={() => setMinRating(minRating === s ? 0 : s)}
                  className={cn('p-0.5 rounded transition-all', s <= minRating ? 'text-yellow-400' : 'text-slate-500 hover:text-yellow-400/70')}
                >
                  <Star size={14} className={s <= minRating ? 'fill-yellow-400' : 'fill-slate-500'} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest shrink-0">Ordenar:</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="appearance-none bg-[#0e1d30] border border-white/5 rounded-lg py-1.5 pl-3 pr-7 text-xs text-white focus:outline-none focus:border-emerald-500/40 transition-all"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4A6580] pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-[#4A6580]">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm font-medium">Buscando profissionais...</span>
        </div>
      ) : !profissionais.length ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 opacity-40 grayscale">
          <Inbox size={48} className="text-slate-600" />
          <div className="text-center">
            <p className="text-white font-black text-base">Nenhum profissional encontrado</p>
            <p className="text-[#4A6580] text-sm font-medium">
              Tente ajustar os filtros ou buscar por outra categoria.
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[10px] text-[#4a6580] font-bold uppercase tracking-widest mb-2">
            {profissionais.length} profissional{profissionais.length !== 1 ? 'is' : ''} encontrado{profissionais.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {profissionais.map(prof => (
              <ProfCard key={prof.id} prof={prof} />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
                className="flex items-center gap-2 px-5 py-2 bg-[#132236] border border-white/5 hover:border-emerald-500/30 text-[#94A3B8] hover:text-emerald-400 text-sm font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {isFetchingNextPage ? (
                  <><Loader2 size={14} className="animate-spin" /> Carregando...</>
                ) : (
                  'Carregar mais'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
