import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface ReviewableInfo {
  appointmentId: string;
  professionalId: string;
  professionalName: string;
  hasReview: boolean;
}

export function useLeadReviewable(
  finalizedLeadIds: string[],
  userId: string | undefined,
): { data: Record<string, ReviewableInfo> | undefined } {
  return useQuery({
    queryKey: ['lead_reviewable', userId, finalizedLeadIds],
    queryFn: async (): Promise<Record<string, ReviewableInfo>> => {
      if (!finalizedLeadIds.length) return {};

      const { data: convs, error: convsErr } = await supabase
        .from('conversations')
        .select('id, lead_id')
        .in('lead_id', finalizedLeadIds);
      if (convsErr) throw convsErr;
      if (!convs?.length) return {};

      const convIds = convs.map((c: { id: string; lead_id: string }) => c.id);
      const convLeadMap: Record<string, string> = {};
      convs.forEach((c: { id: string; lead_id: string }) => {
        convLeadMap[c.id] = c.lead_id;
      });

      const { data: appointments, error: apptsErr } = await supabase
        .from('appointments')
        .select('id, professional_id, conversation_id')
        .in('conversation_id', convIds)
        .eq('status', 'completed');
      if (apptsErr) throw apptsErr;
      if (!appointments?.length) return {};

      const profIds = [
        ...new Set(
          appointments.map((a: { professional_id: string }) => a.professional_id),
        ),
      ];
      const apptIds = appointments.map((a: { id: string }) => a.id);

      const { data: professionals } = await supabase
        .from('professionals')
        .select('id, user_id')
        .in('id', profIds);

      const userIds = (professionals ?? [])
        .map((p: { user_id: string }) => p.user_id)
        .filter(Boolean);

      const { data: profiles } = userIds.length
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds)
        : { data: [] };

      const profUserMap: Record<string, string> = Object.fromEntries(
        (professionals ?? []).map((p: { id: string; user_id: string }) => [p.id, p.user_id]),
      );
      const nameMap: Record<string, string> = Object.fromEntries(
        (profiles ?? []).map((p: { id: string; full_name: string | null }) => [
          p.id,
          p.full_name ?? 'Profissional',
        ]),
      );

      const { data: existingReviews } = await supabase
        .from('reviews')
        .select('appointment_id')
        .in('appointment_id', apptIds);

      const reviewedSet = new Set(
        (existingReviews ?? []).map(
          (r: { appointment_id: string }) => r.appointment_id,
        ),
      );

      const result: Record<string, ReviewableInfo> = {};
      for (const appt of appointments as {
        id: string;
        professional_id: string;
        conversation_id: string;
      }[]) {
        const leadId = convLeadMap[appt.conversation_id];
        if (!leadId) continue;
        const profUserId = profUserMap[appt.professional_id];
        result[leadId] = {
          appointmentId: appt.id,
          professionalId: appt.professional_id,
          professionalName: nameMap[profUserId] ?? 'Profissional',
          hasReview: reviewedSet.has(appt.id),
        };
      }
      return result;
    },
    enabled: !!userId && finalizedLeadIds.length > 0,
  });
}
