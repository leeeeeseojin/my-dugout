// 사용자가 정하는 경기 운영 방식 (언제든 경기 중에 바꿀 수 있다)

import type { AskFrequency } from '../engine/coach'

export type Owner = 'me' | 'coach'

export interface PlaySettings {
  /** AI 코치 추천을 화면에 보일지 */
  showCoach: boolean
  /** 공격 작전(번트·도루·대타)을 누가 정할지 */
  offense: Owner
  /** 투수 교체·수비 작전을 누가 정할지 */
  defense: Owner
  /** 언제 물어볼지 */
  ask: AskFrequency
  /** 코치에게 맡겼을 때 실행 전 기다리는 시간(ms). 이 동안 끼어들 수 있다 */
  delegateDelay: number
}

export const DEFAULT_SETTINGS: PlaySettings = {
  showCoach: true,
  offense: 'me',
  defense: 'me',
  ask: 'key',
  delegateDelay: 2600,
}

const KEY = 'my-dugout:settings'

export function loadSettings(): PlaySettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: PlaySettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // 저장이 막힌 환경에서는 이번 세션에만 적용
  }
}
