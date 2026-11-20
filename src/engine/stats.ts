// 시즌 기록 → 타석 결과 확률
// 1) 데뷔부터 현재까지 시즌을 최근일수록 크게 가중해 합친다
// 2) 표본이 적으면 리그 평균 쪽으로 당긴다 (회귀)
// 3) 타자와 투수 확률을 log5(오즈비)로 합친다

import type { Hand, Player } from '../data/types'
import { CURRENT_SEASON } from '../data/sampleRoster'

export type PaEvent = 'so' | 'bb' | 'hr' | 'single' | 'double' | 'triple' | 'out'

export type Rates = Record<Exclude<PaEvent, 'out'>, number>

export const LEAGUE: Rates = {
  so: 0.19,
  bb: 0.09,
  hr: 0.022,
  single: 0.158,
  double: 0.045,
  triple: 0.004,
}

/** 리그 평균만큼의 가상 타석을 더해 회귀시키는 강도 */
const REGRESSION_PA: Rates = { so: 120, bb: 160, hr: 320, single: 420, double: 600, triple: 900 }
const SPLIT_REGRESSION = 220
const YEAR_DECAY = 0.7

export interface HitterProfile {
  rates: Rates
  /** 가중치가 반영된 표본 타석 수 */
  samplePa: number
  /** 해당 손 투수 상대 실제 통산 타석 수 */
  splitPa: number
  speed: number
  stealRate: number
  stealAttempts: number
}

export interface PitcherProfile {
  rates: Rates
  sampleBf: number
  splitBf: number
}

const weight = (year: number) => Math.pow(YEAR_DECAY, CURRENT_SEASON - year)

function regress(count: number, n: number, prior: number, k: number) {
  return (count + prior * k) / (n + k)
}

function vsKey(hand: Hand, batterHand?: Hand): 'vsL' | 'vsR' {
  if (hand === 'S') return batterHand === 'L' ? 'vsR' : 'vsL'
  return hand === 'L' ? 'vsL' : 'vsR'
}

export function hitterProfile(player: Player, pitcherThrows: Hand): HitterProfile {
  let pa = 0, h = 0, d = 0, t = 0, hr = 0, bb = 0, so = 0, sb = 0, cs = 0
  let spPa = 0, spH = 0, spHr = 0, spBb = 0, spSo = 0, rawSplitPa = 0
  const key = vsKey(pitcherThrows)
  for (const s of player.batting) {
    const w = weight(s.year)
    pa += s.pa * w
    h += s.h * w
    d += s.double * w
    t += s.triple * w
    hr += s.hr * w
    bb += s.bb * w
    so += s.so * w
    sb += s.sb
    cs += s.cs
    const sp = s[key]
    spPa += sp.pa * w
    spH += sp.h * w
    spHr += sp.hr * w
    spBb += sp.bb * w
    spSo += sp.so * w
    rawSplitPa += sp.pa
  }

  const singles = Math.max(0, h - d - t - hr)
  const overall: Rates = {
    so: regress(so, pa, LEAGUE.so, REGRESSION_PA.so),
    bb: regress(bb, pa, LEAGUE.bb, REGRESSION_PA.bb),
    hr: regress(hr, pa, LEAGUE.hr, REGRESSION_PA.hr),
    single: regress(singles, pa, LEAGUE.single, REGRESSION_PA.single),
    double: regress(d, pa, LEAGUE.double, REGRESSION_PA.double),
    triple: regress(t, pa, LEAGUE.triple, REGRESSION_PA.triple),
  }

  // 좌우 기록은 전체 성향 쪽으로 한 번 더 당긴다
  const splitHits = regress(spH - spHr, spPa, overall.single + overall.double + overall.triple, SPLIT_REGRESSION)
  const nonHrHits = overall.single + overall.double + overall.triple
  const scale = nonHrHits > 0 ? splitHits / nonHrHits : 1
  const rates: Rates = {
    so: regress(spSo, spPa, overall.so, SPLIT_REGRESSION),
    bb: regress(spBb, spPa, overall.bb, SPLIT_REGRESSION),
    hr: regress(spHr, spPa, overall.hr, SPLIT_REGRESSION),
    single: overall.single * scale,
    double: overall.double * scale,
    triple: overall.triple * scale,
  }

  const attempts = sb + cs
  const stealRate = regress(sb, attempts, 0.7, 12)
  const speed = Math.min(1, Math.max(0, (sb / Math.max(pa, 1)) * 18 + t / Math.max(pa, 1) * 40))

  return { rates, samplePa: Math.round(pa), splitPa: rawSplitPa, speed, stealRate, stealAttempts: attempts }
}

export function pitcherProfile(player: Player, batterHand: Hand): PitcherProfile {
  let bf = 0, h = 0, hr = 0, bb = 0, so = 0
  let spBf = 0, spH = 0, spHr = 0, spBb = 0, spSo = 0, rawSplit = 0
  const key = batterHand === 'S' ? (player.throws === 'L' ? 'vsR' : 'vsL') : batterHand === 'L' ? 'vsL' : 'vsR'
  for (const s of player.pitching) {
    const w = weight(s.year)
    bf += s.bf * w
    h += s.h * w
    hr += s.hr * w
    bb += s.bb * w
    so += s.so * w
    const sp = s[key]
    spBf += sp.bf * w
    spH += sp.h * w
    spHr += sp.hr * w
    spBb += sp.bb * w
    spSo += sp.so * w
    rawSplit += sp.bf
  }
  const lgHits = LEAGUE.single + LEAGUE.double + LEAGUE.triple
  const overall = {
    so: regress(so, bf, LEAGUE.so, REGRESSION_PA.so),
    bb: regress(bb, bf, LEAGUE.bb, REGRESSION_PA.bb),
    hr: regress(hr, bf, LEAGUE.hr, REGRESSION_PA.hr),
    hits: regress(h - hr, bf, lgHits, REGRESSION_PA.single),
  }
  const hits = regress(spH - spHr, spBf, overall.hits, SPLIT_REGRESSION)
  const rates: Rates = {
    so: regress(spSo, spBf, overall.so, SPLIT_REGRESSION),
    bb: regress(spBb, spBf, overall.bb, SPLIT_REGRESSION),
    hr: regress(spHr, spBf, overall.hr, SPLIT_REGRESSION),
    single: (hits * LEAGUE.single) / lgHits,
    double: (hits * LEAGUE.double) / lgHits,
    triple: (hits * LEAGUE.triple) / lgHits,
  }
  return { rates, sampleBf: Math.round(bf), splitBf: rawSplit }
}

function log5(b: number, p: number, lg: number) {
  const odds = (b / (1 - b)) * (p / (1 - p)) / (lg / (1 - lg))
  return odds / (1 + odds)
}

export interface Modifiers {
  /** 1보다 크면 투수 쪽이 불리 (피로, 비 등) */
  pitcherFatigue?: number
  hrFactor?: number
  hitFactor?: number
}

/** 타자·투수 매치업의 타석 결과 확률 (합계 1) */
export function matchupProbabilities(h: Rates, p: Rates, mod: Modifiers = {}): Record<PaEvent, number> {
  const fatigue = mod.pitcherFatigue ?? 1
  const out: Record<PaEvent, number> = {
    so: log5(h.so, p.so, LEAGUE.so) / fatigue,
    bb: log5(h.bb, p.bb, LEAGUE.bb) * fatigue,
    hr: log5(h.hr, p.hr, LEAGUE.hr) * fatigue * (mod.hrFactor ?? 1),
    single: log5(h.single, p.single, LEAGUE.single) * fatigue * (mod.hitFactor ?? 1),
    double: log5(h.double, p.double, LEAGUE.double) * fatigue * (mod.hitFactor ?? 1),
    triple: log5(h.triple, p.triple, LEAGUE.triple),
    out: 0,
  }
  const used = out.so + out.bb + out.hr + out.single + out.double + out.triple
  out.out = Math.max(0.05, 1 - used)
  const total = used + out.out
  for (const key of Object.keys(out) as PaEvent[]) out[key] /= total
  return out
}

/** 화면 표시용 통산 요약 */
export function battingTotals(player: Player) {
  const t = player.batting.reduce(
    (a, s) => ({ pa: a.pa + s.pa, ab: a.ab + s.ab, h: a.h + s.h, hr: a.hr + s.hr, bb: a.bb + s.bb, so: a.so + s.so, sb: a.sb + s.sb, d: a.d + s.double, t: a.t + s.triple }),
    { pa: 0, ab: 0, h: 0, hr: 0, bb: 0, so: 0, sb: 0, d: 0, t: 0 },
  )
  const avg = t.ab ? t.h / t.ab : 0
  const obp = t.pa ? (t.h + t.bb) / t.pa : 0
  const slg = t.ab ? (t.h - t.d - t.t - t.hr + 2 * t.d + 3 * t.t + 4 * t.hr) / t.ab : 0
  return { ...t, avg, obp, slg }
}

export function pitchingTotals(player: Player) {
  const t = player.pitching.reduce(
    (a, s) => ({ g: a.g + s.g, ip: a.ip + s.ip, er: a.er + s.er, so: a.so + s.so, bb: a.bb + s.bb, h: a.h + s.h, w: a.w + s.w, l: a.l + s.l, sv: a.sv + s.sv }),
    { g: 0, ip: 0, er: 0, so: 0, bb: 0, h: 0, w: 0, l: 0, sv: 0 },
  )
  return { ...t, era: t.ip ? (t.er * 9) / t.ip : 0, whip: t.ip ? (t.h + t.bb) / t.ip : 0 }
}

export function seasonAvg(s: { h: number; ab: number }) {
  return s.ab ? s.h / s.ab : 0
}

export function splitAvg(s: { h: number; pa: number; bb: number }) {
  const ab = s.pa - s.bb
  return ab > 0 ? s.h / ab : 0
}

export function fmtAvg(v: number) {
  return v.toFixed(3).replace(/^0/, '')
}
