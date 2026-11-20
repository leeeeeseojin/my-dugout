// 샘플 선수 명단 생성기
// 실제 데이터 연결 전까지 쓰는 가상의 선수들이다. 이름과 기록은 모두 지어낸 값이며 실제 선수와 무관하다.
// 구단 id를 시드로 쓰므로 같은 구단은 항상 같은 명단이 나온다.

import { createRng, hashString, pick, type Rng } from '../engine/rng'
import type {
  BattingSeason,
  BattingSplit,
  Hand,
  PitcherRole,
  PitchingSeason,
  PitchingSplit,
  Player,
  PlayerRepository,
  Position,
} from './types'

export const CURRENT_SEASON = 2026

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '홍', '유']
const GIVEN_A = ['민', '서', '도', '준', '현', '지', '태', '우', '승', '재', '하', '시', '건', '동', '성', '영', '진', '한']
const GIVEN_B = ['호', '준', '우', '혁', '빈', '원', '훈', '수', '찬', '율', '규', '석', '환', '결', '온', '범', '겸', '오']
const SKINS = ['#f2c7a5', '#e8b48f', '#d9a07a', '#c68863', '#f5d2b8']
const HAIRS = ['#2b2a26', '#3a2a1e', '#5a3b22', '#1e1e1e']

const FIELD_SLOTS: { pos: Position; extra: Position[] }[] = [
  { pos: 'C', extra: [] },
  { pos: '1B', extra: ['DH'] },
  { pos: '2B', extra: ['SS', '3B'] },
  { pos: '3B', extra: ['1B'] },
  { pos: 'SS', extra: ['2B', '3B'] },
  { pos: 'LF', extra: ['RF', 'DH'] },
  { pos: 'CF', extra: ['LF', 'RF'] },
  { pos: 'RF', extra: ['LF', '1B'] },
  { pos: 'DH', extra: ['1B'] },
  { pos: 'C', extra: [] },
  { pos: 'SS', extra: ['2B', '3B'] },
  { pos: 'LF', extra: ['CF', 'RF'] },
  { pos: '1B', extra: ['3B', 'DH'] },
]

const PITCHER_ROLES: PitcherRole[] = ['SP', 'SP', 'SP', 'SP', 'SP', 'RP', 'RP', 'RP', 'RP', 'RP', 'RP', 'CL']

function between(rng: Rng, min: number, max: number) {
  return min + (max - min) * rng()
}

function binom(rng: Rng, n: number, p: number) {
  // 큰 n에서는 정규 근사로 충분하다
  const mean = n * p
  const sd = Math.sqrt(n * p * (1 - p))
  const u = Math.max(1e-9, rng())
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
  return Math.max(0, Math.min(n, Math.round(mean + z * sd)))
}

function makeName(rng: Rng, used: Set<string>) {
  for (;;) {
    const name = pick(rng, SURNAMES) + pick(rng, GIVEN_A) + pick(rng, GIVEN_B)
    if (!used.has(name)) {
      used.add(name)
      return name
    }
  }
}

/** 나이에 따른 기량 변화: 27~30세 전성기 */
function agingFactor(age: number) {
  if (age < 27) return 1 - (27 - age) * 0.025
  if (age > 31) return 1 - (age - 31) * 0.03
  return 1
}

interface HitterTalent {
  contact: number // 안타율(타석 대비)
  power: number // 홈런율
  eye: number // 볼넷율
  whiff: number // 삼진율
  speed: number // 0~1
  platoon: number // 같은 손 투수 상대 불리함 정도
}

function splitOf(rng: Rng, pa: number, t: HitterTalent, penalty: number): BattingSplit {
  const h = binom(rng, pa, t.contact * (1 - penalty))
  return {
    pa,
    h,
    hr: binom(rng, pa, t.power * (1 - penalty * 1.2)),
    bb: binom(rng, pa, t.eye),
    so: binom(rng, pa, t.whiff * (1 + penalty)),
  }
}

function battingSeasons(rng: Rng, t: HitterTalent, bats: Hand, debut: number, birth: number, regular: boolean): BattingSeason[] {
  const seasons: BattingSeason[] = []
  for (let year = debut; year <= CURRENT_SEASON; year++) {
    const age = year - birth
    const f = agingFactor(age)
    const yearsIn = year - debut
    const fullTime = regular ? Math.min(1, 0.35 + yearsIn * 0.25) : between(rng, 0.15, 0.45)
    const pa = Math.round(between(rng, 380, 600) * fullTime)
    const season: HitterTalent = {
      ...t,
      contact: t.contact * f * between(rng, 0.9, 1.1),
      power: t.power * f * between(rng, 0.8, 1.2),
    }
    // 좌투수 상대 타석은 전체의 약 30%
    const paL = Math.round(pa * 0.3)
    const paR = pa - paL
    const vsL = splitOf(rng, paL, season, bats === 'L' ? t.platoon : bats === 'S' ? 0 : -t.platoon * 0.4)
    const vsR = splitOf(rng, paR, season, bats === 'R' ? t.platoon * 0.6 : bats === 'S' ? 0 : -t.platoon * 0.3)
    const h = vsL.h + vsR.h
    const hr = Math.min(h, vsL.hr + vsR.hr)
    const double = Math.min(h - hr, binom(rng, h, 0.19))
    const triple = Math.min(h - hr - double, binom(rng, h, 0.015 + t.speed * 0.02))
    const bb = vsL.bb + vsR.bb
    const steals = Math.round(pa * t.speed * t.speed * between(rng, 0.03, 0.06))
    const cs = Math.round(steals * between(rng, 0.2, 0.35))
    seasons.push({
      year,
      pa,
      ab: pa - bb - Math.round(pa * 0.012),
      h,
      double,
      triple,
      hr,
      bb,
      so: vsL.so + vsR.so,
      sb: steals,
      cs,
      vsL,
      vsR,
    })
  }
  return seasons
}

interface PitcherTalent {
  hitAllowed: number
  hrAllowed: number
  walk: number
  strikeout: number
  platoon: number
}

function pitchSplit(rng: Rng, bf: number, t: PitcherTalent, penalty: number): PitchingSplit {
  return {
    bf,
    h: binom(rng, bf, t.hitAllowed * (1 + penalty)),
    hr: binom(rng, bf, t.hrAllowed * (1 + penalty)),
    bb: binom(rng, bf, t.walk),
    so: binom(rng, bf, t.strikeout * (1 - penalty)),
  }
}

function pitchingSeasons(rng: Rng, t: PitcherTalent, throws: Hand, role: PitcherRole, debut: number, birth: number): PitchingSeason[] {
  const seasons: PitchingSeason[] = []
  for (let year = debut; year <= CURRENT_SEASON; year++) {
    const f = agingFactor(year - birth)
    const starter = role === 'SP'
    const g = starter ? Math.round(between(rng, 18, 30)) : Math.round(between(rng, 35, 68))
    const ip = starter ? g * between(rng, 4.8, 6.2) : g * between(rng, 0.85, 1.1)
    const bf = Math.round(ip * 4.3)
    const season: PitcherTalent = {
      ...t,
      hitAllowed: t.hitAllowed / f,
      strikeout: t.strikeout * f,
    }
    const bfL = Math.round(bf * (throws === 'L' ? 0.32 : 0.42))
    const vsL = pitchSplit(rng, bfL, season, throws === 'L' ? -t.platoon : t.platoon * 0.5)
    const vsR = pitchSplit(rng, bf - bfL, season, throws === 'R' ? -t.platoon * 0.6 : t.platoon * 0.3)
    const h = vsL.h + vsR.h
    const hr = vsL.hr + vsR.hr
    const bb = vsL.bb + vsR.bb
    // 대략적인 자책점: 피안타·볼넷·피홈런으로 추정
    const er = Math.round((h * 0.27 + bb * 0.2 + hr * 0.85) * between(rng, 0.85, 1.15))
    const decisions = starter ? Math.round(g * 0.7) : Math.round(g * 0.12)
    const winShare = Math.min(0.75, Math.max(0.25, 0.5 + (4.3 - (er * 9) / ip) * 0.06))
    const w = Math.round(decisions * winShare)
    seasons.push({
      year,
      g,
      gs: starter ? g : 0,
      ip: Math.round(ip * 3) / 3,
      bf,
      h,
      hr,
      bb,
      so: vsL.so + vsR.so,
      er,
      w,
      l: decisions - w,
      sv: role === 'CL' ? Math.round(g * between(rng, 0.45, 0.6)) : 0,
      vsL,
      vsR,
    })
  }
  return seasons
}

function makeHitter(rng: Rng, teamId: string, index: number, used: Set<string>, numbers: Set<number>): Player {
  const slot = FIELD_SLOTS[index]
  const regular = index < 9
  const bats: Hand = rng() < 0.38 ? 'L' : rng() < 0.08 ? 'S' : 'R'
  const birth = CURRENT_SEASON - Math.round(between(rng, 21, 37))
  const debut = Math.max(birth + 19, CURRENT_SEASON - Math.round(between(rng, 0, 14)))
  const slugger = slot.pos === '1B' || slot.pos === 'DH' || slot.pos === 'RF' || slot.pos === 'LF'
  const quick = slot.pos === 'CF' || slot.pos === 'SS' || slot.pos === '2B'
  const talent: HitterTalent = {
    contact: between(rng, 0.2, 0.29) * (regular ? 1.03 : 0.94),
    power: between(rng, 0.008, slugger ? 0.05 : 0.026),
    eye: between(rng, 0.055, 0.13),
    whiff: between(rng, 0.12, 0.25),
    speed: quick ? between(rng, 0.5, 0.95) : between(rng, 0.1, 0.6),
    platoon: between(rng, 0.02, 0.16),
  }
  return {
    id: `${teamId}-h${index}`,
    teamId,
    name: makeName(rng, used),
    number: uniqueNumber(rng, numbers, 1, 69),
    bats,
    throws: slot.pos === 'C' || slot.pos === 'SS' || slot.pos === '2B' || slot.pos === '3B' ? 'R' : rng() < 0.25 ? 'L' : 'R',
    position: slot.pos,
    positions: [slot.pos, ...slot.extra],
    batting: battingSeasons(rng, talent, bats, debut, birth, regular),
    pitching: [],
    look: { skin: pick(rng, SKINS), hair: pick(rng, HAIRS) },
  }
}

function makePitcher(rng: Rng, teamId: string, index: number, used: Set<string>, numbers: Set<number>): Player {
  const role = PITCHER_ROLES[index]
  const throws: Hand = rng() < 0.3 ? 'L' : 'R'
  const birth = CURRENT_SEASON - Math.round(between(rng, 21, 38))
  const debut = Math.max(birth + 19, CURRENT_SEASON - Math.round(between(rng, 0, 15)))
  const ace = role === 'CL' || index === 0
  const talent: PitcherTalent = {
    hitAllowed: between(rng, 0.2, 0.27) * (ace ? 0.92 : 1),
    hrAllowed: between(rng, 0.014, 0.032),
    walk: between(rng, 0.06, 0.12),
    strikeout: between(rng, 0.14, 0.27) * (ace ? 1.12 : 1),
    platoon: between(rng, 0.02, 0.18),
  }
  return {
    id: `${teamId}-p${index}`,
    teamId,
    name: makeName(rng, used),
    number: uniqueNumber(rng, numbers, 11, 99),
    bats: throws,
    throws,
    position: 'P',
    positions: ['P'],
    role,
    batting: [],
    pitching: pitchingSeasons(rng, talent, throws, role, debut, birth),
    look: { skin: pick(rng, SKINS), hair: pick(rng, HAIRS) },
  }
}

function uniqueNumber(rng: Rng, used: Set<number>, min: number, max: number) {
  for (;;) {
    const n = Math.round(between(rng, min, max))
    if (!used.has(n)) {
      used.add(n)
      return n
    }
  }
}

export function generateRoster(teamId: string): Player[] {
  const rng = createRng(hashString(`my-dugout:${teamId}`))
  const usedNames = new Set<string>()
  const numbers = new Set<number>()
  const hitters = FIELD_SLOTS.map((_, i) => makeHitter(rng, teamId, i, usedNames, numbers))
  const pitchers = PITCHER_ROLES.map((_, i) => makePitcher(rng, teamId, i, usedNames, numbers))
  return [...hitters, ...pitchers]
}

const cache = new Map<string, Player[]>()

export const sampleRepository: PlayerRepository = {
  sourceLabel: '샘플 데이터 · 가상의 선수와 기록',
  getRoster(teamId) {
    if (!cache.has(teamId)) cache.set(teamId, generateRoster(teamId))
    return cache.get(teamId)!
  },
}
