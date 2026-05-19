import {
  format, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval,
  isToday, isSameMonth, isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Appointment } from '../../../services/appointmentService';

type AppStatus = Appointment['status'];

const DOT_COLOR: Record<AppStatus, string> = {
  scheduled: 'bg-blue-500',
  confirmed: 'bg-emerald-500',
  completed: 'bg-slate-400',
  cancelled: 'bg-red-500',
  rescheduled: 'bg-orange-400',
};

const STATUS_LABEL: Record<AppStatus, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  rescheduled: 'Reagendando',
};

function getDayDotColor(appts: Appointment[]): string | null {
  if (!appts.length) return null;
  for (const s of ['rescheduled', 'confirmed', 'scheduled', 'completed', 'cancelled'] as AppStatus[]) {
    if (appts.some(a => a.status === s)) return DOT_COLOR[s];
  }
  return null;
}

interface CalendarGridProps {
  currentMonth: Date;
  selectedDate: Date;
  appointments: Appointment[];
  onSelectDay: (day: Date) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function CalendarGrid({
  currentMonth,
  selectedDate,
  appointments,
  onSelectDay,
  onPrev,
  onNext,
  onToday,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(endOfMonth(monthStart)),
  });

  return (
    <>
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-white font-bold text-xl first-letter:uppercase">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={onPrev} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0E1C32] border border-[#1C3050] text-[#94A3B8] hover:text-white hover:border-white/20 transition-all shadow-sm">
            <ChevronLeft size={20} />
          </button>
          <button onClick={onToday} className="px-4 py-2 text-sm font-bold rounded-xl bg-white/5 border border-[#243F6A] text-white hover:bg-white/10 transition-all shadow-sm">
            Hoje
          </button>
          <button onClick={onNext} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0E1C32] border border-[#1C3050] text-[#94A3B8] hover:text-white hover:border-white/20 transition-all shadow-sm">
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
              onClick={() => onSelectDay(day)}
              className={cn(
                'aspect-square rounded-2xl border flex flex-col p-2 text-sm font-medium transition-all relative group',
                !isCurrentMonth ? 'opacity-[0.05] pointer-events-none' : 'hover:border-emerald-500/50',
                isSelected
                  ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]'
                  : 'bg-[#0E1C32] border-[#1C3050] text-[#94A3B8]',
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
  );
}
