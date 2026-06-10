import { useState } from 'react';
import { format } from 'date-fns';
import { X, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CSSProperties } from 'react';
import type { Appointment } from '../../../services/appointmentService';

interface ProposeRescheduleModalProps {
  appointment: Appointment;
  onClose: () => void;
  onSubmit: (appt: Appointment, proposedAt: string) => void;
  isPending: boolean;
}

const field: CSSProperties = {
  background: '#070f1c',
  border: '1px solid #1C3050',
  borderRadius: '10px',
  padding: '9px 12px',
  color: '#f1f5f9',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const lbl: CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 600,
  color: '#4a6580',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '5px',
};

export function ProposeRescheduleModal({
  appointment,
  onClose,
  onSubmit,
  isPending,
}: ProposeRescheduleModalProps) {
  const [proposeDate, setProposeDate] = useState('');
  const [proposeTime, setProposeTime] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd');

  const handleSubmit = () => {
    if (!proposeDate || !proposeTime) {
      toast.error('Preencha data e horário.');
      return;
    }
    onSubmit(appointment, new Date(`${proposeDate}T${proposeTime}`).toISOString());
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      {/* Overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />

      {/* Modal */}
      <div style={{
        position: 'relative',
        background: '#0a1928',
        border: '1px solid #1C3050',
        borderRadius: '16px',
        maxWidth: '340px',
        width: '100%',
        overflow: 'hidden',
        boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          borderTop: '3px solid #60a5fa',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1C3050',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '6px', background: 'rgba(96,165,250,0.1)', borderRadius: '8px', color: '#60a5fa', display: 'flex' }}>
              <RefreshCw size={16} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.2 }}>Propor nova data</div>
              <div style={{ fontSize: '10px', color: '#4a6580', marginTop: '2px' }}>O cliente deverá aceitar ou recusar</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: '#4a6580', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', lineHeight: 1 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>Nova data</label>
              <input
                type="date"
                min={today}
                value={proposeDate}
                onChange={e => setProposeDate(e.target.value)}
                style={field}
              />
            </div>
            <div>
              <label style={lbl}>Novo horário</label>
              <input
                type="time"
                value={proposeTime}
                onChange={e => setProposeTime(e.target.value)}
                style={field}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSubmit}
              disabled={isPending || !proposeDate || !proposeTime}
              style={{
                flex: 1, background: '#3b82f6', color: '#fff', fontWeight: 700,
                fontSize: '13px', borderRadius: '12px', padding: '10px',
                border: 'none', cursor: isPending || !proposeDate || !proposeTime ? 'not-allowed' : 'pointer',
                opacity: isPending || !proposeDate || !proposeTime ? 0.5 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                transition: 'opacity 0.2s',
              }}
            >
              {isPending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
              Enviar proposta
            </button>
            <button
              onClick={onClose}
              style={{
                background: '#070f1c', border: '1px solid #1C3050', borderRadius: '12px',
                padding: '10px 16px', fontSize: '13px', fontWeight: 600,
                color: '#4a6580', cursor: 'pointer',
              }}
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
