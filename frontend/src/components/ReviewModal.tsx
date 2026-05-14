import { useState } from 'react';
import { X, Star, Loader2, Send } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { reviewService } from '../services/reviewService';
import { cn } from '../lib/utils';

interface ReviewModalProps {
  appointmentId: string;
  professionalId: string;
  clientId: string;
  professionalName: string;
  onClose: () => void;
}

export default function ReviewModal({
  appointmentId,
  professionalId,
  clientId,
  professionalName,
  onClose,
}: ReviewModalProps) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      reviewService.submitReview({
        client_id: clientId,
        professional_id: professionalId,
        appointment_id: appointmentId,
        rating,
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_appointments'] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      toast.success('Avaliação enviada!');
      onClose();
    },
    onError: () => toast.error('Erro ao enviar avaliação.'),
  });

  const displayed = hovered || rating;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#132540] border border-[#1C3050] rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Star size={16} className="text-yellow-400 fill-yellow-400" />
            Avaliar atendimento
          </h3>
          <button onClick={onClose} className="text-[#4A6580] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-[#94A3B8] mb-5">
          Como foi seu atendimento com <span className="text-white font-semibold">{professionalName}</span>?
        </p>

        {/* Stars */}
        <div className="flex justify-center gap-2 mb-5">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="transition-transform hover:scale-110 active:scale-95"
              aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
            >
              <Star
                size={36}
                className={cn(
                  'transition-colors',
                  star <= displayed
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-[#1C3050] fill-[#1C3050]',
                )}
              />
            </button>
          ))}
        </div>

        {/* Comment */}
        <div className="mb-5">
          <label className="text-xs text-[#94A3B8] font-bold uppercase tracking-widest mb-1 block">
            Comentário <span className="text-[#4A6580] normal-case font-normal">(opcional)</span>
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Conte como foi a experiência..."
            className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors resize-none placeholder:text-[#4A6580]"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => mutation.mutate()}
            disabled={rating === 0 || mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Enviar Avaliação
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 text-[#94A3B8] hover:text-white text-xs font-bold rounded-xl border border-[#1C3050] hover:border-white/20 transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
