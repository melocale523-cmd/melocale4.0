import type { ReactNode } from 'react';
import { FileText, User, Calendar, CheckCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { PedidoItem } from '../../../hooks/usePedidosData';

interface TimelineStage {
  label: string;
  icon: ReactNode;
  done: boolean;
  date?: string;
}

interface LeadTimelineProps {
  pedido: PedidoItem;
  appointment: { scheduled_at: string } | null | undefined;
}

export function LeadTimeline({ pedido, appointment }: LeadTimelineProps) {
  const isInterested = pedido.status === 'orçando' || pedido.status === 'finalizado';
  const isScheduled = !!appointment;
  const isCompleted = pedido.status === 'finalizado';

  const stages: TimelineStage[] = [
    {
      label: 'Publicado',
      icon: <FileText size={13} />,
      done: true,
      date: new Date(pedido.created_at).toLocaleDateString('pt-BR'),
    },
    {
      label: 'Com Interesse',
      icon: <User size={13} />,
      done: isInterested,
    },
    {
      label: 'Agendado',
      icon: <Calendar size={13} />,
      done: isScheduled,
      date: isScheduled ? new Date(appointment!.scheduled_at).toLocaleDateString('pt-BR') : undefined,
    },
    {
      label: 'Concluído',
      icon: <CheckCircle size={13} />,
      done: isCompleted,
    },
  ];

  return (
    <div className="w-full py-7">
      <div className="flex items-center">
        {stages.map((stage, i) => (
          <div key={stage.label} className={cn('flex items-center', i < stages.length - 1 ? 'flex-1' : '')}>
            <div className="flex flex-col items-center gap-6 shrink-0">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0',
                stage.done
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-[#0E1C32] border-[#1C3050] text-[#4A6580]',
              )}>
                {stage.icon}
              </div>
              <p className={cn('text-[9px] font-bold text-center whitespace-nowrap', stage.done ? 'text-emerald-400' : 'text-[#4A6580]')}>
                {stage.label}
              </p>
              <p className="text-[8px] text-[#4A6580] text-center whitespace-nowrap h-3">
                {stage.date ?? ''}
              </p>
            </div>
            {i < stages.length - 1 && (
              <div className={cn(
                'h-0.5 flex-1 mx-2 -mt-7 rounded-full',
                stage.done ? 'bg-emerald-500/50' : 'bg-[#1C3050]',
              )} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
