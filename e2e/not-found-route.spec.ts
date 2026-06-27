import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

test.describe('未定義URL・デッドリンクで画面が操作不能にならない', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('部屋詳細の入居者名は未実装の社員詳細ページへのデッドリンクにならない', async ({ page }) => {
    await page.goto('/dorms/b08c62fd-9995-46d7-81fe-15887e58d6e4/rooms/62c175d6-167c-415f-9c2d-f912d5c542e8')
    await expect(page.getByText('田中太郎').first()).toBeVisible()
    await expect(page.locator('a[href^="/employees/"]')).toHaveCount(0)
  })

  test('未定義のURLに直接アクセスしても404エラー画面のまま操作不能にならない', async ({ page }) => {
    await page.goto('/this-page-does-not-exist')
    await expect(page.getByText('404 Not Found')).not.toBeVisible()
    await expect(page.getByRole('link', { name: '寮割カレンダー' })).toBeVisible()
  })
})
