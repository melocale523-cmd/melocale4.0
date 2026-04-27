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
  subDays 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, List, Plus, ChevronLeft, ChevronRight, X, Clock, User, Briefcase, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface Appointment {
  id: string;
  clientName: string;
  service: string;
  date: Date;
  time: string;
  status: 'pending' | 'completed' | 'cancelled';
}

export default function ProfessionalAgenda() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [appointments, setAppointments] = useState<Appointment[]>([
    {
      id: 'initial-1',
      clientName: 'Maria Silva',
      service: 'Consultoria de Design',
      date: new Date(),
      time: '10:30',
      status: 'pending'
    }
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);
  
  // New Appointment Form State
  const [formData, setFormData] = useState({
    clientName: '',
    service: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00'
  });

  // Derived Data
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const selectedDayAppointments = useMemo(() => 
    appointments.filter(app => isSameDay(app.date, selectedDate)),
  [appointments, selectedDate]);

  const stats = useMemo(() => ({
    total: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    today: appointments.filter(a => isSameDay(a.date, new Date())).length
  }), [appointments]);

  // Handlers
  const handlePrev = () => {
    if (viewMode === 'calendar') {
      setCurrentMonth(subMonths(currentMonth, 1));
    } else {
      setSelectedDate(subDays(selectedDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'calendar') {
      setCurrentMonth(addMonths(currentMonth, 1));
    } else {
      setSelectedDate(addDays(selectedDate, 1));
    }
  };

  const handleToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today);
  };

  const handleSelectDay = (day: Date) => {
    if (isSameMonth(day, monthStart)) {
      setSelectedDate(day);
    }
  };

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.service) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const newAppointment: Appointment = {
      id: Math.random().toString(36).substr(2, 9),
      clientName: formData.clientName,
      service: formData.service,
      date: new Date(formData.date + 'T00:00:00'),
      time: formData.time,
      status: 'pending'
    };

    setAppointments(prev => [...prev, newAppointment]);
    setIsModalOpen(false);
    setFormData({ 
      clientName: '', 
      service: '', 
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '09:00' 
    });
    toast.success('Agendamento criado com sucesso!', {
      description: `${formData.service} com ${formData.clientName} às ${formData.time}`
    });
  };

  const handleUpdateStatus = (id: string, status: 'pending' | 'completed' | 'cancelled') => {
    setAppointments(prev => prev.map(app => 
      app.id === id ? { ...app, status } : app
    ));
    
    if (status === 'completed') {
      toast.success('Compromisso concluído!');
    } else if (status === 'cancelled') {
      toast.info('Compromisso cancelado');
    }
    
    if (detailsModalOpen) setDetailsModalOpen(false);
  };

  const openDetails = (app: Appointment) => {
    setViewingAppointment(app);
    setDetailsModalOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Calendário de Agendamentos</h1>
          <p className="text-slate-400 text-sm">Gerencie seus compromissos e horários</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-[#14161B] border border-white/5 rounded-xl p-1">
            <button 
              onClick={() => setViewMode('calendar')}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                viewMode === 'calendar' ? "bg-emerald-500 text-black" : "text-slate-400 hover:text-white"
              )}
            >
              Calendário
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                viewMode === 'list' ? "bg-emerald-500 text-black" : "text-slate-400 hover:text-white"
              )}
            >
              Lista
            </button>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-sm font-bold bg-white/5 border border-white/10 hover:bg-emerald-500 hover:text-black text-white rounded-xl transition-all flex items-center gap-2 group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform" /> Novo Agendamento
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#14161B] border border-white/5 rounded-2xl p-4 group hover:border-white/10 transition-colors">
           <h4 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Total</h4>
           <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-[#14161B] border border-blue-500/20 rounded-2xl p-4">
           <h4 className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">Agendados</h4>
           <p className="text-2xl font-bold text-blue-400">{stats.pending}</p>
        </div>
        <div className="bg-[#14161B] border border-emerald-500/20 rounded-2xl p-4">
           <h4 className="text-emerald-500 text-xs font-bold uppercase tracking-widest mb-1">Concluídos</h4>
           <p className="text-2xl font-bold text-emerald-500">{stats.completed}</p>
        </div>
        <div className="bg-[#14161B] border border-yellow-500/20 rounded-2xl p-4">
           <h4 className="text-yellow-500 text-xs font-bold uppercase tracking-widest mb-1">Hoje</h4>
           <p className="text-2xl font-bold text-yellow-500">{stats.today}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
         {/* Main View Area */}
         <div className="lg:col-span-2 bg-[#14161B] border border-white/5 rounded-2xl p-6">
            {viewMode === 'calendar' ? (
              <>
                <div className="flex justify-between items-center mb-10">
                   <h2 className="text-white font-bold text-xl first-letter:uppercase">
                     {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                   </h2>
                   <div className="flex items-center gap-2">
                      <button 
                        onClick={handlePrev}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0A0B0D] border border-white/5 text-slate-400 hover:text-white hover:border-white/20 transition-all shadow-sm"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button 
                        onClick={handleToday}
                        className="px-4 py-2 text-sm font-bold rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all shadow-sm"
                      >
                        Hoje
                      </button>
                      <button 
                        onClick={handleNext}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0A0B0D] border border-white/5 text-slate-400 hover:text-white hover:border-white/20 transition-all shadow-sm"
                      >
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
                    const hasAppointment = appointments.some(app => isSameDay(app.date, day));

                    return (
                      <button 
                        key={idx}
                        onClick={() => handleSelectDay(day)}
                        className={cn(
                          "aspect-square rounded-2xl border flex flex-col p-2 text-sm font-medium transition-all relative group",
                          !isCurrentMonth ? "opacity-[0.05] pointer-events-none" : "hover:border-emerald-500/50",
                          isSelected 
                            ? "bg-emerald-500 text-black border-emerald-400 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]" 
                            : "bg-[#0A0B0D] border-white/5 text-slate-400"
                        )}
                      >
                        <span className="relative z-10">{format(day, 'd')}</span>
                        {isTodayDay && !isSelected && (
                          <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                        )}
                        {hasAppointment && !isSelected && (
                          <div className="mt-auto flex justify-center">
                            <div className="w-1 h-1 rounded-full bg-blue-500"></div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-6 mt-10 p-4 bg-[#0A0B0D] rounded-2xl border border-white/5">
                   <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                     <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> 
                     Agendado
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                     <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> 
                     Concluído
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                     <div className="w-2.5 h-2.5 rounded-full bg-slate-500"></div> 
                     Cancelado
                   </div>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-white font-bold text-xl uppercase tracking-tight">Próximos Compromissos</h2>
                  <div className="flex items-center gap-2">
                    <button onClick={handlePrev} className="p-2 hover:text-emerald-500 text-slate-400 transition-colors"><ChevronLeft size={20}/></button>
                    <button onClick={handleToday} className="text-xs font-bold text-slate-400 hover:text-white transition-colors">Ir para Hoje</button>
                    <button onClick={handleNext} className="p-2 hover:text-emerald-500 text-slate-400 transition-colors"><ChevronRight size={20}/></button>
                  </div>
                </div>
                
                {appointments.length > 0 ? (
                  <div className="space-y-3">
                    {appointments
                      .sort((a, b) => a.date.getTime() - b.date.getTime())
                      .map(app => (
                        <div key={app.id} className="bg-[#0A0B0D] border border-white/5 p-4 rounded-2xl flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/5 rounded-xl flex flex-col items-center justify-center border border-white/10 group-hover:border-emerald-500/20 transition-colors">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">{format(app.date, 'MMM', { locale: ptBR })}</span>
                              <span className="text-lg font-bold text-white leading-none">{format(app.date, 'dd')}</span>
                            </div>
                            <div>
                               <p className="text-white font-bold">{app.service}</p>
                               <div className="flex items-center gap-2 text-xs text-slate-500">
                                 <User size={12} /> {app.clientName}
                                 <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                 <Clock size={12} /> {app.time}
                               </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                             <span className={cn(
                               "px-3 py-1 text-[10px] font-bold rounded-full border uppercase",
                               app.status === 'pending' && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                               app.status === 'completed' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                               app.status === 'cancelled' && "bg-red-500/10 text-red-400 border-red-500/20"
                             )}>
                               {app.status === 'pending' ? 'Pendente' : app.status === 'completed' ? 'Concluído' : 'Cancelado'}
                             </span>
                             <button 
                               onClick={() => handleUpdateStatus(app.id, 'cancelled')}
                               className="p-2 text-slate-500 hover:text-red-500 transition-colors" 
                               title="Cancelar agendamento"
                             >
                               <X size={18} />
                             </button>
                             <button 
                               onClick={() => openDetails(app)}
                               className="p-2 text-slate-500 hover:text-emerald-500 transition-colors"
                               title="Ver detalhes"
                             >
                               <List size={18} />
                             </button>
                          </div>
                        </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-white/10 rounded-3xl p-16 text-center flex flex-col items-center justify-center bg-[#0A0B0D]/50 min-h-[400px]">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 text-slate-700">
                      <List size={32} />
                    </div>
                    <h3 className="text-slate-300 font-bold mb-2">Sem agendamentos para este período</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto">Sua lista de compromissos está vazia. Novos agendamentos aparecerão aqui automaticamente.</p>
                  </div>
                )}
              </div>
            )}
         </div>

         {/* Right Sidebar / Day View */}
         <div className="bg-[#14161B] border border-white/5 rounded-3xl p-8 flex flex-col relative overflow-hidden group">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-700"></div>
            
            <div className="flex items-center justify-between mb-8 relative z-10">
               <h3 className="text-white font-bold text-lg first-letter:uppercase">
                 {format(selectedDate, "eeee, d 'de' MMMM", { locale: ptBR })}
               </h3>
               <div className="flex gap-1">
                 <button 
                  onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-emerald-500 transition-all"
                  title="Anterior"
                 >
                   <ChevronLeft size={18} />
                 </button>
                 <button 
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-emerald-500 transition-all"
                  title="Próximo"
                 >
                   <ChevronRight size={18} />
                 </button>
               </div>
            </div>

            <div className="flex-1 space-y-4 relative z-10">
               {selectedDayAppointments.length > 0 ? (
                 selectedDayAppointments.map(app => (
                   <div key={app.id} className="bg-[#0A0B0D] border border-white/5 p-5 rounded-2xl space-y-3 hover:border-emerald-500/30 transition-all group">
                     <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/10 rounded-lg text-emerald-500 text-[10px] font-bold font-mono">
                           <Clock size={12} /> {app.time}
                        </div>
                        <button onClick={() => setAppointments(prev => prev.filter(a => a.id !== app.id))} className="text-slate-700 hover:text-red-500 transition-colors">
                           <X size={14} />
                        </button>
                     </div>
                     <div>
                        <h4 className="text-white font-bold text-base">{app.service}</h4>
                        <p className="text-slate-500 text-sm flex items-center gap-2 mt-1">
                           <User size={14} /> {app.clientName}
                        </p>
                        {app.status === 'completed' && (
                          <p className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                            <CheckCircle2 size={12} /> Concluído
                          </p>
                        )}
                     </div>
                     <div className="flex gap-2 pt-2">
                       <button 
                         onClick={() => openDetails(app)}
                         className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg border border-white/10 transition-all"
                       >
                         Detalhes
                       </button>
                       {app.status === 'pending' && (
                         <button 
                           onClick={() => handleUpdateStatus(app.id, 'completed')}
                           className="p-2 bg-emerald-500/10 hover:bg-emerald-500 hover:text-black text-emerald-500 rounded-lg border border-emerald-500/20 transition-all"
                           title="Confirmar Presença / Concluir"
                         >
                           <CheckCircle2 size={16} />
                         </button>
                       )}
                     </div>
                   </div>
                 ))
               ) : (
                 <div className="flex flex-col items-center justify-center text-center py-12">
                   <div className="w-20 h-20 bg-[#0A0B0D] rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-inner">
                      <CalendarIcon className="text-slate-700" size={32} />
                   </div>
                   <p className="text-white/90 font-bold text-lg mb-2">Nenhum agendamento</p>
                   <p className="text-slate-500 text-sm">Este dia está livre. Aproveite para organizar seus próximos leads!</p>
                   
                   <button 
                    onClick={() => setIsModalOpen(true)}
                    className="mt-10 px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/10 active:scale-[0.98]">
                      Agendar Horário
                   </button>
                 </div>
               )}
            </div>

            <div className="mt-8 pt-8 border-t border-white/5 relative z-10">
               <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4">
                  <span>Horários Populares</span>
                  <span className="text-emerald-500/50">Disponível</span>
               </div>
               <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0A0B0D] border border-white/5 p-3 rounded-xl text-center text-xs text-slate-300 font-mono italic">09:00 - 10:00</div>
                  <div className="bg-[#0A0B0D] border border-white/5 p-3 rounded-xl text-center text-xs text-slate-300 font-mono italic">14:00 - 15:00</div>
               </div>
            </div>
         </div>
      </div>

      {/* Details Modal */}
      {detailsModalOpen && viewingAppointment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDetailsModalOpen(false)}></div>
          <div className="relative bg-[#14161B] border border-white/10 rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-300">
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                   <div className="p-2.5 bg-emerald-500/20 text-emerald-500 rounded-xl">
                      <List size={24} />
                   </div>
                   Detalhes do Agendamento
                </h2>
                <button onClick={() => setDetailsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                   <X size={24} />
                </button>
             </div>

             <div className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 bg-[#0A0B0D] border border-white/5 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Status</p>
                      <span className={cn(
                        "text-xs font-bold",
                        viewingAppointment.status === 'pending' ? "text-blue-400" : viewingAppointment.status === 'completed' ? "text-emerald-500" : "text-red-500"
                      )}>
                        {viewingAppointment.status === 'pending' ? 'AGENDADO' : viewingAppointment.status === 'completed' ? 'CONCLUÍDO' : 'CANCELADO'}
                      </span>
                   </div>
                   <div className="p-4 bg-[#0A0B0D] border border-white/5 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">ID do Pedido</p>
                      <span className="text-xs font-mono text-slate-300">#{viewingAppointment.id}</span>
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="flex items-center gap-4 p-4 border border-white/5 rounded-2xl bg-[#0A0B0D]/30">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                         <User size={24} />
                      </div>
                      <div>
                         <p className="text-xs text-slate-500">Cliente</p>
                         <p className="text-white font-bold text-lg">{viewingAppointment.clientName}</p>
                      </div>
                   </div>

                   <div className="flex items-center gap-4 p-4 border border-white/5 rounded-2xl bg-[#0A0B0D]/30">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                         <Briefcase size={24} />
                      </div>
                      <div>
                         <p className="text-xs text-slate-500">Serviço Solicitado</p>
                         <p className="text-white font-bold text-lg">{viewingAppointment.service}</p>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-4 p-4 border border-white/5 rounded-2xl bg-[#0A0B0D]/30">
                         <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400">
                            <CalendarIcon size={20} />
                         </div>
                         <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Data</p>
                            <p className="text-white font-bold text-sm">{format(viewingAppointment.date, 'dd/MM/yyyy')}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-4 p-4 border border-white/5 rounded-2xl bg-[#0A0B0D]/30">
                         <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400">
                            <Clock size={20} />
                         </div>
                         <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Horário</p>
                            <p className="text-white font-bold text-sm">{viewingAppointment.time}</p>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                   {viewingAppointment.status === 'pending' && (
                     <>
                        <button 
                          onClick={() => handleUpdateStatus(viewingAppointment.id, 'completed')}
                          className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20"
                        >
                          Concluir Atendimento
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(viewingAppointment.id, 'cancelled')}
                          className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-2xl border border-red-500/20 transition-all"
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
                </div>
             </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-[#14161B] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                   <div className="p-2 bg-emerald-500/20 text-emerald-500 rounded-lg">
                      <Plus size={24} />
                   </div>
                   Novo Agendamento
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                   <X size={24} />
                </button>
             </div>

             <form onSubmit={handleCreateAppointment} className="space-y-6">
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <User size={14} /> Nome do Cliente
                   </label>
                   <input 
                      type="text" 
                      required
                      placeholder="Ex: João Silva"
                      value={formData.clientName}
                      onChange={e => setFormData({...formData, clientName: e.target.value})}
                      className="w-full bg-[#0A0B0D] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                   />
                </div>

                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Briefcase size={14} /> Serviço
                   </label>
                   <input 
                      type="text" 
                      required
                      placeholder="Ex: Instalação Elétrica"
                      value={formData.service}
                      onChange={e => setFormData({...formData, service: e.target.value})}
                      className="w-full bg-[#0A0B0D] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         <CalendarIcon size={14} /> Data
                      </label>
                      <input 
                         type="date" 
                         required
                         value={formData.date}
                         onChange={e => setFormData({...formData, date: e.target.value})}
                         className="w-full bg-[#0A0B0D] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         <Clock size={14} /> Horário
                      </label>
                      <input 
                         type="time" 
                         required
                         value={formData.time}
                         onChange={e => setFormData({...formData, time: e.target.value})}
                         className="w-full bg-[#0A0B0D] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                   </div>
                </div>

                <button 
                   type="submit"
                   className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-[#0A0B0D] font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] mt-4"
                >
                   Finalizar Agendamento
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
