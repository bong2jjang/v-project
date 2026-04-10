/**
 * Provider 관리 E2E 테스트
 *
 * Provider 추가, 수정, 삭제, 연결 테스트
 */

import { test, expect } from './fixtures';

test.describe('Provider Management', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Settings 페이지의 Providers 탭으로 이동
    await authenticatedPage.goto('/settings');
    await authenticatedPage.waitForSelector('text=/settings/i');

    // Providers 탭 클릭
    const providersTab = authenticatedPage.locator('button:has-text("Providers"), a:has-text("Providers")').first();
    if (await providersTab.isVisible()) {
      await providersTab.click();
    }
  });

  test('should display providers list', async ({ authenticatedPage: page }) => {
    // Provider 목록 또는 빈 상태 확인
    const providersList = page.locator('text=/providers/i, text=/add provider/i').first();
    await expect(providersList).toBeVisible({ timeout: 5000 });
  });

  test('should open add provider modal', async ({ authenticatedPage: page }) => {
    // Add Provider 버튼 클릭
    const addButton = page.locator('button:has-text("Add Provider"), button:has-text("+ Provider")').first();
    await addButton.click();

    // 모달 열림 확인
    await expect(page.locator('dialog, [role="dialog"]')).toBeVisible({ timeout: 3000 });
  });

  test('should create Slack provider', async ({ authenticatedPage: page }) => {
    // Add Provider 버튼 클릭
    const addButton = page.locator('button:has-text("Add Provider"), button:has-text("+ Provider")').first();
    await addButton.click();

    // Platform 선택: Slack
    const platformSelect = page.locator('select[name="platform"], select#platform').first();
    await platformSelect.selectOption('slack');

    // Provider 정보 입력
    await page.fill('input[name="name"]', 'Test Slack Provider');
    await page.fill('input[name="token"], input[placeholder*="xoxb"]', 'xoxb-test-token-12345');
    await page.fill('input[name="app_token"], input[placeholder*="xapp"]', 'xapp-test-token-67890');

    // 저장 버튼 클릭
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Add"), button[type="submit"]').first();
    await saveButton.click();

    // 성공 메시지 또는 목록에 추가된 Provider 확인
    await expect(page.locator('text=/Test Slack Provider|success|created/i')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should test provider connection', async ({ authenticatedPage: page }) => {
    // 기존 Provider의 연결 테스트 버튼 클릭
    const testButton = page.locator('button:has-text("Test"), button:has-text("Test Connection")').first();

    if (await testButton.isVisible({ timeout: 2000 })) {
      await testButton.click();

      // 테스트 결과 대기 (성공 또는 실패)
      await expect(page.locator('text=/success|fail|error|connected/i')).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('should delete provider', async ({ authenticatedPage: page }) => {
    // 삭제 버튼 클릭
    const deleteButton = page.locator('button:has-text("Delete"), button[aria-label="Delete"]').first();

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
