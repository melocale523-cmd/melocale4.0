import { X, MapPin, Tag, Star, Loader2 } from 'lucide-react';
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

  const initials = (prof.fullName || 'P')
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const clientInitials = (name: string | null | undefined) =>
    (name || 'C')
      .split(' ')
      .filter(Boolean)
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-[#132540] border border-[#1C3050] sm:rounded-xl rounded-t-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#1C3050] shrink-0">
          <h2 className="text-sm font-bold text-white">Perfil do profissional</h2>
          <button
            onClick={onClose}
            className="p-1 text-[#4A6580] hover:text-white transition-colors rounded-lg hover:bg-[#1C3050]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">

          {/* Top block: avatar + info */}
          <div className="flex gap-3">
            {prof.avatarUrl ? (
              <img
                src={prof.avatarUrl}
                alt={prof.fullName}
                className={cn(
                  'w-14 h-14 rounded-xl object-cover shrink-0',
                  prof.avgRating > 4.5
                    ? 'border-2 border-emerald-500/30'
                    : 'border border-white/10',
                )}
              />
            ) : (
              <div className={cn(
                'w-14 h-14 rounded-xl bg-[#0e1d30] flex items-center justify-center shrink-0 text-sm font-black text-[#4a6580]',
                prof.avgRating > 4.5
                  ? 'border-2 border-emerald-500/30'
                  : 'border border-white/5',
              )}>
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-white mb-1">{prof.fullName || 'Profissional'}</h3>
              {prof.avgRating > 0 && (
                <div className="flex items-center gap-1.5 mb-1">
                  <StarsFull rating={prof.avgRating} size={12} />
                  <span className="text-xs font-bold text-yellow-400">{prof.avgRating.toFixed(1)}</span>
                  <span className="text-[10px] text-[#4A6580]">({prof.reviewCount})</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {prof.category && (
                  <span className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
                    <Tag size={10} className="text-emerald-500 shrink-0" />
                    {prof.category}
                  </span>
                )}
                {prof.city && (
                  <span className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
                    <MapPin size={10} className="text-[#4A6580] shrink-0" />
                    {prof.city}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-md border bg-blue-500/10 text-blue-400 border-blue-500/20">
              {prof.reviewCount} avaliações
            </span>
            {prof.avgRating >= 4 && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-md border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                <Star size={8} className="fill-yellow-400" /> {prof.avgRating.toFixed(1)} de nota
              </span>
            )}
          </div>

          {/* Bio */}
          {prof.bio && (
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-1">Sobre</p>
              <p className="text-[11px] text-[#94a3b8] leading-relaxed">{prof.bio}</p>
            </div>
          )}

          {/* Reviews */}
          <div>
            <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-2">
              Avaliações recentes
            </p>
            {reviewsLoading ? (
              <div className="flex items-center gap-2 text-[#4A6580] py-3">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">Carregando...</span>
              </div>
            ) : reviews && reviews.length > 0 ? (
              <div>
                {reviews.map(review => (
                  <div key={review.id} className="flex gap-2 py-2 border-b border-white/[0.04]">
                    <div className="w-6 h-6 rounded-full bg-blue-500/15 text-blue-400 text-[9px] font-bold flex items-center justify-center shrink-0">
                      {clientInitials(review.clientName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-white">
                          {review.clientName ?? 'Cliente'}
                        </span>
                        <StarsFull rating={review.rating} size={10} />
                        <span className="text-[10px] text-[#4a6580]">
                          {format(new Date(review.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-[11px] text-[#94a3b8] mt-0.5 leading-relaxed">{review.comment}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[#4A6580] py-2">Nenhuma avaliação ainda.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-[#1C3050] shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-[#1C3050] hover:border-emerald-500/30 text-[#94A3B8] hover:text-emerald-400 text-xs font-bold rounded-xl transition-all"
          >
            Fechar
          </button>
          <button
            onClick={onSolicitarOrcamento}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all"
          >
            Solicitar orçamento →
          </button>
        </div>
      </div>
    </div>
  );
}
