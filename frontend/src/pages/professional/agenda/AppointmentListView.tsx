import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { List, ChevronLeft, ChevronRight, User, Clock, MapPin, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
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

interface AppointmentListViewProps {
  appointments: Appointment[];
  onOpenDetails: (appt: Appointment) => void;
  onCancelTarget: (target: { id: string; clientId: string }) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function isActive(s: AppStatus) {
  return s === 'scheduled' || s === 'confirmed';
}

export function AppointmentListView({
  appointments,
  onOpenDetails,
  onCancelTarget,
  onPrev,
  onNext,
  onToday,
}: AppointmentListViewProps) {
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
  );

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-white font-bold text-xl uppercase tracking-tight">Todos os Compromissos</h2>
        <div className="flex items-center gap-2">
          <button onClick={onPrev} className="p-2 hover:text-emerald-500 text-[#94A3B8] transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={onToday} className="text-xs font-bold text-[#94A3B8] hover:text-white transition-colors">
            Ir para Hoje
          </button>
          <button onClick={onNext} className="p-2 hover:text-emerald-500 text-[#94A3B8] transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {sorted.length > 0 ? (
        <div className="space-y-2">
          {sorted.map(app => (
            <div key={app.id} className="bg-[#0E1C32] border border-[#1C3050] p-2 rounded-xl flex items-center justify-between group hover:border-emerald-500/30 transition-all">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 bg-white/5 rounded-lg flex flex-col items-center justify-center border border-[#243F6A] group-hover:border-emerald-500/20 transition-colors">
                  <span className="text-[10px] font-bold text-[#4A6580] uppercase">
                    {format(new Date(app.scheduled_at), 'MMM', { locale: ptBR })}
                  </span>
                  <span className="text-base font-bold text-white leading-none">
                    {format(new Date(app.scheduled_at), 'dd')}
                  </span>
                </div>
                <div>
                  <p className="text-white font-bold">{app.title}</p>
                  <div className="flex items-center gap-2 text-xs text-[#4A6580]">
                    <User size={12} /> {app.client?.full_name || 'Cliente'}
                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                    <Clock size={12} /> {format(new Date(app.scheduled_at), 'HH:mm')}
                    {app.location && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                        <MapPin size={12} /> {app.location}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('px-3 py-1 text-[10px] font-bold rounded-full border uppercase', STATUS_BADGE[app.status])}>
                  {STATUS_LABEL[app.status]}
                </span>
                {isActive(app.status) && (
                  <button
                    onClick={() => onCancelTarget({ id: app.id, clientId: app.client_id })}
                    className="p-2 text-[#4A6580] hover:text-red-500 transition-colors"
                    title="Cancelar"
                  >
                    <X size={18} />
                  </button>
                )}
                <button onClick={() => onOpenDetails(app)} className="p-2 text-[#4A6580] hover:text-emerald-500 transition-colors">
                  <List size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-[#243F6A] rounded-xl p-16 text-center flex flex-col items-center justify-center bg-[#0E1C32]/50 min-h-[400px]">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-11 text-slate-700">
            <List size={32} />
          </div>
          <h3 className="text-slate-300 font-bold mb-2">Sem agendamentos</h3>
          <p className="text-[#4A6580] text-sm max-w-xs mx-auto">Crie um novo agendamento para começar.</p>
        </div>
      )}
    </div>
  );
}
