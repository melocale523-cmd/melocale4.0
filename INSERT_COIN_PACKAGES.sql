-- ============================================
-- INSERIR PACOTES DE MOEDAS NA TABELA coin_packages
-- Rode este SQL no SQL Editor do Supabase
-- ============================================

INSERT INTO public.coin_packages (id, name, coins, price_brl, is_active, display_order)
VALUES
  ('pack_starter', 'Starter', 50,  19.90, true, 1),
  ('pack_pro',     'Pro',     150, 49.90, true, 2),
  ('pack_premium', 'Premium', 400, 99.90, true, 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  coins = EXCLUDED.coins,
  price_brl = EXCLUDED.price_brl,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order;

-- Conferir o resultado
SELECT * FROM public.coin_packages ORDER BY display_order;
