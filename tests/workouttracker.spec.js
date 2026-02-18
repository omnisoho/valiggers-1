// tests/workouttracker.spec.js
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe.serial('Workout Tracker (Core)', () => {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

  // HTML routes (from your app.get)
  const ROUTES = {
    register: `${BASE_URL}/register.html`,
    login: `${BASE_URL}/login.html`,
    dashboard: `${BASE_URL}/workout`,
    workouts: `${BASE_URL}/workouts`,
    plans: `${BASE_URL}/plans`,
    sessions: `${BASE_URL}/sessions`,
    stats: `${BASE_URL}/stats`,
  };

  // API routes (from your app.use mounts)
  const API = {
    workouts: `${BASE_URL}/workouts-api`,
    presets: `${BASE_URL}/presets-api`,
    weekplan: `${BASE_URL}/weekplan-api`,
    sessionsToday: `${BASE_URL}/sessions-api/today`,
    sessionsState: (id) => `${BASE_URL}/sessions-api/${id}/state`,
    stats: `${BASE_URL}/stats-api`,
  };

  const storageStatePath = path.join(__dirname, 'workoutTracker.storageState.json');
  const credsPath = path.join(__dirname, 'workoutTracker.e2eData.json');

  const unique = Date.now();
  const user = {
    username: `e2eWT_${unique}`,
    email: `e2eWT_${unique}@example.com`,
    password: 'Password123!',
  };

  let token = '';

  function authHeaders() {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async function registerAndLoginAndSaveState(browser) {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Accept dialogs so tests don't hang
    page.on('dialog', async (dialog) => {
      try { await dialog.accept(); } catch (_) {}
    });

    // --- REGISTER ---
    await page.goto(ROUTES.register);
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

    token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    await context.storageState({ path: storageStatePath });
    fs.writeFileSync(credsPath, JSON.stringify({ ...user }, null, 2));

    await context.close();
  }

  async function newAuthedPage(browser) {
    const context = await browser.newContext({ storageState: storageStatePath });
    const page = await context.newPage();
    return { context, page };
  }

  test.beforeAll(async ({ browser }) => {
    await registerAndLoginAndSaveState(browser);
  });

  test('Dashboard loads + shows FitCore branding', async ({ browser }) => {
    const { context, page } = await newAuthedPage(browser);

    await page.goto(ROUTES.dashboard);

    await expect(page.locator('.brand-text-main')).toContainText('FitCore');
    await expect(page.locator('.brand-text-sub')).toContainText('Community workout library');

    // Avoid strict mode: dashboard has 2 /workouts links
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    await expect(sidebar.locator('a.nav-link[data-nav][href="/workouts"]').first()).toBeVisible();
    await expect(sidebar.locator('a.nav-link[data-nav][href="/plans"]').first()).toBeVisible();
    await expect(sidebar.locator('a.nav-link[data-nav][href="/stats"]').first()).toBeVisible();
    await expect(sidebar.locator('a.nav-link[data-nav][href="/sessions"]').first()).toBeVisible();

    await context.close();
  });

  test('Workouts API: create -> get all -> get one -> update -> delete', async ({ request }) => {
    // CREATE
    const createRes = await request.post(API.workouts, {
      headers: authHeaders(),
      data: {
        name: `E2E Bench ${unique}`,
        muscleGroup: 'Chest',
        difficulty: 3,
        durationMin: 30,
        sets: 4,
        reps: 8,
        description: 'Created by Playwright core test',
      },
    });
    expect([200, 201]).toContain(createRes.status());
    const created = await createRes.json();
    expect(created).toHaveProperty('id');

    // GET ALL
    const listRes = await request.get(API.workouts);
    expect(listRes.status()).toBe(200);
    const list = await listRes.json();
    expect(Array.isArray(list)).toBeTruthy();

    // GET ONE
    const oneRes = await request.get(`${API.workouts}/${created.id}`);
    expect(oneRes.status()).toBe(200);
    const one = await oneRes.json();
    expect(one.id).toBe(created.id);

    // UPDATE
    const updRes = await request.put(`${API.workouts}/${created.id}`, {
      headers: authHeaders(),
      data: {
        name: `E2E Bench Updated ${unique}`,
        muscleGroup: 'Chest',
        difficulty: 4,
        durationMin: 35,
        sets: 5,
        reps: 6,
        description: 'Updated by Playwright core test',
      },
    });
    expect([200, 204]).toContain(updRes.status());

    // DELETE
    const delRes = await request.delete(`${API.workouts}/${created.id}`, {
      headers: authHeaders(),
    });
    expect([200, 204]).toContain(delRes.status());
  });

  test('Presets + Weekly Plan: create preset -> ensure plan exists -> assign monday -> verify plan', async ({ request }) => {
    // Create workout for preset item
    const workoutRes = await request.post(API.workouts, {
      headers: authHeaders(),
      data: {
        name: `E2E Preset Workout ${unique}`,
        muscleGroup: 'Back',
        difficulty: 2,
        durationMin: 20,
        sets: 3,
        reps: 10,
        description: 'Workout used inside preset',
      },
    });
    expect([200, 201]).toContain(workoutRes.status());
    const workout = await workoutRes.json();
    expect(workout).toHaveProperty('id');

    // Create preset (difficulty must be Int)
    const presetRes = await request.post(API.presets, {
      headers: authHeaders(),
      data: {
        name: `E2E Preset ${unique}`,
        totalDuration: 45,
        difficulty: 3,
        notes: 'Created by Playwright core test',
        items: [{ workoutId: workout.id, order: 1, customSets: 3, customReps: 10 }],
      },
    });
    expect([200, 201]).toContain(presetRes.status());
    const preset = await presetRes.json();
    expect(preset).toHaveProperty('id');

    // Ensure weekly plan exists (router creates on GET)
    const ensurePlanRes = await request.get(API.weekplan, { headers: authHeaders() });
    expect(ensurePlanRes.status()).toBe(200);

    // Assign to Monday
    const assignRes = await request.put(`${API.weekplan}/day/monday`, {
      headers: authHeaders(),
      data: { presetId: preset.id },
    });
    expect(assignRes.status()).toBe(200);

    // Verify plan updated
    const planRes = await request.get(API.weekplan, { headers: authHeaders() });
    expect(planRes.status()).toBe(200);
    const plan = await planRes.json();

    expect(plan).toHaveProperty('mondayId');
    expect(plan.mondayId).toBe(preset.id);
  });

  test('Sessions (today): GET today context (auth)', async ({ request }) => {
    const res = await request.get(API.sessionsToday, { headers: authHeaders() });
    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('dayKey');

    const sessions = data.sessions || [];
    if (sessions.length > 0) {
      const s0 = sessions[0];
      const patch = await request.patch(API.sessionsState(s0.id), {
        headers: authHeaders(),
        data: { state: 'IN_PROGRESS' },
      });
      expect([200, 400]).toContain(patch.status());
    }
  });

  test('Stats API: GET global stats (public)', async ({ request }) => {
    const res = await request.get(API.stats);
    expect(res.status()).toBe(200);

    const stats = await res.json();

    // ✅ Your API returns { global: {...}, user: ... }
    expect(stats).toHaveProperty('global');
    expect(stats.global).toHaveProperty('totalWorkouts');
    expect(stats.global).toHaveProperty('totalComments');
    expect(typeof stats.global.totalWorkouts).toBe('number');
    expect(typeof stats.global.totalComments).toBe('number');

    // Optional: muscleGroupCounts exists as array
    expect(stats.global).toHaveProperty('muscleGroupCounts');
    expect(Array.isArray(stats.global.muscleGroupCounts)).toBeTruthy();
  });

  test('Basic UI smoke: Workouts / Plans / Sessions / Stats pages load', async ({ browser }) => {
    const { context, page } = await newAuthedPage(browser);

    await page.goto(ROUTES.workouts);
    await expect(page.locator('body')).toBeVisible();

    await page.goto(ROUTES.plans);
    await expect(page.locator('body')).toBeVisible();

    await page.goto(ROUTES.sessions);
    await expect(page.locator('body')).toBeVisible();

    await page.goto(ROUTES.stats);
    await expect(page.locator('body')).toBeVisible();

    await context.close();
  });
});