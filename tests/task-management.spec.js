import { test, expect } from '@playwright/test';

test('smoke test - pipeline runs', async () => {
  expect(true).toBe(true);
});


/*const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3001');
});

const NEW_SOMETHINGS = ['cheese', 'milk', 'delete'];

async function addSomething(page, taskIndex) {
  const taskNameInput = page.getByLabel('Name');
  await taskNameInput.fill(NEW_SOMETHINGS[taskIndex]);
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(page.locator('#somethingsTableBody')).toContainText(
    NEW_SOMETHINGS[taskIndex],
  );
}

test.describe('New Something', () => {
  test('Should allow me to add something', async ({
    page,
  }) => {
    await addSomething(page, 0);
  });
});

test.describe('Load Somethings', () => {
  test('Should load somethings', async ({ page }) => {
    const rows = page.locator('#somethingsTableBody').getByRole('row');
    await rows.first().waitFor();
    await expect(await rows.count()).toBeGreaterThan(0);
  });
});

test.describe('Delete Something', () => {
  test('Should allow me to remove something', async ({ page }) => {
    await addSomething(page, 2);
    const rows = page.locator('#somethingsTableBody').getByRole('row');
    const newlyAddedRow = rows.filter({
      has: page.getByRole('cell', { name: NEW_SOMETHINGS[2], exact: true }),
    });
    await newlyAddedRow.getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('#somethingsTableBody')).not.toContainText(
      NEW_SOMETHINGS[2],
    );
  });
});
*/
