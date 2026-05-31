import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar as CalendarIcon, Clock, MapPin, CheckCircle2, X, Loader2, User,
  RefreshCw, Star, AlertTriangle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { appointmentService, type Appointment, reviewService } from '../../services/dbServices';
import { apiFetch } from '../../lib/api';
import ReviewModal from '../../components/ReviewModal';

type AppStatus = Appointment['status'];

const STATUS_LABEL: Record<AppStatus, string> = {
  scheduled: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
  rescheduled: 'Reagendando',
};

const STATUS_BADGE: Record<AppStatus, string> = {
  scheduled: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  rescheduled: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const CARD_BG: Record<AppStatus, string> = {
  scheduled: 'bg-yellow-500/5 border-yellow-500/20',
  confirmed: 'bg-emerald-500/5 border-emerald-500/20',
  cancelled: 'bg-[#0E1C32] border-[#1C3050]',
  completed: 'bg-[#0E1C32] border-[#1C3050]',
  rescheduled: 'bg-orange-500/5 border-orange-500/30',
};

export default function ClientAgenda() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [reviewingAppt, setReviewingAppt] = useState<Appointment | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['client_appointments', user?.id] });

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ['client_appointments', user?.id],
    queryFn: () => appointmentService.getClientAppointments(user!.id),
    enabled: !!user?.id,
  });

  const completedIds = useMemo(
    () => appointments.filter(a => a.status === 'completed').map(a => a.id),
    [appointments],
  );
  const { data: reviewedIds = [] } = useQuery<string[]>({
    queryKey: ['reviews', 'client_completed', completedIds],
    queryFn: async () => {
      const results = await Promise.all(completedIds.map(id => reviewService.hasReview(id)));
      return completedIds.filter((_, i) => results[i]);
    },
    enabled: completedIds.length > 0,
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, reason, notifyUserId }: {
      id: string;
      status: 'confirmed' | 'cancelled';
      reason?: string;
      notifyUserId?: string;
    }) => appointmentService.updateAppointmentStatus(id, status, { cancelledReason: reason, notifyUserId }),
    onSuccess: (_, { status }) => {
      invalidate();
      if (status === 'confirmed') toast.success('Agendamento confirmado!');
      else toast.info('Agendamento cancelado.');
      setCancellingId(null);
      setCancelReason('');
    },
    onError: () => toast.error('Erro ao atualizar agendamento'),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ appt, proposedAt }: { appt: Appointment; proposedAt: string }) =>
      appointmentService.proposeReschedule(appt.id, proposedAt, 'client', appt.professional?.user_id),
    onSuccess: () => {
      invalidate();
      toast.success('Proposta de reagendamento enviada!');
      setReschedulingAppt(null);
      setRescheduleDate('');
      setRescheduleTime('');
    },
    onError: () => toast.error('Erro ao propor reagendamento'),
  });

  const acceptMutation = useMutation({
    mutationFn: (appt: Appointment) =>
      appointmentService.acceptReschedule(appt.id, appt.professional?.user_id),
    onSuccess: () => { invalidate(); toast.success('Reagendamento aceito!'); },
    onError: () => toast.error('Erro ao aceitar reagendamento'),
  });

  const declineMutation = useMutation({
    mutationFn: (appt: Appointment) =>
      appointmentService.declineReschedule(appt.id, appt.professional?.user_id),
    onSuccess: () => { invalidate(); toast.info('Reagendamento recusado.'); },
    onError: () => toast.error('Erro ao recusar reagendamento'),
  });

  const confirmPresencaMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const res = await apiFetch(`/api/appointments/${appointmentId}/confirm`, { method: 'PATCH' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? 'Erro ao confirmar presença');
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.success('Presença confirmada!');
    },
    onError: (err: Error) => toast.error(err.message || 'Não foi possível confirmar. Tente novamente.'),
  });

  const handleConfirm = (appt: Appointment) => {
    updateMutation.mutate({ id: appt.id, status: 'confirmed', notifyUserId: appt.professional?.user_id });
  };

  const handleCancelSubmit = (appt: Appointment) => {
    updateMutation.mutate({
      id: appt.id,
      status: 'cancelled',
      reason: cancelReason || undefined,
      notifyUserId: appt.professional?.user_id,
    });
  };

  const handleRescheduleSubmit = () => {
    if (!reschedulingAppt || !rescheduleDate || !rescheduleTime) {
      toast.error('Preencha data e horário para reagendar.');
      return;
    }
    const proposedAt = new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString();
    rescheduleMutation.mutate({ appt: reschedulingAppt, proposedAt });
  };

  const stats = useMemo(() => ({
    total: appointments.length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    pending: appointments.filter(a => a.status === 'scheduled').length,
  }), [appointments]);

  const sorted = useMemo(
    () => [...appointments].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [appointments],
  );

  const anyPending =
    updateMutation.isPending ||
    rescheduleMutation.isPending ||
    acceptMutation.isPending ||
    declineMutation.isPending ||
    confirmPresencaMutation.isPending;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Minha Agenda</h1>
        <p className="text-[#94A3B8] text-sm mt-1">Seus agendamentos com profissionais</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#132540] border border-[#1C3050] rounded-2xl p-4">
          <p className="text-[#94A3B8] text-xs font-bold uppercase tracking-widest mb-1">Total</p>
          <p className="text-2xl font-bold text-white">{isLoading ? '—' : stats.total}</p>
        </div>
        <div className="bg-[#132540] border border-emerald-500/20 rounded-2xl p-4">
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">Confirmados</p>
          <p className="text-2xl font-bold text-emerald-400">{isLoading ? '—' : stats.confirmed}</p>
        </div>
        <div className="bg-[#132540] border border-yellow-500/20 rounded-2xl p-4">
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-1">Pendentes</p>
          <p className="text-2xl font-bold text-yellow-400">{isLoading ? '—' : stats.pending}</p>
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
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-[#0E1C32] border border-[#1C3050] flex items-center justify-center">
              <CalendarIcon size={36} className="text-[#243F6A]" />
            </div>
            <div>
              <p className="text-white font-bold text-base">Nenhum agendamento ainda</p>
              <p className="text-[#94A3B8] text-sm mt-1 max-w-xs mx-auto">
                Quando um profissional agendar um serviço com você, ele aparecerá aqui.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map(appt => {
              const dt = new Date(appt.scheduled_at);
              const hoursUntil = (dt.getTime() - Date.now()) / 3_600_000;
              const profName = appt.professional?.profile?.full_name || 'Profissional';
              const profCategory = appt.professional?.category;
              const isCancelling = cancellingId === appt.id;
              const canCancel = appt.status !== 'completed' && appt.status !== 'cancelled';
              const canReview = appt.status === 'completed' && !reviewedIds.includes(appt.id);
              const profProposedReschedule = appt.status === 'rescheduled' && appt.proposed_by === 'professional';
              const clientProposedReschedule = appt.status === 'rescheduled' && appt.proposed_by === 'client';
              // Show "Confirmar Presença" within 48 h of the appointment, before it passes, and only once
              const canConfirmPresenca =
                (appt.status === 'scheduled' || appt.status === 'rescheduled') &&
                hoursUntil > 0 &&
                hoursUntil <= 48 &&
                !appt.confirmed_at;
              // Show regular "Confirmar" only when > 48 h away (presence button handles the close window)
              const canConfirmStatus = appt.status === 'scheduled' && hoursUntil > 48;

              return (
                <div
                  key={appt.id}
                  className={cn('rounded-2xl border transition-all', CARD_BG[appt.status])}
                >
                  {/* Reschedule banner — professional proposed */}
                  {profProposedReschedule && appt.proposed_at && (
                    <div className="mx-4 mt-4 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={14} className="text-orange-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-orange-400">Profissional propôs nova data</p>
                          <p className="text-xs text-orange-300 mt-0.5">
                            {format(new Date(appt.proposed_at), "eeee, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => acceptMutation.mutate(appt)}
                          disabled={anyPending}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                          {acceptMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          Aceitar
                        </button>
                        <button
                          onClick={() => declineMutation.mutate(appt)}
                          disabled={anyPending}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl border border-red-500/20 transition-all disabled:opacity-50"
                        >
                          <X size={12} /> Recusar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reschedule banner — waiting for professional response */}
                  {clientProposedReschedule && appt.proposed_at && (
                    <div className="mx-4 mt-4 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                      <div className="flex items-center gap-2">
                        <RefreshCw size={13} className="text-blue-400 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-blue-400">Aguardando resposta do profissional</p>
                          <p className="text-xs text-blue-300 mt-0.5">
                            Sua proposta: {format(new Date(appt.proposed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-4 p-4">
                    {/* Date badge */}
                    <div className="flex flex-col items-center justify-center min-w-[52px] h-14 rounded-xl bg-[#132540] border border-[#1C3050] shrink-0">
                      <span className="text-lg font-bold text-white leading-none">{format(dt, 'dd')}</span>
                      <span className="text-[10px] text-[#94A3B8] uppercase font-bold">{format(dt, 'MMM', { locale: ptBR })}</span>
                    </div>

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
                          {format(dt, "eeee, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
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

                      {/* Action buttons */}
                      {!isCancelling && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {/* Presence confirmation — only within 48h window */}
                          {canConfirmPresenca && (
                            <button
                              onClick={() => confirmPresencaMutation.mutate(appt.id)}
                              disabled={anyPending}
                              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                            >
                              {confirmPresencaMutation.isPending ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={13} />
                              )}
                              Confirmar Presença
                            </button>
                          )}
                          {/* Regular confirm — only when appointment is > 48 h away */}
                          {canConfirmStatus && (
                            <button
                              onClick={() => handleConfirm(appt)}
                              disabled={anyPending}
                              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                            >
                              {updateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                              Confirmar
                            </button>
                          )}
                          {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                            <button
                              onClick={() => { setReschedulingAppt(appt); setRescheduleDate(''); setRescheduleTime(''); }}
                              disabled={anyPending}
                              className="flex items-center gap-1.5 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold rounded-xl border border-blue-500/20 transition-all disabled:opacity-50"
                            >
                              <RefreshCw size={13} /> Reagendar
                            </button>
                          )}
                          {canCancel && (
                            <button
                              onClick={() => { setCancellingId(appt.id); setCancelReason(''); }}
                              disabled={anyPending}
                              className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl border border-red-500/20 transition-all disabled:opacity-50"
                            >
                              <X size={13} /> Cancelar
                            </button>
                          )}
                          {appt.status === 'confirmed' && (
                            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold ml-1">
                              <CheckCircle2 size={13} className="fill-emerald-400" />
                              Confirmado ✓
                            </div>
                          )}
                          {canReview && (
                            <button
                              onClick={() => setReviewingAppt(appt)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-xl border border-yellow-500/20 transition-all"
                            >
                              <Star size={13} /> Avaliar
                            </button>
                          )}
                          {appt.status === 'completed' && reviewedIds.includes(appt.id) && (
                            <div className="flex items-center gap-1.5 text-yellow-400 text-xs font-bold ml-1">
                              <Star size={13} className="fill-yellow-400" /> Avaliado
                            </div>
                          )}
                        </div>
                      )}

                      {/* Cancel reason form */}
                      {isCancelling && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            rows={2}
                            placeholder="Motivo do cancelamento (opcional)..."
                            value={cancelReason}
                            onChange={e => setCancelReason(e.target.value)}
                            maxLength={500}
                            className="w-full bg-[#0E1C32] border border-red-500/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/40 transition-colors resize-none placeholder:text-[#4A6580]"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCancelSubmit(appt)}
                              disabled={anyPending}
                              className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-400 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                            >
                              {updateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                              Confirmar Cancelamento
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
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review modal */}
      {reviewingAppt && (
        <ReviewModal
          appointmentId={reviewingAppt.id}
          professionalId={reviewingAppt.professional_id}
          clientId={user!.id}
          professionalName={reviewingAppt.professional?.profile?.full_name ?? 'Profissional'}
          onClose={() => setReviewingAppt(null)}
        />
      )}

      {/* Reschedule modal */}
      {reschedulingAppt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setReschedulingAppt(null)} />
          <div className="relative bg-[#132540] border border-[#1C3050] rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RefreshCw size={16} className="text-blue-400" /> Propor Reagendamento
              </h3>
              <button onClick={() => setReschedulingAppt(null)} className="text-[#4A6580] hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-[#94A3B8] mb-4">
              O profissional receberá uma notificação e deverá aceitar ou recusar a nova data.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#94A3B8] font-bold uppercase tracking-widest mb-1 block">Nova Data</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                  className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-[#94A3B8] font-bold uppercase tracking-widest mb-1 block">Novo Horário</label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={e => setRescheduleTime(e.target.value)}
                  className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleRescheduleSubmit}
                disabled={rescheduleMutation.isPending || !rescheduleDate || !rescheduleTime}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {rescheduleMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Enviar Proposta
              </button>
              <button
                onClick={() => setReschedulingAppt(null)}
                className="px-4 py-3 text-[#94A3B8] hover:text-white text-xs font-bold rounded-xl border border-[#1C3050] hover:border-white/20 transition-all"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
