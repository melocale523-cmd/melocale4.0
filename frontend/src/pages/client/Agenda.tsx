import { useState } from 'react';
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

interface Appointment {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  professionals: { full_name: string | null; city: string | null }[] | null;
}

export default function ClientAgenda() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ['client_appointments', year, month],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const from = new Date(year, month, 1).toISOString();
      const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const { data } = await supabase
        .from('appointments')
        .select('id, scheduled_at, status, notes, professionals(full_name, city)')
        .eq('client_id', user.id)
        .gte('scheduled_at', from)
        .lte('scheduled_at', to)
        .order('scheduled_at');
      return (data ?? []) as unknown as Appointment[];
    },
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const appointmentsByDay: Record<number, Appointment[]> = {};
  for (const appt of appointments) {
    const d = new Date(appt.scheduled_at).getDate();
    if (!appointmentsByDay[d]) appointmentsByDay[d] = [];
    appointmentsByDay[d].push(appt);
  }

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const statusColor: Record<string, string> = {
    confirmed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  const statusLabel: Record<string, string> = {
    confirmed: 'Confirmado',
    pending: 'Pendente',
    cancelled: 'Cancelado',
    completed: 'Concluído',
  };

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Minha Agenda</h1>
        <p className="text-[#94A3B8] text-sm mt-1">Seus agendamentos com profissionais</p>
      </div>

      {/* Calendar header */}
      <div className="bg-[#132540] border border-[#1C3050] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-[#1C3454] text-[#94A3B8] transition-colors">
            <ChevronLeft size={20} />
          </button>
          <span className="text-lg font-semibold text-white">
            {MONTHS[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-[#1C3454] text-[#94A3B8] transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-[#4A6580] py-2">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />;
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const hasAppts = !!appointmentsByDay[day]?.length;
            return (
              <div
                key={day}
                className={`
                  relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-all
                  ${isToday ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-[#94A3B8] hover:bg-[#1C3454] hover:text-white'}
                `}
              >
                {day}
                {hasAppts && (
                  <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Appointment list */}
      <div className="bg-[#132540] border border-[#1C3050] rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-emerald-400" />
          Agendamentos em {MONTHS[month]}
        </h2>

        {isLoading ? (
          <p className="text-[#94A3B8] text-sm">Carregando...</p>
        ) : appointments.length === 0 ? (
          <div className="text-center py-10">
            <Calendar size={40} className="mx-auto text-[#243F6A] mb-3" />
            <p className="text-[#94A3B8] text-sm">Nenhum agendamento neste mês</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map(appt => {
              const dt = new Date(appt.scheduled_at);
              return (
                <div key={appt.id} className="flex items-start gap-4 p-4 rounded-xl bg-[#0E1C32] border border-[#1C3050]">
                  <div className="flex flex-col items-center justify-center min-w-[48px] h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-lg font-bold text-emerald-400 leading-none">{dt.getDate()}</span>
                    <span className="text-[10px] text-emerald-400/70">{MONTHS[dt.getMonth()].slice(0, 3)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {appt.professionals?.[0]?.full_name || 'Profissional'}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
                        <Clock size={12} />
                        {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {appt.professionals?.[0]?.city && (
                        <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
                          <MapPin size={12} />
                          {appt.professionals?.[0]?.city}
                        </span>
                      )}
                    </div>
                    {appt.notes && (
                      <p className="text-xs text-[#4A6580] mt-1 truncate">{appt.notes}</p>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg border ${statusColor[appt.status] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                    {statusLabel[appt.status] ?? appt.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
