import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  X, List, User, Clock, MapPin, RefreshCw, CheckCircle2, AlertTriangle,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { UseMutationResult } from '@tanstack/react-query';
import type { Appointment } from '../../../services/appointmentService';

type AppStatus = Appointment['status'];

const STATUS_LABEL: Record<AppStatus, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  rescheduled: 'Reagendando',
};

const STATUS_BADGE: Record<AppStatus, string> = {
  scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  confirmed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  completed: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  rescheduled: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

interface AppointmentDetailsModalProps {
  appointment: Appointment;
  onClose: () => void;
  onUpdateStatus: (id: string, status: 'confirmed' | 'cancelled' | 'completed', notifyUserId?: string) => void;
  onProposeOpen: (appt: Appointment) => void;
  onCancelTarget: (target: { id: string; clientId: string }) => void;
  anyPending: boolean;
  acceptMutation: UseMutationResult<unknown, Error, Appointment>;
  declineMutation: UseMutationResult<unknown, Error, Appointment>;
}

function isActive(s: AppStatus) {
  return s === 'scheduled' || s === 'confirmed';
}

export function AppointmentDetailsModal({
  appointment,
  onClose,
  onUpdateStatus,
  onProposeOpen,
  onCancelTarget,
  anyPending,
  acceptMutation,
  declineMutation,
}: AppointmentDetailsModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-xl p-2 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-500 rounded-lg"><List size={24} /></div>
            Detalhes do Agendamento
          </h2>
          <button onClick={onClose} className="text-[#4A6580] hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {appointment.status === 'rescheduled' && appointment.proposed_by === 'client' && appointment.proposed_at && (
          <div className="mb-11 bg-orange-500/10 border border-orange-500/30 rounded-xl p-2">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-orange-400" />
              <p className="text-sm font-bold text-orange-400">Cliente solicitou reagendamento para:</p>
            </div>
            <p className="text-sm text-orange-300 mb-2">
              {format(new Date(appointment.proposed_at), "eeee, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { acceptMutation.mutate(appointment); onClose(); }}
                disabled={anyPending}
                className="flex-1 py-7 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} /> Aceitar
              </button>
              <button
                onClick={() => { declineMutation.mutate(appointment); onClose(); }}
                disabled={anyPending}
                className="flex-1 py-7 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-lg border border-red-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <X size={16} /> Recusar
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-[#0E1C32] border border-[#1C3050] rounded-xl">
              <p className="text-[10px] font-bold text-[#4A6580] uppercase tracking-widest mb-2">Status</p>
              <span className={cn('text-xs font-bold', STATUS_BADGE[appointment.status].split(' ')[1])}>
                {STATUS_LABEL[appointment.status].toUpperCase()}
              </span>
            </div>
            <div className="p-2 bg-[#0E1C32] border border-[#1C3050] rounded-xl">
              <p className="text-[10px] font-bold text-[#4A6580] uppercase tracking-widest mb-2">ID</p>
              <span className="text-xs font-mono text-slate-300">#{appointment.id.slice(0, 8)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 border border-[#1C3050] rounded-xl bg-[#0E1C32]/30">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500">
                <User size={24} />
              </div>
              <div>
                <p className="text-xs text-[#4A6580]">Cliente</p>
                <p className="text-white font-bold text-base">{appointment.client?.full_name || 'Cliente'}</p>
                {appointment.client?.phone && (
                  <p className="text-[#4A6580] text-xs">{appointment.client.phone}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 border border-[#1C3050] rounded-xl bg-[#0E1C32]/30">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400">
                <CalendarIcon size={24} />
              </div>
              <div>
                <p className="text-xs text-[#4A6580]">Serviço / Título</p>
                <p className="text-white font-bold text-base">{appointment.title}</p>
                {appointment.description && (
                  <p className="text-[#4A6580] text-xs mt-2">{appointment.description}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2 border border-[#1C3050] rounded-xl bg-[#0E1C32]/30">
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-[#94A3B8]">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-[#4A6580] uppercase font-bold">Data</p>
                  <p className="text-white font-bold text-sm">{format(new Date(appointment.scheduled_at), 'dd/MM/yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 border border-[#1C3050] rounded-xl bg-[#0E1C32]/30">
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-[#94A3B8]">
                  <Clock size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-[#4A6580] uppercase font-bold">Horário</p>
                  <p className="text-white font-bold text-sm">{format(new Date(appointment.scheduled_at), 'HH:mm')}</p>
                </div>
              </div>
            </div>

            {appointment.location && (
              <div className="flex items-center gap-2 p-2 border border-[#1C3050] rounded-xl bg-[#0E1C32]/30">
                <MapPin size={16} className="text-[#94A3B8] shrink-0" />
                <p className="text-slate-300 text-sm">{appointment.location}</p>
              </div>
            )}

            {appointment.cancelled_reason && (
              <div className="p-2 border border-red-500/20 rounded-xl bg-red-500/5">
                <p className="text-[10px] text-red-400 uppercase font-bold mb-2">Motivo do cancelamento</p>
                <p className="text-slate-300 text-sm">{appointment.cancelled_reason}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            {isActive(appointment.status) && (
              <>
                <button
                  onClick={() => onUpdateStatus(appointment.id, 'completed', appointment.client_id)}
                  disabled={anyPending}
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  Concluir Atendimento
                </button>
                <button
                  onClick={() => { onProposeOpen(appointment); onClose(); }}
                  disabled={anyPending}
                  className="flex-1 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold rounded-xl border border-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} /> Propor Nova Data
                </button>
                <button
                  onClick={() => { onCancelTarget({ id: appointment.id, clientId: appointment.client_id }); onClose(); }}
                  disabled={anyPending}
                  className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-xl border border-red-500/20 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
              </>
            )}
            {appointment.status === 'completed' && (
              <div className="w-full py-2 bg-emerald-500/10 text-emerald-500 font-bold rounded-xl border border-emerald-500/20 flex items-center justify-center gap-2">
                <CheckCircle2 size={20} /> Atendimento Concluído
              </div>
            )}
            {appointment.status === 'cancelled' && (
              <div className="w-full py-2 bg-red-500/10 text-red-400 font-bold rounded-xl border border-red-500/20 flex items-center justify-center gap-2">
                <X size={20} /> Agendamento Cancelado
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
