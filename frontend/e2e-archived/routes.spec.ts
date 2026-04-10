/**
 * Route 관리 E2E 테스트
 *
 * Route 생성, 삭제 플로우
 */

import { test, expect } from './fixtures';

test.describe('Route Management', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Channels 페이지의 Routes 탭으로 이동
    await authenticatedPage.goto('/channels');
    await authenticatedPage.waitForSelector('text=/channels/i');

    // Routes 탭 클릭
    const routesTab = authenticatedPage.locator('button:has-text("Routes"), a:has-text("Routes")').first();
    if (await routesTab.isVisible()) {
      await routesTab.click();
    }
  });

  test('should display routes list', async ({ authenticatedPage: page }) => {
    // Route 목록 또는 빈 상태 확인
    const routesList = page.locator('text=/routes/i, text=/add route/i, text=/no routes/i').first();
    await expect(routesList).toBeVisible({ timeout: 5000 });
  });

  test('should open add route modal', async ({ authenticatedPage: page }) => {
    // Add Route 버튼 클릭
    const addButton = page.locator('button:has-text("Add Route"), button:has-text("+ Route")').first();
    await addButton.click();

    // 모달 열림 확인
    await expect(page.locator('dialog, [role="dialog"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=/add route|create route/i')).toBeVisible();
  });

  test('should create route', async ({ authenticatedPage: page }) => {
    // Add Route 버튼 클릭
    const addButton = page.locator('button:has-text("Add Route"), button:has-text("+ Route")').first();
    await addButton.click();

    // Source Platform 선택
    const sourcePlatformSelect = page.locator('select').first();
    await sourcePlatformSelect.selectOption('slack');

    // Source Channel 선택 (첫 번째 채널)
    await page.waitForTimeout(1000); // 채널 로딩 대기
    const sourceChannelSelect = page.locator('select').nth(1);
    const sourceOptions = await sourceChannelSelect.locator('option').count();
    if (sourceOptions > 1) {
      await sourceChannelSelect.selectOption({ index: 1 });
    }

    // Target Platform 선택
    const targetPlatformSelect = page.locator('select').nth(2);
    await targetPlatformSelect.selectOption('slack');

    // Target Channel 선택 (두 번째 채널)
    await page.waitForTimeout(1000); // 채널 로딩 대기
    const targetChannelSelect = page.locator('select').nth(3);
    const targetOptions = await targetChannelSelect.locator('option').count();
    if (targetOptions > 2) {
      await targetChannelSelect.selectOption({ index: 2 });
    }

    // 저장 버튼 클릭
    const saveButton = page.locator('button:has-text("Add Route"), button:has-text("Save"), button[type="submit"]').first();
    await saveButton.click();

    // 성공 메시지 또는 목록에 추가된 Route 확인
    await expect(page.locator('text=/success|created|added/i')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should show error when source and target are the same', async ({ authenticatedPage: page }) => {
    // Add Route 버튼 클릭
    const addButton = page.locator('button:has-text("Add Route"), button:has-text("+ Route")').first();
    await addButton.click();

    // Source와 Target을 동일하게 설정
    const sourcePlatformSelect = page.locator('select').first();
    await sourcePlatformSelect.selectOption('slack');

    await page.waitForTimeout(1000);
    const sourceChannelSelect = page.locator('select').nth(1);
    await sourceChannelSelect.selectOption({ index: 1 });

    const targetPlatformSelect = page.locator('select').nth(2);
    await targetPlatformSelect.selectOption('slack');

    await page.waitForTimeout(1000);
    const targetChannelSelect = page.locator('select').nth(3);
    // 같은 채널 선택
    await targetChannelSelect.selectOption({ index: 1 });

    // 저장 버튼 클릭
    const saveButton = page.locator('button:has-text("Add Route"), button:has-text("Save")').first();
    await saveButton.click();

    // 에러 메시지 확인
    await expect(page.locator('text=/error|same|cannot|invalid/i')).toBeVisible({
      timeout: 3000,
    });
  });

  test('should delete route', async ({ authenticatedPage: page }) => {
    // 삭제 버튼 클릭 (첫 번째 Route)
    const deleteButton = page.locator('button:has-text("Delete"), button[aria-label*="Delete"], button[aria-label*="Remove"]').first();

    if (await deleteButton.isVisible({ timeout: 2000 })) {
      await deleteButton.click();

      // 확인 다이얼로그가 있다면 확인 클릭
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').first();
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
      }

      // 삭제 성공 메시지 확인
      await expect(page.locator('text=/deleted|removed|success/i')).toBeVisible({
        timeout: 5000,
      });
    }
  });
});
