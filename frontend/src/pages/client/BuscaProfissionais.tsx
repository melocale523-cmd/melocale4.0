import { useState } from 'react';
import {
  Search, MapPin, Tag, Star, UserCircle, Inbox, Loader2, ExternalLink, ChevronDown,
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
            size={12}
            className={cn(
              s <= filled ? 'text-yellow-400 fill-yellow-400' : 'text-[#1C3050] fill-[#1C3050]',
            )}
          />
        ))}
      </div>
      <span className="text-[11px] text-[#94A3B8]">
        {count > 0 ? `${rating.toFixed(1)} (${count})` : 'Sem avaliações'}
      </span>
    </div>
  );
}

function RatingBadge({ avg, count }: { avg: number; count: number }) {
  if (avg <= 0) return null;
  return (
    <span className="inline-flex items-center gap-6 text-[11px] font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-7 py-0.5">
      <Star size={10} className="fill-yellow-400" />
      {avg.toFixed(1)}
      <span className="text-yellow-400/70 font-normal">({count})</span>
    </span>
  );
}

function ProfCard({ prof }: { prof: ProfissionalResult }) {
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [orcamentoOpen, setOrcamentoOpen] = useState(false);

  return (
    <>
      <div className={cn(
        "bg-[#132540] border rounded-2xl p-5 flex flex-col gap-4 transition-all",
        prof.featuredUntil && new Date(prof.featuredUntil) > new Date()
          ? "border-yellow-500/40 hover:border-yellow-400/60 shadow-lg shadow-yellow-500/5"
          : "border-[#1C3050] hover:border-emerald-500/30",
      )}>
        {prof.featuredUntil && new Date(prof.featuredUntil) > new Date() && (
          <div className="flex items-center gap-1.5 -mb-1">
            <span className="inline-flex items-center gap-6 text-[11px] font-black text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-7 py-0.5 uppercase tracking-wide">
              <Star size={10} className="fill-yellow-400" /> Destaque
            </span>
          </div>
        )}
        <div className="flex items-start gap-9">
          {prof.avatarUrl ? (
            <img
              src={prof.avatarUrl}
              alt={prof.fullName}
              className="w-14 h-14 rounded-xl object-cover shrink-0 border border-[#1C3050]"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-[#0E1C32] border border-[#1C3050] flex items-center justify-center shrink-0">
              <UserCircle size={28} className="text-[#4A6580]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-7">
              <h3 className="text-base font-bold text-white truncate">{prof.fullName || 'Profissional'}</h3>
              <RatingBadge avg={prof.avgRating} count={prof.reviewCount} />
            </div>
            <StarRow rating={prof.avgRating} count={prof.reviewCount} />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              {prof.category && (
                <span className="flex items-center gap-6 text-xs text-[#94A3B8]">
                  <Tag size={11} className="text-emerald-500 shrink-0" />
                  {prof.category}
                </span>
              )}
              {prof.city && (
                <span className="flex items-center gap-6 text-xs text-[#94A3B8]">
                  <MapPin size={11} className="text-[#4A6580] shrink-0" />
                  {prof.city}
                </span>
              )}
            </div>
          </div>
        </div>

        {prof.bio && (
          <p className="text-xs text-[#94A3B8] line-clamp-2 leading-relaxed">{prof.bio}</p>
        )}

        <div className="flex gap-7 mt-auto">
          <button
            onClick={() => setPerfilOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-7 border border-[#1C3050] hover:border-emerald-500/30 text-[#94A3B8] hover:text-emerald-400 text-xs font-bold rounded-xl transition-all"
          >
            <ExternalLink size={12} />
            Ver perfil
          </button>
          <button
            onClick={() => setOrcamentoOpen(true)}
            className="flex-1 py-7 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all"
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
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-black text-white tracking-tight mb-7">Buscar Profissionais</h1>
        <p className="text-[#94A3B8] font-medium">Encontre o profissional certo para o seu serviço.</p>
      </div>

      {/* Filtros */}
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-10 space-y-9">
        <div className="flex flex-col sm:flex-row gap-8">
          <div className="relative flex-1 group">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6580] group-focus-within:text-emerald-500 transition-colors"
            />
            <input
              type="text"
              placeholder="Nome ou categoria..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl py-2.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-[#4A6580]"
            />
          </div>

          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="bg-[#0E1C32] border border-[#1C3050] rounded-xl py-2.5 px-8 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all sm:w-48"
          >
            <option value="">Todas as categorias</option>
            {(categories ?? []).map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          <div className="relative group sm:w-44">
            <MapPin
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6580] group-focus-within:text-emerald-500 transition-colors"
            />
            <input
              type="text"
              placeholder="Cidade..."
              value={city}
              onChange={e => setCity(e.target.value)}
              className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl py-2.5 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-[#4A6580]"
            />
          </div>
        </div>

        {/* Rating filter + sort */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-9">
          {/* Min rating stars */}
          <div className="flex items-center gap-7">
            <span className="text-xs text-[#94A3B8] font-bold uppercase tracking-widest shrink-0">Avaliação mín:</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setMinRating(0)}
                className={cn(
                  'text-xs px-2 py-1 rounded-lg border transition-all font-bold',
                  minRating === 0
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                    : 'border-[#1C3050] text-[#4A6580] hover:text-white',
                )}
              >
                Qualquer
              </button>
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  onClick={() => setMinRating(minRating === s ? 0 : s)}
                  className={cn(
                    'p-1 rounded transition-all',
                    s <= minRating ? 'text-yellow-400' : 'text-slate-500 hover:text-yellow-400/70',
                  )}
                >
                  <Star
                    size={16}
                    className={s <= minRating ? 'fill-yellow-400' : 'fill-slate-500'}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-7 sm:ml-auto">
            <span className="text-xs text-[#94A3B8] font-bold uppercase tracking-widest shrink-0">Ordenar:</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="appearance-none bg-[#0E1C32] border border-[#1C3050] rounded-xl py-7 pl-3 pr-8 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4A6580] pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Resultados */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-8 text-[#4A6580]">
          <Loader2 size={24} className="animate-spin" />
          <span className="text-sm font-medium">Buscando profissionais...</span>
        </div>
      ) : !profissionais.length ? (
        <div className="flex flex-col items-center justify-center py-20 gap-9 opacity-40 grayscale">
          <Inbox size={56} className="text-slate-600" />
          <div className="text-center">
            <p className="text-white font-black text-lg">Nenhum profissional encontrado</p>
            <p className="text-[#4A6580] text-sm font-medium">
              Tente ajustar os filtros ou buscar por outra categoria.
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-[#4A6580] font-bold uppercase tracking-widest -mb-4">
            {profissionais.length} profissional{profissionais.length !== 1 ? 'is' : ''} encontrado{profissionais.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-9">
            {profissionais.map(prof => (
              <ProfCard key={prof.id} prof={prof} />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
                className="flex items-center gap-7 px-11 py-8 bg-[#132540] border border-[#1C3050] hover:border-emerald-500/30 text-[#94A3B8] hover:text-emerald-400 text-sm font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Carregando...
                  </>
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
