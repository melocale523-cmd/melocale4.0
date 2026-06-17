// Set required env vars before any module is imported
process.env.STRIPE_SECRET_KEY = 'sk_test_testsecretkey';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_testwebhooksecret';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

// Stripe Price IDs — subscription plans
process.env.STRIPE_PRICE_STARTER = 'price_test_starter';
process.env.STRIPE_PRICE_PRO = 'price_test_pro';
process.env.STRIPE_PRICE_ELITE = 'price_test_elite';

// Stripe Price IDs — coin packages (full price, no plan discount)
process.env.STRIPE_PRICE_PACK_BASIC = 'price_test_pack_basic';
process.env.STRIPE_PRICE_PACK_POPULAR = 'price_test_pack_popular';
process.env.STRIPE_PRICE_PACK_MAX = 'price_test_pack_max';
