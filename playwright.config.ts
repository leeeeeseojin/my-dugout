import { defineConfig, devices } from '@playwright/test'

// BASE_URL을 주면 이미 떠 있는 주소(예: 수정 전 빌드, 배포본)를 검사한다.
const PORT = 4310
const external = process.env.BASE_URL

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  workers: 1,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: external ?? `http://localhost:${PORT}` },
  webServer: external
    ? undefined
    : { command: `npm run build && npx vite preview --port ${PORT} --strictPort`, url: `http://localhost:${PORT}`, reuseExistingServer: false, timeout: 120_000 },
})
