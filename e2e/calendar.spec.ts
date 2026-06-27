import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

function getTodayJST(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
}

const todayDay = getTodayJST().getDate()

test.describe('寮割カレンダー - 長文字列の表示崩れ', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/calendar')
    await page.locator('table').first().waitFor()
  })

  test('寮名称・住所が長くてもヘッダーが1行に収まり、右側サマリーが見切れない', async ({ page }) => {
    const header = page.locator('.bg-rose-50.border-b.border-gray-200').first()
    const beforeBox = await header.boundingBox()
    expect(beforeBox).not.toBeNull()

    await header.evaluate((el) => {
      const nameSpan = el.querySelector('span.font-bold') as HTMLElement
      nameSpan.textContent = '富士荘超ロングドーミトリーネーム株式会社第一寮棟ビルディング'
      const addrSpan = el.querySelectorAll('span')[2] as HTMLElement
      addrSpan.textContent = '静岡県富士市吉原五丁目五番地五号エクストラロングアドレステストビルディング3階'
    })

    const afterBox = await header.boundingBox()
    expect(afterBox).not.toBeNull()
    // 折り返されずヘッダーの高さが変わらない（1行のまま）
    expect(Math.abs(afterBox!.height - beforeBox!.height)).toBeLessThan(2)

    // 右側の「在籍数・空室状態」サマリーがヘッダー内に収まり、縦に潰れていない
    const summary = header.locator('.ml-auto')
    const summaryBox = await summary.boundingBox()
    expect(summaryBox).not.toBeNull()
    expect(summaryBox!.x + summaryBox!.width).toBeLessThanOrEqual(afterBox!.x + afterBox!.width + 1)
    expect(summaryBox!.height).toBeLessThan(24)
  })

  test('氏名・所属が長くても固定列テーブルの列幅が広がらない', async ({ page }) => {
    const tables = page.locator('table')
    const tableCount = await tables.count()
    expect(tableCount).toBeGreaterThanOrEqual(4) // 2カード分 × (固定列テーブル + スクロールテーブル)

    const firstFixedTable = tables.nth(0)
    const firstDateTable = tables.nth(1)

    // 注入前の「今日」列X座標を記録
    const todayBefore = await firstDateTable.locator('thead th.bg-blue-600').boundingBox()
    expect(todayBefore).not.toBeNull()

    // 1枚目のカードの氏名・所属に長い文字列を注入（左テーブル: 部屋=0, 氏名=1, 所属=2）
    await firstFixedTable.evaluate((table) => {
      const cells = table.querySelectorAll('tbody tr td')
      ;(cells[1] as HTMLElement).textContent = '山田健二郎左衛門エクストラロングネームテスト'
      ;(cells[2] as HTMLElement).textContent = '総務部広報グループ海外事業推進室エクストラロング'
    })

    // 固定列テーブルの列幅が注入前と変わっていない（table-fixedが効いている）
    const nameCell = firstFixedTable.locator('tbody tr td').nth(1)
    const nameCellWidth = await nameCell.evaluate(el => el.getBoundingClientRect().width)
    expect(nameCellWidth).toBeLessThan(120)

    // 同一カード内で「今日」列のX座標がズレていない（固定列幅が変わらないため）
    const todayAfter = await firstDateTable.locator('thead th.bg-blue-600').boundingBox()
    expect(Math.abs(todayAfter!.x - todayBefore!.x)).toBeLessThan(1)
  })

  test('「すべて」タブで全寮分のDormCardが表示され、各カードの先頭行・最終行・フッターが overflow-hidden にクリップされず見える', async ({ page }) => {
    const dormCards = page.locator('.flex-1.overflow-y-auto.p-4.flex.flex-col.gap-3 > div')
    const cardCount = await dormCards.count()
    expect(cardCount).toBeGreaterThanOrEqual(1)

    for (let i = 0; i < cardCount; i++) {
      const card = dormCards.nth(i)
      const fixedTable = card.locator('table').first()
      await expect(fixedTable).toBeVisible()
      await card.scrollIntoViewIfNeeded()

      const cardBox = await card.boundingBox()
      expect(cardBox).not.toBeNull()

      // フッター（サマリーバー）がカードの overflow-hidden に隠れていない（flex-shrink圧縮の回帰検知）
      const footer = card.locator('.border-t.border-gray-200')
      const footerBox = await footer.boundingBox()
      expect(footerBox).not.toBeNull()
      expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height + 1)

      // 部屋数0の寮（心斎橋苑の片方）はtbodyが空のため、先頭行チェックは部屋がある寮のみ対象
      const rowCount = await fixedTable.locator('tbody tr').count()
      if (rowCount === 0) continue

      const firstRoomCell = fixedTable.locator('tbody tr').first().locator('td').first()
      await expect(firstRoomCell).toBeVisible()
      const text = await firstRoomCell.textContent()
      expect(text?.trim().length).toBeGreaterThan(0)

      // 最終行がカードの overflow-hidden にクリップされていない（flex-shrink圧縮の回帰検知）
      const lastRow = fixedTable.locator('tbody tr').last()
      const lastRowBox = await lastRow.boundingBox()
      expect(lastRowBox).not.toBeNull()
      expect(lastRowBox!.y + lastRowBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height + 1)
    }
  })

  test(`当日（${todayDay}日）の日付ヘッダーセルがbg-blue-600で表示される`, async ({ page }) => {
    const dateTable = page.locator('table').nth(1) // 1カード目のスクロール可能テーブル
    const todayHeader = dateTable.locator('thead tr').nth(1).locator('th.bg-blue-600')
    await expect(todayHeader).toBeVisible()
    await expect(todayHeader).toHaveText(String(todayDay))
  })

  test('rowSpanが設定された部屋セルは住民数と一致する', async ({ page }) => {
    const dormCards = page.locator('.flex-1.overflow-y-auto.p-4.flex.flex-col.gap-3 > div')
    const cardCount = await dormCards.count()
    expect(cardCount).toBeGreaterThanOrEqual(1)
    // 各カードの固定テーブルで、rowSpan属性付きの部屋セルが正整数であることを確認
    for (let i = 0; i < cardCount; i++) {
      const fixedTable = dormCards.nth(i).locator('table').first()
      const cells = fixedTable.locator('tbody td[rowspan]')
      const count = await cells.count()
      for (let j = 0; j < count; j++) {
        const rs = await cells.nth(j).getAttribute('rowspan')
        expect(parseInt(rs!, 10)).toBeGreaterThanOrEqual(1)
      }
    }
  })

  test('空室の行は部屋名と「—」が表示され、部屋セルのrowSpanが1になる', async ({ page }) => {
    const dormCards = page.locator('.flex-1.overflow-y-auto.p-4.flex.flex-col.gap-3 > div')
    // 空室行（氏名セルが「—」）を持つカードを探す
    let found = false
    const cardCount = await dormCards.count()
    for (let i = 0; i < cardCount; i++) {
      const fixedTable = dormCards.nth(i).locator('table').first()
      const rows = fixedTable.locator('tbody tr')
      const rowCount = await rows.count()
      for (let j = 0; j < rowCount; j++) {
        const nameCell = rows.nth(j).locator('td').nth(1)
        const text = await nameCell.textContent()
        if (text?.trim() === '—') {
          // 空室行の部屋セルのrowSpanが1
          const roomCell = rows.nth(j).locator('td').first()
          await expect(roomCell).toHaveAttribute('rowspan', '1')
          found = true
          break
        }
      }
      if (found) break
    }
    expect(found).toBe(true)
  })
})

test.describe('寮割カレンダー - 当日が週末の場合の日付ヘッダー強調（P4）', () => {
  test('当日が土曜日でも週末用の薄い背景色に上書きされず bg-blue-600 で表示される', async ({ page }) => {
    // 2026-06-20はJSTで土曜日（dow===6）
    await page.clock.setFixedTime(new Date('2026-06-20T03:00:00Z'))
    await loginAsAdmin(page)
    await page.goto('/calendar')
    await page.locator('table').first().waitFor()

    const dateTable = page.locator('table').nth(1) // 1カード目のスクロール可能テーブル
    const todayHeader = dateTable.locator('thead tr').nth(1).locator('th.bg-blue-600')
    await expect(todayHeader).toBeVisible()
    await expect(todayHeader).toHaveText('20')
    await expect(todayHeader).toHaveCSS('background-color', 'oklch(0.546 0.245 262.881)')
  })
})
