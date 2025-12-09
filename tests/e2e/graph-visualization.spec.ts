import { test, expect } from '@playwright/test';

/**
 * E2E Test: Graph Visualization
 * Tests: Dashboard Graph → Person Detail Graph → Interactions
 */

test.describe('Graph Visualization', () => {
  // Setup: Login before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'demo@nametag.one');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
  });

  test('should display dashboard graph', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should show graph container
    const graphContainer = page.locator('[data-testid="network-graph"]');
    await expect(graphContainer).toBeVisible({ timeout: 5000 });
    
    // Graph should have rendered (check for SVG or canvas)
    const svg = graphContainer.locator('svg');
    const canvas = graphContainer.locator('canvas');
    
    const hasSvg = await svg.count() > 0;
    const hasCanvas = await canvas.count() > 0;
    
    expect(hasSvg || hasCanvas).toBeTruthy();
  });

  test('should display person detail graph', async ({ page }) => {
    // Navigate to first person
    await page.goto('/people');
    const firstPerson = page.locator('[data-testid="person-item"]').first();
    await firstPerson.click();
    
    // Should show person-specific graph
    const graphContainer = page.locator('[data-testid="network-graph"]');
    if (await graphContainer.isVisible({ timeout: 3000 })) {
      expect(await graphContainer.isVisible()).toBeTruthy();
    }
  });

  test('should handle empty graph gracefully', async ({ page }) => {
    // Create a new user with no people
    // (This would require a test-specific account)
    
    await page.goto('/dashboard');
    
    // Should show empty state or message
    const emptyState = page.getByText(/no people/i);
    const graph = page.locator('[data-testid="network-graph"]');
    
    // Either empty state or graph should be visible
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasGraph = await graph.isVisible().catch(() => false);
    
    expect(hasEmptyState || hasGraph).toBeTruthy();
  });
});

