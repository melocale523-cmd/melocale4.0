import { useState } from 'react';
import { format } from 'date-fns';
import { X, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Appointment } from '../../../services/appointmentService';

interface ProposeRescheduleModalProps {
  appointment: Appointment;
  onClose: () => void;
  onSubmit: (appt: Appointment, proposedAt: string) => void;
  isPending: boolean;
}

export function ProposeRescheduleModal({
  appointment,
  onClose,
  onSubmit,
  isPending,
}: ProposeRescheduleModalProps) {
  const [proposeDate, setProposeDate] = useState('');
  const [proposeTime, setProposeTime] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd');

  const handleSubmit = () => {
    if (!proposeDate || !proposeTime) {
      toast.error('Preencha data e horário.');
      return;
    }
    onSubmit(appointment, new Date(`${proposeDate}T${proposeTime}`).toISOString());
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-9">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-2xl p-11 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-9">
          <h3 className="text-base font-bold text-white flex items-center gap-7">
            <RefreshCw size={16} className="text-blue-400" /> Propor Nova Data
          </h3>
          <button onClick={onClose} className="text-[#4A6580] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-[#94A3B8] mb-9">
          O cliente receberá uma notificação e deverá aceitar ou recusar a nova data.
        </p>
        <div className="space-y-8">
          <div>
            <label className="text-xs text-[#94A3B8] font-bold uppercase tracking-widest mb-6 block">Nova Data</label>
            <input
              type="date"
              min={today}
              value={proposeDate}
              onChange={e => setProposeDate(e.target.value)}
              className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl px-8 py-7 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-[#94A3B8] font-bold uppercase tracking-widest mb-6 block">Novo Horário</label>
            <input
              type="time"
              value={proposeTime}
              onChange={e => setProposeTime(e.target.value)}
              className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl px-8 py-7 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
        </div>
        <div className="flex gap-7 mt-5">
          <button
            onClick={handleSubmit}
            disabled={isPending || !proposeDate || !proposeTime}
            className="flex-1 flex items-center justify-center gap-7 py-8 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Enviar Proposta
          </button>
          <button
            onClick={onClose}
            className="px-9 py-8 text-[#94A3B8] hover:text-white text-xs font-bold rounded-xl border border-[#1C3050] hover:border-white/20 transition-all"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
