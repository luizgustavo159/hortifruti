import { test, expect } from '@playwright/test';

const fakeToken = 'header.payload.signature';

test('redirects unauthenticated user from /admin to login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/$/);
});

test('forces login screen after unauthorized api response', async ({ page }) => {
  await page.addInitScript((token) => {
    localStorage.setItem('greenstore_token', token);
    localStorage.setItem('greenstore_user', JSON.stringify({ id: 1, role: 'admin' }));
  }, fakeToken);

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, role: 'admin' }) });
  });

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin$/);

  await page.evaluate(() => {
    localStorage.removeItem('greenstore_token');
    localStorage.removeItem('greenstore_user');
    window.dispatchEvent(new CustomEvent('greenstore:unauthorized'));
  });

  await expect(page).toHaveURL(/\/$/);
});

test('syncs logout between tabs through storage event', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const adminPayload = JSON.stringify({ id: 1, role: 'admin' });

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.addInitScript(([token, user]) => {
    localStorage.setItem('greenstore_token', token);
    localStorage.setItem('greenstore_user', user);
  }, [fakeToken, adminPayload]);

  await pageB.addInitScript(([token, user]) => {
    localStorage.setItem('greenstore_token', token);
    localStorage.setItem('greenstore_user', user);
  }, [fakeToken, adminPayload]);

  await pageA.route('**/api/auth/me', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: adminPayload }));
  await pageB.route('**/api/auth/me', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: adminPayload }));

  await pageA.goto('/admin');
  await pageB.goto('/admin');
  await expect(pageA).toHaveURL(/\/admin$/);
  await expect(pageB).toHaveURL(/\/admin$/);

  await pageA.evaluate(() => {
    localStorage.removeItem('greenstore_token');
    window.dispatchEvent(new StorageEvent('storage', { key: 'greenstore_token', newValue: null }));
  });

  await expect(pageA).toHaveURL(/\/$/);

  await contextA.close();
  await contextB.close();
});
