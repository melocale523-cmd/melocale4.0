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
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-white font-bold text-base first-letter:uppercase">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={onPrev} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#0E1C32] border border-[#1C3050] text-[#94A3B8] hover:text-white hover:border-white/20 transition-all shadow-sm">
            <ChevronLeft size={20} />
          </button>
          <button onClick={onToday} className="px-3 py-1.5 text-sm font-bold rounded-lg bg-white/5 border border-[#243F6A] text-white hover:bg-white/10 transition-all shadow-sm">
            Hoje
          </button>
          <button onClick={onNext} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#0E1C32] border border-[#1C3050] text-[#94A3B8] hover:text-white hover:border-white/20 transition-all shadow-sm">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest pb-2 border-b border-slate-800">
        <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
      </div>

      <div className="grid grid-cols-7 gap-1 mt-1">
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
                'h-20 rounded-lg border flex flex-col items-center justify-center text-xs font-semibold transition-all relative group cursor-pointer',
                !isCurrentMonth ? 'opacity-[0.05] pointer-events-none' : '',
                isSelected
                  ? 'bg-emerald-500 text-black border-emerald-500 shadow-lg shadow-emerald-500/30 scale-105'
                  : isTodayDay ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-[#0E1C32] border-[#1C3050] text-slate-400 hover:bg-[#1C3454] hover:border-slate-600 hover:text-white',
              )}
            >
              <span className="relative z-10">{format(day, 'd')}</span>
              {dotColor && !isSelected && (
                <div className="mt-auto flex justify-center">
                  <div className={cn('w-1 h-1 rounded-full', dotColor)} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 mt-3 px-3 py-2 bg-[#0E1C32]/60 rounded-lg border border-[#1C3050]/50">
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
