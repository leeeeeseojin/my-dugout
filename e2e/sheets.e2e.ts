import { expect, test, type Page } from '@playwright/test'

// 시트(설정·선수 카드·선수 편집)는 화면 위에 뜨는 모달이다.
// 사람에게도, 화면을 접근성 트리로 읽는 AI 에이전트에게도 "지금은 이 창만 조작할 수 있다"가 드러나야 한다.
// 접근성 트리는 Playwright의 표준 ariaSnapshot으로 확인한다.
// 시트가 열린 동안 뒤쪽 화면은 DOM에서 빠지므로, Playwright MCP가 에이전트에게 주는 AI용 스냅샷(mode: 'ai')도 함께 본다.

async function openRosterEditor(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '로스터 편집' }).click()
  await page.getByRole('button', { name: /한화/ }).first().click()
  await page.getByRole('button', { name: '가상 선수로 시작' }).click()
}

async function openSettings(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '운영 방식 설정' }).click()
  const dialog = page.getByRole('dialog', { name: '경기 운영 설정' })
  await expect(dialog).toBeVisible()
  return dialog
}

test('설정창이 열려 있으면 뒤쪽 화면의 버튼은 보이지도 눌리지도 않는다', async ({ page }) => {
  const dialog = await openSettings(page)
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  const tree = await page.locator('body').ariaSnapshot()
  expect(tree).toContain('경기 운영 설정')
  expect(tree).not.toContain('경기 시작')
  expect(tree).not.toContain('로스터 편집')
  await expect(page.getByRole('button', { name: '경기 시작' })).toHaveCount(0)
})

test('Esc로 설정창을 닫으면 설정 버튼으로 포커스가 돌아온다', async ({ page }) => {
  await openSettings(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '운영 방식 설정' })).toBeFocused()
  await expect(page.getByRole('button', { name: '경기 시작' })).toBeVisible()
})

test('운영 방식에서 고른 값이 무엇인지 화면을 읽어서 알 수 있다', async ({ page }) => {
  const dialog = await openSettings(page)
  const offense = dialog.getByRole('group', { name: '공격 작전' })
  await offense.getByRole('button', { name: '코치에게' }).click()
  await expect(offense.getByRole('button', { name: '코치에게' })).toHaveAttribute('aria-pressed', 'true')
  await expect(offense.getByRole('button', { name: '내가' })).toHaveAttribute('aria-pressed', 'false')
  expect(await offense.ariaSnapshot()).toContain('button "코치에게" [pressed]')
})

test('배경을 누르거나 닫기를 누르면 닫히고, 고른 값은 저장된다', async ({ page }) => {
  let dialog = await openSettings(page)
  await dialog.getByRole('group', { name: '투수·수비' }).getByRole('button', { name: '코치에게' }).click()
  await page.mouse.click(640, 10) // 시트 위쪽의 어두운 배경
  await expect(page.getByRole('dialog')).toHaveCount(0)

  dialog = (await page.getByRole('button', { name: '운영 방식 설정' }).click(), page.getByRole('dialog', { name: '경기 운영 설정' }))
  await expect(dialog.getByRole('group', { name: '투수·수비' }).getByRole('button', { name: '코치에게' })).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: '닫기' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('my-dugout:settings') ?? '{}'))
  expect(saved.defense).toBe('coach')
})

test('선수 편집 창도 같은 모달 규칙을 따른다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '로스터 편집' }).click()
  await page.getByRole('button', { name: /한화/ }).first().click()
  await page.getByRole('button', { name: '가상 선수로 시작' }).click()
  await page.getByRole('button', { name: '+ 타자 추가' }).click()
  const dialog = page.getByRole('dialog', { name: '선수 편집' })
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(await page.locator('body').ariaSnapshot()).not.toContain('+ 투수 추가')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '+ 타자 추가' })).toBeFocused()
})

// ───── 뒤쪽 화면 언마운트 ─────

test('시트가 열린 동안 뒤쪽 버튼은 DOM에도, AI용 스냅샷에도 없다', async ({ page }) => {
  const dialog = await openSettings(page)
  // 숨긴 게 아니라 아예 없다
  await expect(page.locator('button', { hasText: '경기 시작' })).toHaveCount(0)
  await expect(page.locator('#root')).not.toHaveAttribute('inert', /.*/)
  await expect(page.locator('#root')).not.toHaveAttribute('aria-hidden', /.*/)

  const ai = await page.locator('body').ariaSnapshot({ mode: 'ai' })
  expect(ai).not.toContain('경기 시작')
  // 예전에는 뒤쪽 버튼이 이름 없이 "button [ref=..]"로 남았다
  expect(ai).not.toMatch(/- button \[/)
  const buttonsInSnapshot = ai.match(/- button "/g)?.length ?? 0
  expect(buttonsInSnapshot).toBe(await dialog.getByRole('button').count())
})

test('Tab을 계속 눌러도 포커스는 시트 안에서만 돈다', async ({ page }) => {
  const dialog = await openSettings(page)
  const count = await dialog.getByRole('button').count()
  for (let i = 0; i < count + 3; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Shift+Tab')
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
})

test('선수 저장으로 닫으면 뒤쪽 화면이 다시 그려지고 연 버튼으로 포커스가 돌아온다', async ({ page }) => {
  await openRosterEditor(page)
  await page.getByRole('button', { name: '+ 투수 추가' }).click()
  const dialog = page.getByRole('dialog', { name: '선수 편집' })
  await dialog.getByRole('textbox', { name: '이름' }).fill('테스트 투수')
  await dialog.getByRole('button', { name: '선수 저장' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '+ 투수 추가' })).toBeFocused()
  await expect(page.getByRole('button', { name: /테스트 투수/ })).toBeVisible()
})

test('기존 선수 편집을 열었다 닫으면 그 선수 줄로 포커스가 돌아온다', async ({ page }) => {
  await openRosterEditor(page)
  const row = page.getByRole('button', { name: /^\d+/ }).first()
  const before = (await row.textContent()) ?? ''
  await row.click()
  await page.keyboard.press('Escape')
  const focused = page.locator(':focus')
  await expect(focused).toHaveText(before)
})

// ───── 버튼 이름 ─────

test('시트를 열기 전후 화면에 같은 이름의 버튼이 없다', async ({ page }) => {
  await openRosterEditor(page)
  const names = async () => (await page.getByRole('button').evaluateAll((els) => els.map((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim())))
  const behind = await names()
  await page.getByRole('button', { name: /^\d+/ }).first().click()
  const inSheet = await names()
  expect(inSheet).toContain('선수 저장')
  expect(inSheet).toContain('선수 삭제')
  expect(inSheet.filter((n) => behind.includes(n))).toEqual([])
})

// ───── 시트 안 요약 ─────

test('선수 편집 창 안에서 로스터 현황을 볼 수 있다', async ({ page }) => {
  await openRosterEditor(page)
  await page.getByRole('button', { name: '+ 타자 추가' }).click()
  await expect(page.getByRole('dialog', { name: '선수 편집' })).toContainText(/한화 로스터 · 타자 \d+ · 투수 \d+/)
})

test('라인업에서 연 선수 카드 안에서 그 선수의 타순을 볼 수 있다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '경기 시작' }).click()
  await page.getByRole('button', { name: /한화/ }).first().click()
  await page.getByRole('button', { name: '라인업 짜기' }).click()
  await page.getByRole('button', { name: /선수 카드$/ }).first().click()
  const dialog = page.getByRole('dialog', { name: /선수 카드/ })
  await expect(dialog).toContainText('오늘 라인업: 1번 타자')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /선수 카드$/ }).first()).toBeFocused()
})

test('경기 중에 연 설정창 안에서 점수와 이닝을 볼 수 있고, 닫으면 경기 화면이 돌아온다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '경기 시작' }).click()
  await page.getByRole('button', { name: /한화/ }).first().click()
  await page.getByRole('button', { name: '라인업 짜기' }).click()
  await page.getByRole('button', { name: '플레이볼!' }).click()
  await page.getByRole('button', { name: '운영 방식 설정' }).click()
  const dialog = page.getByRole('dialog', { name: '경기 운영 설정' })
  await expect(dialog).toContainText(/\d+회 [초말] · .+ \d+ : \d+ .+ · \d아웃/)
  await expect(page.locator('.scoreboard')).toHaveCount(0)
  await dialog.getByRole('button', { name: '설정 닫기' }).click()
  await expect(page.locator('.scoreboard')).toBeVisible()
  await expect(page.getByRole('button', { name: '운영 방식 설정' })).toBeFocused()
})
