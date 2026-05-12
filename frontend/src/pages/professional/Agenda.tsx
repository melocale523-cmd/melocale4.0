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
import { Calendar as CalendarIcon, List, Plus, ChevronLeft, ChevronRight, X, Clock, User, Briefcase, CheckCircle2, Loader2, MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { appointmentService, DbAppointment, AppointmentStatus } from '../../services/dbServices';

interface ConvClient {
  convId: string;
  client_id: string;
  client_name: string;
}

function statusLabel(status: AppointmentStatus) {
  if (status === 'scheduled') return 'Agendado';
  if (status === 'confirmed') return 'Confirmado';
  if (status === 'completed') return 'Concluído';
  if (status === 'cancelled') return 'Cancelado';
  return 'Faltou';
}

function statusColor(status: AppointmentStatus) {
  if (status === 'scheduled') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  if (status === 'confirmed') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (status === 'completed') return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  return 'bg-red-500/10 text-red-400 border-red-500/20';
}

function dotColor(status: AppointmentStatus) {
  if (status === 'scheduled') return 'bg-yellow-500';
  if (status === 'confirmed') return 'bg-emerald-500';
  if (status === 'completed') return 'bg-slate-500';
  return 'bg-red-500';
}

export default function ProfessionalAgenda() {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [viewingAppointment, setViewingAppointment] = useState<DbAppointment | null>(null);

  const [formData, setFormData] = useState({
    clientId: '',
    convId: '',
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    location: '',
    description: '',
  });

  // Get professional row
  const { data: professional } = useQuery({
    queryKey: ['my_professional', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('professionals')
        .select('id')
        .eq('user_id', user!.id)
        .single();
      return data as { id: string } | null;
    },
    enabled: !!user?.id,
  });

  // Get appointments
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['professional_appointments', professional?.id],
    queryFn: () => appointmentService.getProfessionalAppointments(professional!.id),
    enabled: !!professional?.id,
  });

  // Get conversations for client dropdown
  const { data: convClients = [] } = useQuery({
    queryKey: ['prof_conv_clients', user?.id],
    queryFn: async (): Promise<ConvClient[]> => {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, client_id')
        .eq('professional_user_id', user!.id);
      if (!convs?.length) return [];
      const clientIds = [...new Set(convs.map(c => c.client_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', clientIds);
      const pMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name]));
      // deduplicate by client_id, prefer most recent conv
      const seen = new Set<string>();
      return convs.reduce<ConvClient[]>((acc, c) => {
        if (!seen.has(c.client_id)) {
          seen.add(c.client_id);
          acc.push({ convId: c.id, client_id: c.client_id, client_name: pMap[c.client_id] || 'Cliente' });
        }
        return acc;
      }, []);
    },
    enabled: !!user?.id,
  });

  const createMutation = useMutation({
    mutationFn: () => appointmentService.createAppointment({
      professional_id: professional!.id,
      client_id: formData.clientId,
      conversation_id: formData.convId || undefined,
      scheduled_at: `${formData.date}T${formData.time}:00`,
      title: formData.title,
      location: formData.location || undefined,
      description: formData.description || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professional_appointments'] });
      setIsModalOpen(false);
      setFormData({ clientId: '', convId: '', title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '09:00', location: '', description: '' });
      toast.success('Agendamento criado e cliente notificado!');
    },
    onError: () => toast.error('Erro ao criar agendamento'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, notifyId }: { id: string; status: 'completed' | 'cancelled'; notifyId: string }) =>
      appointmentService.updateAppointmentStatus(id, status, notifyId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['professional_appointments'] });
      if (detailsModalOpen) setDetailsModalOpen(false);
      toast.success(vars.status === 'completed' ? 'Atendimento concluído!' : 'Agendamento cancelado');
    },
    onError: () => toast.error('Erro ao atualizar agendamento'),
  });

  // Calendar helpers
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });

  const selectedDayAppointments = useMemo(
    () => appointments.filter(a => isSameDay(new Date(a.scheduled_at), selectedDate)),
    [appointments, selectedDate],
  );

  const stats = useMemo(() => ({
    total: appointments.length,
    scheduled: appointments.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    today: appointments.filter(a => isSameDay(new Date(a.scheduled_at), new Date())).length,
  }), [appointments]);

  const handlePrev = () => viewMode === 'calendar' ? setCurrentMonth(subMonths(currentMonth, 1)) : setSelectedDate(subDays(selectedDate, 1));
  const handleNext = () => viewMode === 'calendar' ? setCurrentMonth(addMonths(currentMonth, 1)) : setSelectedDate(addDays(selectedDate, 1));
  const handleToday = () => { const t = new Date(); setSelectedDate(t); setCurrentMonth(t); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId || !formData.title) { toast.error('Preencha cliente e serviço'); return; }
    if (!professional?.id) { toast.error('Perfil profissional não encontrado'); return; }
    createMutation.mutate();
  };

  if (isLoading && !appointments.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-emerald-500" size={36} />
      </div>
    );
  }

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
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-[#1C3454] border border-blue-500/20 rounded-2xl p-4">
          <h4 className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">Agendados</h4>
          <p className="text-2xl font-bold text-blue-400">{stats.scheduled}</p>
        </div>
        <div className="bg-[#1C3454] border border-emerald-500/20 rounded-2xl p-4">
          <h4 className="text-emerald-500 text-xs font-bold uppercase tracking-widest mb-1">Concluídos</h4>
          <p className="text-2xl font-bold text-emerald-500">{stats.completed}</p>
        </div>
        <div className="bg-[#1C3454] border border-yellow-500/20 rounded-2xl p-4">
          <h4 className="text-yellow-500 text-xs font-bold uppercase tracking-widest mb-1">Hoje</h4>
          <p className="text-2xl font-bold text-yellow-500">{stats.today}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main View */}
        <div className="lg:col-span-2 bg-[#1C3454] border border-[#1C3050] rounded-2xl p-6">
          {viewMode === 'calendar' ? (
            <>
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-white font-bold text-xl first-letter:uppercase">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrev} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0E1C32] border border-[#1C3050] text-[#94A3B8] hover:text-white hover:border-white/20 transition-all">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={handleToday} className="px-4 py-2 text-sm font-bold rounded-xl bg-white/5 border border-[#243F6A] text-white hover:bg-white/10 transition-all">
                    Hoje
                  </button>
                  <button onClick={handleNext} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0E1C32] border border-[#1C3050] text-[#94A3B8] hover:text-white hover:border-white/20 transition-all">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-4 text-center text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => <div key={d}>{d}</div>)}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, idx) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isTodayDay = isToday(day);
                  const dayAppts = appointments.filter(a => isSameDay(new Date(a.scheduled_at), day));
                  const firstStatus = dayAppts[0]?.status;

                  return (
                    <button
                      key={idx}
                      onClick={() => isCurrentMonth && setSelectedDate(day)}
                      className={cn(
                        'aspect-square rounded-2xl border flex flex-col p-2 text-sm font-medium transition-all relative group',
                        !isCurrentMonth ? 'opacity-[0.05] pointer-events-none' : 'hover:border-emerald-500/50',
                        isSelected ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]' : 'bg-[#0E1C32] border-[#1C3050] text-[#94A3B8]',
                      )}
                    >
                      <span className="relative z-10">{format(day, 'd')}</span>
                      {isTodayDay && !isSelected && (
                        <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      )}
                      {dayAppts.length > 0 && !isSelected && (
                        <div className="mt-auto flex justify-center">
                          <div className={cn('w-1 h-1 rounded-full', firstStatus ? dotColor(firstStatus) : 'bg-blue-500')} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-6 mt-10 p-4 bg-[#0E1C32] rounded-2xl border border-[#1C3050]">
                {[['Agendado','bg-yellow-500'],['Confirmado','bg-emerald-500'],['Concluído','bg-slate-500'],['Cancelado','bg-red-500']].map(([lbl,cls]) => (
                  <div key={lbl} className="flex items-center gap-2 text-[10px] font-bold text-[#4A6580] uppercase tracking-widest">
                    <div className={cn('w-2.5 h-2.5 rounded-full', cls)} /> {lbl}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-white font-bold text-xl uppercase tracking-tight">Próximos Compromissos</h2>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrev} className="p-2 hover:text-emerald-500 text-[#94A3B8] transition-colors"><ChevronLeft size={20}/></button>
                  <button onClick={handleToday} className="text-xs font-bold text-[#94A3B8] hover:text-white transition-colors">Ir para Hoje</button>
                  <button onClick={handleNext} className="p-2 hover:text-emerald-500 text-[#94A3B8] transition-colors"><ChevronRight size={20}/></button>
                </div>
              </div>
              {appointments.length > 0 ? (
                <div className="space-y-3">
                  {[...appointments].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()).map(app => (
                    <div key={app.id} className="bg-[#0E1C32] border border-[#1C3050] p-4 rounded-2xl flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/5 rounded-xl flex flex-col items-center justify-center border border-[#243F6A] group-hover:border-emerald-500/20 transition-colors">
                          <span className="text-[10px] font-bold text-[#4A6580] uppercase">{format(new Date(app.scheduled_at), 'MMM', { locale: ptBR })}</span>
                          <span className="text-lg font-bold text-white leading-none">{format(new Date(app.scheduled_at), 'dd')}</span>
                        </div>
                        <div>
                          <p className="text-white font-bold">{app.title}</p>
                          <div className="flex items-center gap-2 text-xs text-[#4A6580]">
                            <User size={12} /> {app.client_profile?.full_name || 'Cliente'}
                            <span className="w-1 h-1 rounded-full bg-slate-700" />
                            <Clock size={12} /> {format(new Date(app.scheduled_at), 'HH:mm')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn('px-3 py-1 text-[10px] font-bold rounded-full border uppercase', statusColor(app.status))}>
                          {statusLabel(app.status)}
                        </span>
                        {app.status !== 'completed' && app.status !== 'cancelled' && (
                          <button
                            onClick={() => updateStatusMutation.mutate({ id: app.id, status: 'cancelled', notifyId: app.client_id })}
                            className="p-2 text-[#4A6580] hover:text-red-500 transition-colors"
                            title="Cancelar agendamento"
                          >
                            <X size={18} />
                          </button>
                        )}
                        <button onClick={() => { setViewingAppointment(app); setDetailsModalOpen(true); }} className="p-2 text-[#4A6580] hover:text-emerald-500 transition-colors" title="Ver detalhes">
                          <List size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-[#243F6A] rounded-3xl p-16 text-center flex flex-col items-center justify-center bg-[#0E1C32]/50 min-h-[400px]">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 text-slate-700"><List size={32} /></div>
                  <h3 className="text-slate-300 font-bold mb-2">Sem agendamentos</h3>
                  <p className="text-[#4A6580] text-sm max-w-xs mx-auto">Novos agendamentos aparecerão aqui automaticamente.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar / Day View */}
        <div className="bg-[#1C3454] border border-[#1C3050] rounded-3xl p-8 flex flex-col relative overflow-hidden group">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-700" />

          <div className="flex items-center justify-between mb-8 relative z-10">
            <h3 className="text-white font-bold text-lg first-letter:uppercase">
              {format(selectedDate, "eeee, d 'de' MMMM", { locale: ptBR })}
            </h3>
            <div className="flex gap-1">
              <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="p-1.5 hover:bg-white/5 rounded-lg text-[#4A6580] hover:text-emerald-500 transition-all"><ChevronLeft size={18} /></button>
              <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-1.5 hover:bg-white/5 rounded-lg text-[#4A6580] hover:text-emerald-500 transition-all"><ChevronRight size={18} /></button>
            </div>
          </div>

          <div className="flex-1 space-y-4 relative z-10">
            {selectedDayAppointments.length > 0 ? (
              selectedDayAppointments.map(app => (
                <div key={app.id} className="bg-[#0E1C32] border border-[#1C3050] p-5 rounded-2xl space-y-3 hover:border-emerald-500/30 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/10 rounded-lg text-emerald-500 text-[10px] font-bold font-mono">
                      <Clock size={12} /> {format(new Date(app.scheduled_at), 'HH:mm')}
                    </div>
                    {app.status !== 'completed' && app.status !== 'cancelled' && (
                      <button onClick={() => updateStatusMutation.mutate({ id: app.id, status: 'cancelled', notifyId: app.client_id })} className="text-slate-700 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-base">{app.title}</h4>
                    <p className="text-[#4A6580] text-sm flex items-center gap-2 mt-1"><User size={14} /> {app.client_profile?.full_name || 'Cliente'}</p>
                    {app.location && <p className="text-[#4A6580] text-xs flex items-center gap-1 mt-1"><MapPin size={12} /> {app.location}</p>}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => { setViewingAppointment(app); setDetailsModalOpen(true); }} className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg border border-[#243F6A] transition-all">
                      Detalhes
                    </button>
                    {(app.status === 'scheduled' || app.status === 'confirmed') && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: app.id, status: 'completed', notifyId: app.client_id })}
                        className="p-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-black text-emerald-500 rounded-lg border border-emerald-500/20 transition-all"
                        title="Concluir atendimento"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-12">
                <div className="w-20 h-20 bg-[#0E1C32] rounded-full flex items-center justify-center mb-6 border border-[#1C3050] shadow-inner">
                  <CalendarIcon className="text-slate-700" size={32} />
                </div>
                <p className="text-white/90 font-bold text-lg mb-2">Nenhum agendamento</p>
                <p className="text-[#4A6580] text-sm">Este dia está livre.</p>
                <button onClick={() => setIsModalOpen(true)} className="mt-10 px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all">
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
          <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-500 rounded-xl"><List size={24} /></div>
                Detalhes do Agendamento
              </h2>
              <button onClick={() => setDetailsModalOpen(false)} className="text-[#4A6580] hover:text-white transition-colors"><X size={24} /></button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-[#0E1C32] border border-[#1C3050] rounded-2xl">
                  <p className="text-[10px] font-bold text-[#4A6580] uppercase tracking-widest mb-1">Status</p>
                  <span className={cn('text-xs font-bold', statusColor(viewingAppointment.status).split(' ')[1])}>
                    {statusLabel(viewingAppointment.status).toUpperCase()}
                  </span>
                </div>
                <div className="p-4 bg-[#0E1C32] border border-[#1C3050] rounded-2xl">
                  <p className="text-[10px] font-bold text-[#4A6580] uppercase tracking-widest mb-1">ID</p>
                  <span className="text-xs font-mono text-slate-300">#{viewingAppointment.id.slice(0, 8)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-4 p-4 border border-[#1C3050] rounded-2xl bg-[#0E1C32]/30">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500"><User size={24} /></div>
                  <div>
                    <p className="text-xs text-[#4A6580]">Cliente</p>
                    <p className="text-white font-bold text-lg">{viewingAppointment.client_profile?.full_name || 'Cliente'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 border border-[#1C3050] rounded-2xl bg-[#0E1C32]/30">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400"><Briefcase size={24} /></div>
                  <div>
                    <p className="text-xs text-[#4A6580]">Serviço</p>
                    <p className="text-white font-bold text-lg">{viewingAppointment.title}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 border border-[#1C3050] rounded-2xl bg-[#0E1C32]/30">
                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-[#94A3B8]"><CalendarIcon size={20} /></div>
                    <div>
                      <p className="text-[10px] text-[#4A6580] uppercase font-bold">Data</p>
                      <p className="text-white font-bold text-sm">{format(new Date(viewingAppointment.scheduled_at), 'dd/MM/yyyy')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 border border-[#1C3050] rounded-2xl bg-[#0E1C32]/30">
                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-[#94A3B8]"><Clock size={20} /></div>
                    <div>
                      <p className="text-[10px] text-[#4A6580] uppercase font-bold">Horário</p>
                      <p className="text-white font-bold text-sm">{format(new Date(viewingAppointment.scheduled_at), 'HH:mm')}</p>
                    </div>
                  </div>
                </div>
                {viewingAppointment.location && (
                  <div className="flex items-center gap-4 p-4 border border-[#1C3050] rounded-2xl bg-[#0E1C32]/30">
                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-[#94A3B8]"><MapPin size={20} /></div>
                    <div>
                      <p className="text-[10px] text-[#4A6580] uppercase font-bold">Endereço</p>
                      <p className="text-white font-bold text-sm">{viewingAppointment.location}</p>
                    </div>
                  </div>
                )}
                {viewingAppointment.description && (
                  <div className="p-4 border border-[#1C3050] rounded-2xl bg-[#0E1C32]/30">
                    <p className="text-[10px] text-[#4A6580] uppercase font-bold mb-1">Observações</p>
                    <p className="text-slate-300 text-sm">{viewingAppointment.description}</p>
                  </div>
                )}
              </div>

              {(viewingAppointment.status === 'scheduled' || viewingAppointment.status === 'confirmed') && (
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    onClick={() => updateStatusMutation.mutate({ id: viewingAppointment.id, status: 'completed', notifyId: viewingAppointment.client_id })}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all disabled:opacity-50"
                  >
                    Concluir Atendimento
                  </button>
                  <button
                    onClick={() => updateStatusMutation.mutate({ id: viewingAppointment.id, status: 'cancelled', notifyId: viewingAppointment.client_id })}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-2xl border border-red-500/20 transition-all disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              )}
              {viewingAppointment.status === 'completed' && (
                <div className="w-full py-4 bg-emerald-500/10 text-emerald-500 font-bold rounded-2xl border border-emerald-500/20 flex items-center justify-center gap-2">
                  <CheckCircle2 size={20} /> Atendimento Concluído
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-[#1C3454] border border-[#243F6A] rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-500 rounded-lg"><Plus size={24} /></div>
                Novo Agendamento
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[#4A6580] hover:text-white transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2"><User size={14} /> Cliente</label>
                <select
                  required
                  value={formData.clientId}
                  onChange={e => {
                    const conv = convClients.find(c => c.client_id === e.target.value);
                    setFormData(f => ({ ...f, clientId: e.target.value, convId: conv?.convId || '' }));
                  }}
                  className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">Selecionar cliente...</option>
                  {convClients.map(c => (
                    <option key={c.client_id} value={c.client_id}>{c.client_name}</option>
                  ))}
                </select>
                {convClients.length === 0 && (
                  <p className="text-xs text-[#4A6580]">Nenhum cliente encontrado nas suas conversas</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2"><Briefcase size={14} /> Serviço / Título</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Instalação Elétrica"
                  value={formData.title}
                  onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2"><CalendarIcon size={14} /> Data</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2"><Clock size={14} /> Horário</label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={e => setFormData(f => ({ ...f, time: e.target.value }))}
                    className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2"><MapPin size={14} /> Endereço (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Rua das Flores, 123"
                  value={formData.location}
                  onChange={e => setFormData(f => ({ ...f, location: e.target.value }))}
                  className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest">Observações (opcional)</label>
                <textarea
                  placeholder="Detalhes adicionais..."
                  value={formData.description}
                  onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-[#0E1C32] border border-[#243F6A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-[#0E1C32] font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createMutation.isPending ? <><Loader2 size={18} className="animate-spin" /> Criando...</> : 'Finalizar Agendamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
