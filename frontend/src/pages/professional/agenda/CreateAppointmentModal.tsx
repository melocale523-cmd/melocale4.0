import { useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { X, Plus, User, MapPin, Loader2, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { AvailableClient } from '../../../hooks/useAgendaData';
import type { appointmentService } from '../../../services/appointmentService';

type CreatePayload = Parameters<typeof appointmentService.createAppointment>[0];

interface CreateAppointmentModalProps {
  initialDate?: string;
  availableClients: AvailableClient[];
  onClose: () => void;
  onSubmit: (payload: CreatePayload) => void;
  isPending: boolean;
  professionalId: string;
}

interface FormData {
  title: string;
  clientId: string;
  conversationId: string;
  date: string;
  time: string;
  location: string;
  description: string;
}

export function CreateAppointmentModal({
  initialDate,
  availableClients,
  onClose,
  onSubmit,
  isPending,
  professionalId,
}: CreateAppointmentModalProps) {
  const today = format(new Date(), 'yyyy-MM-dd');

  const [formData, setFormData] = useState<FormData>({
    title: '',
    clientId: '',
    conversationId: '',
    date: initialDate ?? today,
    time: '09:00',
    location: '',
    description: '',
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.clientId) {
      toast.error('Preencha título e cliente');
      return;
    }
    onSubmit({
      professional_id: professionalId,
      client_id: formData.clientId,
      conversation_id: formData.conversationId || undefined,
      scheduled_at: new Date(`${formData.date}T${formData.time}:00`).toISOString(),
      title: formData.title,
      location: formData.location || undefined,
      description: formData.description || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-xl p-2 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-500 rounded-lg"><Plus size={24} /></div>
            Novo Agendamento
          </h2>
          <button onClick={onClose} className="text-[#4A6580] hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="space-y-7">
            <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest">Título / Serviço *</label>
            <input
              type="text"
              required
              placeholder="Ex: Instalação elétrica"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              maxLength={255}
              className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="space-y-7">
            <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
              <User size={14} /> Cliente *
            </label>
            {availableClients.length === 0 ? (
              <p className="text-xs text-[#4A6580] py-2 px-3 bg-[#0E1C32] rounded-lg border border-[#243F6A]">
                Sem clientes disponíveis. Adquira leads primeiro.
              </p>
            ) : (
              <select
                required
                value={formData.clientId}
                onChange={e => {
                  const c = availableClients.find(cl => cl.clientId === e.target.value);
                  const cityState = [c?.clientCity, c?.clientState].filter(Boolean).join(' - ');
                  const clientLocation = [
                    c?.clientStreet,
                    c?.clientNumber,
                    c?.clientBlock,
                    c?.clientNeighborhood,
                    cityState,
                  ].filter(Boolean).join(', ');
                  setFormData({
                    ...formData,
                    clientId: e.target.value,
                    conversationId: c?.conversationId || '',
                    location: clientLocation || formData.location,
                  });
                }}
                className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="">Selecione um cliente...</option>
                {availableClients.map(c => (
                  <option key={c.clientId} value={c.clientId}>{c.clientName}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-7">
              <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                <CalendarIcon size={14} /> Data *
              </label>
              <input
                type="date"
                required
                min={today}
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-7">
              <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                <Clock size={14} /> Horário *
              </label>
              <input
                type="time"
                required
                value={formData.time}
                onChange={e => setFormData({ ...formData, time: e.target.value })}
                className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-7">
            <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
              <MapPin size={14} /> Endereço
            </label>
            <input
              type="text"
              placeholder="Rua, número, bairro..."
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              maxLength={255}
              className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="space-y-7">
            <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest">Observações</label>
            <textarea
              rows={3}
              placeholder="Detalhes do serviço..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              maxLength={500}
              className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || availableClients.length === 0}
            className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0E1C32] font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPending && <Loader2 size={18} className="animate-spin" />}
            {isPending ? 'Salvando...' : 'Finalizar Agendamento'}
          </button>
        </form>
      </div>
    </div>
  );
}
