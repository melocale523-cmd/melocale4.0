import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';

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
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'rescheduled';
  cancelled_reason: string | null;
  conversation_id: string | null;
  proposed_at: string | null;
  proposed_by: 'client' | 'professional' | null;
  client_id: string;
  professional_id: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  client?: AppointmentClient | null;
  professional?: AppointmentProfessional | null;
}

const APPT_SELECT = 'id,title,description,scheduled_at,duration_minutes,location,status,cancelled_reason,conversation_id,proposed_at,proposed_by,client_id,professional_id,confirmed_at,created_at,updated_at';

export const appointmentService = {
  async getProfessionalAppointments(professionalId: string): Promise<Appointment[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select(APPT_SELECT)
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
      .select(APPT_SELECT)
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

    void apiFetch('/api/notifications/send-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'appointment_created', resource_id: appt.id }),
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

    if (status === 'completed') {
      // Use SECURITY DEFINER RPC — professionals cannot UPDATE leads via RLS directly
      const { error: rpcErr } = await supabase.rpc('finalize_lead', { p_appointment_id: appointmentId });
      if (rpcErr) throw new Error(`Falha ao finalizar lead: ${rpcErr.message}`);
    }

    if (opts?.notifyUserId) {
      void apiFetch('/api/notifications/send-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: status === 'cancelled' ? 'appointment_cancelled' : 'appointment_updated',
          resource_id: appointmentId,
          ...(opts.cancelledReason ? { cancelled_reason: opts.cancelledReason } : {}),
        }),
      });
    }

    return appt as Appointment;
  },

  async proposeReschedule(
    appointmentId: string,
    proposedAt: string,
    proposedBy: 'client' | 'professional',
    notifyUserId?: string,
  ): Promise<Appointment> {
    const { data: appt, error } = await supabase
      .from('appointments')
      .update({
        status: 'rescheduled',
        proposed_at: proposedAt,
        proposed_by: proposedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .select()
      .single();
    if (error) throw error;

    if (notifyUserId) {
      void apiFetch('/api/notifications/send-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'appointment_updated', resource_id: appointmentId }),
      });
    }

    return appt as Appointment;
  },

  async acceptReschedule(
    appointmentId: string,
    notifyUserId?: string,
  ): Promise<Appointment> {
    // Read proposed_at first so we can move it to scheduled_at
    const { data: current, error: fetchErr } = await supabase
      .from('appointments')
      .select('proposed_at,proposed_by,client_id,professional_id')
      .eq('id', appointmentId)
      .single();
    if (fetchErr) throw fetchErr;
    if (!current?.proposed_at) throw new Error('Nenhuma proposta de reagendamento encontrada.');

    const { data: appt, error } = await supabase
      .from('appointments')
      .update({
        status: 'confirmed',
        scheduled_at: current.proposed_at,
        proposed_at: null,
        proposed_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .select()
      .single();
    if (error) throw error;

    if (notifyUserId) {
      void apiFetch('/api/notifications/send-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'appointment_updated', resource_id: appointmentId }),
      });
    }

    return appt as Appointment;
  },

  async declineReschedule(
    appointmentId: string,
    notifyUserId?: string,
  ): Promise<Appointment> {
    const { data: appt, error } = await supabase
      .from('appointments')
      .update({
        status: 'confirmed',
        proposed_at: null,
        proposed_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .select()
      .single();
    if (error) throw error;

    if (notifyUserId) {
      void apiFetch('/api/notifications/send-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'appointment_updated', resource_id: appointmentId }),
      });
    }

    return appt as Appointment;
  },
};
