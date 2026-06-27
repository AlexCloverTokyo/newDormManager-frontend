import type { Page } from '@playwright/test'

export async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill('admin@company.co.jp')
  await page.locator('input[type="password"]').fill('admin123')
  await page.locator('input[type="password"]').press('Enter')
  await page.waitForURL('/')
}
