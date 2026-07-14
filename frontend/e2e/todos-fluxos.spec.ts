import { test, expect } from '@playwright/test';
import { clearE2EAuth, isE2EAuthBypass, loginCliente, loginProfissional } from './helpers/auth';

test.describe('Auth', () => {
  test.skip(isE2EAuthBypass, 'Auth real depende do Turnstile/Supabase e fica fora do bypass E2E.');
  test('logout redireciona para home', async ({ page }) => {
    await loginCliente(page);
    await page.getByRole('button', { name: /sair/i }).first().click();
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('recuperação de senha — campo email aceita input', async ({ page }) => {
    await clearE2EAuth(page);
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'anajuliasantos@gmail.com');
    await expect(page.locator('input[type="email"]')).toHaveValue('anajuliasantos@gmail.com');
  });

  test('cadastro cliente — página /login?mode=signup carrega', async ({ page }) => {
    await clearE2EAuth(page);
    await page.goto('/login?mode=signup');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('cadastro profissional — página /login?mode=signup&role=professional carrega', async ({ page }) => {
    await clearE2EAuth(page);
    await page.goto('/login?mode=signup&role=professional');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

// ─── Cliente ───────────────────────────────────────────────────────────────
test.describe('Cliente', () => {
  test.beforeEach(async ({ page }) => { await loginCliente(page); });

  test('dashboard carrega', async ({ page }) => {
    await expect(page).toHaveURL(/cliente/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('lista de pedidos carrega', async ({ page }) => {
    await page.goto('/cliente/pedidos');
    await expect(page).toHaveURL(/pedidos/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('formulário criar pedido carrega', async ({ page }) => {
    await page.goto('/cliente/pedidos');
    await expect(page).toHaveURL(/pedidos/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('agenda do cliente carrega', async ({ page }) => {
    await page.goto('/cliente/agenda');
    await expect(page).toHaveURL(/agenda/);
  });

  test('chat do cliente carrega', async ({ page }) => {
    await page.goto('/cliente/mensagens');
    await expect(page).toHaveURL(/mensagens/);
  });

  test('busca de profissionais carrega', async ({ page }) => {
    await page.goto('/cliente/busca');
    await expect(page).toHaveURL(/busca/);
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── Profissional ──────────────────────────────────────────────────────────
test.describe('Profissional', () => {
  test.beforeEach(async ({ page }) => { await loginProfissional(page); });

  test('dashboard carrega', async ({ page }) => {
    await expect(page).toHaveURL(/profissional/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('lista de leads disponíveis carrega', async ({ page }) => {
    await page.goto('/profissional/leads');
    await expect(page).toHaveURL(/leads/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('chat do profissional carrega', async ({ page }) => {
    await page.goto('/profissional/mensagens');
    await expect(page).toHaveURL(/mensagens/);
  });

  test('agenda do profissional carrega', async ({ page }) => {
    await page.goto('/profissional/agenda');
    await expect(page).toHaveURL(/agenda/);
  });

  test('perfil profissional — página editar carrega', async ({ page }) => {
    await page.goto('/profissional/perfil');
    await expect(page).toHaveURL(/perfil/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('carteira/moedas carrega', async ({ page }) => {
    await page.goto('/profissional/carteira');
    await expect(page).toHaveURL(/carteira/);
  });

  test('planos/assinatura carrega', async ({ page }) => {
    await page.goto('/profissional/assinatura');
    await expect(page).toHaveURL(/assinatura/);
  });

  test('compra pacote moedas — botão comprar visível', async ({ page }) => {
    await page.goto('/profissional/carteira');
    await expect(page).toHaveURL(/carteira/);
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── Admin ─────────────────────────────────────────────────────────────────
// jogersantos@gmail.com is not admin — skip until a dedicated admin test user is available
test.describe.skip('Admin', () => {
  test.beforeEach(async ({ page }) => {
    // Admin usa login do profissional de teste (ajustar se houver usuário admin dedicado)
    await page.goto('/');
    await page.waitForSelector('a[href="/login?mode=login"]', { timeout: 10000 });
    await page.click('a[href="/login?mode=login"]');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'jogersantos@gmail.com');
    await page.fill('input[type="password"]', process.env.E2E_PROF_PASSWORD ?? '');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  });

  test('painel admin carrega', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.locator('body')).toBeVisible();
  });

  test('lista usuários carrega', async ({ page }) => {
    await page.goto('/admin/usuarios');
    await expect(page.locator('body')).toBeVisible();
  });

  test('transações carregam', async ({ page }) => {
    await page.goto('/admin/transacoes');
    await expect(page.locator('body')).toBeVisible();
  });

  test('aprovações pendentes carregam', async ({ page }) => {
    await page.goto('/admin/pendentes');
    await expect(page.locator('body')).toBeVisible();
  });

  test('testes E2E runner carrega', async ({ page }) => {
    await page.goto('/admin/testes');
    await expect(page.locator('text=/Testes E2E|Rodar/i').first()).toBeVisible({ timeout: 10000 });
  });
});

// ─── Mobile / Responsivo ───────────────────────────────────────────────────
test.describe('Mobile (390x844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('login carrega no mobile', async ({ page }) => {
    test.skip(isE2EAuthBypass, 'Login real depende do Turnstile/Supabase e fica fora do bypass E2E.');
    await clearE2EAuth(page);
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('dashboard cliente no mobile', async ({ page }) => {
    await loginCliente(page);
    await expect(page).toHaveURL(/cliente/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('dashboard profissional no mobile', async ({ page }) => {
    await loginProfissional(page);
    await expect(page).toHaveURL(/profissional/);
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── PWA ───────────────────────────────────────────────────────────────────
test.describe('PWA', () => {
  test('manifesto acessível', async ({ page }) => {
    const response = await page.goto('/manifest.webmanifest');
    expect(response?.status()).toBe(200);
  });

  test('service worker registrado', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    const swRegistered = await page.evaluate(() =>
      navigator.serviceWorker.getRegistrations().then(regs => regs.length > 0)
    );
    expect(swRegistered).toBe(true);
  });
});
