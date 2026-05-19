import { test, expect } from '@playwright/test';

test('cliente consegue logar', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('a[href="/login?mode=login"]', { timeout: 10000 });
  await page.click('a[href="/login?mode=login"]');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', 'anajuliasantos@gmail.com');
  await page.fill('input[type="password"]', process.env.E2E_CLIENT_PASSWORD ?? '');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/cliente/, { timeout: 15000 });
});

test('profissional consegue logar', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('a[href="/login?mode=login"]', { timeout: 10000 });
  await page.click('a[href="/login?mode=login"]');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', 'jogersantos@gmail.com');
  await page.fill('input[type="password"]', process.env.E2E_PROF_PASSWORD ?? '');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/profissional/, { timeout: 15000 });
});

