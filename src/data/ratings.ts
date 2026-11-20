// 직접 매기는 대략적 능력치
// 실제 기록을 옮기지 않고, 사용자가 보고 판단한 "가장 가까운 구간"을 고른다.
// 고른 구간은 엔진이 쓰는 예상 시즌 기록 한 줄로 바꿔 넣는다.

import type { BattingSeason, Hand, PitcherRole, PitchingSeason, Player, Position } from './types'
import { CURRENT_SEASON } from './sampleRoster'

/** 0~4 다섯 단계 */
export type Level = 0 | 1 | 2 | 3 | 4
/** 같은 손 투수(타자) 상대: 약함 · 보통 · 강함 */
export type Platoon = -1 | 0 | 1

export interface HitterRatings {
  avg: Level
  hr: Level
  walk: Level
  strikeout: Level
  speed: Level
  vsLefty: Platoon
}

export interface PitcherRatings {
  era: Level
  strikeout: Level
  walk: Level
  vsLefty: Platoon
}

export interface CustomPlayer {
  id: string
  name: string
  number: number
  bats: Hand
  throws: Hand
  position: Position
  role?: PitcherRole
  hitter?: HitterRatings
  pitcher?: PitcherRatings
}

/** 화면에 보여줄 구간 이름과 엔진에 넣을 값 */
export const HITTER_SCALE = {
  avg: { label: '타율', steps: ['.220', '.250', '.280', '.310', '.340'], values: [0.22, 0.25, 0.28, 0.31, 0.34] },
  hr: { label: '홈런', steps: ['3개', '8개', '15개', '25개', '35개+'], values: [3, 8, 15, 25, 36] },
  walk: { label: '볼넷', steps: ['아주 적음', '적음', '보통', '많음', '아주 많음'], values: [0.05, 0.07, 0.09, 0.115, 0.14] },
  strikeout: { label: '삼진', steps: ['아주 적음', '적음', '보통', '많음', '아주 많음'], values: [0.11, 0.15, 0.19, 0.23, 0.28] },
  speed: { label: '도루', steps: ['0개', '5개', '12개', '22개', '35개+'], values: [0, 5, 12, 22, 36] },
} as const

export const PITCHER_SCALE = {
  era: { label: '평균자책점', steps: ['2.50', '3.30', '4.00', '4.80', '5.80'], values: [2.5, 3.3, 4.0, 4.8, 5.8] },
  strikeout: { label: '탈삼진', steps: ['아주 적음', '적음', '보통', '많음', '아주 많음'], values: [0.14, 0.18, 0.22, 0.26, 0.3] },
  walk: { label: '볼넷', steps: ['아주 적음', '적음', '보통', '많음', '아주 많음'], values: [0.05, 0.07, 0.09, 0.11, 0.13] },
} as const

export const PLATOON_LABEL = { [-1]: '약함', 0: '보통', 1: '강함' } as const

export const DEFAULT_HITTER: HitterRatings = { avg: 2, hr: 2, walk: 2, strikeout: 2, speed: 1, vsLefty: 0 }
export const DEFAULT_PITCHER: PitcherRatings = { era: 2, strikeout: 2, walk: 2, vsLefty: 0 }

const PA = 550
const LEFTY_SHARE = 0.3

function hitterSeason(r: HitterRatings): BattingSeason {
  const avg = HITTER_SCALE.avg.values[r.avg]
  const hr = HITTER_SCALE.hr.values[r.hr]
  const bbRate = HITTER_SCALE.walk.values[r.walk]
  const soRate = HITTER_SCALE.strikeout.values[r.strikeout]
  const sb = HITTER_SCALE.speed.values[r.speed]
  const bb = Math.round(PA * bbRate)
  const ab = PA - bb
  const h = Math.max(hr, Math.round(ab * avg))
  const so = Math.round(PA * soRate)
  const triple = Math.round(h * (0.005 + r.speed * 0.006))
  const double = Math.round(h * 0.19)

  // 좌투수 상대 강약을 타율·홈런에 ±12%로 반영하고, 전체 합은 유지한다
  const paL = Math.round(PA * LEFTY_SHARE)
  const paR = PA - paL
  const tilt = r.vsLefty * 0.12
  const split = (share: number, factor: number, total: number) => Math.round(total * share * factor)
  const hL = split(LEFTY_SHARE, 1 + tilt, h)
  const hrL = split(LEFTY_SHARE, 1 + tilt, hr)
  const bbL = Math.round(bb * LEFTY_SHARE)
  const soL = split(LEFTY_SHARE, 1 - tilt, so)
  return {
    year: CURRENT_SEASON,
    pa: PA,
    ab,
    h,
    double,
    triple,
    hr,
    bb,
    so,
    sb,
    cs: Math.round(sb * 0.28),
    vsL: { pa: paL, h: hL, hr: hrL, bb: bbL, so: soL },
    vsR: { pa: paR, h: h - hL, hr: hr - hrL, bb: bb - bbL, so: so - soL },
  }
}

function pitcherSeason(c: CustomPlayer, r: PitcherRatings): PitchingSeason {
  const role = c.role ?? 'RP'
  const starter = role === 'SP'
  const ip = starter ? 150 : 62
  const g = starter ? 26 : 60
  const bf = Math.round(ip * 4.3)
  const era = PITCHER_SCALE.era.values[r.era]
  const so = Math.round(bf * PITCHER_SCALE.strikeout.values[r.strikeout])
  const bb = Math.round(bf * PITCHER_SCALE.walk.values[r.walk])
  const er = Math.round((era * ip) / 9)
  const hr = Math.round(bf * 0.024 * (era / 4))
  // 샘플 데이터와 같은 자책점 추정식(피안타·볼넷·피홈런)을 거꾸로 풀어 피안타를 정한다
  const h = Math.max(hr, Math.round((er - bb * 0.2 - hr * 0.85) / 0.27))

  const bfL = Math.round(bf * (c.throws === 'L' ? 0.32 : 0.42))
  const share = bfL / bf
  const tilt = r.vsLefty * 0.12
  const hL = Math.round(h * share * (1 - tilt))
  const hrL = Math.round(hr * share * (1 - tilt))
  const bbL = Math.round(bb * share)
  const soL = Math.round(so * share * (1 + tilt))
  const decisions = starter ? 20 : 6
  const w = Math.round(decisions * Math.min(0.72, Math.max(0.28, 0.5 + (4.0 - era) * 0.07)))
  return {
    year: CURRENT_SEASON,
    g,
    gs: starter ? g : 0,
    ip,
    bf,
    h,
    hr,
    bb,
    so,
    er,
    w,
    l: decisions - w,
    sv: role === 'CL' ? 30 : 0,
    vsL: { bf: bfL, h: hL, hr: hrL, bb: bbL, so: soL },
    vsR: { bf: bf - bfL, h: h - hL, hr: hr - hrL, bb: bb - bbL, so: so - soL },
  }
}

const SKINS = ['#f2c7a5', '#e8b48f', '#d9a07a', '#c68863', '#f5d2b8']
const HAIRS = ['#2b2a26', '#3a2a1e', '#5a3b22', '#1e1e1e']

/** 사용자가 만든 선수를 엔진이 쓰는 선수로 바꾼다 */
export function toPlayer(teamId: string, c: CustomPlayer, index: number): Player {
  const isPitcher = c.position === 'P'
  return {
    id: `${teamId}-c-${c.id}`,
    teamId,
    name: c.name.trim() || `선수 ${index + 1}`,
    number: c.number,
    bats: c.bats,
    throws: c.throws,
    position: c.position,
    positions: isPitcher ? ['P'] : c.position === 'DH' ? ['DH', '1B'] : [c.position, 'DH'],
    role: isPitcher ? (c.role ?? 'RP') : undefined,
    batting: !isPitcher ? [hitterSeason(c.hitter ?? DEFAULT_HITTER)] : [],
    pitching: isPitcher ? [pitcherSeason(c, c.pitcher ?? DEFAULT_PITCHER)] : [],
    look: { skin: SKINS[index % SKINS.length], hair: HAIRS[index % HAIRS.length] },
    custom: true,
  }
}

function nearest(values: readonly number[], v: number): Level {
  let best = 0
  for (let i = 1; i < values.length; i++) if (Math.abs(values[i] - v) < Math.abs(values[best] - v)) best = i
  return best as Level
}

/** 기존 선수(가상 샘플)를 편집 시작점으로 바꾼다: 통산 성적에서 가장 가까운 구간을 고른다 */
export function fromPlayer(p: Player): CustomPlayer {
  const base: CustomPlayer = {
    id: p.id.split('-').slice(-1)[0] + Math.random().toString(36).slice(2, 6),
    name: p.name,
    number: p.number,
    bats: p.bats,
    throws: p.throws,
    position: p.position,
    role: p.role,
  }
  if (p.position === 'P') {
    const t = p.pitching.reduce((a, s) => ({ bf: a.bf + s.bf, so: a.so + s.so, bb: a.bb + s.bb, er: a.er + s.er, ip: a.ip + s.ip }), { bf: 0, so: 0, bb: 0, er: 0, ip: 0 })
    return {
      ...base,
      pitcher: {
        era: nearest(PITCHER_SCALE.era.values, t.ip ? (t.er * 9) / t.ip : 4),
        strikeout: nearest(PITCHER_SCALE.strikeout.values, t.bf ? t.so / t.bf : 0.2),
        walk: nearest(PITCHER_SCALE.walk.values, t.bf ? t.bb / t.bf : 0.09),
        vsLefty: 0,
      },
    }
  }
  const last = p.batting[p.batting.length - 1]
  const t = p.batting.reduce((a, s) => ({ pa: a.pa + s.pa, ab: a.ab + s.ab, h: a.h + s.h, bb: a.bb + s.bb, so: a.so + s.so }), { pa: 0, ab: 0, h: 0, bb: 0, so: 0 })
  return {
    ...base,
    hitter: {
      avg: nearest(HITTER_SCALE.avg.values, t.ab ? t.h / t.ab : 0.26),
      hr: nearest(HITTER_SCALE.hr.values, last ? (last.hr / Math.max(last.pa, 1)) * 550 : 10),
      walk: nearest(HITTER_SCALE.walk.values, t.pa ? t.bb / t.pa : 0.09),
      strikeout: nearest(HITTER_SCALE.strikeout.values, t.pa ? t.so / t.pa : 0.19),
      speed: nearest(HITTER_SCALE.speed.values, last ? (last.sb / Math.max(last.pa, 1)) * 550 : 5),
      vsLefty: 0,
    },
  }
}
