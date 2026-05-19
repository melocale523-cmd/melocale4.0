import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface ProfissionalResult {
  id: string;
  userId: string;
  bio: string | null;
  category: string | null;
  city: string | null;
  fullName: string;
  avatarUrl: string | null;
  avgRating: number;
  reviewCount: number;
}

export interface BuscaFilters {
  search: string;
  category: string;
  city: string;
}

export function useBuscaProfissionais(filters: BuscaFilters, userId: string | undefined) {
  const [debounced, setDebounced] = useState<BuscaFilters>(filters);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters), 300);
    return () => clearTimeout(t);
  }, [filters.search, filters.category, filters.city]);

  return useQuery({
    queryKey: ['busca_profissionais', userId, debounced],
    queryFn: async (): Promise<ProfissionalResult[]> => {
      let q = supabase
        .from('professionals')
        .select('id, user_id, bio, category, city')
        .eq('is_active', true)
        .eq('onboarding_completed', true);

      if (debounced.category) {
        q = q.eq('category', debounced.category);
      }
      if (debounced.city) {
        q = q.ilike('city', `%${debounced.city}%`);
      }

      const { data: professionals, error } = await q.limit(100);
      if (error) throw error;
      if (!professionals?.length) return [];

      const userIds = professionals.map((p: { user_id: string }) => p.user_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> =
        Object.fromEntries(
          (profiles ?? []).map((p: { id: string; full_name: string | null; avatar_url: string | null }) => [
            p.id,
            p,
          ]),
        );

      type ProfRow = { id: string; user_id: string; bio: string | null; category: string | null; city: string | null };

      let matched = (professionals as ProfRow[]).map(p => ({
        ...p,
        fullName: profileMap[p.user_id]?.full_name ?? '',
        avatarUrl: profileMap[p.user_id]?.avatar_url ?? null,
      }));

      if (debounced.search) {
        const term = debounced.search.toLowerCase();
        matched = matched.filter(
          p =>
            p.fullName.toLowerCase().includes(term) ||
            (p.category ?? '').toLowerCase().includes(term),
        );
      }

      if (!matched.length) return [];

      const profIds = matched.map(p => p.id);
      const { data: reviews } = await supabase
        .from('reviews')
        .select('professional_id, rating')
        .in('professional_id', profIds);

      const reviewMap: Record<string, { total: number; count: number }> = {};
      (reviews ?? []).forEach((r: { professional_id: string; rating: number }) => {
        if (!reviewMap[r.professional_id]) reviewMap[r.professional_id] = { total: 0, count: 0 };
        reviewMap[r.professional_id].total += r.rating;
        reviewMap[r.professional_id].count += 1;
      });

      const result: ProfissionalResult[] = matched.map(p => {
        const stats = reviewMap[p.id];
        const reviewCount = stats?.count ?? 0;
        const avgRating = reviewCount > 0 ? stats.total / reviewCount : 0;
        return {
          id: p.id,
          userId: p.user_id,
          bio: p.bio,
          category: p.category,
          city: p.city,
          fullName: p.fullName,
          avatarUrl: p.avatarUrl,
          avgRating,
          reviewCount,
        };
      });

      result.sort((a, b) =>
        b.avgRating !== a.avgRating ? b.avgRating - a.avgRating : b.reviewCount - a.reviewCount,
      );

      return result.slice(0, 50);
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}
