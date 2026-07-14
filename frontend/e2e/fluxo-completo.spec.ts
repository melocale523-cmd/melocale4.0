import { test, expect } from '@playwright/test';
import { loginCliente, loginProfissional } from './helpers/auth';

test.describe('Fluxo completo - cliente cria pedido', () => {
  test.beforeEach(async ({ page }) => {
    await loginCliente(page);
  });

  test('cliente ve dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/cliente/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('cliente acessa pedidos', async ({ page }) => {
    await page.goto('/cliente/pedidos');
    await expect(page).toHaveURL(/pedidos/);
  });
});

test.describe('Fluxo completo - profissional ve leads', () => {
  test.beforeEach(async ({ page }) => {
    await loginProfissional(page);
  });

  test('profissional ve leads disponiveis', async ({ page }) => {
    await page.goto('/profissional/leads');
    await expect(page).toHaveURL(/leads/);
  });
});