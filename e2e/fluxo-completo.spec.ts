import { test, expect } from '@playwright/test';

test.describe('Fluxo completo — cliente cria pedido', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'anajuliasantos@gmail.com');
    await page.fill('input[type="password"]', '123456789');
    await page.click('button[type="submit"]');
    await page.waitForURL(/cliente/, { timeout: 10000 });
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
    await page.goto('/login');
    await page.fill('input[type="email"]', 'jogersantos@gmail.com');
    await page.fill('input[type="password"]', '123456789');
    await page.click('button[type="submit"]');
    await page.waitForURL(/profissional/, { timeout: 10000 });
  });

  test('profissional vê leads disponíveis', async ({ page }) => {
    await page.goto('/profissional/leads');
    await expect(page).toHaveURL(/leads/);
  });
});
