-- RPC de agregação para o redesign de admin/Pedidos.tsx: evita N+1 queries
-- do client somando notificados (notifications.data->>'type'='new_lead'),
-- primeira notificação e primeira proposta (lead_purchases) por lead numa
-- única chamada. Segue o padrão de admin_get_pending_professionals:
-- SECURITY DEFINER com checagem de role='admin' interna, GRANT a
-- authenticated (não a anon).

CREATE OR REPLACE FUNCTION public.admin_get_leads_overview()
 RETURNS TABLE(
   id uuid, title text, description text,
   category text, category_icon text, category_color text,
   city text, location text, state text,
   budget_min integer, budget_max integer,
   status text, visualizacoes integer, purchases_count integer,
   created_at timestamptz, updated_at timestamptz,
   client_id uuid, client_name text,
   notified_count bigint, first_notified_at timestamptz,
   first_proposal_at timestamptz
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    l.id, l.title, l.description,
    COALESCE(c.name, l.category) AS category,
    c.icon AS category_icon,
    c.color AS category_color,
    l.city, l.location, l.state,
    l.budget_min, l.budget_max,
    l.status, COALESCE(l.visualizacoes, 0), COALESCE(l.purchases_count, 0),
    l.created_at, l.updated_at,
    l.client_id, p.full_name AS client_name,
    COALESCE(n.notified_count, 0) AS notified_count,
    n.first_notified_at,
    lp.first_proposal_at
  FROM leads l
  LEFT JOIN categories c ON c.id = l.category_id
  LEFT JOIN profiles p ON p.id = l.client_id
  LEFT JOIN LATERAL (
    SELECT count(DISTINCT nt.user_id) AS notified_count, min(nt.created_at) AS first_notified_at
    FROM notifications nt
    WHERE nt.data->>'lead_id' = l.id::text AND nt.data->>'type' = 'new_lead'
  ) n ON true
  LEFT JOIN LATERAL (
    SELECT min(lpu.created_at) AS first_proposal_at
    FROM lead_purchases lpu WHERE lpu.lead_id = l.id
  ) lp ON true
  ORDER BY l.created_at DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_get_leads_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_leads_overview() TO authenticated;
