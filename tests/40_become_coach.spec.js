// tests/40_become_coach.spec.js
const { test, expect } = require('@playwright/test');

const APP = process.env.BASE_URL || 'http://localhost:3001';

function uniqueUser(prefix = 'coach_owner') {
  const u = Date.now();
  return {
    username: `${prefix}_${u}`,
    email: `${prefix}_${u}@example.com`,
    password: 'Password123!',
  };
}

async function registerAndLogin(page, user) {
  await page.goto(`${APP}/register.html`);
  page.once('dialog', async (d) => d.accept());

  await page.fill('#registerUsername', user.username);
  await page.fill('#registerEmail', user.email);
  await page.fill('#registerPassword', user.password);

  await Promise.all([
    page.waitForNavigation({ url: '**/login.html' }),
    page.click('#registerSubmit'),
  ]);

  await page.fill('#loginUsername', user.username);
  await page.fill('#loginPassword', user.password);

  await Promise.all([
    page.waitForNavigation({ url: '**/index.html' }),
    page.click('#loginSubmit'),
  ]);

  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
}

async function setSpecialty(page, value) {
  const selector = `input[type="checkbox"][value="${value}"]`;
  await expect(page.locator(selector)).toHaveCount(1);

  // Works even if checkbox is visually hidden
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`Checkbox not found: ${sel}`);
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector);
}

test('Become a coach: submit coach profile -> redirects to coach detail and renders coach card', async ({ page }) => {
  const user = uniqueUser();
  await registerAndLogin(page, user);

  await page.goto(`${APP}/coach-register`);

  await expect(page.locator('#displayName')).toBeVisible();

  const unique = Date.now();
  const coachName = `E2E Coach ${unique}`;

  await page.fill('#displayName', coachName);
  await page.fill('#hourlyRate', '60');
  await page.fill('#bio', 'E2E bio - strength focus.');

  // ✅ Set specialty reliably even if checkbox input is hidden
  await setSpecialty(page, 'STRENGTH');

  await Promise.all([
    page.waitForURL(/coach-detail\?id=\d+/),
    page.click('button[type="submit"]'),
  ]);

  await expect(page.locator('#coachCard')).toBeVisible();
  await expect(page.locator('#coachName')).toHaveText(coachName);
});
