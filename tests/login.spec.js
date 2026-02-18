// tests/login.spec.js
const { test, expect } = require('@playwright/test');

test.describe.serial('Login + Register + Navbar Auth Gate', () => {
  const BASE = 'http://localhost:3001';

  // Make a unique user each run so you don't collide with existing DB rows
  const unique = Date.now();
  const user = {
    username: `e2e_login_${unique}`,
    email: `e2e_login_${unique}@example.com`,
    password: 'Password123!',
  };

  test('Register → redirects to login, then Login → redirects to index + token saved', async ({ page }) => {
    // --- REGISTER ---
    await page.goto(`${BASE}/register.html`);

    // register.js shows alert on success, so handle it
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.fill('#registerUsername', user.username);
    await page.fill('#registerEmail', user.email);
    await page.fill('#registerPassword', user.password);

    await Promise.all([
      page.waitForNavigation({ url: '**/login.html' }),
      page.click('#registerSubmit'),
    ]);

    await expect(page).toHaveURL(/\/login\.html$/);

    // --- LOGIN ---
    await page.fill('#loginUsername', user.username);
    await page.fill('#loginPassword', user.password);

    await Promise.all([
      page.waitForNavigation({ url: '**/index.html' }),
      page.click('#loginSubmit'),
    ]);

    await expect(page).toHaveURL(/\/index\.html$/);

    // confirm token exists
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });

  test('Navbar auth gate: logged OUT redirects to login; logged IN allows navigation; "logout" clears token', async ({ page }) => {
    // --- LOGGED OUT behavior ---
    await page.goto(`${BASE}/index.html`);

    // Force logged out
    await page.evaluate(() => localStorage.removeItem('token'));
    await page.reload();

    // click any protected nav-link (Nutrition exists in your navbar) :contentReference[oaicite:2]{index=2}
    await Promise.all([
      page.waitForURL('**/login.html'),
      page.click('a.nav-link:has-text("Nutrition")'),
    ]);

    await expect(page).toHaveURL(/\/login\.html$/);

    // --- LOGGED IN behavior ---
    // Do a real login so the token is legit
    await page.fill('#loginUsername', user.username);
    await page.fill('#loginPassword', user.password);

    await Promise.all([
      page.waitForNavigation({ url: '**/index.html' }),
      page.click('#loginSubmit'),
    ]);

    await expect(page).toHaveURL(/\/index\.html$/);

    // Now clicking Nutrition should NOT send you back to login
    await Promise.all([
      page.waitForNavigation({ url: '**/nutritionTracker.html' }),
      page.click('a.nav-link:has-text("Nutrition")'),
    ]);

    await expect(page).toHaveURL(/\/nutritionTracker\.html$/);

    // --- "LOGOUT" behavior (simulated) ---
    // You don't have a logout button in navbar.js right now, so this is the realistic equivalent:
    await page.evaluate(() => localStorage.removeItem('token'));

    // go back to index and click nav link again -> should redirect to login
    await page.goto(`${BASE}/index.html`);
    await Promise.all([
      page.waitForURL('**/login.html'),
      page.click('a.nav-link:has-text("Nutrition")'),
    ]);

    await expect(page).toHaveURL(/\/login\.html$/);
  });

  test('Login fails with wrong password (basic negative test)', async ({ page }) => {
    await page.goto(`${BASE}/login.html`);

    // login.js alerts on failure :contentReference[oaicite:3]{index=3}
    page.once('dialog', async (dialog) => {
      // Don’t overfit exact wording; just accept and continue
      await dialog.accept();
    });

    await page.fill('#loginUsername', user.username);
    await page.fill('#loginPassword', 'WrongPassword!!!');

    await page.click('#loginSubmit');

    // should stay on login page
    await expect(page).toHaveURL(/\/login\.html$/);
  });
});