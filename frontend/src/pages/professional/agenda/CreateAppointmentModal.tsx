import { useState, type FormEvent, type CSSProperties } from 'react';
import { format } from 'date-fns';
import { X, CalendarPlus, CalendarCheck, Loader2, MapPin, Star } from 'lucide-react';
import { toast } from 'sonner';
import type { AvailableClient } from '../../../hooks/useAgendaData';
import type { appointmentService } from '../../../services/appointmentService';

type CreatePayload = Parameters<typeof appointmentService.createAppointment>[0];

interface CreateAppointmentModalProps {
  initialDate?: string;
  availableClients: AvailableClient[];
  onClose: () => void;
  onSubmit: (payload: CreatePayload) => void;
  isPending: boolean;
  professionalId: string;
}

interface FormData {
  title: string;
  serviceType: string;
  clientId: string;
  conversationId: string;
  date: string;
  time: string;
  location: string;
  description: string;
  duration: string;
  estimatedValue: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
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

export function CreateAppointmentModal({
  initialDate,
  availableClients,
  onClose,
  onSubmit,
  isPending,
  professionalId,
}: CreateAppointmentModalProps) {
  const today = format(new Date(), 'yyyy-MM-dd');

  const [formData, setFormData] = useState<FormData>({
    title: '',
    serviceType: '',
    clientId: '',
    conversationId: '',
    date: initialDate ?? today,
    time: '09:00',
    location: '',
    description: '',
    duration: '1h',
    estimatedValue: '',
  });

  const selectedClient = availableClients.find(c => c.clientId === formData.clientId);

  const handleClientChange = (value: string) => {
    const c = availableClients.find(cl => cl.clientId === value);
    const cityState = [c?.clientCity, c?.clientState].filter(Boolean).join(' - ');
    const clientLocation = [
      c?.clientStreet,
      c?.clientNumber,
      c?.clientBlock,
      c?.clientNeighborhood,
      cityState,
    ].filter(Boolean).join(', ');
    setFormData(prev => ({
      ...prev,
      clientId: value,
      conversationId: c?.conversationId || '',
      location: clientLocation || prev.location,
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.clientId) {
      toast.error('Preencha título e cliente');
      return;
    }
    onSubmit({
      professional_id: professionalId,
      client_id: formData.clientId,
      conversation_id: formData.conversationId || undefined,
      scheduled_at: new Date(`${formData.date}T${formData.time}:00`).toISOString(),
      title: formData.title,
      location: formData.location || undefined,
      description: formData.description || undefined,
    });
  };

  const clientCityState = selectedClient
    ? [selectedClient.clientCity, selectedClient.clientState].filter(Boolean).join(' - ')
    : '';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      {/* Overlay */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />

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
          padding: '18px 20px',
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
              <CalendarPlus size={16} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.2 }}>Novo agendamento</div>
              <div style={{ fontSize: '10px', color: '#4a6580', marginTop: '2px' }}>Agendar visita técnica</div>
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
        <form onSubmit={handleSubmit} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '13px' }}>

          {/* Tipo de serviço + Título */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>Tipo de serviço</label>
              <select
                value={formData.serviceType}
                onChange={e => setFormData(prev => ({ ...prev, serviceType: e.target.value }))}
                style={field}
              >
                <option value="">Selecionar...</option>
                <option value="eletrico">Elétrico</option>
                <option value="hidraulico">Hidráulico</option>
                <option value="pintura">Pintura</option>
                <option value="marcenaria">Marcenaria</option>
                <option value="ar_condicionado">Ar condicionado</option>
                <option value="serralheria">Serralheria</option>
                <option value="geral">Geral/Outro</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Título / Serviço *</label>
              <input
                type="text"
                required
                placeholder="Ex: Instalação elétrica"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                maxLength={255}
                style={field}
              />
            </div>
          </div>

          {/* Cliente */}
          <div>
            <label style={lbl}>Cliente *</label>
            {availableClients.length === 0 ? (
              <div style={{ ...field, color: '#4a6580', fontSize: '12px' }}>
                Sem clientes disponíveis. Adquira leads primeiro.
              </div>
            ) : (
              <select
                required
                value={formData.clientId}
                onChange={e => handleClientChange(e.target.value)}
                style={{
                  ...field,
                  color: formData.clientId ? '#10b981' : '#4a6580',
                  fontWeight: formData.clientId ? 600 : 400,
                }}
              >
                <option value="">Selecione um cliente...</option>
                {availableClients.map(c => (
                  <option key={c.clientId} value={c.clientId}>{c.clientName}</option>
                ))}
              </select>
            )}
          </div>

          {/* Card do cliente */}
          {formData.clientId && selectedClient && (
            <div style={{
              background: '#070f1c',
              border: '1px solid #1C3050',
              borderRadius: '12px',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              {/* Avatar */}
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: '#fff',
                fontSize: '11px',
                flexShrink: 0,
              }}>
                {getInitials(selectedClient.clientName)}
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedClient.clientName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {clientCityState && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#4a6580' }}>
                      <MapPin size={10} />
                      {clientCityState}
                    </span>
                  )}
                  <span style={{ color: '#1C3050', fontSize: '10px' }}>·</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px' }}>
                    <Star size={10} fill="#fbbf24" color="#fbbf24" />
                    <span style={{ color: '#94a3b8' }}>4.8</span>
                  </span>
                  <span style={{ fontSize: '10px', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '1px 6px', borderRadius: '20px' }}>
                    — pedidos
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Data + Horário */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>Data *</label>
              <input
                type="date"
                required
                min={today}
                value={formData.date}
                onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                style={field}
              />
            </div>
            <div>
              <label style={lbl}>Horário *</label>
              <input
                type="time"
                required
                value={formData.time}
                onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                style={field}
              />
            </div>
          </div>

          {/* Duração + Valor estimado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>Duração estimada</label>
              <select
                value={formData.duration}
                onChange={e => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                style={field}
              >
                <option value="30min">30 min</option>
                <option value="1h">1 hora</option>
                <option value="2h">2 horas</option>
                <option value="3h">3 horas</option>
                <option value="dia_todo">Dia todo</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Valor estimado R$</label>
              <input
                type="text"
                placeholder="0,00"
                value={formData.estimatedValue}
                onChange={e => setFormData(prev => ({ ...prev, estimatedValue: e.target.value }))}
                style={{ ...field, fontFamily: "'DM Mono', 'Courier New', monospace" }}
              />
            </div>
          </div>

          {/* Endereço */}
          <div>
            <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={10} /> Endereço
            </label>
            <input
              type="text"
              placeholder="Rua, número, bairro..."
              value={formData.location}
              onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
              maxLength={255}
              style={field}
            />
          </div>

          {/* Observações */}
          <div>
            <label style={lbl}>Observações</label>
            <textarea
              rows={2}
              placeholder="Detalhes do serviço..."
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              maxLength={500}
              style={{ ...field, resize: 'none' }}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending || availableClients.length === 0}
            style={{
              width: '100%',
              background: '#10b981',
              color: '#000',
              fontWeight: 700,
              fontSize: '13px',
              borderRadius: '12px',
              padding: '10px',
              border: 'none',
              cursor: isPending || availableClients.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isPending || availableClients.length === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'opacity 0.2s',
            }}
          >
            {isPending
              ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <CalendarCheck size={14} />}
            {isPending ? 'Salvando...' : 'Finalizar agendamento'}
          </button>
        </form>
      </div>
    </div>
  );
}
