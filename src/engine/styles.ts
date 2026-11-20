// AI 감독 스타일: 철학이 다른 가상의 감독 세 명
// 같은 판단 순간에 코치가 계산해 둔 작전별 예상치를 보고, 각자의 철학대로 하나를 고른다.
// 실제 감독을 흉내 내지 않는다. 결과는 "누가 정답"이 아니라 "어떤 관점이 있었나"를 보여주기 위한 것이다.

import type { CoachAdvice, CoachOption } from './coach'
import { defense, fatigueOf, type GameState, type PlayerIndex } from './game'
import { scoreDiffFor } from './manager'

export type StyleId = 'smallball' | 'data' | 'bullpen'

export interface ManagerStyle {
  id: StyleId
  name: string
  motto: string
}

export const STYLES: ManagerStyle[] = [
  { id: 'smallball', name: '작전 야구형', motto: '번트와 도루로 한 점을 짜낸다' },
  { id: 'data', name: '데이터형', motto: '기대 득점이 가장 좋은 쪽을 고른다' },
  { id: 'bullpen', name: '불펜 총력형', motto: '위기가 오면 바로 투수를 바꾼다' },
]

export interface StylePick {
  id: StyleId
  optionId: string
  reason: string
}

const find = (advice: CoachAdvice, kind: CoachOption['kind']) => advice.options.find((o) => o.kind === kind)

function dataPick(advice: CoachAdvice): StylePick {
  const offense = advice.side === 'offense'
  const best = [...advice.options].sort((a, b) => (offense ? b.runs - a.runs : a.runs - b.runs))[0]
  return {
    id: 'data',
    optionId: best.id,
    reason: `예상 ${offense ? '득점이 가장 높아요' : '실점이 가장 낮아요'} (${best.runs.toFixed(2)}점)`,
  }
}

function smallballPick(advice: CoachAdvice, s: GameState): StylePick {
  const fallback = advice.options[0]
  if (advice.side === 'offense') {
    const bunt = find(advice, 'bunt')
    if (bunt) return { id: 'smallball', optionId: bunt.id, reason: '주자를 한 베이스 더 보내 한 점을 노려요' }
    const steal = find(advice, 'steal')
    if (steal) return { id: 'smallball', optionId: steal.id, reason: '발로 상대 배터리를 흔들어요' }
    return { id: 'smallball', optionId: fallback.id, reason: '작전을 걸 상황이 아니라 그대로 쳐요' }
  }
  const late = s.inning >= 7 && Math.abs(scoreDiffFor(s, s.half === 'top' ? 'home' : 'away')) <= 2
  const infieldIn = find(advice, 'infieldIn')
  if (infieldIn) return { id: 'smallball', optionId: infieldIn.id, reason: '3루 주자를 묶어 한 점도 안 줘요' }
  const ibb = find(advice, 'ibb')
  if (ibb && late) return { id: 'smallball', optionId: ibb.id, reason: '1루를 채워 병살을 노려요' }
  return { id: 'smallball', optionId: fallback.id, reason: '지금 투수를 믿고 맡겨요' }
}

function bullpenPick(advice: CoachAdvice, s: GameState, players: PlayerIndex): StylePick {
  const fallback = advice.options[0]
  if (advice.side === 'offense') {
    const pinch = find(advice, 'pinch')
    if (pinch && s.inning >= 6) return { id: 'bullpen', optionId: pinch.id, reason: '승부처라 대타 카드를 아끼지 않아요' }
    return { id: 'bullpen', optionId: fallback.id, reason: '지금은 타자를 믿어요' }
  }
  const change = find(advice, 'change')
  const pitcherId = defense(s).pitcherId
  const pitches = s.pitching[pitcherId]?.pitches ?? 0
  const danger = Boolean(s.bases[1] || s.bases[2])
  const tired = fatigueOf(s, players, pitcherId) > 1.02 || pitches >= 70
  if (change && (s.inning >= 6 || danger || tired)) {
    const why = tired ? `투구 수 ${pitches}개, 힘이 떨어지기 전에 바꿔요` : danger ? '득점권 위기라 바로 불펜을 올려요' : '경기 후반이라 불펜으로 막아요'
    return { id: 'bullpen', optionId: change.id, reason: why }
  }
  return { id: 'bullpen', optionId: fallback.id, reason: '아직 바꿀 때가 아니에요' }
}

/** 세 스타일이 같은 상황에서 고를 작전 */
export function stylePicks(advice: CoachAdvice, s: GameState, players: PlayerIndex): StylePick[] {
  return [smallballPick(advice, s), dataPick(advice), bullpenPick(advice, s, players)]
}

/** 사용자가 직접 고른 판단과 스타일별 일치 횟수. 가장 많이 겹친 스타일이 "나와 닮은 감독" */
export function styleMatch(records: { userPickId: string; delegated: boolean; styles?: StylePick[] }[]) {
  const manual = records.filter((r) => !r.delegated && r.styles)
  const counts = STYLES.map((st) => ({
    style: st,
    same: manual.filter((r) => r.styles!.find((p) => p.id === st.id)?.optionId === r.userPickId).length,
  }))
  const best = [...counts].sort((a, b) => b.same - a.same)[0]
  return { total: manual.length, counts, closest: manual.length && best.same > 0 ? best.style : null }
}
