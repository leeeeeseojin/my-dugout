// 경기 중 판단 기록과 경기 후 비교
// 판단 순간마다 상황·코치 추천·사용자 선택을 남기고, 경기 후 비슷한 실제 사례를 찾는다.

import type { OptionKind } from './coach'
import type { StylePick } from './styles'

export interface Situation {
  inning: number
  /** 판단하는 팀 기준 점수 차 (+면 앞섬) */
  scoreDiff: number
  outs: number
  bases: [boolean, boolean, boolean]
  side: 'offense' | 'defense'
  batterHand: 'L' | 'R' | 'S'
  pitcherHand: 'L' | 'R' | 'S'
}

export interface DecisionRecord {
  id: number
  situation: Situation
  label: string
  batterName: string
  pitcherName: string
  metricLabel: string
  options: { id: string; kind: OptionKind; label: string; value: string }[]
  coachPickId: string
  coachConfidence: string
  /** 같은 상황에서 세 AI 감독 스타일이 고른 작전 */
  styles: StylePick[]
  userPickId: string
  /** 코치에게 맡겨서 자동으로 결정됐는지 */
  delegated: boolean
  /** 이 판단 이후 이번 이닝에 난 점수 (판단한 팀 기준: 공격이면 득점, 수비면 실점) */
  runsAfter: number | null
}

/** 실제 경기에서 감독이 한 행동 한 건 */
export interface RealCase {
  id: string
  situation: Situation
  action: OptionKind
  /** 그 이닝에 판단한 팀 기준으로 난 점수 */
  runsAfter: number
  /** 출처 표기 (실제 데이터 연결 후 경기 날짜·구장) */
  source: string
}

export interface CaseMatch {
  similarity: number
  cases: RealCase[]
  /** 행동별 건수 */
  counts: { action: OptionKind; count: number; avgRuns: number }[]
}

const MIN_CASES = 3
const MIN_SIMILARITY = 0.78

function sameBases(a: Situation['bases'], b: Situation['bases']) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

/** 두 상황이 얼마나 비슷한지 0~1 */
export function similarity(a: Situation, b: Situation): number {
  if (a.side !== b.side) return 0
  const inning = a.inning === b.inning ? 1 : Math.abs(a.inning - b.inning) === 1 ? 0.7 : (a.inning >= 7) === (b.inning >= 7) ? 0.35 : 0
  const diffGap = Math.abs(a.scoreDiff - b.scoreDiff)
  const score = diffGap === 0 ? 1 : diffGap === 1 ? 0.55 : 0
  const outs = a.outs === b.outs ? 1 : 0.25
  const countA = a.bases.filter(Boolean).length
  const countB = b.bases.filter(Boolean).length
  const bases = sameBases(a.bases, b.bases) ? 1 : countA === countB ? 0.5 : 0
  const platoonA = a.batterHand === a.pitcherHand
  const platoonB = b.batterHand === b.pitcherHand
  const hands = platoonA === platoonB ? 1 : 0.6
  return inning * 0.2 + score * 0.25 + outs * 0.2 + bases * 0.25 + hands * 0.1
}

export function findSimilarCases(target: Situation, library: RealCase[]): CaseMatch | null {
  const scored = library
    .map((c) => ({ c, sim: similarity(target, c.situation) }))
    .filter((x) => x.sim >= MIN_SIMILARITY)
    .sort((a, b) => b.sim - a.sim)
  if (scored.length < MIN_CASES) return null
  const cases = scored.map((x) => x.c)
  const byAction = new Map<OptionKind, { count: number; runs: number }>()
  for (const c of cases) {
    const v = byAction.get(c.action) ?? { count: 0, runs: 0 }
    v.count++
    v.runs += c.runsAfter
    byAction.set(c.action, v)
  }
  const counts = [...byAction.entries()]
    .map(([action, v]) => ({ action, count: v.count, avgRuns: v.runs / v.count }))
    .sort((a, b) => b.count - a.count)
  const avgSim = scored.reduce((sum, x) => sum + x.sim, 0) / scored.length
  return { similarity: avgSim, cases, counts }
}

export function similarityLabel(sim: number) {
  return sim >= 0.92 ? '아주 비슷함' : sim >= 0.85 ? '비슷함' : '조금 비슷함'
}

export const ACTION_LABEL: Record<OptionKind, string> = {
  swing: '강공',
  bunt: '번트',
  steal: '도루',
  pinch: '대타',
  pitch: '투수 유지',
  ibb: '고의사구',
  infieldIn: '전진 수비',
  change: '투수 교체',
}

export function situationText(s: Situation) {
  const diff = s.scoreDiff === 0 ? '동점' : s.scoreDiff > 0 ? `${s.scoreDiff}점 앞섬` : `${-s.scoreDiff}점 뒤짐`
  const on = s.bases.map((b, i) => (b ? `${i + 1}` : '')).filter(Boolean)
  const bases = on.length === 3 ? '만루' : on.length ? `${on.join('·')}루` : '주자 없음'
  return `${s.inning}회 · ${diff} · ${s.outs}사 ${bases}`
}
