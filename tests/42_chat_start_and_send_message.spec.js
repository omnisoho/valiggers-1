// tests/42_chat_start_and_send_message.spec.js
const { test, expect } = require('@playwright/test');

const BASE = process.env.BASE_URL || 'http://localhost:3001';

function uniqueUser(prefix) {
  const u = Date.now();
  return {
    username: `${prefix}_${u}`,
    email: `${prefix}_${u}@example.com`,
    password: 'Password123!',
  };
}

async function registerAndLogin(page, user) {
  // REGISTER
  await page.goto(`${BASE}/register.html`);
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

  // set hidden checkbox reliably
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`Checkbox not found: ${sel}`);
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector);
}

async function becomeCoach(page, coachName) {
  await page.goto(`${BASE}/coach-register`);

  await expect(page.locator('#displayName')).toBeVisible();

  await page.fill('#displayName', coachName);
  await page.fill('#hourlyRate', '60');
  await page.fill('#bio', 'E2E coach for chat test.');

  await setSpecialty(page, 'STRENGTH');

  await Promise.all([
    page.waitForURL(/coach-detail\?id=\d+/),
    page.click('button[type="submit"]'),
  ]);

  await expect(page.locator('#coachCard')).toBeVisible();
}

test('Chat: create coach + student, start chat, send message, message appears', async ({ page }) => {
  // 1) Create a coach (so coaches list is not empty)
  const coachUser = uniqueUser('coach_chat');
  await registerAndLogin(page, coachUser);

  const coachName = `Chat Coach ${Date.now()}`;
  await becomeCoach(page, coachName);

  // 2) Logout coach (clear token) then create student
  await logout(page);

  const studentUser = uniqueUser('student_chat');
  await registerAndLogin(page, studentUser);

  // 3) Go coaches page and open chat UI
  await page.goto(`${BASE}/coaches-page`);
  await expect(page.locator('#status')).toContainText('Showing', { timeout: 15000 });

  await page.click('#openChatBtn');
  await expect(page.locator('#chatModal')).toHaveAttribute('aria-hidden', 'false');

  await page.click('#newChatBtn');
  await expect(page.locator('#newChatSheet')).toHaveClass(/is-open/);

  // 4) Pick the coach we just created (more reliable than "first")
  const coachRow = page
    .locator('#newChatList .row, #newChatList .line, #newChatList li, #newChatList > div')
    .filter({ hasText: coachName });

  const chatBtnByName = coachRow.locator('button', { hasText: 'Chat' }).first();
  const firstChatBtn = page.locator('#newChatList button', { hasText: 'Chat' }).first();

  if (await chatBtnByName.count()) {
    await chatBtnByName.click();
  } else {
    await expect(firstChatBtn).toBeVisible();
    await firstChatBtn.click();
  }

  // 5) Wait until the chat is actually “active”
  // (input can exist but still be disabled while thread loads)
  await page.waitForSelector('#chatInput:not([disabled])', { timeout: 15000 });
  await expect(page.locator('#chatMessages')).toBeVisible({ timeout: 15000 });

  // 6) Send message and assert it appears
  const msg = `hello_${Date.now()}`;
  await page.fill('#chatInput', msg);
  await page.click('#sendChatBtn');

  await expect(page.locator('#chatMessages')).toContainText(msg, { timeout: 15000 });
});
