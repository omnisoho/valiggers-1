// tests/41_booking_rules.spec.js
const { test, expect } = require('@playwright/test');

const APP = process.env.BASE_URL || 'http://localhost:3001';

function uniqueUser(prefix = 'booking_user') {
  const u = Date.now();
  return {
    username: `${prefix}_${u}`,
    email: `${prefix}_${u}@example.com`,
    password: 'Password123!',
  };
}

// Convert JS Date -> value for <input type="datetime-local">
function toDatetimeLocalValue(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function registerAndLogin(page, user) {
  // REGISTER
  await page.goto(`${APP}/register.html`);
  page.once('dialog', async (d) => d.accept());

  await page.fill('#registerUsername', user.username);
  await page.fill('#registerEmail', user.email);
  await page.fill('#registerPassword', user.password);

  await Promise.all([
    page.waitForNavigation({ url: '**/login.html' }),
    page.click('#registerSubmit'),
  ]);

  // LOGIN
  await page.fill('#loginUsername', user.username);
  await page.fill('#loginPassword', user.password);

  await Promise.all([
    page.waitForNavigation({ url: '**/index.html' }),
    page.click('#loginSubmit'),
  ]);

  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
}

async function logout(page) {
  await page.evaluate(() => localStorage.removeItem('token'));
}

async function setSpecialty(page, value) {
  const selector = `input[type="checkbox"][value="${value}"]`;
  await expect(page.locator(selector)).toHaveCount(1);

  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`Checkbox not found: ${sel}`);
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector);
}

async function becomeCoachAndGetId(page, coachName) {
  await page.goto(`${APP}/coach-register`);
  await expect(page.locator('#displayName')).toBeVisible();

  await page.fill('#displayName', coachName);
  await page.fill('#hourlyRate', '60');
  await page.fill('#bio', 'E2E coach for booking rules test.');
  await setSpecialty(page, 'STRENGTH');

  await Promise.all([
    page.waitForURL(/coach-detail\?id=\d+/),
    page.click('button[type="submit"]'),
  ]);

  await expect(page.locator('#coachCard')).toBeVisible();

  const url = page.url();
  const m = url.match(/id=(\d+)/);
  if (!m) throw new Error(`Could not parse coach id from URL: ${url}`);
  return m[1];
}

test.describe.serial('Booking rules', () => {
  test('Past booking fails; future booking succeeds with correct status + hint UI', async ({ page }) => {
    // 1️⃣ Create coach
    const coachUser = uniqueUser('booking_coach');
    await registerAndLogin(page, coachUser);

    const coachName = `Booking Coach ${Date.now()}`;
    const coachId = await becomeCoachAndGetId(page, coachName);

    // 2️⃣ Logout coach → create student
    await logout(page);

    const studentUser = uniqueUser('booking_student');
    await registerAndLogin(page, studentUser);

    // 3️⃣ Go to coach detail page
    await page.goto(`${APP}/coach-detail?id=${coachId}`);
    await expect(page.locator('#bookingForm')).toBeVisible();

    // ----------------------------
    // ❌ 1) Past booking (should fail)
    // ----------------------------
    const past = new Date();
    past.setDate(past.getDate() - 1);
    past.setHours(12, 0, 0, 0);

    await page.fill('#bookingStart', toDatetimeLocalValue(past));
    await page.selectOption('#bookingDuration', '60');
    await page.fill('#bookingNotes', 'past booking attempt');

    await page.locator('#bookingForm button[type="submit"]').click();

    await expect(page.locator('#status')).toContainText('future');
    await expect(page.locator('#bookingHint')).toContainText('future');

    // ----------------------------
    // ✅ 2) Future booking (guaranteed safe)
    // ----------------------------
    const future = new Date();
    future.setDate(future.getDate() + 2); // clearly future
    future.setHours(12, 0, 0, 0);         // midday avoids timezone issues

    await page.fill('#bookingStart', toDatetimeLocalValue(future));
    await page.selectOption('#bookingDuration', '60');
    await page.fill('#bookingNotes', `future booking request ${future.toISOString()}`);

    await page.locator('#bookingForm button[type="submit"]').click();

    await expect(page.locator('#status')).not.toHaveText('Creating booking.', { timeout: 15000 });

    await expect(page.locator('#status')).toContainText('Booking requested', { timeout: 15000 });
    await expect(page.locator('#bookingHint')).toContainText('Requested!', { timeout: 15000 });
  });
});
