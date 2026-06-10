import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  X, Phone, MapPin, RefreshCw, CalendarCheck, Clock,
  Calendar as CalendarIcon, AlertTriangle, CheckCircle2,
  Wrench, Trash2,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { Appointment } from '../../../services/appointmentService';

type AppStatus = Appointment['status'];

const STATUS_LABEL: Record<AppStatus, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  rescheduled: 'Reagendando',
};

const STATUS_COLOR: Record<AppStatus, { bg: string; text: string; border: string }> = {
  scheduled:   { bg: 'rgba(59,130,246,0.1)',  text: '#60a5fa', border: 'rgba(59,130,246,0.2)'  },
  confirmed:   { bg: 'rgba(16,185,129,0.1)',  text: '#34d399', border: 'rgba(16,185,129,0.2)'  },
  completed:   { bg: 'rgba(100,116,139,0.1)', text: '#94a3b8', border: 'rgba(100,116,139,0.2)' },
  cancelled:   { bg: 'rgba(239,68,68,0.1)',   text: '#f87171', border: 'rgba(239,68,68,0.2)'   },
  rescheduled: { bg: 'rgba(251,146,60,0.1)',  text: '#fb923c', border: 'rgba(251,146,60,0.2)'  },
};

interface AppointmentDetailsModalProps {
  appointment: Appointment;
  onClose: () => void;
  onUpdateStatus: (id: string, status: 'confirmed' | 'cancelled' | 'completed', notifyUserId?: string) => void;
  onProposeOpen: (appt: Appointment) => void;
  onCancelTarget: (target: { id: string; clientId: string }) => void;
  anyPending: boolean;
  acceptMutation: UseMutationResult<unknown, Error, Appointment>;
  declineMutation: UseMutationResult<unknown, Error, Appointment>;
}

function isActive(s: AppStatus) {
  return s === 'scheduled' || s === 'confirmed';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const card: CSSProperties = {
  background: '#070f1c',
  border: '1px solid #1C3050',
  borderRadius: '12px',
  padding: '12px',
};

const lbl: CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  color: '#4a6580',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  display: 'block',
  marginBottom: '3px',
};

const iconBadge = (bg: string): CSSProperties => ({
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  background: bg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

export function AppointmentDetailsModal({
  appointment,
  onClose,
  onUpdateStatus,
  onProposeOpen,
  onCancelTarget,
  anyPending,
  acceptMutation,
  declineMutation,
}: AppointmentDetailsModalProps) {
  const sc = STATUS_COLOR[appointment.status];
  const clientName = appointment.client?.full_name || 'Cliente';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      {/* Overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />

      {/* Modal */}
      <div style={{
        position: 'relative',
        background: '#0a1928',
        border: '1px solid #1C3050',
        borderRadius: '16px',
        maxWidth: '360px',
        width: '100%',
        overflow: 'hidden',
        boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          borderTop: '3px solid #10b981',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1C3050',
          position: 'sticky',
          top: 0,
          background: '#0a1928',
          zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '6px', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', color: '#10b981', display: 'flex' }}>
              <CalendarCheck size={16} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.2 }}>Detalhes do agendamento</div>
              <div style={{ fontSize: '10px', color: '#4a6580', marginTop: '2px' }}>Visita técnica</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Status badge */}
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              color: sc.text,
              background: sc.bg,
              border: `1px solid ${sc.border}`,
              borderRadius: '20px',
              padding: '3px 8px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {STATUS_LABEL[appointment.status]}
            </span>
            <button
              onClick={onClose}
              style={{ color: '#4a6580', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', lineHeight: 1 }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Banner reagendamento */}
          {appointment.status === 'rescheduled' && appointment.proposed_by === 'client' && appointment.proposed_at && (
            <div style={{
              background: 'rgba(251,146,60,0.08)',
              border: '1px solid rgba(251,146,60,0.2)',
              borderRadius: '12px',
              padding: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <AlertTriangle size={14} style={{ color: '#fb923c', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#fb923c' }}>Cliente solicitou reagendamento para:</span>
              </div>
              <p style={{ fontSize: '12px', color: '#fdba74', marginBottom: '10px' }}>
                {format(new Date(appointment.proposed_at), "eeee, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { acceptMutation.mutate(appointment); onClose(); }}
                  disabled={anyPending}
                  style={{
                    flex: 1, background: '#10b981', color: '#000', fontWeight: 700,
                    fontSize: '12px', borderRadius: '10px', padding: '8px',
                    border: 'none', cursor: anyPending ? 'not-allowed' : 'pointer',
                    opacity: anyPending ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  <CheckCircle2 size={14} /> Aceitar
                </button>
                <button
                  onClick={() => { declineMutation.mutate(appointment); onClose(); }}
                  disabled={anyPending}
                  style={{
                    flex: 1, background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: 700,
                    fontSize: '12px', borderRadius: '10px', padding: '8px',
                    border: '1px solid rgba(239,68,68,0.2)', cursor: anyPending ? 'not-allowed' : 'pointer',
                    opacity: anyPending ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  <X size={14} /> Recusar
                </button>
              </div>
            </div>
          )}

          {/* ID */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#4a6580', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ID</span>
            <span style={{ fontSize: '11px', fontFamily: "'DM Mono', 'Courier New', monospace", color: '#64748b' }}>
              #{appointment.id.slice(0, 8)}
            </span>
          </div>

          {/* Card cliente */}
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Avatar */}
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, color: '#fff', fontSize: '12px', flexShrink: 0,
            }}>
              {getInitials(clientName)}
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {clientName}
              </div>
              {appointment.client?.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#4a6580' }}>
                  <Phone size={10} /> {appointment.client.phone}
                </div>
              )}
            </div>
            {/* Chat button */}
            <button
              type="button"
              onClick={() => {}}
              style={{
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 600,
                color: '#34d399', cursor: 'pointer', flexShrink: 0,
              }}
            >
              Chat
            </button>
          </div>

          {/* Card serviço */}
          <div style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={iconBadge('rgba(99,102,241,0.1)')}>
              <Wrench size={16} style={{ color: '#818cf8' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={lbl}>Serviço</span>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{appointment.title}</div>
              {appointment.description && (
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{appointment.description}</div>
              )}
            </div>
          </div>

          {/* Data + Horário */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={iconBadge('rgba(16,185,129,0.08)')}>
                <CalendarIcon size={14} style={{ color: '#34d399' }} />
              </div>
              <div>
                <span style={lbl}>Data</span>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                  {format(new Date(appointment.scheduled_at), 'dd/MM/yyyy')}
                </div>
              </div>
            </div>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={iconBadge('rgba(16,185,129,0.08)')}>
                <Clock size={14} style={{ color: '#34d399' }} />
              </div>
              <div>
                <span style={lbl}>Horário</span>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                  {format(new Date(appointment.scheduled_at), 'HH:mm')}
                </div>
              </div>
            </div>
          </div>

          {/* Endereço */}
          {appointment.location && (
            <div style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={iconBadge('rgba(251,191,36,0.08)')}>
                <MapPin size={14} style={{ color: '#fbbf24' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={lbl}>Endereço</span>
                <div style={{ fontSize: '12px', color: '#f1f5f9' }}>{appointment.location}</div>
              </div>
            </div>
          )}

          {/* Motivo cancelamento */}
          {appointment.cancelled_reason && (
            <div style={{
              background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: '12px', padding: '12px',
            }}>
              <span style={{ ...lbl, color: '#f87171' }}>Motivo do cancelamento</span>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>{appointment.cancelled_reason}</div>
            </div>
          )}

          {/* Botões de ação */}
          {isActive(appointment.status) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <button
                onClick={() => onUpdateStatus(appointment.id, 'completed', appointment.client_id)}
                disabled={anyPending}
                style={{
                  background: '#10b981', border: 'none', borderRadius: '12px', padding: '10px 4px',
                  cursor: anyPending ? 'not-allowed' : 'pointer', opacity: anyPending ? 0.5 : 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                }}
              >
                <CheckCircle2 size={16} style={{ color: '#000' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#000' }}>Concluir</span>
              </button>
              <button
                onClick={() => { onProposeOpen(appointment); onClose(); }}
                disabled={anyPending}
                style={{
                  background: '#070f1c', border: '1px solid #1C3050', borderRadius: '12px', padding: '10px 4px',
                  cursor: anyPending ? 'not-allowed' : 'pointer', opacity: anyPending ? 0.5 : 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                }}
              >
                <RefreshCw size={16} style={{ color: '#60a5fa' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa' }}>Nova data</span>
              </button>
              <button
                onClick={() => { onCancelTarget({ id: appointment.id, clientId: appointment.client_id }); onClose(); }}
                disabled={anyPending}
                style={{
                  background: '#070f1c', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '10px 4px',
                  cursor: anyPending ? 'not-allowed' : 'pointer', opacity: anyPending ? 0.5 : 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                }}
              >
                <Trash2 size={16} style={{ color: '#f87171' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#f87171' }}>Cancelar</span>
              </button>
            </div>
          )}

          {/* Status final */}
          {appointment.status === 'completed' && (
            <div style={{
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: '12px', padding: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              <CheckCircle2 size={16} style={{ color: '#34d399' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#34d399' }}>Atendimento Concluído</span>
            </div>
          )}
          {appointment.status === 'cancelled' && (
            <div style={{
              background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '12px', padding: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              <X size={16} style={{ color: '#f87171' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f87171' }}>Agendamento Cancelado</span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
