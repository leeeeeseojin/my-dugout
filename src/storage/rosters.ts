// 직접 만든 로스터: 이 기기에만 저장하고, 파일로 내보내고 불러올 수 있다

import { toPlayer, type CustomPlayer, type Level, type Platoon } from '../data/ratings'
import { sampleRepository } from '../data/sampleRoster'
import type { Hand, PitcherRole, Player, PlayerRepository, Position } from '../data/types'

export interface CustomRoster {
  teamId: string
  updatedAt: string
  players: CustomPlayer[]
}

export type RosterMap = Record<string, CustomRoster>

const KEY = 'my-dugout:rosters'
const FILE_APP = 'my-dugout-roster'

export function loadRosters(): RosterMap {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RosterMap) : {}
  } catch {
    return {}
  }
}

export function saveRosters(map: RosterMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    // 저장이 막힌 환경에서는 이번 세션에만 유지
  }
}

// ───────── 경기에 쓸 수 있는지 ─────────

export interface RosterCheck {
  ok: boolean
  problems: string[]
  counts: { hitters: number; catchers: number; starters: number; bullpen: number }
}

export function checkRoster(players: CustomPlayer[]): RosterCheck {
  const hitters = players.filter((p) => p.position !== 'P')
  const pitchers = players.filter((p) => p.position === 'P')
  const counts = {
    hitters: hitters.length,
    catchers: hitters.filter((p) => p.position === 'C').length,
    starters: pitchers.filter((p) => (p.role ?? 'RP') === 'SP').length,
    bullpen: pitchers.filter((p) => (p.role ?? 'RP') !== 'SP').length,
  }
  const problems: string[] = []
  if (counts.hitters < 9) problems.push(`타자가 ${9 - counts.hitters}명 더 필요해요 (최소 9명)`)
  if (counts.catchers < 1) problems.push('포수가 1명 이상 필요해요')
  if (counts.starters < 1) problems.push('선발 투수가 1명 이상 필요해요')
  return { ok: problems.length === 0, problems, counts }
}

// ───────── 엔진 연결 ─────────

const converted = new WeakMap<CustomRoster, Player[]>()

function rosterPlayers(r: CustomRoster): Player[] {
  let list = converted.get(r)
  if (!list) {
    list = r.players.map((p, i) => toPlayer(r.teamId, p, i))
    converted.set(r, list)
  }
  return list
}

/** 경기에 쓸 수 있는 직접 만든 로스터가 있으면 그것을, 없으면 가상 샘플 선수를 쓴다 */
export function createRepository(map: RosterMap): PlayerRepository {
  const usable = Object.values(map).filter((r) => checkRoster(r.players).ok)
  return {
    sourceLabel: usable.length ? `직접 만든 로스터 ${usable.length}팀 · 나머지는 가상의 선수` : '샘플 데이터 · 가상의 선수와 기록',
    getRoster(teamId) {
      const r = map[teamId]
      return r && checkRoster(r.players).ok ? rosterPlayers(r) : sampleRepository.getRoster(teamId)
    },
  }
}

export function isCustomTeam(map: RosterMap, teamId: string) {
  const r = map[teamId]
  return Boolean(r && checkRoster(r.players).ok)
}

// ───────── 파일로 내보내기·불러오기 ─────────

export function exportRosters(rosters: CustomRoster[]): string {
  return JSON.stringify({ app: FILE_APP, version: 1, exportedAt: new Date().toISOString(), rosters }, null, 2)
}

const HANDS: Hand[] = ['L', 'R', 'S']
const POSITIONS: Position[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']
const ROLES: PitcherRole[] = ['SP', 'RP', 'CL']

const level = (v: unknown): Level => (Math.max(0, Math.min(4, Math.round(Number(v) || 0))) as Level)
const platoon = (v: unknown): Platoon => (Math.max(-1, Math.min(1, Math.round(Number(v) || 0))) as Platoon)
const pickOf = <T,>(list: T[], v: unknown, fallback: T): T => (list.includes(v as T) ? (v as T) : fallback)

/** 파일 내용을 검사해 안전한 값만 남긴다. 형식이 틀리면 이유를 담아 예외를 던진다 */
export function parseRosterFile(text: string, knownTeams: string[]): CustomRoster[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('JSON 파일이 아니에요')
  }
  const obj = data as { app?: string; rosters?: unknown }
  if (obj.app !== FILE_APP || !Array.isArray(obj.rosters)) throw new Error('MY DUGOUT 로스터 파일이 아니에요')
  const out: CustomRoster[] = []
  for (const raw of obj.rosters as Record<string, unknown>[]) {
    const teamId = String(raw.teamId ?? '')
    if (!knownTeams.includes(teamId) || !Array.isArray(raw.players)) continue
    const players: CustomPlayer[] = (raw.players as Record<string, unknown>[]).slice(0, 60).map((p, i) => {
      const position = pickOf(POSITIONS, p.position, 'LF')
      const h = (p.hitter ?? {}) as Record<string, unknown>
      const pi = (p.pitcher ?? {}) as Record<string, unknown>
      return {
        id: String(p.id ?? i).slice(0, 40),
        name: String(p.name ?? '').slice(0, 20),
        number: Math.max(0, Math.min(99, Math.round(Number(p.number) || 0))),
        bats: pickOf(HANDS, p.bats, 'R'),
        throws: pickOf(HANDS, p.throws, 'R'),
        position,
        role: position === 'P' ? pickOf(ROLES, p.role, 'RP') : undefined,
        hitter: position !== 'P' ? { avg: level(h.avg), hr: level(h.hr), walk: level(h.walk), strikeout: level(h.strikeout), speed: level(h.speed), vsLefty: platoon(h.vsLefty) } : undefined,
        pitcher: position === 'P' ? { era: level(pi.era), strikeout: level(pi.strikeout), walk: level(pi.walk), vsLefty: platoon(pi.vsLefty) } : undefined,
      }
    })
    out.push({ teamId, updatedAt: new Date().toISOString(), players })
  }
  if (!out.length) throw new Error('불러올 수 있는 구단 로스터가 없어요')
  return out
}
