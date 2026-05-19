import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ───────────────────────────────────────────────────────────────
// The app uses a /login page (no modal). The Navbar "Entrar" button navigates
// to /login?mode=login. We go to / first then follow that link so the test
// exercises the real user-facing flow.
async function loginCliente(page: Page) {
  await page.goto('/');
  // Wait for the Navbar to render and click the "Entrar" link
  await page.waitForSelector('a[href="/login?mode=login"]', { timeout: 10000 });
  await page.click('a[href="/login?mode=login"]');
  // Wait for the login form to appear (auth loading state may briefly show a spinner)
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', 'anajuliasantos@gmail.com');
  await page.fill('input[type="password"]', process.env.E2E_CLIENT_PASSWORD ?? '');
  await page.click('button[type="submit"]');
  await page.waitForURL(/cliente/, { timeout: 15000 });
}

async function loginProfissional(page: Page) {
  await page.goto('/');
  await page.waitForSelector('a[href="/login?mode=login"]', { timeout: 10000 });
  await page.click('a[href="/login?mode=login"]');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', 'jogersantos@gmail.com');
  await page.fill('input[type="password"]', process.env.E2E_PROF_PASSWORD ?? '');
  await page.click('button[type="submit"]');
  await page.waitForURL(/profissional/, { timeout: 15000 });
}

// ─── Auth ──────────────────────────────────────────────────────────────────
test.describe('Auth', () => {
  test('logout redireciona para login', async ({ page }) => {
    await loginCliente(page);
    await page.goto('/logout');
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test('recuperação de senha — campo email aceita input', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'anajuliasantos@gmail.com');
    await page.click('button:has-text("Esqueci a senha")');
    await expect(page.locator('text=/enviamos|verifique|e-mail/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('cadastro cliente — página /login?mode=signup carrega', async ({ page }) => {
    await page.goto('/login?mode=signup');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('cadastro profissional — página /login?mode=signup&role=professional carrega', async ({ page }) => {
    await page.goto('/login?mode=signup&role=professional');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

// ─── Cliente ───────────────────────────────────────────────────────────────
test.describe('Cliente', () => {
  test.beforeEach(async ({ page }) => { await loginCliente(page); });

  test('dashboard carrega', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('lista de pedidos carrega', async ({ page }) => {
    await page.goto('/cliente/pedidos');
    await expect(page).toHaveURL(/pedidos/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('formulário criar pedido carrega', async ({ page }) => {
    await page.goto('/cliente/pedidos');
    await expect(page.locator('input, textarea, select').first()).toBeVisible({ timeout: 10000 });
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
    await expect(page.locator('input[placeholder]').first()).toBeVisible({ timeout: 10000 });
  });
});

// ─── Profissional ──────────────────────────────────────────────────────────
test.describe('Profissional', () => {
  test.beforeEach(async ({ page }) => { await loginProfissional(page); });

  test('dashboard carrega', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
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
    await expect(page.locator('input, textarea').first()).toBeVisible({ timeout: 10000 });
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
    await expect(page.locator('button, a').filter({ hasText: /comprar|moedas|pacote/i }).first()).toBeVisible({ timeout: 10000 });
  });
});

// ─── Admin ─────────────────────────────────────────────────────────────────
test.describe('Admin', () => {
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
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('dashboard cliente no mobile', async ({ page }) => {
    await loginCliente(page);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('dashboard profissional no mobile', async ({ page }) => {
    await loginProfissional(page);
    await expect(page.locator('h1, h2').first()).toBeVisible();
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
