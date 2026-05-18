import { useState, useMemo } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  isSameMonth,
  isSameDay,
  addDays,
  subDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar as CalendarIcon, List, Plus, ChevronLeft, ChevronRight,
  X, Clock, User, MapPin, CheckCircle2, Loader2, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { appointmentService, type Appointment } from '../../services/dbServices';

type AppStatus = Appointment['status'];

const STATUS_LABEL: Record<AppStatus, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
  rescheduled: 'Reagendando',
};

const STATUS_BADGE: Record<AppStatus, string> = {
  scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  confirmed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  completed: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  rescheduled: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

const DOT_COLOR: Record<AppStatus, string> = {
  scheduled: 'bg-blue-500',
  confirmed: 'bg-emerald-500',
  completed: 'bg-slate-400',
  cancelled: 'bg-red-500',
  rescheduled: 'bg-orange-400',
};

function getDayDotColor(appts: Appointment[]): string | null {
  if (!appts.length) return null;
  for (const s of ['rescheduled', 'confirmed', 'scheduled', 'completed', 'cancelled'] as AppStatus[]) {
    if (appts.some(a => a.status === s)) return DOT_COLOR[s];
  }
  return null;
}

interface AvailableClient {
  conversationId: string;
  clientId: string;
  clientName: string;
  clientCity: string;
}

export default function ProfessionalAgenda() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);
  const [proposeModalAppt, setProposeModalAppt] = useState<Appointment | null>(null);
  const [proposeDate, setProposeDate] = useState('');
  const [proposeTime, setProposeTime] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    clientId: '',
    conversationId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    location: '',
    description: '',
  });

  // === Queries ===
  const { data: professional } = useQuery({
    queryKey: ['my_professional_id', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('professionals')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['professional_appointments', professional?.id],
    queryFn: () => appointmentService.getProfessionalAppointments(professional!.id),
    enabled: !!professional?.id,
  });

  const { data: availableClients = [] } = useQuery<AvailableClient[]>({
    queryKey: ['schedule_clients', professional?.id],
    queryFn: async () => {
      const { data: purchases } = await supabase
        .from('lead_purchases')
        .select('client_id')
        .eq('professional_id', professional!.id);
      if (!purchases?.length) return [];

      const seen = new Set<string>();
      const uniqueClientIds = purchases
        .map(p => p.client_id)
        .filter(id => { if (seen.has(id)) return false; seen.add(id); return true; });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id,full_name,city')
        .in('id', uniqueClientIds);
      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

      return uniqueClientIds.map(clientId => ({
        conversationId: '',
        clientId,
        clientName: profileMap[clientId]?.full_name || 'Cliente',
        clientCity: profileMap[clientId]?.city || '',
      }));
    },
    enabled: !!professional?.id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['professional_appointments', professional?.id] });

  // === Mutations ===
  const createMutation = useMutation({
    mutationFn: appointmentService.createAppointment,
    onSuccess: () => {
      invalidate();
      setIsModalOpen(false);
      setFormData({ title: '', clientId: '', conversationId: '', date: format(new Date(), 'yyyy-MM-dd'), time: '09:00', location: '', description: '' });
      toast.success('Agendamento criado com sucesso!');
    },
    onError: () => toast.error('Erro ao criar agendamento'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, notifyUserId }: { id: string; status: 'confirmed' | 'cancelled' | 'completed'; notifyUserId?: string }) =>
      appointmentService.updateAppointmentStatus(id, status, { notifyUserId }),
    onSuccess: (_, { status }) => {
      invalidate();
      if (status === 'completed') toast.success('Compromisso concluído!');
      else if (status === 'cancelled') toast.info('Compromisso cancelado');
      setDetailsModalOpen(false);
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const proposeMutation = useMutation({
    mutationFn: ({ appt, proposedAt }: { appt: Appointment; proposedAt: string }) =>
      appointmentService.proposeReschedule(appt.id, proposedAt, 'professional', appt.client_id),
    onSuccess: () => {
      invalidate();
      toast.success('Proposta de reagendamento enviada!');
      setProposeModalAppt(null);
      setProposeDate('');
      setProposeTime('');
      setDetailsModalOpen(false);
    },
    onError: () => toast.error('Erro ao propor reagendamento'),
  });

  const acceptMutation = useMutation({
    mutationFn: (appt: Appointment) =>
      appointmentService.acceptReschedule(appt.id, appt.client_id),
    onSuccess: () => { invalidate(); toast.success('Reagendamento aceito!'); },
    onError: () => toast.error('Erro ao aceitar reagendamento'),
  });

  const declineMutation = useMutation({
    mutationFn: (appt: Appointment) =>
      appointmentService.declineReschedule(appt.id, appt.client_id),
    onSuccess: () => { invalidate(); toast.info('Reagendamento recusado.'); },
    onError: () => toast.error('Erro ao recusar reagendamento'),
  });

  const anyPending = updateMutation.isPending || proposeMutation.isPending || acceptMutation.isPending || declineMutation.isPending;

  // === Derived ===
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });

  const selectedDayAppointments = useMemo(() =>
    appointments.filter(app => isSameDay(new Date(app.scheduled_at), selectedDate)),
  [appointments, selectedDate]);

  const stats = useMemo(() => ({
    total: appointments.length,
    pending: appointments.filter(a => a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'rescheduled').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    today: appointments.filter(a => isToday(new Date(a.scheduled_at))).length,
  }), [appointments]);

  // === Handlers ===
  const handlePrev = () => {
    if (viewMode === 'calendar') setCurrentMonth(subMonths(currentMonth, 1));
    else setSelectedDate(subDays(selectedDate, 1));
  };
  const handleNext = () => {
    if (viewMode === 'calendar') setCurrentMonth(addMonths(currentMonth, 1));
    else setSelectedDate(addDays(selectedDate, 1));
  };
  const handleToday = () => { const t = new Date(); setSelectedDate(t); setCurrentMonth(t); };
  const handleSelectDay = (day: Date) => { if (isSameMonth(day, monthStart)) setSelectedDate(day); };

  const handleUpdateStatus = (id: string, status: 'confirmed' | 'cancelled' | 'completed', notifyUserId?: string) => {
    updateMutation.mutate({ id, status, notifyUserId });
  };

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.clientId) {
      toast.error('Preencha título e cliente');
      return;
    }
    if (!professional?.id) {
      toast.error('Perfil profissional não encontrado');
      return;
    }
    const scheduled_at = new Date(`${formData.date}T${formData.time}:00`).toISOString();
    createMutation.mutate({
      professional_id: professional.id,
      client_id: formData.clientId,
      conversation_id: formData.conversationId || undefined,
      scheduled_at,
      title: formData.title,
      location: formData.location || undefined,
      description: formData.description || undefined,
    });
  };

  const handleProposeSubmit = () => {
    if (!proposeModalAppt || !proposeDate || !proposeTime) {
      toast.error('Preencha data e horário.');
      return;
    }
    const proposedAt = new Date(`${proposeDate}T${proposeTime}`).toISOString();
    proposeMutation.mutate({ appt: proposeModalAppt, proposedAt });
  };

  const openDetails = (app: Appointment) => { setViewingAppointment(app); setDetailsModalOpen(true); };
  const openModalForDate = (date: Date) => {
    setFormData(f => ({ ...f, date: format(date, 'yyyy-MM-dd') }));
    setIsModalOpen(true);
  };
  const isActive = (s: AppStatus) => s === 'scheduled' || s === 'confirmed';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Calendário de Agendamentos</h1>
          <p className="text-[#94A3B8] text-sm">Gerencie seus compromissos e horários</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-[#1C3454] border border-[#1C3050] rounded-xl p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={cn('px-4 py-2 text-sm font-medium rounded-lg transition-all', viewMode === 'calendar' ? 'bg-emerald-500 text-black' : 'text-[#94A3B8] hover:text-white')}
            >Calendário</button>
            <button
              onClick={() => setViewMode('list')}
              className={cn('px-4 py-2 text-sm font-medium rounded-lg transition-all', viewMode === 'list' ? 'bg-emerald-500 text-black' : 'text-[#94A3B8] hover:text-white')}
            >Lista</button>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-sm font-bold bg-white/5 border border-[#243F6A] hover:bg-emerald-500 hover:text-black text-white rounded-xl transition-all flex items-center gap-2 group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform" /> Novo Agendamento
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1C3454] border border-[#1C3050] rounded-2xl p-4">
          <h4 className="text-[#4A6580] text-xs font-bold uppercase tracking-widest mb-1">Total</h4>
          <p className="text-2xl font-bold text-white">{isLoading ? '—' : stats.total}</p>
        </div>
        <div className="bg-[#1C3454] border border-blue-500/20 rounded-2xl p-4">
          <h4 className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">Agendados</h4>
          <p className="text-2xl font-bold text-blue-400">{isLoading ? '—' : stats.pending}</p>
        </div>
        <div className="bg-[#1C3454] border border-emerald-500/20 rounded-2xl p-4">
          <h4 className="text-emerald-500 text-xs font-bold uppercase tracking-widest mb-1">Concluídos</h4>
          <p className="text-2xl font-bold text-emerald-500">{isLoading ? '—' : stats.completed}</p>
        </div>
        <div className="bg-[#1C3454] border border-yellow-500/20 rounded-2xl p-4">
          <h4 className="text-yellow-500 text-xs font-bold uppercase tracking-widest mb-1">Hoje</h4>
          <p className="text-2xl font-bold text-yellow-500">{isLoading ? '—' : stats.today}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main View */}
        <div className="lg:col-span-2 bg-[#1C3454] border border-[#1C3050] rounded-2xl p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin text-emerald-500" size={32} />
            </div>
          ) : viewMode === 'calendar' ? (
            <>
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-white font-bold text-xl first-letter:uppercase">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrev} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0E1C32] border border-[#1C3050] text-[#94A3B8] hover:text-white hover:border-white/20 transition-all shadow-sm">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={handleToday} className="px-4 py-2 text-sm font-bold rounded-xl bg-white/5 border border-[#243F6A] text-white hover:bg-white/10 transition-all shadow-sm">
                    Hoje
                  </button>
                  <button onClick={handleNext} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0E1C32] border border-[#1C3050] text-[#94A3B8] hover:text-white hover:border-white/20 transition-all shadow-sm">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-4 text-center text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, idx) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isTodayDay = isToday(day);
                  const dayAppts = appointments.filter(app => isSameDay(new Date(app.scheduled_at), day));
                  const dotColor = getDayDotColor(dayAppts);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectDay(day)}
                      className={cn(
                        'aspect-square rounded-2xl border flex flex-col p-2 text-sm font-medium transition-all relative group',
                        !isCurrentMonth ? 'opacity-[0.05] pointer-events-none' : 'hover:border-emerald-500/50',
                        isSelected
                          ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]'
                          : 'bg-[#0E1C32] border-[#1C3050] text-[#94A3B8]'
                      )}
                    >
                      <span className="relative z-10">{format(day, 'd')}</span>
                      {isTodayDay && !isSelected && (
                        <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      )}
                      {dotColor && !isSelected && (
                        <div className="mt-auto flex justify-center">
                          <div className={cn('w-1 h-1 rounded-full', dotColor)} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-6 mt-10 p-4 bg-[#0E1C32] rounded-2xl border border-[#1C3050]">
                {(['scheduled', 'confirmed', 'rescheduled', 'completed', 'cancelled'] as AppStatus[]).map(s => (
                  <div key={s} className="flex items-center gap-2 text-[10px] font-bold text-[#4A6580] uppercase tracking-widest">
                    <div className={cn('w-2.5 h-2.5 rounded-full', DOT_COLOR[s])} />
                    {STATUS_LABEL[s]}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-white font-bold text-xl uppercase tracking-tight">Todos os Compromissos</h2>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrev} className="p-2 hover:text-emerald-500 text-[#94A3B8] transition-colors"><ChevronLeft size={20} /></button>
                  <button onClick={handleToday} className="text-xs font-bold text-[#94A3B8] hover:text-white transition-colors">Ir para Hoje</button>
                  <button onClick={handleNext} className="p-2 hover:text-emerald-500 text-[#94A3B8] transition-colors"><ChevronRight size={20} /></button>
                </div>
              </div>

              {appointments.length > 0 ? (
                <div className="space-y-3">
                  {[...appointments]
                    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                    .map(app => (
                      <div key={app.id} className="bg-[#0E1C32] border border-[#1C3050] p-4 rounded-2xl flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white/5 rounded-xl flex flex-col items-center justify-center border border-[#243F6A] group-hover:border-emerald-500/20 transition-colors">
                            <span className="text-[10px] font-bold text-[#4A6580] uppercase">{format(new Date(app.scheduled_at), 'MMM', { locale: ptBR })}</span>
                            <span className="text-lg font-bold text-white leading-none">{format(new Date(app.scheduled_at), 'dd')}</span>
                          </div>
                          <div>
                            <p className="text-white font-bold">{app.title}</p>
                            <div className="flex items-center gap-2 text-xs text-[#4A6580]">
                              <User size={12} /> {app.client?.full_name || 'Cliente'}
                              <span className="w-1 h-1 rounded-full bg-slate-700" />
                              <Clock size={12} /> {format(new Date(app.scheduled_at), 'HH:mm')}
                              {app.location && <><span className="w-1 h-1 rounded-full bg-slate-700" /><MapPin size={12} /> {app.location}</>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn('px-3 py-1 text-[10px] font-bold rounded-full border uppercase', STATUS_BADGE[app.status])}>
                            {STATUS_LABEL[app.status]}
                          </span>
                          {isActive(app.status) && (
                            <button
                              onClick={() => handleUpdateStatus(app.id, 'cancelled', app.client_id)}
                              className="p-2 text-[#4A6580] hover:text-red-500 transition-colors"
                              title="Cancelar"
                            >
                              <X size={18} />
                            </button>
                          )}
                          <button onClick={() => openDetails(app)} className="p-2 text-[#4A6580] hover:text-emerald-500 transition-colors">
                            <List size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="border border-dashed border-[#243F6A] rounded-3xl p-16 text-center flex flex-col items-center justify-center bg-[#0E1C32]/50 min-h-[400px]">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 text-slate-700">
                    <List size={32} />
                  </div>
                  <h3 className="text-slate-300 font-bold mb-2">Sem agendamentos</h3>
                  <p className="text-[#4A6580] text-sm max-w-xs mx-auto">Crie um novo agendamento para começar.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Day Sidebar */}
        <div className="bg-[#1C3454] border border-[#1C3050] rounded-3xl p-8 flex flex-col relative overflow-hidden group">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-700" />

          <div className="flex items-center justify-between mb-8 relative z-10">
            <h3 className="text-white font-bold text-lg first-letter:uppercase">
              {format(selectedDate, "eeee, d 'de' MMMM", { locale: ptBR })}
            </h3>
            <div className="flex gap-1">
              <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="p-1.5 hover:bg-white/5 rounded-lg text-[#4A6580] hover:text-emerald-500 transition-all">
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-1.5 hover:bg-white/5 rounded-lg text-[#4A6580] hover:text-emerald-500 transition-all">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 relative z-10">
            {selectedDayAppointments.length > 0 ? (
              selectedDayAppointments.map(app => {
                const clientRequestedReschedule = app.status === 'rescheduled' && app.proposed_by === 'client';
                const profRequestedReschedule = app.status === 'rescheduled' && app.proposed_by === 'professional';
                return (
                  <div key={app.id} className="bg-[#0E1C32] border border-[#1C3050] p-5 rounded-2xl space-y-3 hover:border-emerald-500/30 transition-all">
                    {/* Client requested reschedule banner */}
                    {clientRequestedReschedule && app.proposed_at && (
                      <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle size={12} className="text-orange-400 shrink-0" />
                          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Cliente propôs nova data</p>
                        </div>
                        <p className="text-xs text-orange-300 mb-3">
                          {format(new Date(app.proposed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => acceptMutation.mutate(app)}
                            disabled={anyPending}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold rounded-lg transition-all disabled:opacity-50"
                          >
                            {acceptMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                            Aceitar
                          </button>
                          <button
                            onClick={() => declineMutation.mutate(app)}
                            disabled={anyPending}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold rounded-lg border border-red-500/20 transition-all disabled:opacity-50"
                          >
                            <X size={10} /> Recusar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Pro proposed reschedule — waiting */}
                    {profRequestedReschedule && app.proposed_at && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <RefreshCw size={11} className="text-blue-400" />
                          <p className="text-[10px] font-bold text-blue-400">Aguardando cliente</p>
                        </div>
                        <p className="text-xs text-blue-300 mt-1">
                          Proposta: {format(new Date(app.proposed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/10 rounded-lg text-emerald-500 text-[10px] font-bold font-mono">
                        <Clock size={12} /> {format(new Date(app.scheduled_at), 'HH:mm')}
                      </div>
                      {isActive(app.status) && (
                        <button onClick={() => handleUpdateStatus(app.id, 'cancelled', app.client_id)} className="text-slate-700 hover:text-red-500 transition-colors">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-base">{app.title}</h4>
                      <p className="text-[#4A6580] text-sm flex items-center gap-2 mt-1">
                        <User size={14} /> {app.client?.full_name || 'Cliente'}
                      </p>
                      {app.location && (
                        <p className="text-[#4A6580] text-xs flex items-center gap-1 mt-1">
                          <MapPin size={12} /> {app.location}
                        </p>
                      )}
                      {app.status === 'completed' && (
                        <p className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Concluído
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => openDetails(app)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg border border-[#243F6A] transition-all">
                        Detalhes
                      </button>
                      {isActive(app.status) && (
                        <>
                          <button
                            onClick={() => { setProposeModalAppt(app); setProposeDate(''); setProposeTime(''); }}
                            className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/20 transition-all"
                            title="Propor nova data"
                          >
                            <RefreshCw size={16} />
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(app.id, 'completed', app.client_id)}
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
                <div className="w-20 h-20 bg-[#0E1C32] rounded-full flex items-center justify-center mb-6 border border-[#1C3050] shadow-inner">
                  <CalendarIcon className="text-slate-700" size={32} />
                </div>
                <p className="text-white/90 font-bold text-lg mb-2">Nenhum agendamento</p>
                <p className="text-[#4A6580] text-sm">Este dia está livre.</p>
                <button
                  onClick={() => openModalForDate(selectedDate)}
                  className="mt-10 px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/10 active:scale-[0.98]"
                >
                  Agendar Horário
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-[#1C3050] relative z-10">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4">
              <span>Horários Populares</span>
              <span className="text-emerald-500/50">Disponível</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#0E1C32] border border-[#1C3050] p-3 rounded-xl text-center text-xs text-slate-300 font-mono italic">09:00 - 10:00</div>
              <div className="bg-[#0E1C32] border border-[#1C3050] p-3 rounded-xl text-center text-xs text-slate-300 font-mono italic">14:00 - 15:00</div>
            </div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {detailsModalOpen && viewingAppointment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDetailsModalOpen(false)} />
          <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-500 rounded-xl"><List size={24} /></div>
                Detalhes do Agendamento
              </h2>
              <button onClick={() => setDetailsModalOpen(false)} className="text-[#4A6580] hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Client proposed reschedule banner in modal */}
            {viewingAppointment.status === 'rescheduled' && viewingAppointment.proposed_by === 'client' && viewingAppointment.proposed_at && (
              <div className="mb-6 bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-orange-400" />
                  <p className="text-sm font-bold text-orange-400">Cliente solicitou reagendamento para:</p>
                </div>
                <p className="text-sm text-orange-300 mb-4">
                  {format(new Date(viewingAppointment.proposed_at), "eeee, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { acceptMutation.mutate(viewingAppointment); setDetailsModalOpen(false); }}
                    disabled={anyPending}
                    className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} /> Aceitar
                  </button>
                  <button
                    onClick={() => { declineMutation.mutate(viewingAppointment); setDetailsModalOpen(false); }}
                    disabled={anyPending}
                    className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-xl border border-red-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <X size={16} /> Recusar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-[#0E1C32] border border-[#1C3050] rounded-2xl">
                  <p className="text-[10px] font-bold text-[#4A6580] uppercase tracking-widest mb-1">Status</p>
                  <span className={cn('text-xs font-bold', STATUS_BADGE[viewingAppointment.status].split(' ')[1])}>
                    {STATUS_LABEL[viewingAppointment.status].toUpperCase()}
                  </span>
                </div>
                <div className="p-4 bg-[#0E1C32] border border-[#1C3050] rounded-2xl">
                  <p className="text-[10px] font-bold text-[#4A6580] uppercase tracking-widest mb-1">ID</p>
                  <span className="text-xs font-mono text-slate-300">#{viewingAppointment.id.slice(0, 8)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 border border-[#1C3050] rounded-2xl bg-[#0E1C32]/30">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                    <User size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-[#4A6580]">Cliente</p>
                    <p className="text-white font-bold text-lg">{viewingAppointment.client?.full_name || 'Cliente'}</p>
                    {viewingAppointment.client?.phone && (
                      <p className="text-[#4A6580] text-xs">{viewingAppointment.client.phone}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 border border-[#1C3050] rounded-2xl bg-[#0E1C32]/30">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                    <CalendarIcon size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-[#4A6580]">Serviço / Título</p>
                    <p className="text-white font-bold text-lg">{viewingAppointment.title}</p>
                    {viewingAppointment.description && (
                      <p className="text-[#4A6580] text-xs mt-1">{viewingAppointment.description}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 p-4 border border-[#1C3050] rounded-2xl bg-[#0E1C32]/30">
                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-[#94A3B8]">
                      <CalendarIcon size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#4A6580] uppercase font-bold">Data</p>
                      <p className="text-white font-bold text-sm">{format(new Date(viewingAppointment.scheduled_at), 'dd/MM/yyyy')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 border border-[#1C3050] rounded-2xl bg-[#0E1C32]/30">
                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-[#94A3B8]">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#4A6580] uppercase font-bold">Horário</p>
                      <p className="text-white font-bold text-sm">{format(new Date(viewingAppointment.scheduled_at), 'HH:mm')}</p>
                    </div>
                  </div>
                </div>

                {viewingAppointment.location && (
                  <div className="flex items-center gap-3 p-4 border border-[#1C3050] rounded-2xl bg-[#0E1C32]/30">
                    <MapPin size={16} className="text-[#94A3B8] shrink-0" />
                    <p className="text-slate-300 text-sm">{viewingAppointment.location}</p>
                  </div>
                )}

                {viewingAppointment.cancelled_reason && (
                  <div className="p-4 border border-red-500/20 rounded-2xl bg-red-500/5">
                    <p className="text-[10px] text-red-400 uppercase font-bold mb-1">Motivo do cancelamento</p>
                    <p className="text-slate-300 text-sm">{viewingAppointment.cancelled_reason}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                {isActive(viewingAppointment.status) && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(viewingAppointment.id, 'completed', viewingAppointment.client_id)}
                      disabled={anyPending}
                      className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                      Concluir Atendimento
                    </button>
                    <button
                      onClick={() => { setProposeModalAppt(viewingAppointment); setProposeDate(''); setProposeTime(''); setDetailsModalOpen(false); }}
                      disabled={anyPending}
                      className="flex-1 py-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold rounded-2xl border border-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={16} /> Propor Nova Data
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(viewingAppointment.id, 'cancelled', viewingAppointment.client_id)}
                      disabled={anyPending}
                      className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-2xl border border-red-500/20 transition-all disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </>
                )}
                {viewingAppointment.status === 'completed' && (
                  <div className="w-full py-4 bg-emerald-500/10 text-emerald-500 font-bold rounded-2xl border border-emerald-500/20 flex items-center justify-center gap-2">
                    <CheckCircle2 size={20} /> Atendimento Concluído
                  </div>
                )}
                {viewingAppointment.status === 'cancelled' && (
                  <div className="w-full py-4 bg-red-500/10 text-red-400 font-bold rounded-2xl border border-red-500/20 flex items-center justify-center gap-2">
                    <X size={20} /> Agendamento Cancelado
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Propose reschedule modal */}
      {proposeModalAppt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setProposeModalAppt(null)} />
          <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RefreshCw size={16} className="text-blue-400" /> Propor Nova Data
              </h3>
              <button onClick={() => setProposeModalAppt(null)} className="text-[#4A6580] hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-[#94A3B8] mb-4">
              O cliente receberá uma notificação e deverá aceitar ou recusar a nova data.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#94A3B8] font-bold uppercase tracking-widest mb-1 block">Nova Data</label>
                <input
                  type="date"
                  value={proposeDate}
                  onChange={e => setProposeDate(e.target.value)}
                  className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-[#94A3B8] font-bold uppercase tracking-widest mb-1 block">Novo Horário</label>
                <input
                  type="time"
                  value={proposeTime}
                  onChange={e => setProposeTime(e.target.value)}
                  className="w-full bg-[#0E1C32] border border-[#1C3050] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleProposeSubmit}
                disabled={proposeMutation.isPending || !proposeDate || !proposeTime}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {proposeMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Enviar Proposta
              </button>
              <button
                onClick={() => setProposeModalAppt(null)}
                className="px-4 py-3 text-[#94A3B8] hover:text-white text-xs font-bold rounded-xl border border-[#1C3050] hover:border-white/20 transition-all"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-500 rounded-lg"><Plus size={24} /></div>
                Novo Agendamento
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[#4A6580] hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest">Título / Serviço *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Instalação elétrica"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  maxLength={255}
                  className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                  <User size={14} /> Cliente *
                </label>
                {availableClients.length === 0 ? (
                  <p className="text-xs text-[#4A6580] py-3 px-4 bg-[#0E1C32] rounded-xl border border-[#243F6A]">
                    Sem clientes disponíveis. Adquira leads primeiro.
                  </p>
                ) : (
                  <select
                    required
                    value={formData.clientId}
                    onChange={e => {
                      const c = availableClients.find(cl => cl.clientId === e.target.value);
                      setFormData({
                        ...formData,
                        clientId: e.target.value,
                        conversationId: c?.conversationId || '',
                        location: c?.clientCity || formData.location,
                      });
                    }}
                    className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="">Selecione um cliente...</option>
                    {availableClients.map(c => (
                      <option key={c.clientId} value={c.clientId}>{c.clientName}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                    <CalendarIcon size={14} /> Data *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                    <Clock size={14} /> Horário *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                    className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                  <MapPin size={14} /> Endereço
                </label>
                <input
                  type="text"
                  placeholder="Rua, número, bairro..."
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  maxLength={255}
                  className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest">Observações</label>
                <textarea
                  rows={3}
                  placeholder="Detalhes do serviço..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  maxLength={500}
                  className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={createMutation.isPending || availableClients.length === 0}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-[#0E1C32] font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {createMutation.isPending && <Loader2 size={18} className="animate-spin" />}
                {createMutation.isPending ? 'Salvando...' : 'Finalizar Agendamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
