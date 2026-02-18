const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'e2eData.json');

test.describe.serial('Nutrition Tracker E2E', () => {

  test('Register, login, and add meals', async ({ page }) => {

    // --- Attach listener BEFORE clicking submit ---
page.once('dialog', async (dialog) => {
  console.log('Alert message:', dialog.message()); // optional log
  await dialog.accept(); // accept the alert
});

    

    // --- REGISTER ---
    await page.goto('http://localhost:3001/register.html');

    await page.fill('#registerUsername', 'e2eUser');
    await page.fill('#registerEmail', 'e2eUser@example.com');
    await page.fill('#registerPassword', 'Password123!');

    // Trigger registration submit and wait for redirect to login page
    await Promise.all([
      page.waitForNavigation({ url: '**/login.html' }),
      page.click('#registerSubmit')
    ]);

    // --- LOGIN ---
    await page.fill('#loginUsername', 'e2eUser'); // match login.html ID
    await page.fill('#loginPassword', 'Password123!');

    // Submit login and wait for redirect to main page
    await Promise.all([
      page.waitForNavigation({ url: '**/index.html' }),
      page.click('#loginSubmit')
    ]);

    await page.goto('http://localhost:3001/nutritionTracker.html');

    // --- NUTRITION TRACKER PAGE ---
    await page.waitForSelector('.create-meal-btn');

    // Open add meal form
    await page.click('.create-meal-btn');
    await page.waitForSelector('#mealForm');

    // Fill the meal form
    await page.fill('#mealName', 'Test Breakfast');
    await page.selectOption('#mealType', 'Breakfast');
    await page.fill('#calories', '500');
    await page.fill('#protein', '25');
    await page.fill('#fat', '20');
    await page.fill('#sugar', '10');

    // Submit the meal
    await page.click('button[type="submit"]');

    // Wait for meal card to appear
    const mealCards = page.locator('.meal-card');
    await mealCards.first().waitFor();

    // Verify the meal name
    const firstMealName = await mealCards.first().locator('h3').textContent();
    expect(firstMealName).toBe('Test Breakfast');

    // Save login & meal info for next test
    fs.writeFileSync(dataFile, JSON.stringify({
      username: 'e2eUser',
      password: 'Password123!',
      mealName: 'Test Breakfast'
    }));

  });

});
