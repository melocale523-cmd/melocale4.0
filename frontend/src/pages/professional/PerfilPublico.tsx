import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { MapPin, Briefcase, Star, ArrowLeft, Loader2, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthStore } from '../../store/authStore';

interface ProfessionalPublic {
  id: string;
  user_id: string;
  bio: string | null;
  category: string | null;
  city: string | null;
  is_active: boolean;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
    city: string | null;
  } | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  client_name: string | null;
}

export default function PerfilPublico() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();

  const { data: prof, isLoading } = useQuery<ProfessionalPublic | null>({
    queryKey: ['publicProfile', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('professionals')
        .select('id, user_id, bio, category, city, is_active, profiles(full_name, avatar_url, city)')
        .eq('user_id', id)
        .single();
      if (error) throw error;
      return data as unknown as ProfessionalPublic;
    },
    enabled: !!id,
  });

  const { data: reviewsData } = useQuery<{ reviews: Review[]; average: number; total: number }>({
    queryKey: ['publicReviews', prof?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, client_name')
        .eq('professional_id', prof!.id)
        .order('created_at', { ascending: false })
        .limit(10);
      const reviews = (data || []) as Review[];
      const total = reviews.length;
      const average = total > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
      return { reviews, average, total };
    },
    enabled: !!prof?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0E1C32] flex items-center justify-center text-emerald-500">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  if (!prof) {
    return (
      <div className="min-h-screen bg-[#0E1C32] flex flex-col items-center justify-center text-center p-8">
        <p className="text-2xl font-bold text-white mb-2">Profissional não encontrado</p>
        <p className="text-[#94A3B8] mb-6">Este perfil pode ter sido removido ou o link está incorreto.</p>
        <Link to="/" className="text-emerald-500 font-bold hover:underline">Voltar ao início</Link>
      </div>
    );
  }

  const name = prof.profiles?.full_name || 'Profissional';
  const avatar = prof.profiles?.avatar_url;
  const city = prof.city || prof.profiles?.city;
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#0E1C32]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          to={user ? (user.role === 'client' ? '/cliente/dashboard' : '/') : '/'}
          className="inline-flex items-center gap-2 text-[#94A3B8] hover:text-white text-sm font-medium mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Voltar
        </Link>

        {/* Header card */}
        <div className="bg-[#1C3454] border border-slate-800/50 rounded-2xl overflow-hidden mb-6">
          <div className="h-28 bg-gradient-to-r from-slate-800 to-emerald-900/30" />
          <div className="px-6 pb-6 -mt-12">
            <div className="flex items-end gap-4 mb-4">
              <div className="w-20 h-20 rounded-full border-4 border-[#1C3454] bg-emerald-600 flex items-center justify-center text-white font-bold text-2xl overflow-hidden shrink-0">
                {avatar
                  ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
                  : initials}
              </div>
              <div className="pt-12">
                <h1 className="text-2xl font-bold text-white">{name}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  {prof.category && (
                    <span className="flex items-center gap-1.5 text-sm text-emerald-400 font-medium">
                      <Briefcase size={14} /> {prof.category}
                    </span>
                  )}
                  {city && (
                    <span className="flex items-center gap-1.5 text-sm text-[#94A3B8]">
                      <MapPin size={14} /> {city}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {reviewsData && reviewsData.total > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star
                      key={s}
                      size={16}
                      className={s <= Math.round(reviewsData.average) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700 fill-slate-700'}
                    />
                  ))}
                </div>
                <span className="text-yellow-400 font-bold text-sm">{reviewsData.average.toFixed(1)}</span>
                <span className="text-[#4A6580] text-sm">({reviewsData.total} avaliação{reviewsData.total !== 1 ? 'ões' : ''})</span>
              </div>
            )}

            {prof.bio && (
              <p className="text-[#94A3B8] text-sm leading-relaxed border-t border-slate-800/50 pt-4">
                {prof.bio}
              </p>
            )}

            {user?.role === 'client' && (
              <div className="mt-4">
                <Link
                  to="/cliente/mensagens"
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all"
                >
                  <MessageCircle size={16} /> Enviar mensagem
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Reviews */}
        {reviewsData && reviewsData.reviews.length > 0 && (
          <div className="bg-[#1C3454] border border-slate-800/50 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Star size={18} className="text-yellow-400" /> Avaliações
            </h2>
            <div className="space-y-4">
              {reviewsData.reviews.map(review => (
                <div key={review.id} className="bg-[#0E1C32] border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-200">{review.client_name ?? 'Cliente'}</span>
                    <span className="text-xs text-[#4A6580]">
                      {format(new Date(review.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star
                        key={s}
                        size={13}
                        className={s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700 fill-slate-700'}
                      />
                    ))}
                  </div>
                  {review.comment && (
                    <p className="text-sm text-[#94A3B8]">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
