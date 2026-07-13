-- has_role is used by authenticated RLS policies and must not be callable anonymously.
-- Keep the function SECURITY DEFINER because it reads profiles under RLS, but limit
-- its RPC surface to signed-in callers and the service role.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO service_role;
