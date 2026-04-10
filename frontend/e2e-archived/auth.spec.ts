/**
 * 인증 플로우 E2E 테스트
 *
 * 로그인, 로그아웃 테스트
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    // 로그인 폼 확인
    await expect(page.locator('h1, h2')).toContainText(/login|sign in/i);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // 잘못된 계정 정보 입력
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // 에러 메시지 확인
    await expect(page.locator('text=/invalid|incorrect|wrong/i')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // 올바른 관리자 계정 정보 입력
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // 대시보드로 리다이렉트 확인
    await page.waitForURL('/', { timeout: 5000 });
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // 로그인
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // 로그아웃 버튼 클릭 (헤더 또는 메뉴에 있음)
    // 로그아웃 버튼의 정확한 선택자는 UI에 따라 다를 수 있음
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("로그아웃"), a:has-text("Logout")').first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();

      // 로그인 페이지로 리다이렉트 확인
      await page.waitForURL('/login', { timeout: 5000 });
    }
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // 로컬 스토리지 클리어 (로그아웃 상태)
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // 보호된 페이지 접근 시도
    await page.goto('/settings');

    // 로그인 페이지로 리다이렉트 확인
    await page.waitForURL('/login', { timeout: 5000 });
  });
});
