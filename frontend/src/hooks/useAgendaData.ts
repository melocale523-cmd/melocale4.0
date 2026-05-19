import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { appointmentService, type Appointment } from '../services/appointmentService';

export interface AvailableClient {
  conversationId: string;
  clientId: string;
  clientName: string;
  clientCity: string;
}

interface UseAgendaDataParams {
  userId: string | undefined;
}

export function useAgendaData({ userId }: UseAgendaDataParams) {
  const queryClient = useQueryClient();

  const { data: professional } = useQuery({
    queryKey: ['my_professional_id', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('professionals')
        .select('id')
        .eq('user_id', userId!)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['professional_appointments', professional?.id],
    queryFn: () => appointmentService.getProfessionalAppointments(professional!.id),
    enabled: !!professional?.id,
  });

  const { data: availableClients = [] } = useQuery<AvailableClient[]>({
    queryKey: ['schedule_clients', professional?.id],
    queryFn: async () => {
      const { data: purchases } = await supabase
        .from('lead_purchases')
        .select('client_id')
        .eq('professional_id', professional!.id);
      if (!purchases?.length) return [];

      const seen = new Set<string>();
      const uniqueClientIds = purchases
        .map(p => p.client_id)
        .filter(id => { if (seen.has(id)) return false; seen.add(id); return true; });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id,full_name,city')
        .in('id', uniqueClientIds);
      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

      return uniqueClientIds.map(clientId => ({
        conversationId: '',
        clientId,
        clientName: profileMap[clientId]?.full_name || 'Cliente',
        clientCity: profileMap[clientId]?.city || '',
      }));
    },
    enabled: !!professional?.id,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['professional_appointments', professional?.id] });

  const createMutation = useMutation({
    mutationFn: appointmentService.createAppointment,
    onSuccess: () => { invalidate(); toast.success('Agendamento criado com sucesso!'); },
    onError: () => toast.error('Erro ao criar agendamento'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, notifyUserId }: { id: string; status: 'confirmed' | 'cancelled' | 'completed'; notifyUserId?: string }) =>
      appointmentService.updateAppointmentStatus(id, status, { notifyUserId }),
    onSuccess: (_, { status }) => {
      invalidate();
      if (status === 'completed') toast.success('Compromisso concluído!');
      else if (status === 'cancelled') toast.info('Compromisso cancelado');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const proposeMutation = useMutation({
    mutationFn: ({ appt, proposedAt }: { appt: Appointment; proposedAt: string }) =>
      appointmentService.proposeReschedule(appt.id, proposedAt, 'professional', appt.client_id),
    onSuccess: () => { invalidate(); toast.success('Proposta de reagendamento enviada!'); },
    onError: () => toast.error('Erro ao propor reagendamento'),
  });

  const acceptMutation = useMutation({
    mutationFn: (appt: Appointment) =>
      appointmentService.acceptReschedule(appt.id, appt.client_id),
    onSuccess: () => { invalidate(); toast.success('Reagendamento aceito!'); },
    onError: () => toast.error('Erro ao aceitar reagendamento'),
  });

  const declineMutation = useMutation({
    mutationFn: (appt: Appointment) =>
      appointmentService.declineReschedule(appt.id, appt.client_id),
    onSuccess: () => { invalidate(); toast.info('Reagendamento recusado.'); },
    onError: () => toast.error('Erro ao recusar reagendamento'),
  });

  const anyPending =
    updateMutation.isPending ||
    proposeMutation.isPending ||
    acceptMutation.isPending ||
    declineMutation.isPending;

  return {
    professional,
    appointments,
    isLoading,
    availableClients,
    createMutation,
    updateMutation,
    proposeMutation,
    acceptMutation,
    declineMutation,
    anyPending,
  };
}
