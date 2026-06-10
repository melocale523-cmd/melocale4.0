import { useState, useEffect, type FormEvent, type CSSProperties } from 'react';
import { X, CalendarPlus, CalendarCheck, Loader2, MapPin, Bell, Star } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useMutation, useQuery } from '@tanstack/react-query';
import { appointmentService } from '../../services/dbServices';
import { supabase } from '../../lib/supabase';

interface ChatScheduleModalProps {
  open: boolean;
  onClose: () => void;
  professionalId: string;
  clientId: string;
  clientName: string;
  conversationId: string;
}

interface ScheduleForm {
  title: string;
  date: string;
  time: string;
  location: string;
  serviceType: string;
  duration: string;
  estimatedValue: string;
  notes: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const field: CSSProperties = {
  background: '#070f1c',
  border: '1px solid #1C3050',
  borderRadius: '12px',
  padding: '10px 12px',
  fontSize: '13px',
  color: '#f1f5f9',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const label: CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  color: '#4a6580',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  display: 'block',
  marginBottom: '4px',
};

export function ChatScheduleModal({
  open,
  onClose,
  professionalId,
  clientId,
  clientName,
  conversationId,
}: ChatScheduleModalProps) {
  const [form, setForm] = useState<ScheduleForm>({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    location: '',
    serviceType: '',
    duration: '1h',
    estimatedValue: '',
    notes: '',
  });

  const [notifyClient, setNotifyClient] = useState(true);

  const { data: clientData } = useQuery({
    queryKey: ['client_address', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('full_name,address_street,address_number,address_block,address_neighborhood,city,state')
        .eq('id', clientId)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: activeLead } = useQuery({
    queryKey: ['client_active_lead', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('id,title,status')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });

  // Pre-fill location whenever the modal opens or the address loads.
  useEffect(() => {
    if (!open || !clientData) return;
    const cityState = [clientData.city, clientData.state].filter(Boolean).join(' - ');
    const location = [
      clientData.address_street,
      clientData.address_number ? `Nº ${clientData.address_number}` : null,
      clientData.address_block ? `Bloco ${clientData.address_block}` : null,
      clientData.address_neighborhood,
      cityState,
    ].filter(Boolean).join(', ');
    if (location) setForm(prev => ({ ...prev, location }));
  }, [clientData, open]);

  const scheduleMutation = useMutation({
    mutationFn: () =>
      (appointmentService.createAppointment as (p: Record<string, unknown>) => Promise<unknown>)({
        professional_id: professionalId,
        client_id: clientId,
        conversation_id: conversationId,
        scheduled_at: new Date(`${form.date}T${form.time}:00`).toISOString(),
        title: form.title,
        location: form.location || undefined,
        service_type: form.serviceType || undefined,
        estimated_value: form.estimatedValue
          ? parseFloat(form.estimatedValue.replace(',', '.'))
          : undefined,
        duration: form.duration || undefined,
        notes: form.notes || undefined,
        notify_client: notifyClient,
      }),
    onSuccess: () => {
      toast.success('Agendamento criado! O cliente foi notificado.');
      setForm({
        title: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        location: '',
        serviceType: '',
        duration: '1h',
        estimatedValue: '',
        notes: '',
      });
      onClose();
    },
    onError: () => toast.error('Erro ao criar agendamento'),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title) { toast.error('Informe o título do serviço'); return; }
    scheduleMutation.mutate();
  };

  if (!open) return null;

  const initials = getInitials(clientName);
  const cityState = clientData
    ? [clientData.city, clientData.state].filter(Boolean).join(' - ')
    : '';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      {/* Overlay */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
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
      }}>
        {/* Header */}
        <div style={{
          borderTop: '3px solid #10b981',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1C3050',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '6px', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', color: '#10b981', display: 'flex' }}>
              <CalendarPlus size={16} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.2 }}>Agendar visita</div>
              <div style={{ fontSize: '10px', color: '#4a6580', marginTop: '2px' }}>Visita técnica agendada</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: '#4a6580', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', lineHeight: 1 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Client card */}
        <div style={{ background: '#070f1c', padding: '14px 20px', borderBottom: '1px solid #1C3050', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            {/* Avatar */}
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: '#fff',
              fontSize: '12px',
              flexShrink: 0,
            }}>
              {initials}
            </div>
            {/* Info */}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {clientName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {cityState && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#4a6580' }}>
                    <MapPin size={11} />
                    {cityState}
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px' }}>
                  <Star size={11} fill="#fbbf24" color="#fbbf24" />
                  <span style={{ color: '#94a3b8' }}>4.8</span>
                </span>
                <span style={{ fontSize: '10px', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '1px 6px', borderRadius: '20px' }}>
                  3 pedidos
                </span>
              </div>
            </div>
          </div>
          {/* Active lead */}
          {activeLead && (
            <div style={{ textAlign: 'right', flexShrink: 0, maxWidth: '110px' }}>
              <div style={{ fontSize: '10px', color: '#4a6580', marginBottom: '2px' }}>Pedido ativo</div>
              <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeLead.title || 'Sem título'}
              </div>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
          {/* Tipo de serviço */}
          <div>
            <label style={label}>Tipo de serviço</label>
            <select
              value={form.serviceType}
              onChange={e => setForm({ ...form, serviceType: e.target.value })}
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

          {/* Título */}
          <div>
            <label style={label}>Título do serviço *</label>
            <input
              type="text"
              required
              placeholder="Ex: Instalação elétrica"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              style={field}
            />
          </div>

          {/* Data + Horário */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={label}>Data *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                style={field}
              />
            </div>
            <div>
              <label style={label}>Horário *</label>
              <input
                type="time"
                required
                value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
                style={field}
              />
            </div>
          </div>

          {/* Duração + Valor estimado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={label}>Duração estimada</label>
              <select
                value={form.duration}
                onChange={e => setForm({ ...form, duration: e.target.value })}
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
              <label style={label}>Valor estimado R$</label>
              <input
                type="text"
                placeholder="0,00"
                value={form.estimatedValue}
                onChange={e => setForm({ ...form, estimatedValue: e.target.value })}
                style={{ ...field, fontFamily: "'DM Mono', 'Courier New', monospace" }}
              />
            </div>
          </div>

          {/* Endereço */}
          <div>
            <label style={{ ...label, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={10} /> Endereço
            </label>
            <input
              type="text"
              placeholder="Rua, número, bairro..."
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              style={field}
            />
          </div>

          {/* Nota interna */}
          <div>
            <label style={label}>Nota interna</label>
            <textarea
              rows={2}
              placeholder="Observações privadas sobre a visita..."
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              style={{ ...field, resize: 'none' }}
            />
          </div>

          {/* Toggle notificação */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(16,185,129,0.05)',
            border: '1px solid rgba(16,185,129,0.15)',
            borderRadius: '12px',
            padding: '10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={14} style={{ color: '#10b981', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9' }}>Notificar cliente</div>
                <div style={{ fontSize: '10px', color: '#4a6580' }}>WhatsApp + notificação no app</div>
              </div>
            </div>
            {/* Toggle pill */}
            <button
              type="button"
              onClick={() => setNotifyClient(v => !v)}
              style={{
                width: '34px',
                height: '20px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                background: notifyClient ? '#10b981' : '#1C3050',
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute',
                top: '3px',
                left: notifyClient ? '17px' : '3px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                display: 'block',
              }} />
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={scheduleMutation.isPending}
            style={{
              width: '100%',
              background: '#10b981',
              color: '#000',
              fontWeight: 700,
              fontSize: '13px',
              borderRadius: '12px',
              padding: '10px',
              border: 'none',
              cursor: scheduleMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: scheduleMutation.isPending ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'opacity 0.2s',
            }}
          >
            {scheduleMutation.isPending
              ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <CalendarCheck size={14} />}
            {scheduleMutation.isPending ? 'Salvando...' : 'Criar agendamento'}
          </button>
        </form>
      </div>
    </div>
  );
}
