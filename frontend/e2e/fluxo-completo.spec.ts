import { test, expect } from '@playwright/test';
async function waitForRoleRoute(page: import('@playwright/test').Page, pattern: RegExp) {
  try {
    await page.waitForURL(pattern, { timeout: 15000 });
  } catch (error) {
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 500);
    console.log(`[e2e-auth] URL=${page.url()} body=${body}`);
    throw error;
  }
}

test.describe('Fluxo completo — cliente cria pedido', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('a[href="/login?mode=login"]', { timeout: 10000 });
    await page.click('a[href="/login?mode=login"]');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'anajuliasantos@gmail.com');
    await page.fill('input[type="password"]', process.env.E2E_CLIENT_PASSWORD ?? '');
    await page.click('button[type="submit"]');
    await waitForRoleRoute(page, /cliente/);
  });

  test('cliente vê dashboard', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('cliente acessa pedidos', async ({ page }) => {
    await page.goto('/cliente/pedidos');
    await expect(page).toHaveURL(/pedidos/);
  });
});

test.describe('Fluxo completo — profissional vê leads', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('a[href="/login?mode=login"]', { timeout: 10000 });
    await page.click('a[href="/login?mode=login"]');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'jogersantos@gmail.com');
    await page.fill('input[type="password"]', process.env.E2E_PROF_PASSWORD ?? '');
    await page.click('button[type="submit"]');
    await waitForRoleRoute(page, /profissional/);
  });

  test('profissional vê leads disponíveis', async ({ page }) => {
    await page.goto('/profissional/leads');
    await expect(page).toHaveURL(/leads/);
  });
});
