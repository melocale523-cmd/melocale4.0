import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, MapPin, User, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { appointmentService, DbAppointment, AppointmentStatus } from '../../services/dbServices';

function statusLabel(s: AppointmentStatus) {
  if (s === 'scheduled') return 'Aguardando confirmação';
  if (s === 'confirmed') return 'Confirmado';
  if (s === 'completed') return 'Concluído';
  if (s === 'cancelled') return 'Cancelado';
  return 'Faltou';
}

function statusBadge(s: AppointmentStatus) {
  if (s === 'scheduled') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  if (s === 'confirmed') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (s === 'completed') return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  return 'bg-red-500/10 text-red-400 border-red-500/20';
}

interface CancelModal {
  appointmentId: string;
  profUserId: string | undefined;
}

export default function ClientAgenda() {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const [cancelModal, setCancelModal] = useState<CancelModal | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['client_appointments', user?.id],
    queryFn: () => appointmentService.getClientAppointments(user!.id),
    enabled: !!user?.id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, notifyId, reason }: { id: string; status: 'confirmed' | 'cancelled'; notifyId?: string; reason?: string }) =>
      appointmentService.updateAppointmentStatus(id, status, notifyId, reason),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['client_appointments'] });
      if (vars.status === 'confirmed') toast.success('Agendamento confirmado!');
      else { toast.info('Agendamento recusado'); setCancelModal(null); setCancelReason(''); }
    },
    onError: () => toast.error('Erro ao atualizar agendamento'),
  });

  const pending = appointments.filter(a => a.status === 'scheduled');
  const confirmed = appointments.filter(a => a.status === 'confirmed');
  const past = appointments.filter(a => a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show');

  const renderCard = (appt: DbAppointment) => {
    const profName = appt.professional?.profile?.full_name || 'Profissional';
    const profCategory = appt.professional?.category || '';
    const profUserId = appt.professional?.user_id;
    const date = new Date(appt.scheduled_at);

    return (
      <div key={appt.id} className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-5 space-y-4 hover:border-[#243F6A] transition-all">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-[#243F6A] text-[#4A6580]">
              <User size={20} />
            </div>
            <div>
              <p className="text-white font-bold text-sm">{profName}</p>
              {profCategory && <p className="text-xs text-[#94A3B8]">{profCategory}</p>}
            </div>
          </div>
          <span className={cn('px-2.5 py-1 text-[10px] font-bold rounded-full border uppercase tracking-wide', statusBadge(appt.status))}>
            {statusLabel(appt.status)}
          </span>
        </div>

        <div className="bg-[#0E1C32] rounded-xl p-3 space-y-1">
          <p className="text-white font-bold text-sm">{appt.title}</p>
          {appt.description && <p className="text-xs text-[#4A6580]">{appt.description}</p>}
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-[#94A3B8]">
          <span className="flex items-center gap-1.5">
            <Calendar size={12} className="text-emerald-500" />
            {format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={12} className="text-emerald-500" />
            {format(date, 'HH:mm')}
          </span>
          {appt.location && (
            <span className="flex items-center gap-1.5">
              <MapPin size={12} className="text-emerald-500" />
              {appt.location}
            </span>
          )}
        </div>

        {appt.status === 'scheduled' && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => updateMutation.mutate({ id: appt.id, status: 'confirmed', notifyId: profUserId })}
              disabled={updateMutation.isPending}
              className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 size={16} /> Confirmar
            </button>
            <button
              onClick={() => { setCancelModal({ appointmentId: appt.id, profUserId }); setCancelReason(''); }}
              className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-xl text-sm border border-red-500/20 transition-all flex items-center justify-center gap-2"
            >
              <XCircle size={16} /> Recusar
            </button>
          </div>
        )}

        {appt.status === 'cancelled' && appt.cancelled_reason && (
          <p className="text-xs text-[#4A6580] italic border-l-2 border-red-500/30 pl-2">
            Motivo: {appt.cancelled_reason}
          </p>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-500" size={36} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Minha Agenda</h1>
        <p className="text-[#94A3B8] text-sm">Gerencie seus agendamentos com profissionais</p>
      </div>

      {appointments.length === 0 ? (
        <div className="bg-[#1C3454] border border-[#1C3050] rounded-3xl p-16 text-center flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-[#0E1C32] rounded-full flex items-center justify-center mb-6 border border-[#1C3050]">
            <Calendar className="text-slate-600" size={36} />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">Sem agendamentos</h3>
          <p className="text-[#4A6580] text-sm max-w-xs">Quando um profissional agendar uma visita, ela aparecerá aqui para você confirmar.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <h2 className="text-sm font-bold text-yellow-400 uppercase tracking-widest">Aguardando sua confirmação ({pending.length})</h2>
              </div>
              <div className="space-y-4">{pending.map(renderCard)}</div>
            </section>
          )}

          {confirmed.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Confirmados ({confirmed.length})</h2>
              </div>
              <div className="space-y-4">{confirmed.map(renderCard)}</div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-slate-500" />
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Histórico ({past.length})</h2>
              </div>
              <div className="space-y-4">{past.map(renderCard)}</div>
            </section>
          )}
        </>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setCancelModal(null)} />
          <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-xl font-bold text-white mb-2">Recusar agendamento</h2>
            <p className="text-[#94A3B8] text-sm mb-6">O profissional será notificado. Deseja informar um motivo?</p>
            <textarea
              placeholder="Motivo (opcional)..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={3}
              className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500/50 transition-colors resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setCancelModal(null)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-sm border border-[#243F6A] transition-all">
                Voltar
              </button>
              <button
                onClick={() => updateMutation.mutate({ id: cancelModal.appointmentId, status: 'cancelled', notifyId: cancelModal.profUserId, reason: cancelReason || undefined })}
                disabled={updateMutation.isPending}
                className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                Confirmar Recusa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
