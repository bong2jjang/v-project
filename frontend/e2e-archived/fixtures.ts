/**
 * Playwright 테스트 픽스쳐
 *
 * 로그인 상태 등 공통 설정
 */

import { test as base, Page } from '@playwright/test';

interface TestFixtures {
  authenticatedPage: Page;
}

/**
 * 로그인된 페이지 픽스쳐
 */
export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // 로그인 페이지로 이동
    await page.goto('/login');

    // 테스트용 관리자 계정으로 로그인
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // 로그인 성공 대기 (대시보드 페이지로 이동)
    await page.waitForURL('/');
    await page.waitForSelector('text=Dashboard', { timeout: 5000 });

    // 테스트에서 사용
    await use(page);

    // 정리 (로그아웃 등)
    // 현재는 localStorage만 클리어
    await page.evaluate(() => localStorage.clear());
  },
});

export { expect } from '@playwright/test';
