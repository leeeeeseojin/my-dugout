import { expect, test, type Page } from '@playwright/test'

// 시트(설정·선수 카드·선수 편집)는 화면 위에 뜨는 모달이다.
// 사람에게도, 화면을 접근성 트리로 읽는 AI 에이전트에게도 "지금은 이 창만 조작할 수 있다"가 드러나야 한다.
// 접근성 트리는 Playwright MCP가 에이전트에게 보여주는 것과 같은 ariaSnapshot으로 확인한다.

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
