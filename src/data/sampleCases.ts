// 실제 감독 판단 사례 라이브러리 (샘플)
// 실제 KBO 경기 기록을 연결하기 전까지 쓰는 가상의 사례다. 화면에는 반드시 "샘플 사례"로 표시한다.
// 실제 데이터로 바꿀 때는 같은 RealCase 형식으로 경기별 플레이 기록에서 추출해 넣으면 된다.

import type { OptionKind } from '../engine/coach'
import type { RealCase, Situation } from '../engine/review'
import { createRng, pickWeighted, type Rng } from '../engine/rng'

export const CASE_SOURCE_LABEL = '샘플 사례 · 실제 경기 데이터 연결 전'

function situation(rng: Rng, side: 'offense' | 'defense'): Situation {
  const inning = 1 + Math.floor(rng() * 9)
  const scoreDiff = Math.round((rng() - 0.5) * 6)
  const outs = Math.floor(rng() * 3)
  const bases: [boolean, boolean, boolean] = [rng() < 0.5, rng() < 0.35, rng() < 0.25]
  const hand = () => (rng() < 0.35 ? 'L' : 'R') as 'L' | 'R'
  return { inning, scoreDiff, outs, bases, side, batterHand: hand(), pitcherHand: hand() }
}

/** 상황에 따라 감독들이 흔히 고르는 행동 비율 (샘플용 가정) */
function actionWeights(s: Situation): Partial<Record<OptionKind, number>> {
  const late = s.inning >= 7
  const close = Math.abs(s.scoreDiff) <= 1
  const runners = s.bases.filter(Boolean).length
  if (s.side === 'offense') {
    const w: Partial<Record<OptionKind, number>> = { swing: 10 }
    if ((s.bases[0] || s.bases[1]) && !s.bases[2] && s.outs === 0) w.bunt = late && close ? 6 : 1.5
    if (s.bases[0] && !s.bases[1] && s.outs < 2) w.steal = 1.5
    if (late && close) w.pinch = s.batterHand === s.pitcherHand ? 4 : 1.5
    return w
  }
  const w: Partial<Record<OptionKind, number>> = { pitch: 10 }
  if (late && runners > 0) w.change = close ? 9 : 4
  else if (runners >= 2) w.change = 3
  if (!s.bases[0] && (s.bases[1] || s.bases[2]) && late && close) w.ibb = 3
  if (s.bases[2] && s.outs < 2 && late && close) w.infieldIn = 4
  return w
}

function runsAfter(rng: Rng, s: Situation): number {
  const runners = s.bases.filter(Boolean).length
  const base = [0.5, 0.9, 1.4, 2.2][runners] * [1, 0.62, 0.3][s.outs]
  let runs = 0
  let p = base / (1 + base)
  while (rng() < p && runs < 6) {
    runs++
    p *= 0.55
  }
  return runs
}

export function buildSampleCases(count = 1600): RealCase[] {
  const rng = createRng(20260401)
  const cases: RealCase[] = []
  for (let i = 0; i < count; i++) {
    const s = situation(rng, i % 2 === 0 ? 'offense' : 'defense')
    const action = pickWeighted(rng, actionWeights(s) as Record<OptionKind, number>)
    cases.push({ id: `sample-${i}`, situation: s, action, runsAfter: runsAfter(rng, s), source: CASE_SOURCE_LABEL })
  }
  return cases
}

let cached: RealCase[] | null = null
export function sampleCases() {
  return (cached ??= buildSampleCases())
}
