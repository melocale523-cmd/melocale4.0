import { useState, type FormEvent } from 'react';
import { X, CalendarPlus, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useMutation } from '@tanstack/react-query';
import { appointmentService } from '../../services/dbServices';

interface ChatScheduleModalProps {
  open: boolean;
  onClose: () => void;
  professionalId: string;
  clientId: string;
  clientName: string;
  conversationId: string;
}

interface ScheduleForm {
  title: string;
  date: string;
  time: string;
  location: string;
}

export function ChatScheduleModal({
  open,
  onClose,
  professionalId,
  clientId,
  clientName,
  conversationId,
}: ChatScheduleModalProps) {
  const [form, setForm] = useState<ScheduleForm>({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    location: '',
  });

  const scheduleMutation = useMutation({
    mutationFn: () =>
      appointmentService.createAppointment({
        professional_id: professionalId,
        client_id: clientId,
        conversation_id: conversationId,
        scheduled_at: new Date(`${form.date}T${form.time}:00`).toISOString(),
        title: form.title,
        location: form.location || undefined,
      }),
    onSuccess: () => {
      toast.success('Agendamento criado! O cliente foi notificado.');
      setForm({ title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '09:00', location: '' });
      onClose();
    },
    onError: () => toast.error('Erro ao criar agendamento'),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title) { toast.error('Informe o título do serviço'); return; }
    scheduleMutation.mutate();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-500 rounded-lg">
              <CalendarPlus size={20} />
            </div>
            Agendar Visita
          </h2>
          <button onClick={onClose} className="text-[#4A6580] hover:text-white transition-colors">
            <X size={22} />
          </button>
        </div>

        <p className="text-xs text-[#94A3B8] mb-6">
          Para: <span className="text-white font-semibold">{clientName}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest">Título do Serviço *</label>
            <input
              type="text"
              required
              placeholder="Ex: Instalação elétrica"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest">Data *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest">Horário *</label>
              <input
                type="time"
                required
                value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
                className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-1">
              <MapPin size={12} /> Endereço
            </label>
            <input
              type="text"
              placeholder="Rua, número, bairro..."
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={scheduleMutation.isPending}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {scheduleMutation.isPending && <Loader2 size={16} className="animate-spin" />}
            {scheduleMutation.isPending ? 'Salvando...' : 'Criar Agendamento'}
          </button>
        </form>
      </div>
    </div>
  );
}
