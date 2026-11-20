// 기본 라인업 구성: 통산 기록으로 타순을 짜고 선발·불펜을 나눈다

import type { Player, Position } from '../data/types'
import type { Rng } from './rng'
import type { TeamSide } from './game'
import { battingTotals } from './stats'

export interface LineupPlan {
  order: string[]
  fielding: Record<string, Position>
  bench: string[]
  starterId: string
}

const FIELD_ORDER: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']

function ops(p: Player) {
  const t = battingTotals(p)
  return t.obp + t.slg
}

/** 포지션별로 주전을 고르고 OPS 순으로 타순을 짠다 */
export function defaultLineup(roster: Player[], rng: Rng): LineupPlan {
  const hitters = roster.filter((p) => p.position !== 'P')
  const fielding: Record<string, Position> = {}
  const taken = new Set<string>()
  for (const pos of FIELD_ORDER) {
    const candidates = hitters
      .filter((p) => !taken.has(p.id) && (p.position === pos || (pos === 'DH' && p.positions.includes('DH'))))
      .sort((a, b) => ops(b) - ops(a))
    const fallback = hitters.filter((p) => !taken.has(p.id) && p.positions.includes(pos)).sort((a, b) => ops(b) - ops(a))
    const any = hitters.filter((p) => !taken.has(p.id)).sort((a, b) => ops(b) - ops(a))
    const chosen = candidates[0] ?? fallback[0] ?? any[0]
    taken.add(chosen.id)
    fielding[chosen.id] = pos
  }
  const starters = Object.keys(fielding)
    .map((id) => roster.find((p) => p.id === id)!)
    .sort((a, b) => ops(b) - ops(a))
  // 3번에 가장 좋은 타자, 1·2번에 출루형, 4·5번에 다음 순서
  const ranked = starters.map((p) => p.id)
  const order = [ranked[2], ranked[1], ranked[0], ranked[3], ranked[4], ranked[5], ranked[6], ranked[7], ranked[8]]
  const bench = hitters.filter((p) => !taken.has(p.id)).map((p) => p.id)
  const sps = roster.filter((p) => p.role === 'SP')
  const starterId = sps[Math.floor(rng() * sps.length)].id
  return { order, fielding, bench, starterId }
}

export function bullpenOf(roster: Player[]) {
  return roster.filter((p) => p.role === 'RP' || p.role === 'CL').map((p) => p.id)
}

export function toTeamSide(teamId: string, roster: Player[], plan: LineupPlan): TeamSide {
  return {
    teamId,
    lineup: [...plan.order],
    fielding: { ...plan.fielding },
    bench: [...plan.bench],
    pitcherId: plan.starterId,
    bullpen: bullpenOf(roster),
    usedPitchers: [],
    battingIndex: 0,
  }
}
