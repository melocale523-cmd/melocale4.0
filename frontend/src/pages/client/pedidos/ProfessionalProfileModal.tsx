import { useState, useEffect } from 'react';
import { X, MapPin, Briefcase, Star, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface ProfessionalData {
  id: string;
  bio: string | null;
  category: string | null;
  city: string | null;
  is_active: boolean;
}

interface ReviewData {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  client_name: string | null;
}

interface ProfessionalProfileModalProps {
  userId: string;
  name: string;
  avatar: string | null;
  onClose: () => void;
}

export function ProfessionalProfileModal({ userId, name, avatar, onClose }: ProfessionalProfileModalProps) {
  const [prof, setProf] = useState<ProfessionalData | null>(null);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('professionals')
      .select('id, bio, category, city, is_active')
      .eq('user_id', userId)
      .single()
      .then(({ data: profData }) => {
        setProf(profData);
        if (profData?.id) {
          supabase
            .from('reviews')
            .select('id, rating, comment, created_at, client_name')
            .eq('professional_id', profData.id)
            .order('created_at', { ascending: false })
            .limit(5)
            .then(({ data }) => setReviews(data || []));
        }
        setLoading(false);
      });
  }, [userId]);

  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#1C3454] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">

        <div className="h-20 bg-gradient-to-r from-slate-800 to-emerald-900/30 shrink-0" />

        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-black/30 hover:bg-black/50 text-white transition-all"
        >
          <X size={18} />
        </button>

        <div className="px-6 -mt-10 pb-4 border-b border-slate-700/50 shrink-0">
          <div className="flex items-end gap-4 mb-3">
            <div className="w-20 h-20 rounded-full border-4 border-[#1C3454] bg-emerald-600 flex items-center justify-center text-white font-bold text-xl overflow-hidden shrink-0">
              {avatar
                ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
                : initials}
            </div>
            <div className="pb-1">
              <h3 className="text-xl font-black text-white">{name}</h3>
              {prof && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {prof.category && (
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                      <Briefcase size={12} /> {prof.category}
                    </span>
                  )}
                  {prof.city && (
                    <span className="text-xs text-[#94A3B8] flex items-center gap-1">
                      <MapPin size={12} /> {prof.city}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {reviews.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} size={14} className={s <= Math.round(avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600 fill-slate-600'} />
                ))}
              </div>
              <span className="text-yellow-400 font-bold text-sm">{avgRating.toFixed(1)}</span>
              <span className="text-[#4A6580] text-xs">({reviews.length} avaliação{reviews.length !== 1 ? 'ões' : ''})</span>
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-emerald-500" size={28} />
            </div>
          ) : (
            <>
              {prof?.bio && (
                <div>
                  <p className="text-xs font-bold text-[#4A6580] uppercase tracking-widest mb-2">Sobre</p>
                  <p className="text-sm text-[#94A3B8] leading-relaxed">{prof.bio}</p>
                </div>
              )}

              {reviews.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-[#4A6580] uppercase tracking-widest mb-3">Avaliações</p>
                  <div className="space-y-3">
                    {reviews.map(r => (
                      <div key={r.id} className="bg-[#0E1C32] rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-200">{r.client_name ?? 'Cliente'}</span>
                          <span className="text-xs text-[#4A6580]">
                            {new Date(r.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} size={12} className={s <= r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700 fill-slate-700'} />
                          ))}
                        </div>
                        {r.comment && <p className="text-xs text-[#94A3B8]">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!prof?.bio && reviews.length === 0 && !loading && (
                <p className="text-center text-[#4A6580] text-sm py-4">Nenhuma informação adicional disponível.</p>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-700/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
