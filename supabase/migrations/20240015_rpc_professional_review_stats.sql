-- Replaces the unbounded SELECT rating FROM reviews (all rows) used in
-- reviewService.getReviewsByProfessional with a single aggregate RPC call.
-- Computes average and total count in the DB — no full table scan on the client.
CREATE OR REPLACE FUNCTION public.get_professional_review_stats(p_professional_id UUID)
RETURNS TABLE(avg_rating NUMERIC, total_reviews BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0) AS avg_rating,
    COUNT(*)::BIGINT                              AS total_reviews
  FROM reviews
  WHERE professional_id = p_professional_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_professional_review_stats(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_professional_review_stats(UUID) TO authenticated, anon;
