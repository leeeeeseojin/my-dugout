// 경기 중 판단 기록
// 판단 순간마다 상황·코치 추천·AI 감독 스타일별 선택·사용자 선택을 남기고, 경기 후 복기에서 나란히 보여준다.

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

export function situationText(s: Situation) {
  const diff = s.scoreDiff === 0 ? '동점' : s.scoreDiff > 0 ? `${s.scoreDiff}점 앞섬` : `${-s.scoreDiff}점 뒤짐`
  const on = s.bases.map((b, i) => (b ? `${i + 1}` : '')).filter(Boolean)
  const bases = on.length === 3 ? '만루' : on.length ? `${on.join('·')}루` : '주자 없음'
  return `${s.inning}회 · ${diff} · ${s.outs}사 ${bases}`
}
