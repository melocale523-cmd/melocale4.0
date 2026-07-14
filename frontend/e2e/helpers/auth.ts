import type { Page } from '@playwright/test';

export const isE2EAuthBypass = process.env.VITE_E2E_AUTH_BYPASS === 'true';

type E2ERole = 'client' | 'professional';

async function waitForRoleRoute(page: Page, pattern: RegExp) {
  try {
    await page.waitForURL(pattern, { timeout: 15000 });
  } catch (error) {
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 500);
    console.log(`[e2e-auth] URL=${page.url()} body=${body}`);
    throw error;
  }
}

async function loginWithBypass(page: Page, role: E2ERole) {
  await page.addInitScript((selectedRole) => {
    window.localStorage.setItem('melocale_e2e_role', selectedRole);
  }, role);

  await page.goto(role === 'professional' ? '/profissional/dashboard' : '/cliente/dashboard');
  await page.waitForURL(role === 'professional' ? /profissional/ : /cliente/, { timeout: 15000 });
}

async function loginWithForm(page: Page, role: E2ERole) {
  await page.goto('/');
  try {
    await page.waitForSelector('a[href="/login?mode=login"]', { state: 'visible', timeout: 5000 });
    await page.click('a[href="/login?mode=login"]');
  } catch {
    await page.goto('/login?mode=login');
  }
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  if (role === 'professional') {
    await page.fill('input[type="email"]', 'jogersantos@gmail.com');
    await page.fill('input[type="password"]', process.env.E2E_PROF_PASSWORD ?? '');
    await page.click('button[type="submit"]');
    await waitForRoleRoute(page, /profissional/);
    return;
  }

  await page.fill('input[type="email"]', 'anajuliasantos@gmail.com');
  await page.fill('input[type="password"]', process.env.E2E_CLIENT_PASSWORD ?? '');
  await page.click('button[type="submit"]');
  await waitForRoleRoute(page, /cliente/);
}

export async function loginCliente(page: Page) {
  if (isE2EAuthBypass) return loginWithBypass(page, 'client');
  return loginWithForm(page, 'client');
}

export async function loginProfissional(page: Page) {
  if (isE2EAuthBypass) return loginWithBypass(page, 'professional');
  return loginWithForm(page, 'professional');
}
export async function clearE2EAuth(page: Page) {
  if (!isE2EAuthBypass) return;
  await page.addInitScript(() => {
    window.localStorage.removeItem('melocale_e2e_role');
  });
}