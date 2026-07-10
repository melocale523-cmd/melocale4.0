import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Calendar as CalendarIcon, Clock, MapPin, CheckCircle2, X, Loader2,
  RefreshCw, Star, Search,
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

const BAR_COLOR: Record<AppStatus, string> = {
  confirmed: '#10b981',
  scheduled: '#f59e0b',
  rescheduled: '#3b82f6',
  cancelled: '#ef4444',
  completed: '#8b5cf6',
};

const AVATAR_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];

export default function ClientAgenda() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [reviewingAppt, setReviewingAppt] = useState<Appointment | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['client_appointments', user?.id] });

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ['client_appointments', user?.id],
    queryFn: () => appointmentService.getClientAppointments(user!.id),
    enabled: !!user?.id,
  });

  // Deep link vindo de notificação push (?appointmentId=) — rola até o
  // compromisso e destaca ele temporariamente.
  useEffect(() => {
    const appointmentId = searchParams.get('appointmentId');
    if (!appointmentId || !appointments.some(a => a.id === appointmentId)) return;
    const el = document.getElementById(`appt-${appointmentId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedId(appointmentId);
    const timeout = setTimeout(() => setHighlightedId(null), 4000);
    return () => clearTimeout(timeout);
  }, [appointments, searchParams]);

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

  const upcoming = useMemo(
    () => sorted.filter(a => ['scheduled', 'confirmed', 'rescheduled'].includes(a.status)),
    [sorted],
  );
  const pastHistory = useMemo(
    () => sorted.filter(a => ['completed', 'cancelled'].includes(a.status)).slice(0, 10),
    [sorted],
  );

  const renderCard = (appt: Appointment, isHistory = false) => {
    const dt = new Date(appt.scheduled_at);
    const hoursUntil = (dt.getTime() - Date.now()) / 3_600_000;
    const profName = appt.professional?.profile?.full_name || 'Profissional';
    const profCategory = appt.professional?.category;
    const isCancelling = cancellingId === appt.id;
    const canReview = appt.status === 'completed' && !reviewedIds.includes(appt.id);
    const profProposedReschedule = appt.status === 'rescheduled' && appt.proposed_by === 'professional';
    const clientProposedReschedule = appt.status === 'rescheduled' && appt.proposed_by === 'client';
    const canConfirmPresenca =
      (appt.status === 'scheduled' || appt.status === 'rescheduled') &&
      hoursUntil > 0 && hoursUntil <= 48 && !appt.confirmed_at;
    const canConfirmStatus = appt.status === 'scheduled' && hoursUntil > 48;
    const canCancel = appt.status !== 'completed' && appt.status !== 'cancelled';

    const barColor = BAR_COLOR[appt.status];
    const profInitials = profName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
    const avatarBg = AVATAR_COLORS[profName.charCodeAt(0) % AVATAR_COLORS.length];

    const btnBase: React.CSSProperties = {
      borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 700,
      cursor: anyPending ? 'not-allowed' : 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      opacity: anyPending ? 0.5 : 1, transition: 'all 0.15s',
    };
    const btnPrimary: React.CSSProperties = { ...btnBase, background: '#10b981', color: 'white', border: 'none' };
    const btnYellow: React.CSSProperties = { ...btnBase, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' };
    const btnRed: React.CSSProperties = { ...btnBase, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' };
    const btnStar: React.CSSProperties = { ...btnBase, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', opacity: 1, cursor: 'pointer' };
    const btnRedFill: React.CSSProperties = { ...btnBase, background: '#ef4444', border: 'none', color: 'white' };
    const btnOutline: React.CSSProperties = { ...btnBase, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#7a9ebf', opacity: 1, cursor: 'pointer' };

    return (
      <div
        key={appt.id}
        id={`appt-${appt.id}`}
        className={cn(
          'bg-[#132236] rounded-xl border mb-3 overflow-hidden transition-shadow',
          highlightedId === appt.id ? 'border-emerald-500 ring-2 ring-emerald-500/50' : 'border-white/5',
        )}
        style={{ opacity: appt.status === 'cancelled' ? 0.65 : 1 }}
      >
        {/* Top section */}
        <div className="p-4 flex gap-3">
          <div style={{ width: '3px', background: barColor, borderRadius: '3px', flexShrink: 0, alignSelf: 'stretch' }} />
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
            style={{ background: avatarBg + '33', border: `1.5px solid ${avatarBg}55`, color: avatarBg }}
          >
            {profInitials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-white font-bold text-base truncate">{appt.title}</p>
              <span className={cn('text-xs font-bold px-2 py-1 rounded border whitespace-nowrap shrink-0', STATUS_BADGE[appt.status])}>
                {STATUS_LABEL[appt.status]}
              </span>
            </div>
            <p className="text-sm text-[#7a9ebf] mt-1">{profName}{profCategory ? ` · ${profCategory}` : ''}</p>
            <div className="flex flex-wrap gap-x-3 mt-1">
              <span className="flex items-center gap-1 text-xs text-[#4a6580]">
                <Clock size={12} /> {format(dt, "dd/MM/yy HH:mm")}
              </span>
              {appt.location && (
                <span className="flex items-center gap-1 text-xs text-[#4a6580]">
                  <MapPin size={12} /> {appt.location}
                </span>
              )}
            </div>
            {appt.cancelled_reason && (
              <p className="text-[10px] text-red-400/70 mt-0.5">Motivo: {appt.cancelled_reason}</p>
            )}
          </div>
        </div>

        {/* Actions bar — upcoming */}
        {!isHistory && !isCancelling && (
          <div className="px-3 py-3 flex flex-wrap gap-2 items-center" style={{ background: 'rgba(0,0,0,0.15)' }}>
            {canConfirmPresenca && (
              <button disabled={anyPending} onClick={() => confirmPresencaMutation.mutate(appt.id)} style={btnPrimary}>
                {confirmPresencaMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                Confirmar Presença
              </button>
            )}
            {canConfirmStatus && (
              <button disabled={anyPending} onClick={() => handleConfirm(appt)} style={btnPrimary}>
                {updateMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                Confirmar
              </button>
            )}
            {profProposedReschedule && (
              <>
                <button disabled={anyPending} onClick={() => acceptMutation.mutate(appt)} style={btnPrimary}>
                  {acceptMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                  Aceitar
                </button>
                <button disabled={anyPending} onClick={() => declineMutation.mutate(appt)} style={btnRed}>
                  <X size={10} /> Recusar
                </button>
              </>
            )}
            {clientProposedReschedule && (
              <span style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 600 }}>⏳ Aguardando resposta...</span>
            )}
            {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
              <button
                disabled={anyPending}
                onClick={() => { setReschedulingAppt(appt); setRescheduleDate(''); setRescheduleTime(''); }}
                style={btnYellow}
              >
                <RefreshCw size={10} /> Reagendar
              </button>
            )}
            {canCancel && !profProposedReschedule && !clientProposedReschedule && (
              <button
                disabled={anyPending}
                onClick={() => { setCancellingId(appt.id); setCancelReason(''); }}
                style={btnRed}
              >
                <X size={10} /> Cancelar
              </button>
            )}
            {appt.status === 'confirmed' && (
              <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={10} /> Confirmado ✓
              </span>
            )}
            {canReview && (
              <button onClick={() => setReviewingAppt(appt)} style={btnStar}>
                <Star size={10} /> Avaliar
              </button>
            )}
            {appt.status === 'completed' && reviewedIds.includes(appt.id) && (
              <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Star size={10} className="fill-yellow-400" /> Avaliado ✓
              </span>
            )}
          </div>
        )}

        {/* Actions bar — history */}
        {isHistory && appt.status === 'completed' && (
          <div className="px-3 py-1.5 flex gap-1.5 items-center" style={{ background: 'rgba(0,0,0,0.15)' }}>
            {canReview ? (
              <button onClick={() => setReviewingAppt(appt)} style={btnStar}>
                <Star size={10} /> Avaliar
              </button>
            ) : reviewedIds.includes(appt.id) ? (
              <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Star size={10} className="fill-yellow-400" /> Avaliado ✓
              </span>
            ) : null}
          </div>
        )}

        {/* Cancel reason form */}
        {isCancelling && (
          <div className="px-3 py-2 flex flex-col gap-2" style={{ background: 'rgba(0,0,0,0.15)' }}>
            <textarea
              rows={2}
              placeholder="Motivo do cancelamento (opcional)..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              maxLength={500}
              className="w-full bg-[#0E1C32] border border-red-500/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/40 transition-colors resize-none placeholder:text-[#4A6580]"
            />
            <div className="flex gap-2">
              <button disabled={anyPending} onClick={() => handleCancelSubmit(appt)} style={btnRedFill}>
                {updateMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                Confirmar Cancelamento
              </button>
              <button onClick={() => { setCancellingId(null); setCancelReason(''); }} style={btnOutline}>
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500" style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Minha Agenda</h1>
        <p className="text-[#94A3B8] text-sm mt-1">Acompanhe seus agendamentos com profissionais</p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
        <div style={{ background:'#132540', border:'1px solid rgba(255,255,255,.06)', borderRadius:10, padding:'0.75rem', textAlign:'center' }}>
          <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#4a6580', margin:'0 0 4px' }}>Total</p>
          <p style={{ fontSize:24, fontWeight:700, color:'white', margin:0, lineHeight:1 }}>{isLoading ? '—' : stats.total}</p>
        </div>
        <div style={{ background:'#132540', border:'1px solid rgba(16,185,129,.2)', borderRadius:10, padding:'0.75rem', textAlign:'center' }}>
          <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#10b981', margin:'0 0 4px' }}>Confirm.</p>
          <p style={{ fontSize:24, fontWeight:700, color: stats.confirmed > 0 ? '#34d399' : 'white', margin:0, lineHeight:1 }}>{isLoading ? '—' : stats.confirmed}</p>
        </div>
        <div style={{ background:'#132540', border:'1px solid rgba(245,158,11,.2)', borderRadius:10, padding:'0.75rem', textAlign:'center' }}>
          <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'#f59e0b', margin:'0 0 4px' }}>Pendentes</p>
          <p style={{ fontSize:24, fontWeight:700, color: stats.pending > 0 ? '#fbbf24' : 'white', margin:0, lineHeight:1 }}>{isLoading ? '—' : stats.pending}</p>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 gap-2">
          <Loader2 size={20} className="animate-spin text-emerald-500" />
          <span className="text-[#94A3B8] text-sm">Carregando...</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sorted.length === 0 && (
        <div className="flex flex-col items-center text-center py-16 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#132236] border border-white/5 flex items-center justify-center">
            <CalendarIcon size={24} className="text-[#4a6580]" />
          </div>
          <div>
            <p className="text-white font-bold text-base">Nenhum agendamento ainda</p>
            <p className="text-[#94A3B8] text-sm mt-1 max-w-xs mx-auto">
              Encontre profissionais e solicite orçamentos para agendar serviços.
            </p>
          </div>
          <Link
            to="/cliente/busca"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all"
          >
            <Search size={14} /> Buscar profissionais
          </Link>
        </div>
      )}

      {/* 2-column layout */}
      {!isLoading && sorted.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Left column — upcoming */}
          <div>
            <p className="text-[11px] font-black text-[#7a9ebf] uppercase tracking-widest mb-3">
              Próximos agendamentos
            </p>
            {upcoming.length > 0 ? (
              upcoming.map(appt => renderCard(appt, false))
            ) : (
              <div className="bg-[#132236] rounded-xl border border-emerald-500/15 p-4 text-center">
                <CalendarIcon size={20} className="text-[#4a6580] mx-auto mb-2" />
                <p className="text-white font-bold text-sm mb-1">Sem agendamentos ativos</p>
                <p className="text-[#4a6580] text-xs mb-3">Solicite orçamentos para agendar serviços.</p>
                <Link
                  to="/cliente/busca"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all"
                >
                  <Search size={12} /> Buscar profissionais →
                </Link>
              </div>
            )}
          </div>

          {/* Right column — history */}
          <div>
            <p className="text-[11px] font-black text-[#7a9ebf] uppercase tracking-widest mb-3">
              Histórico recente
            </p>
            {pastHistory.length > 0 ? (
              pastHistory.map(appt => renderCard(appt, true))
            ) : (
              <div className="bg-[#132236] rounded-xl border border-white/5 p-4 text-center">
                <p className="text-[#4a6580] text-xs">Nenhum histórico ainda.</p>
              </div>
            )}
          </div>
        </div>
      )}

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
          <div className="relative bg-[#132540] border border-[#1C3050] rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
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
                <label className="text-xs text-[#94A3B8] font-bold uppercase tracking-widest mb-1.5 block">Nova Data</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                  className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-[#94A3B8] font-bold uppercase tracking-widest mb-1.5 block">Novo Horário</label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={e => setRescheduleTime(e.target.value)}
                  className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleRescheduleSubmit}
                disabled={rescheduleMutation.isPending || !rescheduleDate || !rescheduleTime}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {rescheduleMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Enviar Proposta
              </button>
              <button
                onClick={() => setReschedulingAppt(null)}
                className="px-3 py-2 text-[#94A3B8] hover:text-white text-xs font-bold rounded-xl border border-[#1C3050] hover:border-white/20 transition-all"
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
