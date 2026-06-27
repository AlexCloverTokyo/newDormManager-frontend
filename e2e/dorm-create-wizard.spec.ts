import { test, expect, type Page } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

async function deleteDormByName(page: Page, name: string) {
  for (let i = 0; i < 10; i++) {
    await page.goto('/dorms')
    await page.waitForLoadState('networkidle')
    const link = page.getByRole('link', { name, exact: true })
    if (await link.count() === 0) return
    await link.first().click()
    await page.getByRole('button', { name: '削除' }).first().click()
    await page.getByRole('alertdialog').getByRole('button', { name: '削除', exact: true }).click()
    await page.getByText('寮を削除しました').first().waitFor()
  }
}

test.describe('寮新規登録ウィザード（Step1: 寮情報＋予定部屋数 → Step2: 部屋を繰り返し登録）', () => {
  let createdDormName: string

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/dorms')
  })

  test.afterEach(async ({ page }) => {
    await deleteDormByName(page, createdDormName)
  })

  test('予定部屋数2件すべて登録すると、詳細画面に「未登録」バッジが表示されず新規登録ボタンが無効化される', async ({ page }) => {
    createdDormName = 'E2Eテスト寮A'
    await page.getByRole('button', { name: '新規登録' }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Step 1/2')).toBeVisible()

    await dialog.getByLabel('寮名称 *').fill('E2Eテスト寮A')
    await dialog.getByLabel('住所 *').fill('東京都江東区豊洲9-9-9')

    // 所在地（1番目のSelect）
    await dialog.getByRole('combobox').nth(0).click()
    await page.getByRole('option', { name: '東京' }).click()

    // 寮種別（2番目のSelect）
    await dialog.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: '男性', exact: true }).click()

    await dialog.getByLabel('予定部屋数 *').fill('2')
    await dialog.getByRole('button', { name: '次へ（寮を作成）' }).click()

    await expect(dialog.getByText('Step 2/2')).toBeVisible()
    await expect(dialog.getByText('登録済み 0 / 予定 2')).toBeVisible()

    // 1部屋目
    await dialog.getByLabel('部屋名称 *').fill('101')
    await dialog.getByRole('combobox').nth(0).click()
    await page.getByRole('option', { name: '洋室' }).click()
    await dialog.getByLabel('部屋面積（㎡）').fill('20')
    await dialog.getByLabel('単価計算用（円/㎡/日）').fill('80')
    await dialog.getByRole('button', { name: '保存して次へ（1/2）' }).click()
    await expect(dialog.getByText('✓ 101')).toBeVisible()

    // 2部屋目
    await dialog.getByLabel('部屋名称 *').fill('102')
    await dialog.getByRole('combobox').nth(0).click()
    await page.getByRole('option', { name: '洋室' }).click()
    await dialog.getByLabel('部屋面積（㎡）').fill('18')
    await dialog.getByLabel('単価計算用（円/㎡/日）').fill('75')
    await dialog.getByRole('button', { name: '保存して次へ（2/2）' }).click()
    await expect(dialog.getByText('✓ 102')).toBeVisible()

    // 予定数に達すると入力フォームが消え、「完了」のみ表示
    await expect(dialog.getByLabel('部屋名称 *')).not.toBeVisible()
    await dialog.getByRole('button', { name: '完了' }).click()
    await expect(dialog).not.toBeVisible()

    await page.getByRole('link', { name: 'E2Eテスト寮A' }).click()
    await expect(page.getByText('2件 / 予定 2件')).toBeVisible()
    await expect(page.getByText(/未登録/)).not.toBeVisible()
    await expect(page.getByRole('button', { name: '新規登録' })).toBeDisabled()
  })

  test('予定部屋数3件中1件のみ登録すると、詳細画面に「未登録 2件」バッジが表示され新規登録ボタンは有効のまま', async ({ page }) => {
    createdDormName = 'E2Eテスト寮B'
    await page.getByRole('button', { name: '新規登録' }).first().click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('寮名称 *').fill('E2Eテスト寮B')
    await dialog.getByLabel('住所 *').fill('東京都江東区豊洲8-8-8')
    await dialog.getByRole('combobox').nth(0).click()
    await page.getByRole('option', { name: '東京' }).click()
    await dialog.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: '女性', exact: true }).click()
    await dialog.getByLabel('予定部屋数 *').fill('3')
    await dialog.getByRole('button', { name: '次へ（寮を作成）' }).click()

    await expect(dialog.getByText('登録済み 0 / 予定 3')).toBeVisible()
    await dialog.getByLabel('部屋名称 *').fill('201')
    await dialog.getByRole('combobox').nth(0).click()
    await page.getByRole('option', { name: '和室' }).click()
    await dialog.getByLabel('部屋面積（㎡）').fill('22')
    await dialog.getByLabel('単価計算用（円/㎡/日）').fill('90')
    await dialog.getByRole('button', { name: '保存して次へ（1/3）' }).click()
    await expect(dialog.getByText('✓ 201')).toBeVisible()

    await dialog.getByRole('button', { name: '完了' }).click()
    await expect(dialog).not.toBeVisible()

    await page.getByRole('link', { name: 'E2Eテスト寮B' }).click()
    await expect(page.getByText('1件 / 予定 3件')).toBeVisible()
    await expect(page.getByText('⚠ 未登録 2件')).toBeVisible()
    await expect(page.getByRole('button', { name: '新規登録' })).toBeEnabled()
  })

  test('寮種別を「未定」のまま登録すると、ボード表示の「性別未定」セクションに表示される', async ({ page }) => {
    createdDormName = 'E2Eテスト寮C'
    await page.getByRole('button', { name: '新規登録' }).first().click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('寮名称 *').fill('E2Eテスト寮C')
    await dialog.getByLabel('住所 *').fill('東京都江東区豊洲7-7-7')
    await dialog.getByRole('combobox').nth(0).click()
    await page.getByRole('option', { name: '東京' }).click()
    // 寮種別は「未定」のまま（デフォルト選択を変更しない）
    await dialog.getByLabel('予定部屋数 *').fill('1')
    await dialog.getByRole('button', { name: '次へ（寮を作成）' }).click()

    await expect(dialog.getByText('Step 2/2')).toBeVisible()
    await dialog.getByRole('button', { name: '完了' }).click()
    await expect(dialog).not.toBeVisible()

    await page.getByTitle('ボード表示').first().click()
    await expect(page.getByRole('heading', { name: '性別未定' })).toBeVisible()

    const dormBlock = page.getByRole('link', { name: 'E2Eテスト寮C' }).locator('..')
    await expect(dormBlock.getByText('未定')).toBeVisible()
  })
})
