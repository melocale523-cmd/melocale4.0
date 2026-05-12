import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Clock, MapPin, CheckCircle2, X, Loader2, User,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { appointmentService, type Appointment } from '../../services/dbServices';

type AppStatus = Appointment['status'];

const STATUS_LABEL: Record<AppStatus, string> = {
  scheduled: 'Aguardando confirmação',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
};

const STATUS_BADGE: Record<AppStatus, string> = {
  scheduled: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export default function ClientAgenda() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    localStorage.setItem('client_agenda_last_seen', new Date().toISOString());
    queryClient.invalidateQueries({ queryKey: ['client_scheduled_count'] });
  }, [queryClient]);

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ['client_appointments', user?.id],
    queryFn: () => appointmentService.getClientAppointments(user!.id),
    enabled: !!user?.id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, reason, notifyUserId }: {
      id: string;
      status: 'confirmed' | 'cancelled';
      reason?: string;
      notifyUserId?: string;
    }) => appointmentService.updateAppointmentStatus(id, status, { cancelledReason: reason, notifyUserId }),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['client_appointments', user?.id] });
      if (status === 'confirmed') toast.success('Agendamento confirmado!');
      else toast.info('Agendamento recusado');
      setCancellingId(null);
      setCancelReason('');
    },
    onError: () => toast.error('Erro ao atualizar agendamento'),
  });

  const handleConfirm = (appt: Appointment) => {
    const notifyUserId = appt.professional?.user_id;
    updateMutation.mutate({ id: appt.id, status: 'confirmed', notifyUserId });
  };

  const handleCancelSubmit = (appt: Appointment) => {
    const notifyUserId = appt.professional?.user_id;
    updateMutation.mutate({ id: appt.id, status: 'cancelled', reason: cancelReason || undefined, notifyUserId });
  };

  const stats = useMemo(() => ({
    scheduled: appointments.filter(a => a.status === 'scheduled').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
  }), [appointments]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Minha Agenda</h1>
        <p className="text-[#94A3B8] text-sm mt-1">Seus agendamentos com profissionais</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#132540] border border-yellow-500/20 rounded-2xl p-4">
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-1">Aguardando</p>
          <p className="text-2xl font-bold text-yellow-400">{isLoading ? '—' : stats.scheduled}</p>
        </div>
        <div className="bg-[#132540] border border-emerald-500/20 rounded-2xl p-4">
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">Confirmados</p>
          <p className="text-2xl font-bold text-emerald-400">{isLoading ? '—' : stats.confirmed}</p>
        </div>
        <div className="bg-[#132540] border border-blue-500/20 rounded-2xl p-4">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">Concluídos</p>
          <p className="text-2xl font-bold text-blue-400">{isLoading ? '—' : stats.completed}</p>
        </div>
        <div className="bg-[#132540] border border-red-500/20 rounded-2xl p-4">
          <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-1">Cancelados</p>
          <p className="text-2xl font-bold text-red-400">{isLoading ? '—' : stats.cancelled}</p>
        </div>
      </div>

      {/* Appointment list */}
      <div className="bg-[#132540] border border-[#1C3050] rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <CalendarIcon size={18} className="text-emerald-400" />
          Todos os Agendamentos
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 size={24} className="animate-spin text-emerald-500" />
            <span className="text-[#94A3B8] text-sm">Carregando...</span>
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12">
            <CalendarIcon size={40} className="mx-auto text-[#243F6A] mb-3" />
            <p className="text-[#94A3B8] text-sm">Nenhum agendamento encontrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {[...appointments]
              .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
              .map(appt => {
                const dt = new Date(appt.scheduled_at);
                const profName = appt.professional?.profile?.full_name || 'Profissional';
                const profCategory = appt.professional?.category;
                const isCancelling = cancellingId === appt.id;

                return (
                  <div
                    key={appt.id}
                    className={cn(
                      'rounded-2xl border transition-all',
                      appt.status === 'scheduled'
                        ? 'bg-yellow-500/5 border-yellow-500/20'
                        : appt.status === 'confirmed'
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : 'bg-[#0E1C32] border-[#1C3050]',
                    )}
                  >
                    <div className="flex items-start gap-4 p-4">
                      {/* Date badge */}
                      <div className="flex flex-col items-center justify-center min-w-[52px] h-14 rounded-xl bg-[#132540] border border-[#1C3050] shrink-0">
                        <span className="text-lg font-bold text-white leading-none">{format(dt, 'dd')}</span>
                        <span className="text-[10px] text-[#94A3B8] uppercase font-bold">{format(dt, 'MMM', { locale: ptBR })}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-bold text-white truncate">{appt.title}</p>
                            <p className="text-xs text-[#94A3B8] flex items-center gap-1 mt-0.5">
                              <User size={11} /> {profName}
                              {profCategory && <span className="text-[#4A6580]">· {profCategory}</span>}
                            </p>
                          </div>
                          <span className={cn('text-[10px] font-bold px-2 py-1 rounded-lg border whitespace-nowrap shrink-0', STATUS_BADGE[appt.status])}>
                            {STATUS_LABEL[appt.status]}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                          <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
                            <Clock size={11} />
                            {format(dt, "eeee, HH:mm", { locale: ptBR })}
                          </span>
                          {appt.location && (
                            <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
                              <MapPin size={11} />
                              {appt.location}
                            </span>
                          )}
                        </div>

                        {appt.description && (
                          <p className="text-xs text-[#4A6580] mt-1 truncate">{appt.description}</p>
                        )}

                        {appt.cancelled_reason && (
                          <p className="text-xs text-red-400/70 mt-1">Motivo: {appt.cancelled_reason}</p>
                        )}

                        {/* Action buttons for 'scheduled' */}
                        {appt.status === 'scheduled' && !isCancelling && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleConfirm(appt)}
                              disabled={updateMutation.isPending}
                              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                            >
                              {updateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                              Confirmar
                            </button>
                            <button
                              onClick={() => { setCancellingId(appt.id); setCancelReason(''); }}
                              disabled={updateMutation.isPending}
                              className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl border border-red-500/20 transition-all disabled:opacity-50"
                            >
                              <X size={13} /> Recusar
                            </button>
                          </div>
                        )}

                        {/* Cancel reason form */}
                        {appt.status === 'scheduled' && isCancelling && (
                          <div className="mt-3 space-y-2">
                            <textarea
                              rows={2}
                              placeholder="Motivo do cancelamento (opcional)..."
                              value={cancelReason}
                              onChange={e => setCancelReason(e.target.value)}
                              className="w-full bg-[#0E1C32] border border-red-500/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/40 transition-colors resize-none placeholder:text-[#4A6580]"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleCancelSubmit(appt)}
                                disabled={updateMutation.isPending}
                                className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-400 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                              >
                                {updateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                                Confirmar Recusa
                              </button>
                              <button
                                onClick={() => { setCancellingId(null); setCancelReason(''); }}
                                className="px-4 py-2 text-[#94A3B8] hover:text-white text-xs font-bold rounded-xl border border-[#1C3050] hover:border-white/20 transition-all"
                              >
                                Voltar
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Confirmed status indicator */}
                        {appt.status === 'confirmed' && (
                          <div className="flex items-center gap-1.5 mt-2 text-emerald-400 text-xs font-bold">
                            <CheckCircle2 size={13} /> Você confirmou este agendamento
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
