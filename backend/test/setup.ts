// Set required env vars before any module is imported
process.env.STRIPE_SECRET_KEY = 'sk_test_testsecretkey';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_testwebhooksecret';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
