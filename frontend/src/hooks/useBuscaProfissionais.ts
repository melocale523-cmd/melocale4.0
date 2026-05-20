import { useState, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
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
  createdAt: string;
}

export interface BuscaParams {
  query: string;
  category: string;
  city: string;
  minRating: number;
  sortBy: 'rating' | 'city' | 'created_at';
}

const PAGE_SIZE = 20;

type ProfRow = {
  id: string;
  user_id: string;
  bio: string | null;
  category: string | null;
  city: string | null;
  created_at: string;
  rating_avg: number | string | null;
  review_count: number | null;
};

type ProfileRow = { id: string; full_name: string | null; avatar_url: string | null };

export function useBuscaProfissionais(params: BuscaParams, userId: string | undefined) {
  const [debounced, setDebounced] = useState<BuscaParams>(params);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(params), 300);
    return () => clearTimeout(t);
  }, [params.query, params.category, params.city, params.minRating, params.sortBy]);

  const result = useInfiniteQuery({
    queryKey: [
      'busca-profissionais',
      userId,
      debounced.query,
      debounced.category,
      debounced.city,
      debounced.minRating,
      debounced.sortBy,
    ],
    queryFn: async ({ pageParam }): Promise<ProfissionalResult[]> => {
      const offset = pageParam;

      // Query the professionals_with_rating view. Since the supabase client is created
      // without a typed Database generic, any table/column string is accepted.
      let q = supabase
        .from('professionals_with_rating' as never)
        .select('id, user_id, bio, category, city, created_at, rating_avg, review_count')
        .eq('is_active', true)
        .eq('onboarding_completed', true);

      if (debounced.category) q = q.eq('category', debounced.category);
      if (debounced.city) q = q.ilike('city', `%${debounced.city}%`);
      if (debounced.minRating > 0) q = q.gte('rating_avg', debounced.minRating);

      if (debounced.sortBy === 'rating') {
        q = q.order('rating_avg', { ascending: false }).order('created_at', { ascending: false });
      } else if (debounced.sortBy === 'city') {
        q = q.order('city', { ascending: true }).order('created_at', { ascending: false });
      } else {
        q = q.order('created_at', { ascending: false });
      }

      const { data: rawData, error } = await q.range(offset, offset + PAGE_SIZE - 1);

      if (error) throw new Error(error.message);
      if (!rawData?.length) return [];

      const rows = rawData as unknown as ProfRow[];
      const userIds = rows.map(p => p.user_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> =
        Object.fromEntries(
          ((profiles ?? []) as ProfileRow[]).map(p => [
            p.id,
            { full_name: p.full_name, avatar_url: p.avatar_url },
          ]),
        );

      let merged: ProfissionalResult[] = rows.map(p => ({
        id: p.id,
        userId: p.user_id,
        bio: p.bio,
        category: p.category,
        city: p.city,
        fullName: profileMap[p.user_id]?.full_name ?? '',
        avatarUrl: profileMap[p.user_id]?.avatar_url ?? null,
        avgRating: Number(p.rating_avg ?? 0),
        reviewCount: Number(p.review_count ?? 0),
        createdAt: p.created_at,
      }));

      if (debounced.query) {
        const term = debounced.query.toLowerCase();
        merged = merged.filter(
          p =>
            p.fullName.toLowerCase().includes(term) ||
            (p.category ?? '').toLowerCase().includes(term),
        );
      }

      return merged;
    },
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length === PAGE_SIZE ? lastPageParam + PAGE_SIZE : undefined,
    initialPageParam: 0,
    enabled: !!userId,
    staleTime: 30_000,
  });

  return {
    profissionais: result.data?.pages.flat() ?? [],
    isLoading: result.isLoading,
    isFetchingNextPage: result.isFetchingNextPage,
    hasNextPage: result.hasNextPage,
    fetchNextPage: result.fetchNextPage,
    error: result.error,
  };
}
