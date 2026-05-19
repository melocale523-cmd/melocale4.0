import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Tag, Star, UserCircle, Inbox, Loader2, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useBuscaProfissionais, type ProfissionalResult } from '../../hooks/useBuscaProfissionais';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

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

function ProfCard({ prof }: { prof: ProfissionalResult }) {
  const navigate = useNavigate();

  return (
    <div className="bg-[#132540] border border-[#1C3050] rounded-2xl p-5 flex flex-col gap-4 hover:border-emerald-500/30 transition-all">
      <div className="flex items-start gap-4">
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
          <h3 className="text-base font-bold text-white truncate">{prof.fullName || 'Profissional'}</h3>
          <StarRow rating={prof.avgRating} count={prof.reviewCount} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            {prof.category && (
              <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
                <Tag size={11} className="text-emerald-500 shrink-0" />
                {prof.category}
              </span>
            )}
            {prof.city && (
              <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
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

      <div className="flex gap-2 mt-auto">
        <Link
          to={`/profissional/${prof.userId}/perfil`}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-[#1C3050] hover:border-emerald-500/30 text-[#94A3B8] hover:text-emerald-400 text-xs font-bold rounded-xl transition-all"
        >
          <ExternalLink size={12} />
          Ver perfil
        </Link>
        <button
          onClick={() => navigate('/cliente/pedidos')}
          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all"
        >
          Solicitar orçamento
        </button>
      </div>
    </div>
  );
}

export default function BuscaProfissionais() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');

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

  const { data: professionals, isLoading } = useBuscaProfissionais(
    { search, category, city },
    user?.id,
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-black text-white tracking-tight mb-2">Buscar Profissionais</h1>
        <p className="text-[#94A3B8] font-medium">Encontre o profissional certo para o seu serviço.</p>
      </div>

      {/* Filtros */}
      <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-5 flex flex-col sm:flex-row gap-3">
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
          className="bg-[#0E1C32] border border-[#1C3050] rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all sm:w-48"
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

      {/* Resultados */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-[#4A6580]">
          <Loader2 size={24} className="animate-spin" />
          <span className="text-sm font-medium">Buscando profissionais...</span>
        </div>
      ) : !professionals?.length ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40 grayscale">
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
            {professionals.length} profissional{professionals.length !== 1 ? 'is' : ''} encontrado{professionals.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {professionals.map(prof => (
              <ProfCard key={prof.id} prof={prof} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
