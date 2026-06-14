import { useState, useMemo } from 'react';
import { format, addMonths, subMonths, isSameDay, addDays, subDays, isToday } from 'date-fns';
import { Plus, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useAgendaData } from '../../hooks/useAgendaData';
import type { Appointment } from '../../services/appointmentService';

import { AgendaStats } from './agenda/AgendaStats';
import { CalendarGrid } from './agenda/CalendarGrid';
import { AppointmentListView } from './agenda/AppointmentListView';
import { DaySidebar } from './agenda/DaySidebar';
import { AppointmentDetailsModal } from './agenda/AppointmentDetailsModal';
import { ProposeRescheduleModal } from './agenda/ProposeRescheduleModal';
import { CancelConfirmModal } from './agenda/CancelConfirmModal';
import { CreateAppointmentModal } from './agenda/CreateAppointmentModal';

export default function ProfessionalAgenda() {
  const { user } = useAuthStore();

  const {
    professional,
    appointments,
    isLoading,
    availableClients,
    createMutation,
    updateMutation,
    proposeMutation,
    acceptMutation,
    declineMutation,
    anyPending,
  } = useAgendaData({ userId: user?.id });

  // Navigation state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Modal triggers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialModalDate, setInitialModalDate] = useState<string | undefined>();
  const [detailsModalAppt, setDetailsModalAppt] = useState<Appointment | null>(null);
  const [proposeModalAppt, setProposeModalAppt] = useState<Appointment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; clientId: string } | null>(null);

  // Derived
  const selectedDayAppointments = useMemo(
    () => appointments.filter(app => isSameDay(new Date(app.scheduled_at), selectedDate)),
    [appointments, selectedDate],
  );

  const stats = useMemo(() => ({
    total: appointments.length,
    pending: appointments.filter(a => ['scheduled', 'confirmed', 'rescheduled'].includes(a.status)).length,
    completed: appointments.filter(a => a.status === 'completed').length,
    today: appointments.filter(a => isToday(new Date(a.scheduled_at))).length,
  }), [appointments]);

  // Handlers
  const handlePrev = () => {
    if (viewMode === 'calendar') setCurrentMonth(subMonths(currentMonth, 1));
    else setSelectedDate(subDays(selectedDate, 1));
  };
  const handleNext = () => {
    if (viewMode === 'calendar') setCurrentMonth(addMonths(currentMonth, 1));
    else setSelectedDate(addDays(selectedDate, 1));
  };
  const handleToday = () => { const t = new Date(); setSelectedDate(t); setCurrentMonth(t); };
  const handleSelectDay = (day: Date) => setSelectedDate(day);

  const handleUpdateStatus = (id: string, status: 'confirmed' | 'cancelled' | 'completed', notifyUserId?: string) => {
    updateMutation.mutate({ id, status, notifyUserId });
  };

  const openDetails = (appt: Appointment) => setDetailsModalAppt(appt);
  const openNewForDate = (date: Date) => {
    setInitialModalDate(format(date, 'yyyy-MM-dd'));
    setIsModalOpen(true);
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ marginBottom: '0.25rem' }}>
        <div>
          <h1 className="text-xl font-bold text-white mb-1.5">Calendário de Agendamentos</h1>
          <p className="text-[#94A3B8] text-sm">Gerencie seus compromissos e horários</p>
        </div>
        <div className="flex gap-1.5">
          <div className="flex bg-[#1C3454] border border-[#1C3050] rounded-lg p-1.5">
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
            onClick={() => { setInitialModalDate(undefined); setIsModalOpen(true); }}
            className="h-9 px-4 text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl transition-all flex items-center gap-1.5"
          >
            <Plus size={18} /> Novo Agendamento
          </button>
        </div>
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <AgendaStats stats={stats} isLoading={isLoading} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4" style={{ marginTop: '1.25rem' }}>
        <div className="lg:col-span-2 bg-[#132236] border border-[#1C3050] rounded-2xl p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin text-emerald-500" size={32} />
            </div>
          ) : viewMode === 'calendar' ? (
            <CalendarGrid
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              appointments={appointments}
              onSelectDay={handleSelectDay}
              onPrev={handlePrev}
              onNext={handleNext}
              onToday={handleToday}
            />
          ) : (
            <AppointmentListView
              appointments={appointments}
              onOpenDetails={openDetails}
              onCancelTarget={setCancelTarget}
              onPrev={handlePrev}
              onNext={handleNext}
              onToday={handleToday}
            />
          )}
        </div>

        <DaySidebar
          selectedDate={selectedDate}
          selectedDayAppointments={selectedDayAppointments}
          onSetSelectedDate={setSelectedDate}
          onOpenDetails={openDetails}
          onCancelTarget={setCancelTarget}
          onProposeOpen={setProposeModalAppt}
          onUpdateStatus={handleUpdateStatus}
          onOpenNewForDate={openNewForDate}
          anyPending={anyPending}
          acceptMutation={acceptMutation}
          declineMutation={declineMutation}
        />
      </div>

      {/* Modals */}
      {detailsModalAppt && (
        <AppointmentDetailsModal
          appointment={detailsModalAppt}
          onClose={() => setDetailsModalAppt(null)}
          onUpdateStatus={handleUpdateStatus}
          onProposeOpen={appt => { setProposeModalAppt(appt); setDetailsModalAppt(null); }}
          onCancelTarget={t => { setCancelTarget(t); setDetailsModalAppt(null); }}
          anyPending={anyPending}
          acceptMutation={acceptMutation}
          declineMutation={declineMutation}
        />
      )}

      {proposeModalAppt && (
        <ProposeRescheduleModal
          appointment={proposeModalAppt}
          onClose={() => setProposeModalAppt(null)}
          onSubmit={(appt, proposedAt) => proposeMutation.mutate({ appt, proposedAt })}
          isPending={proposeMutation.isPending}
        />
      )}

      {cancelTarget && (
        <CancelConfirmModal
          target={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={(id, clientId) => { handleUpdateStatus(id, 'cancelled', clientId); setCancelTarget(null); }}
          isPending={updateMutation.isPending}
        />
      )}

      {isModalOpen && professional?.id && (
        <CreateAppointmentModal
          initialDate={initialModalDate}
          availableClients={availableClients}
          onClose={() => setIsModalOpen(false)}
          onSubmit={payload => createMutation.mutate(payload, { onSuccess: () => setIsModalOpen(false) })}
          isPending={createMutation.isPending}
          professionalId={professional.id}
        />
      )}
    </div>
  );
}
