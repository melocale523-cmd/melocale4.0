import { X, MapPin, Tag, Star, UserCircle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import type { ProfissionalResult } from '../hooks/useBuscaProfissionais';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  client_id: string;
  clientName?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  prof: ProfissionalResult;
  onSolicitarOrcamento: () => void;
}

function StarsFull({ rating, size = 14 }: { rating: number; size?: number }) {
  const filled = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          size={size}
          className={cn(s <= filled ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600 fill-slate-600')}
        />
      ))}
    </div>
  );
}

export default function PerfilProfissionalModal({ open, onClose, prof, onSolicitarOrcamento }: Props) {
  const { data: reviews, isLoading: reviewsLoading } = useQuery<Review[]>({
    queryKey: ['prof-modal-reviews', prof.id],
    queryFn: async () => {
      type RawReview = { id: string; rating: number; comment: string | null; created_at: string; client_id: string };

      const { data: rawReviews, error } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, client_id')
        .eq('professional_id', prof.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error || !rawReviews?.length) return [];

      const rows = rawReviews as unknown as RawReview[];
      const clientIds = rows.map(r => r.client_id);

      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', clientIds);

      const profileMap: Record<string, string | null> = Object.fromEntries(
        (profileRows ?? []).map(p => [p.id, p.full_name])
      );

      return rows.map(r => ({ ...r, clientName: profileMap[r.client_id] ?? null }));
    },
    enabled: open,
  });

  if (!open) return null;

  const initials = prof.fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-lg bg-[#132540] border border-[#1C3050] sm:rounded-2xl rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#1C3050] shrink-0">
          <h2 className="text-base font-bold text-white">Perfil do profissional</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[#4A6580] hover:text-white transition-colors rounded-lg hover:bg-[#1C3050]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-10">
          {/* Avatar + name + rating */}
          <div className="flex items-start gap-9">
            {prof.avatarUrl ? (
              <img
                src={prof.avatarUrl}
                alt={prof.fullName}
                className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-[#1C3050]"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-[#0E1C32] border border-[#1C3050] flex items-center justify-center shrink-0">
                <UserCircle size={32} className="text-[#4A6580]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-white mb-6">{prof.fullName || 'Profissional'}</h3>
              {prof.avgRating > 0 && (
                <div className="flex items-center gap-7 mb-1.5">
                  <StarsFull rating={prof.avgRating} />
                  <span className="text-sm font-bold text-yellow-400">{prof.avgRating.toFixed(1)}</span>
                  <span className="text-xs text-[#4A6580]">({prof.reviewCount})</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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

          {/* Bio */}
          {prof.bio && (
            <div className="bg-[#0E1C32] border border-[#1C3050] rounded-xl p-9">
              <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-7">Sobre</p>
              <p className="text-sm text-[#94A3B8] leading-relaxed">{prof.bio}</p>
            </div>
          )}

          {/* Reviews */}
          <div>
            <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-8">
              Avaliações recentes
            </p>
            {reviewsLoading ? (
              <div className="flex items-center gap-7 text-[#4A6580] py-9">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs">Carregando...</span>
              </div>
            ) : reviews && reviews.length > 0 ? (
              <div className="space-y-8">
                {reviews.map(review => (
                  <div key={review.id} className="bg-[#0E1C32] border border-[#1C3050] rounded-xl p-9 space-y-7">
                    <div className="flex items-center justify-between gap-7">
                      <div className="flex items-center gap-7">
                        <StarsFull rating={review.rating} size={12} />
                        <span className="text-xs font-semibold text-slate-300">
                          {review.clientName ?? 'Cliente'}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#4A6580] shrink-0">
                        {format(new Date(review.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-xs text-[#94A3B8] leading-relaxed">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#4A6580] py-7">Nenhuma avaliação ainda.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-8 px-5 py-9 border-t border-[#1C3050] shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-[#1C3050] hover:border-emerald-500/30 text-[#94A3B8] hover:text-emerald-400 text-sm font-bold rounded-xl transition-all"
          >
            Fechar
          </button>
          <button
            onClick={onSolicitarOrcamento}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all"
          >
            Solicitar orçamento
          </button>
        </div>
      </div>
    </div>
  );
}
