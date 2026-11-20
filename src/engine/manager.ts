// 자동 감독: 상대 팀 운영과 사용자가 맡긴 영역의 기본 판단
// 몬테카를로 계산 없이 상황 규칙으로 빠르게 결정한다. (AI 코치는 coach.ts)

import {
  changePitcher,
  currentBatterId,
  defense,
  defenseKey,
  fatigueOf,
  offense,
  offenseKey,
  playPlateAppearance,
  type DefenseAction,
  type GameState,
  type OffenseAction,
  type PlayerIndex,
  type SideKey,
} from './game'
import type { Rng } from './rng'
import { battingTotals, hitterProfile } from './stats'

export function scoreDiffFor(s: GameState, side: SideKey) {
  const other: SideKey = side === 'home' ? 'away' : 'home'
  return s.score[side] - s.score[other]
}

/** 투수를 바꿔야 하면 교체할 투수 id, 아니면 null */
export function autoPitchingChange(s: GameState, players: PlayerIndex): string | null {
  const side = defenseKey(s)
  const team = defense(s)
  if (!team.bullpen.length) return null
  const current = players[team.pitcherId]
  const fatigue = fatigueOf(s, players, team.pitcherId)
  const lead = scoreDiffFor(s, side)
  const closer = team.bullpen.find((id) => players[id].role === 'CL')
  const line = s.pitching[team.pitcherId]

  // 9회 이후 3점 차 이내 리드면 마무리
  if (s.inning >= 9 && lead > 0 && lead <= 3 && closer && current.role !== 'CL' && s.outs === 0 && !s.bases.some(Boolean)) {
    return closer
  }
  const shelled = line && line.r >= 5 && current.role === 'SP'
  if (fatigue > 1.1 || shelled || (current.role !== 'SP' && line && line.outs >= 3 && s.outs === 0 && !s.bases.some(Boolean))) {
    return bestReliever(s, players)
  }
  return null
}

/** 현재 타자 손에 맞는, 마무리를 제외한 불펜 */
export function bestReliever(s: GameState, players: PlayerIndex): string | null {
  const team = defense(s)
  const batter = players[currentBatterId(s)]
  const lead = scoreDiffFor(s, defenseKey(s))
  const pool = team.bullpen.filter((id) => players[id].role !== 'CL' || (s.inning >= 9 && lead > 0) || team.bullpen.length === 1)
  if (!pool.length) return team.bullpen[0] ?? null
  const sameHand = pool.find((id) => players[id].throws === batter.bats)
  return sameHand ?? pool[0]
}

export function autoOffense(s: GameState, players: PlayerIndex): OffenseAction {
  const side = offenseKey(s)
  const diff = scoreDiffFor(s, side)
  const close = Math.abs(diff) <= 2
  const b = s.bases
  // 도루: 빠른 주자, 2사 전, 접전
  const leadRunner = b[0] && !b[1] ? b[0] : null
  if (leadRunner && s.outs < 2 && close) {
    const prof = hitterProfile(players[leadRunner.id], 'R')
    if (prof.stealRate > 0.78 && prof.stealAttempts >= 15) return 'steal'
  }
  // 번트: 경기 후반, 무사 1(2)루, 동점 또는 1점 차, 하위 타순
  if (s.inning >= 7 && s.outs === 0 && (b[0] || b[1]) && !b[2] && diff >= -1 && diff <= 0) {
    const batter = players[currentBatterId(s)]
    if (battingTotals(batter).avg < 0.255 || offense(s).battingIndex >= 6) return 'bunt'
  }
  return 'swing'
}

export function autoDefense(s: GameState, players: PlayerIndex): DefenseAction {
  const lead = scoreDiffFor(s, defenseKey(s))
  const late = s.inning >= 7
  const b = s.bases
  if (late && Math.abs(lead) <= 1 && b[2] && s.outs < 2) {
    // 1루가 비어 있고 지금 타자가 강타자면 거른다
    const batter = players[currentBatterId(s)]
    if (!b[0] && battingTotals(batter).slg > 0.46) return 'ibb'
    return 'infieldIn'
  }
  return 'pitch'
}

/** 양 팀 모두 자동 감독으로 한 타석 진행 */
export function autoStep(state: GameState, players: PlayerIndex, rng: Rng): GameState {
  let s = state
  const change = autoPitchingChange(s, players)
  if (change) s = changePitcher(s, players, defenseKey(s), change)
  return playPlateAppearance(s, players, rng, { offense: autoOffense(s, players), defense: autoDefense(s, players) })
}
