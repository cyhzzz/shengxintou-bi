import { test, expect, type Page } from '@playwright/test';

const FIXED_ASSISTANTS = [
  '陈鸿', '荣杜娟', '贾芳', '赵梅', '袁孝春', '张杰明',
  '吴茂秋', '何泳萍', '李兆俊', '史菡漾', '朱橙青', '杨华',
];

async function waitForWeeklyResponse(page: Page) {
  return page.waitForResponse((response) => (
    response.url().includes('/api/v1/employee-conversion/weekly')
    && response.request().method() === 'POST'
    && response.status() === 200
  ));
}

test('固定 12 人参与周报排名且生成过程无运行时错误', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  const initialResponsePromise = waitForWeeklyResponse(page);
  await page.goto('/employee-conversion/weekly');
  const initialResponse = await initialResponsePromise;
  const initialPayload = await initialResponse.json();

  await expect(page.getByText('固定 12 名员工')).toHaveCount(3);
  await expect(page.getByText('榜单人数')).toHaveCount(0);

  const tables = page.locator('table');
  await expect(tables).toHaveCount(3);

  const backendOrder = initialPayload.data.rankings['小红书'].total
    .map((item: { employee_name: string }) => item.employee_name);
  const missingNames = FIXED_ASSISTANTS.filter((name) => !backendOrder.includes(name));
  const expectedOrder = [...backendOrder, ...missingNames];
  const visibleOrder = await tables.first().locator('tbody tr:not(:last-child) td:nth-child(2)').allTextContents();

  expect(visibleOrder).toEqual(expectedOrder);
  expect(new Set(visibleOrder)).toEqual(new Set(FIXED_ASSISTANTS));

  const manualResponsePromise = waitForWeeklyResponse(page);
  await page.getByRole('button', { name: '生成周报' }).click();
  await manualResponsePromise;
  await expect(page.getByText('周报生成成功')).toBeVisible();

  expect(pageErrors).toEqual([]);
});
