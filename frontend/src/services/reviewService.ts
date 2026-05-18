import { supabase } from '../lib/supabase';

export interface Review {
  id: string;
  client_id: string;
  professional_id: string;
  appointment_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  client_name?: string | null;
}

export interface ReviewsResult {
  reviews: Review[];
  average: number;
  total: number;
}

export const reviewService = {
  async submitReview(data: {
    client_id: string;
    professional_id: string;
    appointment_id: string;
    rating: number;
    comment?: string;
  }): Promise<Review> {
    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        client_id: data.client_id,
        professional_id: data.professional_id,
        appointment_id: data.appointment_id,
        rating: data.rating,
        comment: data.comment || null,
      })
      .select()
      .single();
    if (error) throw error;
    return review as Review;
  },

  async getReviewsByProfessional(professional_id: string): Promise<ReviewsResult> {
    const { data, error } = await supabase
      .from('reviews')
      .select('id,client_id,professional_id,appointment_id,rating,comment,created_at')
      .eq('professional_id', professional_id)
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    if (!data?.length) return { reviews: [], average: 0, total: 0 };

    const clientIds = [...new Set(data.map(r => r.client_id).filter(Boolean))];
    const { data: profiles } = clientIds.length
      ? await supabase.from('profiles').select('id,full_name').in('id', clientIds)
      : { data: [] };
    const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name]));

    const reviews: Review[] = data.map(r => ({
      ...r,
      client_name: nameMap[r.client_id] ?? null,
    }));

    const { data: stats } = await supabase
      .rpc('get_professional_review_stats', { p_professional_id: professional_id })
      .single();
    const total = Number((stats as { total_reviews?: number } | null)?.total_reviews ?? 0);
    const average = Number((stats as { avg_rating?: number } | null)?.avg_rating ?? 0);

    return { reviews, average, total };
  },

  async hasReview(appointment_id: string): Promise<boolean> {
    const { data } = await supabase
      .from('reviews')
      .select('id')
      .eq('appointment_id', appointment_id)
      .maybeSingle();
    return !!data;
  },
};
