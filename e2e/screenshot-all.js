// frontend/e2e/screenshot-all.js
import pw from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const { chromium } = pw
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Config ---
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@company.co.jp'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const STAFF_EMAIL = process.env.STAFF_EMAIL || 'suzuki@company.co.jp'
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'staff123'
const FROZEN_TIME = '2026-06-15T12:00:00+09:00'
const VIEWPORT = { width: 1440, height: 900 }
const OUTPUT_DIR = path.resolve(__dirname, '../../tmp/screenshots')
const EDGE_PREFIX = 'SCREENSHOT_TEST_'

// --- State ---
const results = []
let counter = 0
let edgeCaseIds = { employeeId: null, dormId: null }
let activePage = null // for SIGINT cleanup

// --- SIGINT handler ---
process.on('SIGINT', async () => {
  console.log('\nInterrupted — cleaning up edge case data...')
  if (activePage) {
    try { await cleanupEdgeCaseData(activePage) } catch {}
  }
  process.exit(1)
})

// --- Utility: Server health check ---
async function waitForServer(url, maxRetries = 10, intervalMs = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch { /* ignore */ }
    console.log(`Waiting for ${url}... (${i + 1}/${maxRetries})`)
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`Server not responding at ${url} after ${maxRetries} retries`)
}

// --- Utility: Login ---
async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForSelector('input[type="email"]', { state: 'visible' })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('input[type="password"]').press('Enter')
  await page.waitForURL(/\/$/)
}

// --- Utility: Wait for API response + DOM element ---
async function waitForPageData(page, apiPattern, domSelector, timeout = 15000) {
  await Promise.all([
    page.waitForResponse(res => {
      if (!res.url().includes(apiPattern)) return false
      if (res.status() !== 200) console.warn(`[Warning] ${apiPattern} returned ${res.status()}`)
      return true
    }, { timeout }),
    page.waitForSelector(domSelector, { state: 'visible', timeout })
  ])
}

// --- Utility: Navigate and wait ---
async function navigateTo(page, urlPath, apiPattern, domSelector) {
  if (apiPattern && domSelector) {
    await Promise.all([
      page.waitForResponse(res => {
        if (!res.url().includes(apiPattern)) return false
        if (res.status() !== 200) console.warn(`[Warning] ${apiPattern} returned ${res.status()}`)
        return true
      }, { timeout: 15000 }),
      page.goto(`${BASE_URL}${urlPath}`)
    ])
    await page.waitForSelector(domSelector, { state: 'visible', timeout: 10000 })
  } else {
    await page.goto(`${BASE_URL}${urlPath}`)
    await page.waitForTimeout(1000)
  }
}

// --- Utility: Take screenshot (with font wait) ---
async function takeScreenshot(page, name, { fullPage = false } = {}) {
  const filename = `${String(++counter).padStart(2, '0')}-${name}.png`
  const filepath = path.join(OUTPUT_DIR, filename)
  await page.evaluate(() => document.fonts.ready)
  if (fullPage) {
    await screenshotFullPage(page, filepath)
  } else {
    await page.screenshot({ path: filepath, animations: 'disabled' })
  }
  return filename
}

// --- Utility: Full-page screenshot with sticky/fixed handling ---
async function screenshotFullPage(page, filepath) {
  await page.evaluate(() => {
    document.querySelectorAll('.sticky, .fixed, [class*="sticky"], [class*="fixed"]').forEach(el => {
      const pos = getComputedStyle(el).position
      if (pos !== 'sticky' && pos !== 'fixed') return
      el.dataset.origPosition = pos
      el.dataset.origOpacity = el.style.opacity
      const rect = el.getBoundingClientRect()
      if (rect.top < 100 || rect.left < 300) {
        el.style.position = 'relative'
      } else {
        el.style.opacity = '0'
      }
    })
  })
  await page.screenshot({ path: filepath, fullPage: true, animations: 'disabled' })
  await page.evaluate(() => {
    document.querySelectorAll('[data-orig-position]').forEach(el => {
      el.style.position = el.dataset.origPosition
      el.style.opacity = el.dataset.origOpacity
      delete el.dataset.origPosition
      delete el.dataset.origOpacity
    })
  })
}

// --- Utility: Open dialog, screenshot, close ---
async function openAndScreenshotDialog(page, triggerSelector, name, opts = {}) {
  await page.click(triggerSelector)
  await page.waitForSelector('[role="dialog"]', { state: 'visible' })
  const filename = await takeScreenshot(page, name, opts)
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role="dialog"]', { state: 'hidden' })
  return filename
}

// --- Utility: Open dropdown menu, screenshot, close ---
async function openAndScreenshotMenu(page, triggerSelector, name) {
  await page.click(triggerSelector)
  await page.waitForSelector('[role="menu"]', { state: 'visible' })
  const filename = await takeScreenshot(page, name)
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role="menu"]', { state: 'hidden' })
  return filename
}

// --- Utility: Open popover, screenshot, close ---
async function openAndScreenshotPopover(page, triggerSelector, name) {
  await page.click(triggerSelector)
  await page.waitForSelector('[data-state="open"]', { state: 'visible' })
  const filename = await takeScreenshot(page, name)
  await page.keyboard.press('Escape')
  await page.waitForSelector('[data-state="open"]', { state: 'hidden' }).catch(() => {})
  return filename
}

// --- Utility: Record result ---
function record(filename, section, description, status = 'ok', error = null) {
  results.push({ filename, section, description, status, error })
}

// --- Utility: Authenticated fetch helper (runs inside page context) ---
async function apiFetch(page, urlPath, options = {}) {
  return page.evaluate(async ([url, opts]) => {
    const token = localStorage.getItem('token')
    const headers = { 'Content-Type': 'application/json', ...opts.headers }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(url, { ...opts, headers })
    const text = await res.text()
    let body = null
    try { body = JSON.parse(text) } catch {}
    return { ok: res.ok, status: res.status, body }
  }, [urlPath, options])
}

// --- Utility: Cleanup edge case data ---
async function cleanupEdgeCaseData(page) {
  try {
    if (edgeCaseIds.employeeId) {
      await apiFetch(page, `/api/employees/${edgeCaseIds.employeeId}?version=1`, { method: 'DELETE' })
      edgeCaseIds.employeeId = null
    }
  } catch {}
  try {
    if (edgeCaseIds.dormId) {
      await apiFetch(page, `/api/dorms/${edgeCaseIds.dormId}?version=1`, { method: 'DELETE' })
      edgeCaseIds.dormId = null
    }
  } catch {}
  // Also search for leftover SCREENSHOT_TEST_ data
  try {
    const res = await apiFetch(page, '/api/employees?page_size=200')
    const employees = res.body?.data ?? res.body
    const items = Array.isArray(employees) ? employees : (employees?.items || [])
    for (const emp of items) {
      if (emp.name && emp.name.startsWith(EDGE_PREFIX)) {
        const v = emp.version ?? 1
        await apiFetch(page, `/api/employees/${emp.employee_id}?version=${v}`, { method: 'DELETE' })
      }
    }
  } catch {}
  try {
    const res = await apiFetch(page, '/api/dorms')
    const dorms = res.body?.data ?? res.body
    const arr = Array.isArray(dorms) ? dorms : []
    for (const d of arr) {
      if (d.name && d.name.startsWith(EDGE_PREFIX)) {
        const v = d.version ?? 1
        await apiFetch(page, `/api/dorms/${d.dorm_id}?version=${v}`, { method: 'DELETE' })
      }
    }
  } catch {}
}

// --- Screenshot: Login (IDs 01-02) ---
async function captureLoginScreenshots(browser) {
  const ctx = await browser.newContext({ viewport: VIEWPORT })
  const page = await ctx.newPage()

  // 01 - login default
  try {
    await page.goto(`${BASE_URL}/login`)
    await page.waitForSelector('input[type="email"]', { state: 'visible' })
    const f = await takeScreenshot(page, 'login-default')
    record(f, 'ログイン画面 `/login`', 'ログインフォーム空白状態')
  } catch (e) { record(null, 'ログイン画面 `/login`', 'ログインフォーム空白状態', 'failed', e.message) }

  // 02 - login error
  try {
    await page.locator('input[type="email"]').fill('admin@company.co.jp')
    await page.locator('input[type="password"]').fill('wrong_password')
    await page.locator('input[type="password"]').press('Enter')
    // Error message: <p className="text-sm text-red-600">
    await page.waitForSelector('.text-red-600, [role="alert"], .text-destructive', { state: 'visible', timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(500)
    const f = await takeScreenshot(page, 'login-error')
    record(f, 'ログイン画面 `/login`', 'パスワード誤入力後のエラーメッセージ表示')
  } catch (e) { record(null, 'ログイン画面 `/login`', 'エラー表示', 'failed', e.message) }

  await ctx.close()
}

// --- Screenshot: Calendar (IDs 03-12) ---
async function captureCalendarScreenshots(page) {
  // 03 - calendar default
  try {
    await page.goto(`${BASE_URL}/`)
    await waitForPageData(page, '/api/calendar', '.rounded-lg.border.border-gray-200.bg-white')
    const f = await takeScreenshot(page, 'calendar-default', { fullPage: true })
    record(f, '寮割カレンダー `/`', '当月・「すべて」タブ・全寮表示')
  } catch (e) { record(null, '寮割カレンダー `/`', 'デフォルト', 'failed', e.message) }

  // 04 - region tab
  try {
    await page.goto(`${BASE_URL}/`)
    await waitForPageData(page, '/api/calendar', '.rounded-lg.border.border-gray-200.bg-white')
    // Location tabs are buttons next to "すべて" — get the second tab (first region)
    const regionTabs = page.locator('.overflow-x-auto button').filter({ hasNot: page.locator('text=すべて') })
    if (await regionTabs.count() > 0) {
      await regionTabs.first().click()
      await page.waitForTimeout(1000)
    }
    const f = await takeScreenshot(page, 'calendar-region-tab', { fullPage: true })
    record(f, '寮割カレンダー `/`', '地域タブ選択')
  } catch (e) { record(null, '寮割カレンダー `/`', '地域タブ選択', 'failed', e.message) }

  // 05 - search result
  try {
    await page.goto(`${BASE_URL}/`)
    await waitForPageData(page, '/api/calendar', '.rounded-lg.border.border-gray-200.bg-white')
    const searchInput = page.locator('input[placeholder="氏名で検索..."]')
    if (await searchInput.count() > 0) {
      await searchInput.fill('田中')
      await page.waitForTimeout(500)
    }
    const f = await takeScreenshot(page, 'calendar-search', { fullPage: true })
    record(f, '寮割カレンダー `/`', '検索結果（「田中」）')
  } catch (e) { record(null, '寮割カレンダー `/`', '検索結果', 'failed', e.message) }

  // 06 - search no result
  try {
    await page.goto(`${BASE_URL}/`)
    await waitForPageData(page, '/api/calendar', '.rounded-lg.border.border-gray-200.bg-white')
    const searchInput = page.locator('input[placeholder="氏名で検索..."]')
    if (await searchInput.count() > 0) {
      await searchInput.fill('ZZZZNOTFOUND')
      await page.waitForTimeout(500)
    }
    const f = await takeScreenshot(page, 'calendar-search-no-result', { fullPage: true })
    record(f, '寮割カレンダー `/`', '検索結果なし')
  } catch (e) { record(null, '寮割カレンダー `/`', '検索結果なし', 'failed', e.message) }

  // 07 - column settings popover
  try {
    await page.goto(`${BASE_URL}/`)
    await waitForPageData(page, '/api/calendar', '.rounded-lg.border.border-gray-200.bg-white')
    // Button text contains "列設定"
    const colBtn = page.locator('button:has-text("列設定")')
    if (await colBtn.count() > 0) {
      const f = await openAndScreenshotPopover(page, 'button:has-text("列設定")', 'calendar-column-settings')
      record(f, '寮割カレンダー `/`', '列設定 Popover')
    } else {
      record(null, '寮割カレンダー `/`', '列設定 Popover', 'failed', 'Column settings button not found')
    }
  } catch (e) { record(null, '寮割カレンダー `/`', '列設定 Popover', 'failed', e.message) }

  // 08 - move-in drawer (click an empty/vacant cell)
  try {
    await page.goto(`${BASE_URL}/`)
    await waitForPageData(page, '/api/calendar', '.rounded-lg.border.border-gray-200.bg-white')
    // Vacant cells have cursor-pointer class and are clickable tds in the date grid
    const vacantCell = page.locator('td.cursor-pointer').first()
    if (await vacantCell.count() > 0) {
      await vacantCell.click()
      // MoveInDrawer uses Sheet component which renders [role="dialog"]
      await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 3000 })
      const f = await takeScreenshot(page, 'calendar-move-in-drawer')
      record(f, '寮割カレンダー `/`', '入居 Drawer（空室セルクリック）')
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="dialog"]', { state: 'hidden' }).catch(() => {})
    } else {
      record(null, '寮割カレンダー `/`', '入居 Drawer', 'failed', 'No vacant cell found')
    }
  } catch (e) { record(null, '寮割カレンダー `/`', '入居 Drawer', 'failed', e.message) }

  // 09 - print dialog
  try {
    await page.goto(`${BASE_URL}/`)
    await waitForPageData(page, '/api/calendar', '.rounded-lg.border.border-gray-200.bg-white')
    const printBtn = page.locator('button:has-text("印刷")')
    if (await printBtn.count() > 0) {
      const f = await openAndScreenshotDialog(page, 'button:has-text("印刷")', 'calendar-print-dialog')
      record(f, '寮割カレンダー `/`', '印刷設定 Dialog')
    } else {
      record(null, '寮割カレンダー `/`', '印刷設定 Dialog', 'failed', 'Print button not found')
    }
  } catch (e) { record(null, '寮割カレンダー `/`', '印刷設定 Dialog', 'failed', e.message) }

  // 10 - scroll right
  try {
    await page.goto(`${BASE_URL}/`)
    await waitForPageData(page, '/api/calendar', '.rounded-lg.border.border-gray-200.bg-white')
    // The date grid is inside .overflow-x-auto inside each DormCard
    const scrollable = page.locator('.overflow-x-auto').first()
    if (await scrollable.count() > 0) {
      await scrollable.evaluate(el => el.scrollLeft = el.scrollWidth)
      await page.waitForTimeout(300)
    }
    const f = await takeScreenshot(page, 'calendar-scroll-right', { fullPage: true })
    record(f, '寮割カレンダー `/`', '横スクロール右端')
  } catch (e) { record(null, '寮割カレンダー `/`', '横スクロール右端', 'failed', e.message) }

  // 11 - division filter
  try {
    await page.goto(`${BASE_URL}/`)
    await waitForPageData(page, '/api/calendar', '.rounded-lg.border.border-gray-200.bg-white')
    // Division filter is a shadcn Select with a SelectTrigger containing "事業部" placeholder
    // The trigger has class w-28 h-8 text-xs and shows "全事業部" by default
    const divTrigger = page.locator('button[role="combobox"]:has-text("全事業部"), button[role="combobox"]:has-text("事業部")').first()
    if (await divTrigger.count() > 0) {
      await divTrigger.click()
      await page.waitForTimeout(300)
    }
    const f = await takeScreenshot(page, 'calendar-division-filter')
    record(f, '寮割カレンダー `/`', '事業部フィルタ')
  } catch (e) { record(null, '寮割カレンダー `/`', '事業部フィルタ', 'failed', e.message) }

  // 12 - month nav
  try {
    await page.goto(`${BASE_URL}/`)
    await waitForPageData(page, '/api/calendar', '.rounded-lg.border.border-gray-200.bg-white')
    // Previous month button is the first <button> inside the month nav div (has ChevronLeft icon)
    // The month nav has a span with "年" and "月" between two buttons
    const prevBtn = page.locator('button:has(svg.lucide-chevron-left)').first()
    if (await prevBtn.count() > 0) {
      await prevBtn.click()
      await page.waitForTimeout(1500)
    }
    const f = await takeScreenshot(page, 'calendar-month-nav', { fullPage: true })
    record(f, '寮割カレンダー `/`', '月切替（前月）')
  } catch (e) { record(null, '寮割カレンダー `/`', '月切替', 'failed', e.message) }
}

// --- Screenshot: Dashboard (ID 13) ---
async function captureDashboardScreenshots(page) {
  try {
    await page.goto(`${BASE_URL}/dashboard`)
    await waitForPageData(page, '/api/summary', 'h1:has-text("ダッシュボード")')
    const f = await takeScreenshot(page, 'dashboard-default', { fullPage: true })
    record(f, 'ダッシュボード `/dashboard`', '統計カード・空室状況・最近入居')
  } catch (e) { record(null, 'ダッシュボード `/dashboard`', 'デフォルト', 'failed', e.message) }
}

// --- Screenshot: Analytics (ID 14) ---
async function captureAnalyticsScreenshots(page) {
  try {
    await page.goto(`${BASE_URL}/analytics`)
    await waitForPageData(page, '/api/analytics', '.recharts-wrapper')
    const f = await takeScreenshot(page, 'analytics-default', { fullPage: true })
    record(f, 'データ分析 `/analytics`', '4象限チャート')
  } catch (e) { record(null, 'データ分析 `/analytics`', 'デフォルト', 'failed', e.message) }
}

// --- Screenshot: Dorm Management (IDs 15-19) ---
async function captureDormScreenshots(page) {
  // 15 - dorm list table
  try {
    await page.goto(`${BASE_URL}/dorms`)
    await waitForPageData(page, '/api/dorms', 'table tbody tr')
    const f = await takeScreenshot(page, 'dorm-list-table', { fullPage: true })
    record(f, '寮管理 `/dorms`', 'リスト表示')
  } catch (e) { record(null, '寮管理 `/dorms`', 'リスト表示', 'failed', e.message) }

  // 16 - dorm list board
  try {
    await page.goto(`${BASE_URL}/dorms`)
    await waitForPageData(page, '/api/dorms', 'table tbody tr')
    const boardBtn = page.locator('button[title="ボード表示"]')
    if (await boardBtn.count() > 0) await boardBtn.click()
    await page.waitForTimeout(500)
    const f = await takeScreenshot(page, 'dorm-list-board', { fullPage: true })
    record(f, '寮管理 `/dorms`', 'ボード表示')
  } catch (e) { record(null, '寮管理 `/dorms`', 'ボード表示', 'failed', e.message) }

  // 17 - dorm form new (ensure list view mode)
  try {
    await page.evaluate(() => localStorage.setItem('dormViewMode', 'list'))
    await page.goto(`${BASE_URL}/dorms`)
    await waitForPageData(page, '/api/dorms', 'table tbody tr')
    const f = await openAndScreenshotDialog(page, 'button:has-text("新規登録")', 'dorm-form-new')
    record(f, '寮管理 `/dorms`', '新規登録 Dialog')
  } catch (e) { record(null, '寮管理 `/dorms`', '新規登録 Dialog', 'failed', e.message) }

  // 18 - dorm form edit
  try {
    await page.evaluate(() => localStorage.setItem('dormViewMode', 'list'))
    await page.goto(`${BASE_URL}/dorms`)
    await waitForPageData(page, '/api/dorms', 'table tbody tr')
    const editBtn = page.locator('table tbody tr button:has-text("編集")').first()
    if (await editBtn.count() > 0) {
      await editBtn.click()
      await page.waitForSelector('[role="dialog"]', { state: 'visible' })
      const f = await takeScreenshot(page, 'dorm-form-edit')
      record(f, '寮管理 `/dorms`', '編集 Dialog')
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="dialog"]', { state: 'hidden' })
    }
  } catch (e) { record(null, '寮管理 `/dorms`', '編集 Dialog', 'failed', e.message) }

  // 19 - dorm delete confirm
  try {
    await page.evaluate(() => localStorage.setItem('dormViewMode', 'list'))
    await page.goto(`${BASE_URL}/dorms`)
    await waitForPageData(page, '/api/dorms', 'table tbody tr')
    const delBtn = page.locator('table tbody tr button:has-text("削除")').first()
    if (await delBtn.count() > 0) {
      await delBtn.click()
      await page.waitForSelector('[role="alertdialog"]', { state: 'visible' })
      const f = await takeScreenshot(page, 'dorm-delete-confirm')
      record(f, '寮管理 `/dorms`', '削除確認 AlertDialog')
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="alertdialog"]', { state: 'hidden' })
    }
  } catch (e) { record(null, '寮管理 `/dorms`', '削除確認 AlertDialog', 'failed', e.message) }
}

// --- Screenshot: Dorm Detail (IDs 20-24) ---
async function captureDormDetailScreenshots(page) {
  // Get first non-test dorm that has rooms
  let dormId, dormName
  try {
    const result = await page.evaluate(async (prefix) => {
      const token = localStorage.getItem('token')
      const hdr = { Authorization: `Bearer ${token}` }
      const res = await fetch('/api/dorms', { headers: hdr })
      const body = await res.json()
      const dorms = body.data ?? body
      const arr = Array.isArray(dorms) ? dorms : []
      for (const d of arr) {
        if (d.name && d.name.startsWith(prefix)) continue
        const rRes = await fetch(`/api/dorms/${d.dorm_id}/rooms`, { headers: hdr })
        const rBody = await rRes.json()
        const rooms = rBody.data ?? rBody
        if (Array.isArray(rooms) && rooms.length > 0) return { dormId: d.dorm_id, dormName: d.name }
      }
      // Fallback: any non-test dorm
      const fallback = arr.find(d => !d.name?.startsWith(prefix))
      if (fallback) return { dormId: fallback.dorm_id, dormName: fallback.name }
      return { error: 'No dorms found' }
    }, EDGE_PREFIX)
    if (result.error) { record(null, '寮詳細', 'No dorm data', 'failed', result.error); return }
    dormId = result.dormId
    dormName = result.dormName
  } catch (e) { record(null, '寮詳細', 'API error', 'failed', e.message); return }

  // 20 - dorm detail default
  try {
    await page.goto(`${BASE_URL}/dorms/${dormId}`)
    await waitForPageData(page, `/api/dorms/${dormId}`, 'h1')
    const f = await takeScreenshot(page, 'dorm-detail-default', { fullPage: true })
    record(f, `寮詳細 \`/dorms/:id\``, `${dormName} — 基本情報・部屋一覧`)
  } catch (e) { record(null, '寮詳細 `/dorms/:id`', 'デフォルト', 'failed', e.message) }

  // 21 - room form add (from dorm detail)
  try {
    await page.goto(`${BASE_URL}/dorms/${dormId}`)
    await waitForPageData(page, `/api/dorms/${dormId}`, 'h1')
    // The room section "新規登録" button (second one on the page, inside room table card)
    const addBtns = page.locator('button:has-text("新規登録")')
    const addBtnCount = await addBtns.count()
    if (addBtnCount > 0) {
      // Use the last "新規登録" button (the one in the room section, not in the dorm header)
      const addBtn = addBtns.last()
      if (await addBtn.isEnabled()) {
        await addBtn.click()
        await page.waitForSelector('[role="dialog"]', { state: 'visible' })
        const f = await takeScreenshot(page, 'dorm-detail-room-form-add')
        record(f, '寮詳細 `/dorms/:id`', '部屋追加 Dialog')
        await page.keyboard.press('Escape')
        await page.waitForSelector('[role="dialog"]', { state: 'hidden' })
      } else {
        record(null, '寮詳細 `/dorms/:id`', '部屋追加 Dialog', 'failed', 'Add room button disabled (room count at limit)')
      }
    } else {
      record(null, '寮詳細 `/dorms/:id`', '部屋追加 Dialog', 'failed', 'Add room button not found')
    }
  } catch (e) { record(null, '寮詳細 `/dorms/:id`', '部屋追加 Dialog', 'failed', e.message) }

  // 22 - room form edit
  try {
    await page.goto(`${BASE_URL}/dorms/${dormId}`)
    await waitForPageData(page, `/api/dorms/${dormId}`, 'h1')
    const editBtn = page.locator('table tbody tr button:has-text("編集")').first()
    if (await editBtn.count() > 0) {
      await editBtn.click()
      await page.waitForSelector('[role="dialog"]', { state: 'visible' })
      const f = await takeScreenshot(page, 'dorm-detail-room-form-edit')
      record(f, '寮詳細 `/dorms/:id`', '部屋編集 Dialog')
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="dialog"]', { state: 'hidden' })
    }
  } catch (e) { record(null, '寮詳細 `/dorms/:id`', '部屋編集 Dialog', 'failed', e.message) }

  // 23 - dorm delete confirm (from dorm detail header)
  try {
    await page.goto(`${BASE_URL}/dorms/${dormId}`)
    await waitForPageData(page, `/api/dorms/${dormId}`, 'h1')
    // The header "削除" button (has Trash2 icon)
    const delDormBtn = page.locator('button:has(svg.lucide-trash-2)')
    if (await delDormBtn.count() > 0) {
      await delDormBtn.click()
      await page.waitForSelector('[role="alertdialog"]', { state: 'visible' })
      const f = await takeScreenshot(page, 'dorm-detail-delete-dorm')
      record(f, '寮詳細 `/dorms/:id`', '寮削除確認 AlertDialog')
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="alertdialog"]', { state: 'hidden' })
    }
  } catch (e) { record(null, '寮詳細 `/dorms/:id`', '寮削除確認 AlertDialog', 'failed', e.message) }

  // 24 - room delete confirm
  try {
    await page.goto(`${BASE_URL}/dorms/${dormId}`)
    await waitForPageData(page, `/api/dorms/${dormId}`, 'h1')
    const delRoomBtn = page.locator('table tbody tr button:has-text("削除")').first()
    if (await delRoomBtn.count() > 0) {
      await delRoomBtn.click()
      await page.waitForSelector('[role="alertdialog"]', { state: 'visible' })
      const f = await takeScreenshot(page, 'dorm-detail-delete-room')
      record(f, '寮詳細 `/dorms/:id`', '部屋削除確認 AlertDialog')
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="alertdialog"]', { state: 'hidden' })
    } else {
      record(null, '寮詳細 `/dorms/:id`', '部屋削除確認 AlertDialog', 'failed', 'No room delete button found (all rooms occupied)')
    }
  } catch (e) { record(null, '寮詳細 `/dorms/:id`', '部屋削除確認 AlertDialog', 'failed', e.message) }
}

// --- Screenshot: Room Detail (ID 25) ---
async function captureRoomDetailScreenshots(page) {
  // Find a dorm that has rooms (skip SCREENSHOT_TEST_ entries)
  let dormId, roomId
  try {
    const result = await page.evaluate(async (prefix) => {
      const token = localStorage.getItem('token')
      const hdr = { Authorization: `Bearer ${token}` }
      const dRes = await fetch('/api/dorms', { headers: hdr })
      const dBody = await dRes.json()
      const dorms = dBody.data ?? dBody
      const dArr = Array.isArray(dorms) ? dorms : []
      for (const d of dArr) {
        if (d.name && d.name.startsWith(prefix)) continue
        const rRes = await fetch(`/api/dorms/${d.dorm_id}/rooms`, { headers: hdr })
        const rBody = await rRes.json()
        const rooms = rBody.data ?? rBody
        const rArr = Array.isArray(rooms) ? rooms : []
        if (rArr.length > 0) return { dormId: d.dorm_id, roomId: rArr[0].room_id }
      }
      return { error: 'No dorms with rooms found' }
    }, EDGE_PREFIX)
    if (result.error) { record(null, '部屋詳細', result.error, 'failed', result.error); return }
    dormId = result.dormId
    roomId = result.roomId
  } catch (e) { record(null, '部屋詳細', 'API error', 'failed', e.message); return }

  // 25 - room detail
  try {
    await page.goto(`${BASE_URL}/dorms/${dormId}/rooms/${roomId}`)
    await page.waitForSelector('h1', { state: 'visible', timeout: 10000 })
    const f = await takeScreenshot(page, 'room-detail-default', { fullPage: true })
    record(f, '部屋詳細 `/dorms/:id/rooms/:roomId`', '部屋情報・入居履歴テーブル')
  } catch (e) { record(null, '部屋詳細', 'デフォルト', 'failed', e.message) }
}

// --- Screenshot: Employee Management (IDs 26-30) ---
async function captureEmployeeScreenshots(page) {
  // 26 - employee list
  try {
    await page.goto(`${BASE_URL}/employees`)
    await waitForPageData(page, '/api/employees', 'table tbody tr')
    const f = await takeScreenshot(page, 'employee-list-default', { fullPage: true })
    record(f, '社員管理 `/employees`', '一覧')
  } catch (e) { record(null, '社員管理 `/employees`', '一覧', 'failed', e.message) }

  // 27 - employee form add
  try {
    await page.goto(`${BASE_URL}/employees`)
    await waitForPageData(page, '/api/employees', 'table tbody tr')
    const f = await openAndScreenshotDialog(page, 'button:has-text("新規社員")', 'employee-form-add')
    record(f, '社員管理 `/employees`', '新規社員 Dialog')
  } catch (e) { record(null, '社員管理 `/employees`', '新規社員 Dialog', 'failed', e.message) }

  // 28 - employee form edit
  try {
    await page.goto(`${BASE_URL}/employees`)
    await waitForPageData(page, '/api/employees', 'table tbody tr')
    const editBtn = page.locator('table tbody tr button:has-text("編集")').first()
    if (await editBtn.count() > 0) {
      await editBtn.click()
      await page.waitForSelector('[role="dialog"]', { state: 'visible' })
      const f = await takeScreenshot(page, 'employee-form-edit')
      record(f, '社員管理 `/employees`', '編集 Dialog')
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="dialog"]', { state: 'hidden' })
    }
  } catch (e) { record(null, '社員管理 `/employees`', '編集 Dialog', 'failed', e.message) }

  // 29 - employee delete confirm
  try {
    await page.goto(`${BASE_URL}/employees`)
    await waitForPageData(page, '/api/employees', 'table tbody tr')
    const delBtn = page.locator('table tbody tr button:has-text("削除")').first()
    if (await delBtn.count() > 0) {
      await delBtn.click()
      await page.waitForSelector('[role="alertdialog"]', { state: 'visible' })
      const f = await takeScreenshot(page, 'employee-delete-confirm')
      record(f, '社員管理 `/employees`', '削除確認 AlertDialog')
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="alertdialog"]', { state: 'hidden' })
    }
  } catch (e) { record(null, '社員管理 `/employees`', '削除確認 AlertDialog', 'failed', e.message) }

  // 30 - employee search
  try {
    await page.goto(`${BASE_URL}/employees`)
    await waitForPageData(page, '/api/employees', 'table tbody tr')
    const searchInput = page.locator('input[placeholder*="山田"]').first()
    if (await searchInput.count() > 0) {
      await searchInput.fill('田中')
      // Click the search button to apply
      const searchBtn = page.locator('button:has-text("検索")').first()
      if (await searchBtn.count() > 0) await searchBtn.click()
      await page.waitForTimeout(1000)
    }
    const f = await takeScreenshot(page, 'employee-list-search', { fullPage: true })
    record(f, '社員管理 `/employees`', '検索結果（「田中」）')
  } catch (e) { record(null, '社員管理 `/employees`', '検索結果', 'failed', e.message) }
}

// --- Screenshot: New Stay (IDs 31-32) ---
async function captureNewStayScreenshots(page) {
  // 31 - new stay default
  try {
    await page.goto(`${BASE_URL}/stays/new`)
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 })
    const f = await takeScreenshot(page, 'new-stay-default')
    record(f, '入居登録 `/stays/new`', '空フォーム（カスケード選択）')
  } catch (e) { record(null, '入居登録 `/stays/new`', '空フォーム', 'failed', e.message) }

  // 32 - new stay with dorm selected
  try {
    await page.goto(`${BASE_URL}/stays/new`)
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 })
    // Select first dorm using the shadcn Select (SelectTrigger with placeholder "寮を選択")
    const dormTrigger = page.locator('button[role="combobox"]:has-text("寮を選択")')
    if (await dormTrigger.count() > 0) {
      await dormTrigger.click()
      await page.waitForTimeout(300)
      const firstOption = page.locator('[role="option"]').first()
      if (await firstOption.count() > 0) await firstOption.click()
      await page.waitForTimeout(500)
    }
    const f = await takeScreenshot(page, 'new-stay-filled')
    record(f, '入居登録 `/stays/new`', '寮選択後の状態')
  } catch (e) { record(null, '入居登録 `/stays/new`', '寮選択後', 'failed', e.message) }
}

// --- Screenshot: Stay List (IDs 33-34) ---
async function captureStayListScreenshots(page) {
  // 33 - stay list
  try {
    await page.goto(`${BASE_URL}/stays`)
    await waitForPageData(page, '/api/stays', 'table tbody tr')
    const f = await takeScreenshot(page, 'stay-list-default', { fullPage: true })
    record(f, '入居履歴 `/stays`', '一覧')
  } catch (e) { record(null, '入居履歴 `/stays`', '一覧', 'failed', e.message) }

  // 34 - export menu
  try {
    await page.goto(`${BASE_URL}/stays`)
    await waitForPageData(page, '/api/stays', 'table tbody tr')
    const exportBtn = page.locator('button:has-text("CSVエクスポート")')
    if (await exportBtn.count() > 0) {
      const f = await openAndScreenshotMenu(page, 'button:has-text("CSVエクスポート")', 'stay-list-export-menu')
      record(f, '入居履歴 `/stays`', 'エクスポート DropdownMenu')
    }
  } catch (e) { record(null, '入居履歴 `/stays`', 'エクスポート DropdownMenu', 'failed', e.message) }
}

// --- Screenshot: Stay Detail (IDs 35-38) ---
async function captureStayDetailScreenshots(page) {
  // Find active stay + left stay via authenticated API call
  let activeStayId, leftStayId
  try {
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/stays?page_size=50', { headers: { Authorization: `Bearer ${token}` } })
      const body = await res.json()
      const stays = body.data?.items || body.data || body
      const arr = Array.isArray(stays) ? stays : []
      return {
        activeStayId: arr.find(s => !s.move_out_date)?.stay_id ?? null,
        leftStayId: arr.find(s => s.move_out_date)?.stay_id ?? null,
      }
    })
    activeStayId = result.activeStayId
    leftStayId = result.leftStayId
  } catch {}

  // 35 - stay detail active
  if (activeStayId) {
    try {
      await page.goto(`${BASE_URL}/stays/${activeStayId}`)
      await page.waitForSelector('h1', { state: 'visible', timeout: 10000 })
      const f = await takeScreenshot(page, 'stay-detail-active', { fullPage: true })
      record(f, '入居詳細 `/stays/:id`', '入居中の詳細')
    } catch (e) { record(null, '入居詳細 `/stays/:id`', '入居中', 'failed', e.message) }

    // 36 - transfer dialog
    try {
      await page.goto(`${BASE_URL}/stays/${activeStayId}`)
      await page.waitForSelector('h1', { state: 'visible', timeout: 10000 })
      const transferBtn = page.locator('button:has-text("換房")')
      if (await transferBtn.count() > 0) {
        const f = await openAndScreenshotDialog(page, 'button:has-text("換房")', 'stay-detail-transfer-dialog')
        record(f, '入居詳細 `/stays/:id`', '換房 Dialog')
      }
    } catch (e) { record(null, '入居詳細 `/stays/:id`', '換房 Dialog', 'failed', e.message) }

    // 37 - leave dialog
    try {
      await page.goto(`${BASE_URL}/stays/${activeStayId}`)
      await page.waitForSelector('h1', { state: 'visible', timeout: 10000 })
      const leaveBtn = page.locator('button:has-text("退寮処理")')
      if (await leaveBtn.count() > 0) {
        const f = await openAndScreenshotDialog(page, 'button:has-text("退寮処理")', 'stay-detail-leave-dialog')
        record(f, '入居詳細 `/stays/:id`', '退寮処理 Dialog')
      }
    } catch (e) { record(null, '入居詳細 `/stays/:id`', '退寮処理 Dialog', 'failed', e.message) }
  } else {
    record(null, '入居詳細 `/stays/:id`', '入居中の詳細', 'failed', 'No active stay found')
  }

  // 38 - stay detail left
  if (leftStayId) {
    try {
      await page.goto(`${BASE_URL}/stays/${leftStayId}`)
      await page.waitForSelector('h1', { state: 'visible', timeout: 10000 })
      const f = await takeScreenshot(page, 'stay-detail-left', { fullPage: true })
      record(f, '入居詳細 `/stays/:id`', '退寮済みの詳細')
    } catch (e) { record(null, '入居詳細 `/stays/:id`', '退寮済み', 'failed', e.message) }
  } else {
    record(null, '入居詳細 `/stays/:id`', '退寮済みの詳細', 'failed', 'No left stay found')
  }
}

// --- Screenshot: Fee Management (IDs 39-42) ---
async function captureFeeScreenshots(page) {
  // 39 - fee list
  try {
    await page.goto(`${BASE_URL}/fees`)
    await waitForPageData(page, '/api/fees', 'table tbody tr')
    const f = await takeScreenshot(page, 'fee-list-default', { fullPage: true })
    record(f, '寮費管理 `/fees`', '一覧（draft+confirmed）')
  } catch (e) { record(null, '寮費管理 `/fees`', '一覧', 'failed', e.message) }

  // 40 - bulk confirm (the button text includes draft count)
  try {
    await page.goto(`${BASE_URL}/fees`)
    await waitForPageData(page, '/api/fees', 'table tbody tr')
    const confirmBtn = page.locator('button:has-text("一括確定")')
    if (await confirmBtn.count() > 0) {
      // Bulk confirm is just a button click (no dialog), just screenshot the page state
      const f = await takeScreenshot(page, 'fee-list-bulk-confirm-visible')
      record(f, '寮費管理 `/fees`', '一括確定ボタン表示')
    } else {
      record(null, '寮費管理 `/fees`', '一括確定', 'failed', 'No draft fees to confirm')
    }
  } catch (e) { record(null, '寮費管理 `/fees`', '一括確定', 'failed', e.message) }

  // 41 - export menu
  try {
    await page.goto(`${BASE_URL}/fees`)
    await waitForPageData(page, '/api/fees', 'table tbody tr')
    const exportBtn = page.locator('button:has-text("CSVエクスポート")')
    if (await exportBtn.count() > 0) {
      const f = await openAndScreenshotMenu(page, 'button:has-text("CSVエクスポート")', 'fee-list-export-menu')
      record(f, '寮費管理 `/fees`', 'エクスポート DropdownMenu')
    }
  } catch (e) { record(null, '寮費管理 `/fees`', 'エクスポート DropdownMenu', 'failed', e.message) }

  // 42 - revert to draft confirm
  try {
    await page.goto(`${BASE_URL}/fees`)
    await waitForPageData(page, '/api/fees', 'table tbody tr')
    const revertBtn = page.locator('button:has-text("草稿に戻す")').first()
    if (await revertBtn.count() > 0) {
      await revertBtn.click()
      await page.waitForSelector('[role="alertdialog"]', { state: 'visible', timeout: 3000 })
      const f = await takeScreenshot(page, 'fee-list-revert-confirm')
      record(f, '寮費管理 `/fees`', '草稿に戻す確認 AlertDialog')
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="alertdialog"]', { state: 'hidden' })
    } else {
      record(null, '寮費管理 `/fees`', '草稿に戻す確認', 'failed', 'No confirmed fees with revert button')
    }
  } catch (e) { record(null, '寮費管理 `/fees`', '草稿に戻す確認', 'failed', e.message) }
}

// --- Screenshot: Alert List (ID 43) ---
async function captureAlertScreenshots(page) {
  // 43 - alert list
  try {
    await page.goto(`${BASE_URL}/alerts`)
    await waitForPageData(page, '/api/summary', 'h1:has-text("アラート一覧")')
    const f = await takeScreenshot(page, 'alert-list-default', { fullPage: true })
    record(f, 'アラート `/alerts`', 'アラート一覧')
  } catch (e) { record(null, 'アラート `/alerts`', 'アラート一覧', 'failed', e.message) }
}

// --- Screenshot: Import (IDs 44-45) ---
async function captureImportScreenshots(page) {
  // 44 - import default (employee tab is default)
  try {
    await page.goto(`${BASE_URL}/import`)
    await page.waitForSelector('h1:has-text("Excel インポート")', { state: 'visible' })
    const f = await takeScreenshot(page, 'import-employee-tab')
    record(f, 'Excel インポート `/import`', '社員・入居履歴タブ（デフォルト）')
  } catch (e) { record(null, 'Excel インポート `/import`', '社員・入居履歴タブ', 'failed', e.message) }

  // 45 - import dorm tab
  try {
    await page.goto(`${BASE_URL}/import`)
    await page.waitForSelector('h1:has-text("Excel インポート")', { state: 'visible' })
    const dormTab = page.locator('button:has-text("寮・部屋マスタ")')
    if (await dormTab.count() > 0) {
      await dormTab.click()
      await page.waitForTimeout(300)
    }
    const f = await takeScreenshot(page, 'import-dorm-tab')
    record(f, 'Excel インポート `/import`', '寮・部屋マスタタブ')
  } catch (e) { record(null, 'Excel インポート `/import`', '寮・部屋マスタタブ', 'failed', e.message) }
}

// --- Screenshot: Master Settings (IDs 46-49) ---
async function captureMasterSettingsScreenshots(page) {
  // 46 - location tab (default)
  try {
    await page.goto(`${BASE_URL}/admin/masters`)
    await page.waitForSelector('table tbody tr', { state: 'visible' })
    const f = await takeScreenshot(page, 'master-settings-location', { fullPage: true })
    record(f, 'マスタ値管理 `/admin/masters`', '立地タブ')
  } catch (e) { record(null, 'マスタ値管理', '立地タブ', 'failed', e.message) }

  // 47 - room type tab
  try {
    await page.goto(`${BASE_URL}/admin/masters`)
    await page.waitForSelector('table tbody tr', { state: 'visible' })
    const rtTab = page.locator('button:has-text("部屋タイプ")')
    if (await rtTab.count() > 0) await rtTab.click()
    await page.waitForTimeout(300)
    const f = await takeScreenshot(page, 'master-settings-room-type', { fullPage: true })
    record(f, 'マスタ値管理 `/admin/masters`', '部屋タイプタブ')
  } catch (e) { record(null, 'マスタ値管理', '部屋タイプタブ', 'failed', e.message) }

  // 48 - edit dialog
  try {
    await page.goto(`${BASE_URL}/admin/masters`)
    await page.waitForSelector('table tbody tr', { state: 'visible' })
    const editBtn = page.locator('table tbody tr button:has-text("編集")').first()
    if (await editBtn.count() > 0) {
      const f = await openAndScreenshotDialog(page, 'table tbody tr button:has-text("編集") >> nth=0', 'master-settings-edit-dialog')
      record(f, 'マスタ値管理 `/admin/masters`', '値編集 Dialog')
    }
  } catch (e) { record(null, 'マスタ値管理', '値編集 Dialog', 'failed', e.message) }

  // 49 - disable confirm
  try {
    await page.goto(`${BASE_URL}/admin/masters`)
    await page.waitForSelector('table tbody tr', { state: 'visible' })
    const disableBtn = page.locator('table tbody tr button:has-text("無効化")').first()
    if (await disableBtn.count() > 0) {
      await disableBtn.click()
      await page.waitForSelector('[role="alertdialog"], [role="dialog"]', { state: 'visible' })
      const f = await takeScreenshot(page, 'master-settings-disable-confirm')
      record(f, 'マスタ値管理 `/admin/masters`', '無効化確認 AlertDialog')
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="alertdialog"], [role="dialog"]', { state: 'hidden' })
    }
  } catch (e) { record(null, 'マスタ値管理', '無効化確認', 'failed', e.message) }
}

// --- Screenshot: User List (IDs 50-52) ---
async function captureUserListScreenshots(page) {
  // 50 - user list
  try {
    await page.goto(`${BASE_URL}/admin/users`)
    await waitForPageData(page, '/api/users', 'table tbody tr')
    const f = await takeScreenshot(page, 'user-list-default', { fullPage: true })
    record(f, 'ユーザー管理 `/admin/users`', '一覧+招待フォーム')
  } catch (e) { record(null, 'ユーザー管理', 'デフォルト', 'failed', e.message) }

  // 51 - role change menu
  try {
    await page.goto(`${BASE_URL}/admin/users`)
    await waitForPageData(page, '/api/users', 'table tbody tr')
    const roleBtn = page.locator('table tbody tr button:has-text("権限"), table tbody tr [aria-haspopup="menu"]').first()
    if (await roleBtn.count() > 0) {
      const f = await openAndScreenshotMenu(page, 'table tbody tr button:has-text("権限"), table tbody tr [aria-haspopup="menu"] >> nth=0', 'user-list-role-menu')
      record(f, 'ユーザー管理 `/admin/users`', '権限変更 DropdownMenu')
    }
  } catch (e) { record(null, 'ユーザー管理', '権限変更メニュー', 'failed', e.message) }

  // 52 - status toggle (just capture the current state)
  try {
    await page.goto(`${BASE_URL}/admin/users`)
    await waitForPageData(page, '/api/users', 'table tbody tr')
    const f = await takeScreenshot(page, 'user-list-status-toggle', { fullPage: true })
    record(f, 'ユーザー管理 `/admin/users`', 'ステータス切替ボタン表示')
  } catch (e) { record(null, 'ユーザー管理', 'ステータス切替', 'failed', e.message) }
}

// --- Screenshot: Operation Logs (ID 53) ---
async function captureOperationLogsScreenshots(page) {
  // 53
  try {
    await page.goto(`${BASE_URL}/admin/logs`)
    await waitForPageData(page, '/api/operation-logs', 'table')
    const f = await takeScreenshot(page, 'operation-logs-default', { fullPage: true })
    record(f, '操作履歴 `/admin/logs`', '操作履歴テーブル')
  } catch (e) { record(null, '操作履歴', 'デフォルト', 'failed', e.message) }
}

// --- Screenshot: System Settings (ID 54) ---
async function captureSystemSettingsScreenshots(page) {
  // 54
  try {
    await page.goto(`${BASE_URL}/admin/settings`)
    await waitForPageData(page, '/api/settings', 'h1:has-text("システム設定")')
    const f = await takeScreenshot(page, 'system-settings-default')
    record(f, 'システム設定 `/admin/settings`', 'アラート閾値・同日入退寮設定')
  } catch (e) { record(null, 'システム設定', 'デフォルト', 'failed', e.message) }
}

// --- Screenshot: Edge Case Data (IDs 62-63) ---
async function captureEdgeCaseScreenshots(page) {
  // Create long-name employee via authenticated API
  try {
    const longName = EDGE_PREFIX + 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわ'
    const res = await apiFetch(page, '/api/employees', {
      method: 'POST',
      body: JSON.stringify({
        name: longName,
        employee_code: 'SCR999',
        employee_type: 'japanese',
        gender_type: 'male'
      })
    })
    if (res.ok) {
      const emp = res.body?.data ?? res.body
      edgeCaseIds.employeeId = emp.employee_id
    }
  } catch {}

  // Screenshot employee list with long name
  if (edgeCaseIds.employeeId) {
    try {
      await page.goto(`${BASE_URL}/employees`)
      await waitForPageData(page, '/api/employees', 'table tbody tr')
      const f = await takeScreenshot(page, 'edge-employee-long-name', { fullPage: true })
      record(f, 'エッジケース', '長い名前の社員（50文字）レイアウト崩れ確認')
    } catch (e) { record(null, 'エッジケース', '長い名前社員', 'failed', e.message) }
    // Delete immediately (version=1 for newly created)
    try { await apiFetch(page, `/api/employees/${edgeCaseIds.employeeId}?version=1`, { method: 'DELETE' }) } catch {}
    edgeCaseIds.employeeId = null
  }

  // Create empty dorm via authenticated API
  try {
    const res = await apiFetch(page, '/api/dorms', {
      method: 'POST',
      body: JSON.stringify({
        name: EDGE_PREFIX + '空寮',
        address: 'テスト住所',
        floor_plan: '1LDK',
        location: 'tokyo',
        planned_room_count: 1
      })
    })
    if (res.ok) {
      const dorm = res.body?.data ?? res.body
      edgeCaseIds.dormId = dorm.dorm_id
    }
  } catch {}

  // Screenshot empty dorm detail
  if (edgeCaseIds.dormId) {
    try {
      await page.goto(`${BASE_URL}/dorms/${edgeCaseIds.dormId}`)
      await page.waitForSelector('h1', { state: 'visible', timeout: 10000 })
      const f = await takeScreenshot(page, 'edge-dorm-empty', { fullPage: true })
      record(f, 'エッジケース', '部屋0件の寮 — Empty state 表示確認')
    } catch (e) { record(null, 'エッジケース', '空寮', 'failed', e.message) }
    // Delete immediately (version=1 for newly created)
    try { await apiFetch(page, `/api/dorms/${edgeCaseIds.dormId}?version=1`, { method: 'DELETE' }) } catch {}
    edgeCaseIds.dormId = null
  }
}

// --- Screenshot: Staff Permission (IDs 55-61) ---
async function captureStaffScreenshots(page) {
  // 55 - sidebar (no admin menu)
  try {
    await page.goto(`${BASE_URL}/`)
    await page.waitForSelector('nav', { state: 'visible' })
    const f = await takeScreenshot(page, 'staff-sidebar')
    record(f, 'Staff — Sidebar', '管理者メニューグループ非表示')
  } catch (e) { record(null, 'Staff — Sidebar', '管理者メニュー非表示', 'failed', e.message) }

  // 56 - calendar (no click on vacant cells)
  try {
    await page.goto(`${BASE_URL}/`)
    await waitForPageData(page, '/api/calendar', '.rounded-lg.border.border-gray-200.bg-white')
    const f = await takeScreenshot(page, 'staff-calendar-default', { fullPage: true })
    record(f, 'Staff — カレンダー', '空室セルにクリック不可（Drawer非表示）')
  } catch (e) { record(null, 'Staff — カレンダー', 'デフォルト', 'failed', e.message) }

  // 57 - employee list (no add/edit/delete buttons)
  try {
    await page.goto(`${BASE_URL}/employees`)
    await waitForPageData(page, '/api/employees', 'table tbody tr')
    const f = await takeScreenshot(page, 'staff-employee-list', { fullPage: true })
    record(f, 'Staff — 社員管理', '新規/編集/削除ボタン非表示')
  } catch (e) { record(null, 'Staff — 社員管理', 'ボタン非表示', 'failed', e.message) }

  // 58 - fee list (no calc/revert buttons)
  try {
    await page.goto(`${BASE_URL}/fees`)
    await waitForPageData(page, '/api/fees', 'table')
    const f = await takeScreenshot(page, 'staff-fee-list', { fullPage: true })
    record(f, 'Staff — 寮費管理', '計算/草稿に戻すボタン非表示')
  } catch (e) { record(null, 'Staff — 寮費管理', 'ボタン非表示', 'failed', e.message) }

  // 59 - dorm list
  try {
    await page.goto(`${BASE_URL}/dorms`)
    await waitForPageData(page, '/api/dorms', 'table tbody tr')
    const f = await takeScreenshot(page, 'staff-dorm-list', { fullPage: true })
    record(f, 'Staff — 寮管理', '差異確認')
  } catch (e) { record(null, 'Staff — 寮管理', 'デフォルト', 'failed', e.message) }

  // 60 - dashboard
  try {
    await page.goto(`${BASE_URL}/dashboard`)
    await waitForPageData(page, '/api/summary', 'h1:has-text("ダッシュボード")')
    const f = await takeScreenshot(page, 'staff-dashboard', { fullPage: true })
    record(f, 'Staff — ダッシュボード', '差異確認')
  } catch (e) { record(null, 'Staff — ダッシュボード', 'デフォルト', 'failed', e.message) }

  // 61 - URL override (negative permission test)
  try {
    await page.goto(`${BASE_URL}/admin/users`)
    await page.waitForTimeout(2000) // Wait for redirect or 403
    const f = await takeScreenshot(page, 'staff-admin-url-override')
    record(f, 'Staff — 越権アクセス', '`/admin/users` URL直打ち → リダイレクト or 403')
  } catch (e) { record(null, 'Staff — 越権アクセス', 'URL override', 'failed', e.message) }
}

// --- INDEX.md generation ---
function generateIndexMd(results, outputDir) {
  const now = new Date().toISOString()
  const okCount = results.filter(r => r.status === 'ok').length
  const failCount = results.filter(r => r.status === 'failed').length

  const REVIEW_GUIDE = `## レビュー観点（AI向けガイド）

以下の観点でレビューしてください:
1. **UI一貫性:** 同じ種類のボタン・テーブル・フォームが統一されたスタイルか
2. **UX合理性:** 画面遷移フロー・操作動線が自然か、迷う箇所はないか
3. **情報設計:** 必要な情報が適切に表示されているか、過不足はないか
4. **レスポンシブ:** 横幅1440pxでのレイアウト崩れはないか
5. **権限制御:** admin/staff で適切にUIが出し分けされているか
6. **エラー表現:** エラー状態の表示が分かりやすいか
7. **日本語テキスト:** ラベル・メッセージの表現が自然か、用語統一されているか
`

  let md = `# UI/UX レビュー用スクリーンショット集

**システム:** 社員寮管理システム（寮割管理・入退寮管理・寮費管理）
**取得日時:** ${now}
**解像度:** ${VIEWPORT.width}×${VIEWPORT.height}
**総数:** ${okCount} 枚（失敗: ${failCount} 枚）
**時間固定:** ${FROZEN_TIME}

${REVIEW_GUIDE}

---

`
  let currentSection = ''
  for (const r of results) {
    if (r.section !== currentSection) {
      currentSection = r.section
      md += `### ${currentSection}\n\n`
      md += `| # | ファイル | 説明 |\n|---|---------|------|\n`
    }
    if (r.status === 'ok') {
      md += `| ${r.filename.split('-')[0]} | ![](${r.filename}) | ${r.description} |\n`
    } else {
      md += `| — | ⚠ 取得失敗 | ${r.description} — ${r.error} |\n`
    }
  }

  fs.writeFileSync(path.join(outputDir, 'INDEX.md'), md)
  console.log(`INDEX.md written (${okCount} ok, ${failCount} failed)`)
}

function generateSplitIndexFiles(results, outputDir) {
  const REVIEW_GUIDE = `## レビュー観点（AI向けガイド）

以下の観点でレビューしてください:
1. **UI一貫性:** 同じ種類のボタン・テーブル・フォームが統一されたスタイルか
2. **UX合理性:** 画面遷移フロー・操作動線が自然か、迷う箇所はないか
3. **情報設計:** 必要な情報が適切に表示されているか、過不足はないか
4. **レスポンシブ:** 横幅1440pxでのレイアウト崩れはないか
5. **権限制御:** admin/staff で適切にUIが出し分けされているか
6. **エラー表現:** エラー状態の表示が分かりやすいか
7. **日本語テキスト:** ラベル・メッセージの表現が自然か、用語統一されているか
`

  const splits = [
    { file: 'INDEX-00-login-dashboard.md', title: 'ログイン・ダッシュボード・分析', sections: ['ログイン画面', 'ダッシュボード', 'データ分析'] },
    { file: 'INDEX-01-calendar.md', title: 'カレンダー', sections: ['寮割カレンダー'] },
    { file: 'INDEX-02-master-data.md', title: '寮・部屋・社員管理', sections: ['寮管理', '寮詳細', '部屋詳細', '社員管理', 'エッジケース'] },
    { file: 'INDEX-03-stay-fee.md', title: '入退寮・寮費・アラート', sections: ['入居登録', '入居履歴', '入居詳細', '寮費管理', 'アラート'] },
    { file: 'INDEX-04-admin.md', title: '管理者画面', sections: ['Excel インポート', 'マスタ値管理', 'ユーザー管理', '操作履歴', 'システム設定'] },
    { file: 'INDEX-05-staff.md', title: 'Staff 権限差異', sections: ['Staff'] },
  ]

  let written = 0
  for (const split of splits) {
    const filtered = results.filter(r => split.sections.some(s => r.section.includes(s)))
    if (filtered.length === 0) continue

    let md = `# ${split.title}\n\n${REVIEW_GUIDE}\n\n---\n\n`
    let currentSection = ''
    for (const r of filtered) {
      if (r.section !== currentSection) {
        currentSection = r.section
        md += `### ${currentSection}\n\n`
        md += `| # | ファイル | 説明 |\n|---|---------|------|\n`
      }
      if (r.status === 'ok') {
        md += `| ${r.filename.split('-')[0]} | ![](${r.filename}) | ${r.description} |\n`
      } else {
        md += `| — | ⚠ 取得失敗 | ${r.description} — ${r.error} |\n`
      }
    }

    fs.writeFileSync(path.join(outputDir, split.file), md)
    written++
  }
  console.log(`Split index files written (${written} files)`)
}

// --- Main ---
async function main() {
  // Prepare output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true })
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  console.log('Checking server...')
  await waitForServer(BASE_URL)
  console.log('Server ready. Launching browser...')

  const browser = await chromium.launch({ headless: true })

  try {
    // --- Admin Section ---
    const adminContext = await browser.newContext({ viewport: VIEWPORT })
    const adminPage = await adminContext.newPage()
    await adminPage.clock.install({ time: new Date(FROZEN_TIME) })
    activePage = adminPage

    // Login page screenshots (before admin login, uses its own context)
    await captureLoginScreenshots(browser)

    // Startup cleanup
    await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD)
    await cleanupEdgeCaseData(adminPage)

    // Calendar, Dashboard, Analytics screenshots (admin session)
    await captureCalendarScreenshots(adminPage)
    await captureDashboardScreenshots(adminPage)
    await captureAnalyticsScreenshots(adminPage)

    // Master data + stay/fee/alert screenshots (admin session)
    await captureDormScreenshots(adminPage)
    await captureDormDetailScreenshots(adminPage)
    await captureRoomDetailScreenshots(adminPage)
    await captureEmployeeScreenshots(adminPage)
    await captureNewStayScreenshots(adminPage)
    await captureStayListScreenshots(adminPage)
    await captureStayDetailScreenshots(adminPage)
    await captureFeeScreenshots(adminPage)
    await captureAlertScreenshots(adminPage)

    // Admin pages (import, masters, users, logs, settings)
    await captureImportScreenshots(adminPage)
    await captureMasterSettingsScreenshots(adminPage)
    await captureUserListScreenshots(adminPage)
    await captureOperationLogsScreenshots(adminPage)
    await captureSystemSettingsScreenshots(adminPage)

    // Edge case data (create → screenshot → delete)
    await captureEdgeCaseScreenshots(adminPage)

    await adminContext.close()

    // --- Staff Section ---
    const staffContext = await browser.newContext({ viewport: VIEWPORT })
    const staffPage = await staffContext.newPage()
    await staffPage.clock.install({ time: new Date(FROZEN_TIME) })
    activePage = staffPage
    await login(staffPage, STAFF_EMAIL, STAFF_PASSWORD)

    await captureStaffScreenshots(staffPage)

    await staffContext.close()
  } finally {
    if (activePage) {
      try { await cleanupEdgeCaseData(activePage) } catch {}
    }
    generateIndexMd(results, OUTPUT_DIR)
    generateSplitIndexFiles(results, OUTPUT_DIR)
    await browser.close()
    const ok = results.filter(r => r.status === 'ok').length
    const fail = results.filter(r => r.status === 'failed').length
    console.log(`\nDone: ${ok} captured, ${fail} failed, ${results.length} total`)
    console.log(`Output: ${OUTPUT_DIR}`)
    if (fail > 0) {
      console.log('\nFailed screenshots:')
      results.filter(r => r.status === 'failed').forEach(r => {
        console.log(`  [FAIL] ${r.section} — ${r.description}: ${r.error}`)
      })
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
