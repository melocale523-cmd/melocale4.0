import { supabase } from '../lib/supabase';

export interface AppointmentClient {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
}

export interface AppointmentProfessionalProfile {
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
}

export interface AppointmentProfessional {
  id: string;
  user_id: string;
  category: string | null;
  profile: AppointmentProfessionalProfile | null;
}

export interface Appointment {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  cancelled_reason: string | null;
  conversation_id: string | null;
  client_id: string;
  professional_id: string;
  created_at: string;
  updated_at: string;
  client?: AppointmentClient | null;
  professional?: AppointmentProfessional | null;
}

export const appointmentService = {
  async getProfessionalAppointments(professionalId: string): Promise<Appointment[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select('id,title,description,scheduled_at,duration_minutes,location,status,cancelled_reason,conversation_id,client_id,professional_id,created_at,updated_at')
      .eq('professional_id', professionalId)
      .order('scheduled_at', { ascending: true });
    if (error) throw error;
    if (!data?.length) return [];

    const clientIds = [...new Set(data.map(a => a.client_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id,full_name,avatar_url,phone')
      .in('id', clientIds);
    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    return data.map(a => ({ ...a, client: profileMap[a.client_id] ?? null })) as Appointment[];
  },

  async getClientAppointments(clientUserId: string): Promise<Appointment[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select('id,title,description,scheduled_at,duration_minutes,location,status,cancelled_reason,conversation_id,professional_id,client_id,created_at,updated_at')
      .eq('client_id', clientUserId)
      .order('scheduled_at', { ascending: true });
    if (error) throw error;
    if (!data?.length) return [];

    const profIds = [...new Set(data.map(a => a.professional_id))];
    const { data: professionals } = await supabase
      .from('professionals')
      .select('id,user_id,category')
      .in('id', profIds);
    const profMap = Object.fromEntries((professionals ?? []).map(p => [p.id, p]));

    const userIds = (professionals ?? []).map(p => p.user_id).filter(Boolean);
    const { data: profProfiles } = userIds.length
      ? await supabase.from('profiles').select('id,full_name,avatar_url,city').in('id', userIds)
      : { data: [] };
    const profProfileMap = Object.fromEntries((profProfiles ?? []).map(p => [p.id, p]));

    return data.map(a => {
      const prof = profMap[a.professional_id];
      return {
        ...a,
        professional: prof
          ? { ...prof, profile: profProfileMap[prof.user_id] ?? null }
          : null,
      };
    }) as Appointment[];
  },

  async createAppointment(payload: {
    professional_id: string;
    client_id: string;
    conversation_id?: string;
    scheduled_at: string;
    title: string;
    location?: string;
    description?: string;
    duration_minutes?: number;
  }): Promise<Appointment> {
    const { data: appt, error } = await supabase
      .from('appointments')
      .insert({ ...payload, status: 'scheduled' })
      .select()
      .single();
    if (error) throw error;

    const dt = new Date(payload.scheduled_at);
    void supabase.from('notifications').insert({
      user_id: payload.client_id,
      title: 'Novo agendamento',
      body: `Visita agendada para ${dt.toLocaleDateString('pt-BR')} às ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      data: { appointment_id: appt.id, type: 'appointment' },
    });

    return appt as Appointment;
  },

  async updateAppointmentStatus(
    appointmentId: string,
    status: 'confirmed' | 'cancelled' | 'completed',
    opts?: { cancelledReason?: string; notifyUserId?: string }
  ): Promise<Appointment> {
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (opts?.cancelledReason !== undefined) updates.cancelled_reason = opts.cancelledReason;

    const { data: appt, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', appointmentId)
      .select()
      .single();
    if (error) throw error;

    // B: appointment completed → lead finalizado (via conversation.lead_id)
    if (status === 'completed' && (appt as Appointment).conversation_id) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('lead_id')
        .eq('id', (appt as Appointment).conversation_id as string)
        .maybeSingle();
      if (conv?.lead_id) {
        void supabase.from('leads').update({ status: 'finalizado' }).eq('id', conv.lead_id);
      }
    }

    if (opts?.notifyUserId) {
      const labels: Record<string, string> = {
        confirmed: 'Agendamento confirmado ✅',
        cancelled: 'Agendamento cancelado',
        completed: 'Atendimento concluído ✅',
      };
      void supabase.from('notifications').insert({
        user_id: opts.notifyUserId,
        title: labels[status] ?? 'Agendamento atualizado',
        body: opts.cancelledReason ? `Motivo: ${opts.cancelledReason}` : 'Status do agendamento foi atualizado',
        data: { appointment_id: appointmentId, type: 'appointment' },
      });
    }

    return appt as Appointment;
  },
};
