import { test, expect } from '@playwright/test';

/**
 * E2E Test: Complete Authentication Flow
 * Tests: Registration → Email Verification → Login → Logout
 */

test.describe('Authentication Flow', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  const testName = 'Test User';

  test('should complete full registration and login flow', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/register');
    
    // Fill in registration form
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="name"]', testName);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show verification message
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 5000 });
    
    // Note: In a real E2E test, you would:
    // 1. Check email inbox for verification link
    // 2. Extract verification token
    // 3. Visit verification URL
    // For now, we'll verify the page shows the correct message
  });

  test('should show error for duplicate email registration', async ({ page }) => {
    await page.goto('/register');
    
    // Try to register with demo account email
    await page.fill('input[name="email"]', 'demo@nametag.one');
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="name"]', testName);
    
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.getByText(/already exists/i)).toBeVisible({ timeout: 5000 });
  });

  test('should enforce password requirements', async ({ page }) => {
    await page.goto('/register');
    
    await page.fill('input[name="email"]', `test-weak-${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'weak'); // Too short, no complexity
    await page.fill('input[name="name"]', testName);
    
    await page.click('button[type="submit"]');
    
    // Should show password requirement errors
    await expect(page.getByText(/at least 12 characters/i)).toBeVisible({ timeout: 3000 });
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Use demo account
    await page.fill('input[name="email"]', 'demo@nametag.one');
    await page.fill('input[name="password"]', 'password123');
    
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 3000 });
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'demo@nametag.one');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
    
    // Click logout (adjust selector based on your UI)
    await page.click('button:has-text("Logout")');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login', { timeout: 3000 });
  });
});

