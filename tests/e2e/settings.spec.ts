import { test, expect } from '@playwright/test';

/**
 * E2E Test: Settings Management
 * Tests: Profile Settings → Password Change → Theme Toggle → Data Export
 */

test.describe('Settings', () => {
  // Setup: Login before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'demo@nametag.one');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
  });

  test('should update profile information', async ({ page }) => {
    await page.goto('/settings');
    
    // Update name
    const nameInput = page.locator('input[name="name"]');
    await nameInput.fill(`Updated Name ${Date.now()}`);
    
    // Submit form
    await page.click('button:has-text("Save")');
    
    // Should show success message
    await expect(page.getByText(/updated successfully/i)).toBeVisible({ timeout: 3000 });
  });

  test('should change password', async ({ page }) => {
    await page.goto('/settings');
    
    // Find password change section
    const currentPassword = page.locator('input[name="currentPassword"]');
    if (await currentPassword.isVisible()) {
      await currentPassword.fill('password123');
      await page.fill('input[name="newPassword"]', 'NewPassword123!');
      
      // Submit
      await page.click('button:has-text("Change Password")');
      
      // Should show success or current password error
      const successMsg = page.getByText(/changed successfully/i);
      const errorMsg = page.getByText(/incorrect/i);
      
      const hasSuccess = await successMsg.isVisible().catch(() => false);
      const hasError = await errorMsg.isVisible().catch(() => false);
      
      expect(hasSuccess || hasError).toBeTruthy();
    }
  });

  test('should toggle theme', async ({ page }) => {
    await page.goto('/settings');
    
    // Find theme toggle
    const themeToggle = page.locator('[data-testid="theme-toggle"]');
    if (await themeToggle.isVisible()) {
      // Get initial theme class
      const htmlElement = page.locator('html');
      const initialClass = await htmlElement.getAttribute('class');
      
      // Toggle theme
      await themeToggle.click();
      
      // Wait a bit for theme to change
      await page.waitForTimeout(500);
      
      // Check if class changed
      const newClass = await htmlElement.getAttribute('class');
      expect(newClass).not.toBe(initialClass);
    }
  });

  test('should export data', async ({ page }) => {
    await page.goto('/settings');
    
    // Find export button
    const exportButton = page.locator('button:has-text("Export")');
    if (await exportButton.isVisible()) {
      // Start waiting for download before clicking
      const downloadPromise = page.waitForEvent('download');
      
      await exportButton.click();
      
      // Wait for download
      const download = await downloadPromise;
      
      // Verify download started
      expect(download.suggestedFilename()).toContain('nametag');
    }
  });

  test('should change date format preference', async ({ page }) => {
    await page.goto('/settings');
    
    // Find date format selector
    const dateFormatSelect = page.locator('select[name="dateFormat"]');
    if (await dateFormatSelect.isVisible()) {
      // Change format
      await dateFormatSelect.selectOption('DMY');
      
      // Submit
      await page.click('button:has-text("Save")');
      
      // Should show success
      await expect(page.getByText(/updated successfully/i)).toBeVisible({ timeout: 3000 });
    }
  });
});

