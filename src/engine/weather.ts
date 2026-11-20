// 경기 중 날씨 변수
// 경기 시작 때 바람이 정해지고, 반 이닝마다 비가 오거나 그칠 수 있다.

import type { Rng } from './rng'

export type WeatherKind = 'clear' | 'windOut' | 'windIn' | 'rain' | 'heavyRain'

export interface Weather {
  kind: WeatherKind
  since: number
}

export interface WeatherEffect {
  label: string
  /** 홈런 확률 배수 */
  hr: number
  /** 땅볼·뜬공 때 수비 실책 확률 */
  error: number
  /** 도루 성공률 보정 */
  steal: number
  /** 번트 성공률 보정 (클수록 실패가 늘어남) */
  bunt: number
}

export const WEATHER_EFFECTS: Record<WeatherKind, WeatherEffect> = {
  clear: { label: '맑음', hr: 1, error: 0.015, steal: 0, bunt: 0 },
  windOut: { label: '외야로 부는 바람', hr: 1.25, error: 0.015, steal: 0, bunt: 0 },
  windIn: { label: '맞바람', hr: 0.8, error: 0.015, steal: 0, bunt: 0 },
  rain: { label: '비', hr: 0.92, error: 0.05, steal: -0.08, bunt: -0.06 },
  heavyRain: { label: '폭우', hr: 0.8, error: 0.09, steal: -0.15, bunt: -0.12 },
}

export function rollWeather(rng: Rng): Weather {
  const roll = rng()
  const kind: WeatherKind = roll < 0.18 ? 'windOut' : roll < 0.3 ? 'windIn' : 'clear'
  return { kind, since: 1 }
}
