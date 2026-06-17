import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Clock, User, MapPin, X, CheckCircle2, RefreshCw, AlertTriangle, Loader2,
} from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { Appointment } from '../../../services/appointmentService';

type AppStatus = Appointment['status'];

interface DaySidebarProps {
  selectedDate: Date;
  selectedDayAppointments: Appointment[];
  onSetSelectedDate: (d: Date) => void;
  onOpenDetails: (appt: Appointment) => void;
  onCancelTarget: (target: { id: string; clientId: string }) => void;
  onProposeOpen: (appt: Appointment) => void;
  onUpdateStatus: (id: string, status: 'confirmed' | 'cancelled' | 'completed', notifyUserId?: string) => void;
  onOpenNewForDate: (date: Date) => void;
  anyPending: boolean;
  acceptMutation: UseMutationResult<unknown, Error, Appointment>;
  declineMutation: UseMutationResult<unknown, Error, Appointment>;
}

function isActive(s: AppStatus) {
  return s === 'scheduled' || s === 'confirmed';
}

export function DaySidebar({
  selectedDate,
  selectedDayAppointments,
  onSetSelectedDate,
  onOpenDetails,
  onCancelTarget,
  onProposeOpen,
  onUpdateStatus,
  onOpenNewForDate,
  anyPending,
  acceptMutation,
  declineMutation,
}: DaySidebarProps) {
  return (
    <div className="bg-[#132236] border border-[#1C3050] rounded-2xl p-5 flex flex-col relative overflow-hidden group">
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-700" />

      <div className="flex items-center justify-between mb-4 relative z-10">
        <h3 className="text-white font-bold text-base first-letter:uppercase">
          {format(selectedDate, "eeee, d 'de' MMMM", { locale: ptBR })}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => onSetSelectedDate(subDays(selectedDate, 1))}
            className="p-1.5 hover:bg-white/5 rounded-lg text-[#4A6580] hover:text-emerald-500 transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => onSetSelectedDate(addDays(selectedDate, 1))}
            className="p-1.5 hover:bg-white/5 rounded-lg text-[#4A6580] hover:text-emerald-500 transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2 relative z-10">
        {selectedDayAppointments.length > 0 ? (
          selectedDayAppointments.map(app => {
            const clientRequestedReschedule = app.status === 'rescheduled' && app.proposed_by === 'client';
            const profRequestedReschedule = app.status === 'rescheduled' && app.proposed_by === 'professional';
            return (
              <div key={app.id} className="bg-[#0d1929] border border-[#1C3050] rounded-xl p-4 space-y-2 hover:border-emerald-500/30 transition-all">
                {clientRequestedReschedule && app.proposed_at && (
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={12} className="text-orange-400 shrink-0" />
                      <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Cliente propôs nova data</p>
                    </div>
                    <p className="text-xs text-orange-300 mb-2">
                      {format(new Date(app.proposed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptMutation.mutate(app)}
                        disabled={anyPending}
                        className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold rounded-lg transition-all disabled:opacity-50"
                      >
                        {acceptMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                        Aceitar
                      </button>
                      <button
                        onClick={() => declineMutation.mutate(app)}
                        disabled={anyPending}
                        className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold rounded-lg border border-red-500/20 transition-all disabled:opacity-50"
                      >
                        <X size={10} /> Recusar
                      </button>
                    </div>
                  </div>
                )}

                {profRequestedReschedule && app.proposed_at && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <RefreshCw size={11} className="text-blue-400" />
                      <p className="text-[10px] font-bold text-blue-400">Aguardando cliente</p>
                    </div>
                    <p className="text-xs text-blue-300 mt-2">
                      Proposta: {format(new Date(app.proposed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}

                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 px-7 py-2 bg-emerald-500/10 rounded-lg text-emerald-500 text-[10px] font-bold font-mono">
                    <Clock size={12} /> {format(new Date(app.scheduled_at), 'HH:mm')}
                  </div>
                  {isActive(app.status) && (
                    <button
                      onClick={() => onCancelTarget({ id: app.id, clientId: app.client_id })}
                      className="text-slate-700 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div>
                  <h4 className="text-white font-bold text-base">{app.title}</h4>
                  <p className="text-[#4A6580] text-sm flex items-center gap-2 mt-2">
                    <User size={14} /> {app.client?.full_name || 'Cliente'}
                  </p>
                  {app.location && (
                    <p className="text-[#4A6580] text-xs flex items-center gap-2 mt-2">
                      <MapPin size={12} /> {app.location}
                    </p>
                  )}
                  {app.status === 'completed' && (
                    <p className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest mt-7 flex items-center gap-2">
                      <CheckCircle2 size={12} /> Concluído
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={() => onOpenDetails(app)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg border border-[#243F6A] transition-all">
                    Detalhes
                  </button>
                  {isActive(app.status) && (
                    <>
                      <button
                        onClick={() => onProposeOpen(app)}
                        className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/20 transition-all"
                        title="Propor nova data"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        onClick={() => onUpdateStatus(app.id, 'completed', app.client_id)}
                        className="p-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-black text-emerald-500 rounded-lg border border-emerald-500/20 transition-all"
                        title="Concluir"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <div className="w-20 h-20 bg-[#0E1C32] rounded-full flex items-center justify-center mb-11 border border-[#1C3050] shadow-inner">
              <CalendarIcon className="text-slate-700" size={32} />
            </div>
            <p className="text-white/90 font-bold text-base mb-2">Nenhum agendamento</p>
            <p className="text-[#4A6580] text-sm">Este dia está livre.</p>
            <button
              onClick={() => onOpenNewForDate(selectedDate)}
              className="mt-10 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/10 active:scale-[0.98]"
            >
              Agendar Horário
            </button>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-[#1C3050] relative z-10" style={{ marginTop: '1.5rem' }}>
        <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">
          <span>Horários Populares</span>
          <span className="text-emerald-500/50">Disponível</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#0E1C32] border border-[#1C3050] p-2 rounded-lg text-center text-xs text-slate-300 font-mono italic">09:00 - 10:00</div>
          <div className="bg-[#0E1C32] border border-[#1C3050] p-2 rounded-lg text-center text-xs text-slate-300 font-mono italic">14:00 - 15:00</div>
        </div>
      </div>

      <div style={{ marginTop: '1.25rem' }} className="bg-[#0d1929] border border-[#1C3050] rounded-xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6580] mb-3">Resumo do mês</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#4A6580]">Próximo agendamento</span>
            <span className="text-xs font-medium text-white">—</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#4A6580]">Faturamento est.</span>
            <span className="text-xs font-medium text-emerald-400">R$ 0,00</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#4A6580]">Taxa de conclusão</span>
            <span className="text-xs font-medium text-white">—</span>
          </div>
        </div>
      </div>
    </div>
  );
}
