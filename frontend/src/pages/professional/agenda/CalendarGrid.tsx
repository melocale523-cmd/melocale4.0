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
    <div style={{ padding: '1rem' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
        <h2 className="first-letter:uppercase" style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={onPrev} className="flex items-center justify-center rounded-lg bg-[#0E1C32] border border-[#1C3050] text-[#94A3B8] hover:text-white hover:border-white/20 transition-all shadow-sm" style={{ width: 32, height: 32 }}>
            <ChevronLeft size={18} />
          </button>
          <button onClick={onToday} className="font-bold rounded-lg bg-white/5 border border-[#243F6A] text-white hover:bg-white/10 transition-all shadow-sm" style={{ height: 32, padding: '0 14px', fontSize: 13 }}>
            Hoje
          </button>
          <button onClick={onNext} className="flex items-center justify-center rounded-lg bg-[#0E1C32] border border-[#1C3050] text-[#94A3B8] hover:text-white hover:border-white/20 transition-all shadow-sm" style={{ width: 32, height: 32 }}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1 text-center uppercase tracking-widest pb-2 border-b border-slate-800" style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>
        <div>D</div><div>S</div><div>T</div><div>Q</div><div>Q</div><div>S</div><div>S</div>
      </div>

      <div className="grid grid-cols-7 gap-1 mt-2">
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
              style={{ aspectRatio: '1', borderRadius: 10 }}
              className={cn(
                'border flex flex-col items-center justify-center transition-all relative group cursor-pointer',
                !isCurrentMonth ? 'opacity-[0.05] pointer-events-none' : '',
                isSelected
                  ? 'bg-emerald-500 text-black border-emerald-500 shadow-lg shadow-emerald-500/30 scale-105'
                  : isTodayDay ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-[#0E1C32] border-[#1C3050] text-slate-400 hover:bg-[#1C3454] hover:border-slate-600 hover:text-white',
              )}
            >
              <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1 }}>{format(day, 'd')}</span>
              {dotColor && !isSelected && (
                <div className="flex justify-center" style={{ marginTop: 3 }}>
                  <div className={cn('w-1 h-1 rounded-full', dotColor)} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 px-4 py-4 bg-[#0d1929] rounded-xl border border-[#1C3050]" style={{ marginTop: '1rem' }}>
        {(['scheduled', 'confirmed', 'rescheduled', 'completed', 'cancelled'] as AppStatus[]).map(s => (
          <div key={s} className="flex items-center gap-2 text-[10px] font-bold text-[#4A6580] uppercase tracking-widest">
            <div className={cn('w-2.5 h-2.5 rounded-full', DOT_COLOR[s])} />
            {STATUS_LABEL[s]}
          </div>
        ))}
      </div>
    </div>
  );
}
