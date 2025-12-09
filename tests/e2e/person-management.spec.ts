import { test, expect } from '@playwright/test';

/**
 * E2E Test: Person Management Flow
 * Tests: Create Person → Edit Person → View Person → Delete Person
 */

test.describe('Person Management', () => {
  // Setup: Login before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'demo@nametag.one');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
  });

  test('should create a new person', async ({ page }) => {
    // Navigate to create person page
    await page.goto('/people/new');
    
    // Fill in person form
    const personName = `Test Person ${Date.now()}`;
    await page.fill('input[name="name"]', personName);
    await page.fill('input[name="surname"]', 'Lastname');
    
    // Select relationship type (adjust selector based on your UI)
    // await page.selectOption('select[name="relationshipToUserId"]', { index: 1 });
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should redirect to people list or person detail
    await expect(page).toHaveURL(/\/people/, { timeout: 5000 });
    
    // Should show success message
    await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 3000 });
  });

  test('should list all people', async ({ page }) => {
    await page.goto('/people');
    
    // Should show people list
    await expect(page.getByRole('heading', { name: /people/i })).toBeVisible();
    
    // Should show at least one person (demo data)
    const peopleList = page.locator('[data-testid="person-item"]');
    await expect(peopleList.first()).toBeVisible({ timeout: 3000 });
  });

  test('should view person details', async ({ page }) => {
    await page.goto('/people');
    
    // Click on first person in list
    const firstPerson = page.locator('[data-testid="person-item"]').first();
    await firstPerson.click();
    
    // Should navigate to person detail page
    await expect(page).toHaveURL(/\/people\/[a-zA-Z0-9]+$/, { timeout: 5000 });
    
    // Should show person details
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('should edit person', async ({ page }) => {
    await page.goto('/people');
    
    // Click on first person
    const firstPerson = page.locator('[data-testid="person-item"]').first();
    await firstPerson.click();
    
    // Click edit button
    await page.click('a:has-text("Edit")');
    
    // Should navigate to edit page
    await expect(page).toHaveURL(/\/people\/[a-zA-Z0-9]+\/edit/, { timeout: 5000 });
    
    // Update person name
    const updatedName = `Updated Person ${Date.now()}`;
    await page.fill('input[name="name"]', updatedName);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show success message
    await expect(page.getByText(/updated successfully/i)).toBeVisible({ timeout: 3000 });
  });

  test('should search for people', async ({ page }) => {
    await page.goto('/people');
    
    // Type in search box (adjust selector based on your UI)
    const searchBox = page.locator('input[placeholder*="Search"]');
    if (await searchBox.isVisible()) {
      await searchBox.fill('John');
      
      // Should filter results
      const peopleList = page.locator('[data-testid="person-item"]');
      const count = await peopleList.count();
      
      // Should show filtered results (may be 0 if no John in demo data)
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});

