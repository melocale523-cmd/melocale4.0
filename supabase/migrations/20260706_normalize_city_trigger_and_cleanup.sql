-- CAMADA 3 — Rede de segurança no banco.
-- A fonte da verdade da normalização de cidade é o app
-- (frontend/src/utils/normalizeCity.ts e backend/src/lib/normalizeCity.ts):
-- select de 6 cidades-alvo no cadastro + normalizeCity() em todo ponto de
-- escrita. Este trigger cobre apenas escrita direta via SQL/RPC que não
-- passe pelo app, fazendo só a parte mecânica (trim + colapso de espaços) —
-- sem fuzzy-match nem Title Case, de propósito.
CREATE OR REPLACE FUNCTION public.normalize_city_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.city IS NOT NULL THEN
    NEW.city := NULLIF(regexp_replace(btrim(NEW.city), '\s+', ' ', 'g'), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_normalize_city ON public.profiles;
CREATE TRIGGER trg_profiles_normalize_city
  BEFORE INSERT OR UPDATE OF city ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.normalize_city_text();

DROP TRIGGER IF EXISTS trg_professionals_normalize_city ON public.professionals;
CREATE TRIGGER trg_professionals_normalize_city
  BEFORE INSERT OR UPDATE OF city ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.normalize_city_text();

-- CAMADA 4 — Limpeza do histórico.
-- 4a. Mecânica: trim + colapso de espaços (profiles e professionals)
UPDATE public.profiles
SET city = NULLIF(regexp_replace(btrim(city), '\s+', ' ', 'g'), '')
WHERE city IS NOT NULL
  AND city IS DISTINCT FROM NULLIF(regexp_replace(btrim(city), '\s+', ' ', 'g'), '');

UPDATE public.professionals
SET city = NULLIF(regexp_replace(btrim(city), '\s+', ' ', 'g'), '')
WHERE city IS NOT NULL
  AND city IS DISTINCT FROM NULLIF(regexp_replace(btrim(city), '\s+', ' ', 'g'), '');

-- 4b. Canônica: casa a parte "cidade" (sem UF) com as 6 cidades-alvo,
-- ignorando caixa e acentos, e regrava no formato canônico "Cidade - BA"
-- (formato de profiles.city). Corrige também UF errada ("AB") e adiciona
-- UF onde faltava, já que as 6 são todas na Bahia.
UPDATE public.profiles p
SET city = c.canon || ' - BA'
FROM (VALUES
  ('salvador',         'Salvador'),
  ('lauro de freitas', 'Lauro de Freitas'),
  ('jacobina',         'Jacobina'),
  ('feira de santana', 'Feira de Santana'),
  ('irece',            'Irecê'),
  ('senhor do bonfim', 'Senhor do Bonfim')
) AS c(k, canon)
WHERE p.city IS NOT NULL
  AND translate(lower(split_part(p.city, ' - ', 1)),
                'áàâãäéèêëíìîïóòôõöúùûüç',
                'aaaaaeeeeiiiiooooouuuuc') = c.k
  AND p.city IS DISTINCT FROM c.canon || ' - BA';

-- professionals.city usa nome puro (sem UF) — só garante o canônico
UPDATE public.professionals p
SET city = c.canon
FROM (VALUES
  ('salvador',         'Salvador'),
  ('lauro de freitas', 'Lauro de Freitas'),
  ('jacobina',         'Jacobina'),
  ('feira de santana', 'Feira de Santana'),
  ('irece',            'Irecê'),
  ('senhor do bonfim', 'Senhor do Bonfim')
) AS c(k, canon)
WHERE p.city IS NOT NULL
  AND translate(lower(split_part(p.city, ' - ', 1)),
                'áàâãäéèêëíìîïóòôõöúùûüç',
                'aaaaaeeeeiiiiooooouuuuc') = c.k
  AND p.city IS DISTINCT FROM c.canon;
