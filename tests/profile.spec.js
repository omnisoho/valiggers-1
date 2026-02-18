// tests/profile.spec.js
const { test, expect } = require('@playwright/test');

test.describe.serial('Profile + Notes System E2E', () => {
  const BASE = 'http://localhost:3001';

  function uniqueUser() {
    const id = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    return {
      username: `e2e_profile_${id}`,
      email: `e2e_profile_${id}@example.com`,
      password: 'Password123!',
    };
  }

  async function registerAndLogin(page) {
    const user = uniqueUser();

    await page.goto(`${BASE}/register.html`);
    page.once('dialog', async (dialog) => dialog.accept());

    await page.fill('#registerUsername', user.username);
    await page.fill('#registerEmail', user.email);
    await page.fill('#registerPassword', user.password);

    await Promise.all([
      page.waitForURL('**/login.html', { timeout: 15000 }),
      page.click('#registerSubmit'),
    ]);

    await page.fill('#loginUsername', user.username);
    await page.fill('#loginPassword', user.password);

    await Promise.all([
      page.waitForURL('**/index.html', { timeout: 15000 }),
      page.click('#loginSubmit'),
    ]);

    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    return { token, user };
  }

  async function openProfileEditModal(page) {
    await page.click('.profile-options .options-btn');
    await page.click('#openProfileModal');
    await expect(page.locator('#profileModal')).not.toHaveClass(/d-none/);
  }

  test('Profile loads + Edit Profile saves changes + token still valid', async ({ page }) => {
    const { user } = await registerAndLogin(page);

    await page.goto(`${BASE}/profile.html`);
    await expect(page.locator('#profileName')).toContainText(user.username, { timeout: 15000 });

    await openProfileEditModal(page);

    const newUsername = `${user.username}_new`;

    await page.fill('#edit-name', newUsername);
    await page.fill('#edit-bio', 'Building my best self.');
    await page.fill('#stat-weight', '72');
    await page.fill('#stat-bodyfat', '18');
    await page.fill('#stat-height', '180');

    await page.click('#saveProfileBtn');
    await expect(page.locator('#profileModal')).toHaveClass(/d-none/, { timeout: 15000 });

    await expect(page.locator('#profileName')).toContainText(newUsername);
    await expect(page.locator('.profile-bio')).toContainText('Building my best self.');
    await expect(page.locator('#display-weight')).toContainText('72 kg');
    await expect(page.locator('#display-bodyfat')).toContainText('18 %');
    await expect(page.locator('#display-height')).toContainText('180 cm');

    const tokenAfter = await page.evaluate(() => localStorage.getItem('token'));
    expect(tokenAfter).toBeTruthy();

    // verify token still works
    const profileRes = await page.request.get(`${BASE}/api/profile`, {
      headers: { Authorization: `Bearer ${tokenAfter}` },
    });
    expect(profileRes.ok()).toBeTruthy();
  });

  test('Notes: create 2 notes, pin one, verify pinned-group ordering, sort latest/oldest, open modal + delete', async ({ page }) => {
    const { user } = await registerAndLogin(page);
    await page.goto(`${BASE}/profile.html`);

    async function createNote(content) {
      await page.click('#addNoteBtn');
      await expect(page.locator('#createNoteModal')).not.toHaveClass(/d-none/);

      await page.fill('#newNoteContent', content);
      await page.click('#saveCreateNote');

      await expect(page.locator('#createNoteModal')).toHaveClass(/d-none/, { timeout: 15000 });
      // Wait for notes reload to finish by checking the card appears
      await expect(page.locator('#notesGrid .note-card', { hasText: content })).toBeVisible({ timeout: 15000 });
    }

    const noteA = `note A for ${user.username}`;
    const noteB = `note B for ${user.username}`;

    await createNote(noteA);
    await createNote(noteB);

    const cards = page.locator('#notesGrid .note-card');
    await expect(cards).toHaveCount(2, { timeout: 15000 });
    await expect(page.locator('#notes-count')).toContainText('2 notes');

    // Pin noteA
    const cardA = page.locator('#notesGrid .note-card', { hasText: noteA });
    const pinA = cardA.locator('.note-pin');

    await pinA.click();
    const allCards = page.locator('#notesGrid .note-card');
    const count = await allCards.count();

    let foundUnpinned = false;
    for (let i = 0; i < count; i++) {
      const card = allCards.nth(i);
      const pin = card.locator('.note-pin');
      const style = (await pin.getAttribute('style')) || '';
      const isPinned = style.includes('#4cc9f0');

      if (!isPinned) foundUnpinned = true;
      if (foundUnpinned) {
        // no more pinned cards
        expect(isPinned).toBeFalsy();
      }
    }

    // Sorting toggles + label checks
    await page.click('button.sort-btn');
    await page.click('button.sort-option[data-value="oldest"]');
    await expect(page.locator('#sortLabel')).toHaveText('Oldest First');

    await page.click('button.sort-btn');
    await page.click('button.sort-option[data-value="latest"]');
    await expect(page.locator('#sortLabel')).toHaveText('Latest First');

    // Open modal for noteB and delete it
    const cardB = page.locator('#notesGrid .note-card', { hasText: noteB });
    await cardB.click();
    await expect(page.locator('#noteModal')).not.toHaveClass(/d-none/);

    await page.click('#deleteNoteBtn');
    await expect(page.locator('#noteModal')).toHaveClass(/d-none/, { timeout: 15000 });

    // One note left
    await expect(page.locator('#notesGrid .note-card')).toHaveCount(1, { timeout: 15000 });
    await expect(page.locator('#notes-count')).toContainText('1 notes');
  });

  test('Logout modal clears token and redirects to login', async ({ page }) => {
    await registerAndLogin(page);
    await page.goto(`${BASE}/profile.html`);

    await page.click('.profile-options .options-btn');
    await page.click('#logoutFromMenu');

    await expect(page.locator('#logoutModal')).not.toHaveClass(/d-none/);

    await Promise.all([
      page.waitForURL('**/login.html', { timeout: 15000 }),
      page.click('#confirmLogout'),
    ]);

    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeFalsy();
    await expect(page).toHaveURL(/\/login\.html$/);
  });
});