// AI 코치
// 지금 상황에서 고를 수 있는 작전마다 "이번 이닝의 남은 공격"을 수백 번 빠르게 시뮬레이션해
// 예상 득점(또는 실점)을 비교한다. 추천과 함께 근거, 판단의 한계, 확신 정도를 돌려준다.
// 코치의 모델은 실제 경기 엔진보다 단순하다. 그래서 코치의 예상이 틀릴 수 있다.

import type { Player } from '../data/types'
import {
  currentBatterId,
  defense,
  defenseKey,
  fatigueOf,
  offense,
  offenseKey,
  staminaOf,
  userIsBatting,
  type GameState,
  type PlayerIndex,
} from './game'
import { scoreDiffFor } from './manager'
import { createRng, type Rng } from './rng'
import { battingTotals, fmtAvg, hitterProfile, matchupProbabilities, pitcherProfile, splitAvg, type PaEvent } from './stats'
import { WEATHER_EFFECTS } from './weather'

export type OptionKind = 'swing' | 'bunt' | 'steal' | 'pinch' | 'pitch' | 'ibb' | 'infieldIn' | 'change'

export interface CoachOption {
  id: string
  kind: OptionKind
  label: string
  playerId?: string
  /** 예상 득점(공격) 또는 예상 실점(수비) */
  runs: number
  /** 공격: 1점 이상 낼 확률 / 수비: 1점 이상 내줄 확률 */
  scoreProb: number
  sd: number
}

export type Confidence = '높음' | '중간' | '낮음'

export interface CoachAdvice {
  side: 'offense' | 'defense'
  /** 무엇을 기준으로 비교했는지 */
  metric: 'runs' | 'prob'
  metricLabel: string
  options: CoachOption[]
  recommendedId: string
  confidence: Confidence
  reasons: string[]
  limits: string[]
}

const SIMS = 500

type Probs = Record<PaEvent, number>

interface SimSetup {
  outs: number
  bases: [boolean, boolean, boolean]
  /** 이번 이닝에 나올 타자 순서대로의 확률표 */
  batters: Probs[]
  speeds: number[]
  baseSpeeds: [number, number, number]
  first: { kind: 'swing' | 'bunt' | 'steal' | 'ibb'; stealRate?: number }
  infieldIn: boolean
  errorRate: number
}

function draw(rng: Rng, probs: Probs): PaEvent {
  let r = rng()
  for (const k in probs) {
    r -= probs[k as PaEvent]
    if (r <= 0) return k as PaEvent
  }
  return 'out'
}

/** 남은 이닝 한 번을 빠르게 시뮬레이션해 득점을 돌려준다 */
function simInning(setup: SimSetup, rng: Rng): number {
  let outs = setup.outs
  const b = [...setup.bases]
  const sp = [...setup.baseSpeeds]
  let runs = 0
  let i = 0
  let firstAction = setup.first.kind

  const force = (speed: number) => {
    if (b[0]) {
      if (b[1]) {
        if (b[2]) runs++
        b[2] = true
        sp[2] = sp[1]
      }
      b[1] = true
      sp[1] = sp[0]
    }
    b[0] = true
    sp[0] = speed
  }

  while (outs < 3 && i < 30) {
    const idx = i % setup.batters.length
    const speed = setup.speeds[idx]
    if (firstAction === 'steal') {
      firstAction = 'swing'
      const lead = b[1] && !b[2] ? 1 : b[0] && !b[1] ? 0 : -1
      if (lead >= 0) {
        b[lead] = false
        if (rng() < (setup.first.stealRate ?? 0.7) * (lead === 1 ? 0.88 : 1)) {
          b[lead + 1] = true
          sp[lead + 1] = sp[lead]
        } else outs++
        if (outs >= 3) break
      }
    }
    if (firstAction === 'ibb') {
      firstAction = 'swing'
      force(speed)
      i++
      continue
    }
    if (firstAction === 'bunt') {
      firstAction = 'swing'
      const roll = rng()
      if (roll < 0.66) {
        outs++
        if (outs < 3) {
          if (b[2]) runs++
          b[2] = b[1]
          b[1] = b[0]
          b[0] = false
        }
      } else if (roll < 0.84) {
        outs++
        if (b[1]) b[1] = b[0]
        b[0] = true
      } else if (roll < 0.92) {
        force(speed)
      } else outs++
      i++
      continue
    }

    const ev = draw(rng, setup.batters[idx])
    switch (ev) {
      case 'so':
        outs++
        break
      case 'bb':
        force(speed)
        break
      case 'hr':
        runs += 1 + Number(b[0]) + Number(b[1]) + Number(b[2])
        b[0] = b[1] = b[2] = false
        break
      case 'triple':
        runs += Number(b[0]) + Number(b[1]) + Number(b[2])
        b[0] = b[1] = false
        b[2] = true
        break
      case 'double': {
        runs += Number(b[1]) + Number(b[2])
        const fromFirst = b[0]
        b[0] = false
        b[1] = true
        b[2] = false
        if (fromFirst) {
          if (rng() < 0.35 + sp[0] * 0.35) runs++
          else b[2] = true
        }
        sp[1] = speed
        break
      }
      case 'single': {
        if (b[2]) runs++
        let third = false
        if (b[1]) {
          if (rng() < 0.5 + sp[1] * 0.3) runs++
          else third = true
        }
        const second = b[0]
        b[2] = third
        b[1] = second
        b[0] = true
        sp[1] = sp[0]
        sp[0] = speed
        break
      }
      default: {
        if (rng() < setup.errorRate) {
          force(speed)
          break
        }
        const roll = rng()
        if (roll < 0.47) {
          if (b[0] && outs < 2 && rng() < 0.42 * (1 - speed * 0.4)) {
            outs += 2
            b[0] = false
            if (outs < 3) {
              if (b[2] && !setup.infieldIn) {
                runs++
                b[2] = false
              }
              if (b[1]) {
                b[2] = true
                b[1] = false
              }
            }
          } else {
            outs++
            if (outs < 3) {
              const hold = setup.infieldIn ? rng() < 0.85 : rng() < 0.45
              if (b[2] && !hold) {
                runs++
                b[2] = false
              }
              if (b[1] && !b[2]) {
                b[2] = true
                b[1] = false
              }
              if (b[0] && !b[1]) {
                b[1] = true
                b[0] = false
              }
            }
          }
        } else if (roll < 0.87) {
          outs++
          if (outs < 3 && b[2] && rng() < 0.62) {
            runs++
            b[2] = false
          }
        } else outs++
      }
    }
    i++
  }
  return runs
}

function runSims(setup: SimSetup, seed: number) {
  const rng = createRng(seed)
  let total = 0
  let sq = 0
  let scored = 0
  for (let n = 0; n < SIMS; n++) {
    const r = simInning(setup, rng)
    total += r
    sq += r * r
    if (r > 0) scored++
  }
  const mean = total / SIMS
  return { runs: mean, scoreProb: scored / SIMS, sd: Math.sqrt(Math.max(0, sq / SIMS - mean * mean)) }
}

// ───────── 상황 정리 ─────────

function upcoming(s: GameState): string[] {
  const team = offense(s)
  return Array.from({ length: 9 }, (_, k) => team.lineup[(team.battingIndex + k) % 9])
}

function probsFor(s: GameState, batter: Player, pitcher: Player, fatigue: number, infieldIn: boolean): Probs {
  const fx = WEATHER_EFFECTS[s.weather.kind]
  return matchupProbabilities(hitterProfile(batter, pitcher.throws).rates, pitcherProfile(pitcher, batter.bats).rates, {
    pitcherFatigue: fatigue,
    hrFactor: fx.hr,
    hitFactor: infieldIn ? 1.08 : 1,
  })
}

interface Variant {
  first?: SimSetup['first']
  pitcherId?: string
  pinchId?: string
  infieldIn?: boolean
}

function evaluate(s: GameState, players: PlayerIndex, v: Variant) {
  const ids = upcoming(s)
  if (v.pinchId) ids[0] = v.pinchId
  const pitcherId = v.pitcherId ?? defense(s).pitcherId
  const pitcher = players[pitcherId]
  const fatigue = v.pitcherId ? 1 : fatigueOf(s, players, pitcherId)
  const infieldIn = v.infieldIn ?? false
  const batters = ids.map((id) => probsFor(s, players[id], pitcher, fatigue, infieldIn))
  const speeds = ids.map((id) => hitterProfile(players[id], 'R').speed)
  const baseSpeeds = s.bases.map((r) => (r ? hitterProfile(players[r.id], 'R').speed : 0)) as [number, number, number]
  const setup: SimSetup = {
    outs: s.outs,
    bases: s.bases.map(Boolean) as [boolean, boolean, boolean],
    batters,
    speeds,
    baseSpeeds,
    first: v.first ?? { kind: 'swing' },
    infieldIn,
    errorRate: WEATHER_EFFECTS[s.weather.kind].error,
  }
  // 같은 상황이면 같은 결과가 나오도록 상황으로 시드를 만든다
  const seed = s.inning * 1000 + s.outs * 100 + s.log.length
  return runSims(setup, seed)
}

function stealCandidate(s: GameState) {
  const b = s.bases
  if (b[1] && !b[2]) return b[1]
  if (b[0] && !b[1]) return b[0]
  return null
}

/** 비교 기준: 경기 후반 접전이면 "1점"의 가치가 더 크다 */
function prefersProbMetric(s: GameState, side: 'offense' | 'defense') {
  const diff = scoreDiffFor(s, side === 'offense' ? offenseKey(s) : defenseKey(s))
  if (s.inning < 7) return false
  return side === 'offense' ? diff >= -1 && diff <= 0 : diff >= 0 && diff <= 1
}

/** 받침에 따라 "으로/로"를 붙인다 */
export function withRo(name: string) {
  const code = name.charCodeAt(name.length - 1) - 0xac00
  if (code < 0 || code > 11171) return name + "로"
  const jong = code % 28
  return name + (jong === 0 || jong === 8 ? "로" : "으로")
}

// ───────── 공격 ─────────

export function pinchCandidates(s: GameState, players: PlayerIndex) {
  const pitcher = players[defense(s).pitcherId]
  return offense(s)
    .bench.map((id) => players[id])
    .map((p) => {
      const prof = hitterProfile(p, pitcher.throws)
      const r = prof.rates
      return { player: p, score: r.single + r.double * 1.5 + r.triple * 2 + r.hr * 3 + r.bb * 0.8 }
    })
    .sort((a, b) => b.score - a.score)
}

export function relieverCandidates(s: GameState, players: PlayerIndex) {
  const batter = players[currentBatterId(s)]
  return defense(s)
    .bullpen.map((id) => players[id])
    .map((p) => {
      const r = pitcherProfile(p, batter.bats).rates
      return { player: p, score: r.so - r.bb - (r.single + r.double + r.hr * 3) }
    })
    .sort((a, b) => b.score - a.score)
}

export function offenseOptions(s: GameState, players: PlayerIndex, extraPinch?: string): CoachOption[] {
  const opts: CoachOption[] = []
  const batter = players[currentBatterId(s)]
  const push = (id: string, kind: OptionKind, label: string, v: Variant, playerId?: string) =>
    opts.push({ id, kind, label, playerId, ...evaluate(s, players, v) })

  push('swing', 'swing', '강공', {})
  if ((s.bases[0] || s.bases[1]) && !s.bases[2] && s.outs < 2) push('bunt', 'bunt', '희생번트', { first: { kind: 'bunt' } })
  const runner = stealCandidate(s)
  if (runner && s.outs < 3) {
    const prof = hitterProfile(players[runner.id], 'R')
    const rate = Math.min(0.92, prof.stealRate + WEATHER_EFFECTS[s.weather.kind].steal)
    push('steal', 'steal', '도루', { first: { kind: 'steal', stealRate: rate } })
  }
  const best = pinchCandidates(s, players)[0]
  const ids = new Set<string>()
  if (best && best.player.id !== batter.id) ids.add(best.player.id)
  if (extraPinch) ids.add(extraPinch)
  for (const id of ids) push(`pinch:${id}`, 'pinch', `대타 ${players[id].name}`, { pinchId: id }, id)
  return opts
}

/** 아직 힘이 남은 선발을 내릴 때 불펜이 대신 던질 이닝만큼의 비용 (점) */
export function bullpenBurden(s: GameState, players: PlayerIndex) {
  const current = players[defense(s).pitcherId]
  if (current.role !== 'SP') return 0
  const pitches = s.pitching[current.id]?.pitches ?? 0
  const inningsLeft = Math.max(0, (staminaOf(current) - pitches) / 16)
  const gameLeft = Math.max(0, 9 - s.inning)
  return Math.min(inningsLeft, gameLeft) * 0.14
}

export function defenseOptions(s: GameState, players: PlayerIndex, extraPitcher?: string): CoachOption[] {
  const opts: CoachOption[] = []
  const push = (id: string, kind: OptionKind, label: string, v: Variant, playerId?: string) =>
    opts.push({ id, kind, label, playerId, ...evaluate(s, players, v) })
  const current = players[defense(s).pitcherId]
  push('pitch', 'pitch', `${current.name} 정면 승부`, {})
  if (!s.bases[0] && (s.bases[1] || s.bases[2])) push('ibb', 'ibb', '고의사구', { first: { kind: 'ibb' } })
  if (s.bases[2] && s.outs < 2) push('infieldIn', 'infieldIn', '전진 수비', { infieldIn: true })
  const ids = new Set<string>()
  const best = relieverCandidates(s, players)[0]
  if (best) ids.add(best.player.id)
  if (extraPitcher) ids.add(extraPitcher)
  const burden = bullpenBurden(s, players)
  for (const id of ids) {
    push(`change:${id}`, 'change', `${withRo(players[id].name)} 교체`, { pitcherId: id }, id)
    // 이번 이닝만 보면 교체가 늘 유리해 보이므로, 선발이 남겨둔 이닝을 불펜이 떠안는 비용을 더한다
    const o = opts[opts.length - 1]
    o.runs += burden
    o.scoreProb = Math.min(1, o.scoreProb + burden * 0.5)
  }
  return opts
}

// ───────── 추천과 설명 ─────────

function better(a: CoachOption, b: CoachOption, side: 'offense' | 'defense', metric: 'runs' | 'prob') {
  const va = metric === 'runs' ? a.runs : a.scoreProb
  const vb = metric === 'runs' ? b.runs : b.scoreProb
  return side === 'offense' ? va - vb : vb - va
}

function confidenceOf(best: CoachOption, second: CoachOption | undefined, metric: 'runs' | 'prob', smallSample: boolean): Confidence {
  if (!second) return '높음'
  const gap = metric === 'runs' ? Math.abs(best.runs - second.runs) : Math.abs(best.scoreProb - second.scoreProb)
  const se = metric === 'runs' ? (best.sd + second.sd) / Math.sqrt(SIMS) : 0.5 / Math.sqrt(SIMS) * 2
  let level: Confidence = gap > Math.max(3 * se, metric === 'runs' ? 0.12 : 0.06) ? '높음' : gap > 1.5 * se ? '중간' : '낮음'
  if (smallSample && level === '높음') level = '중간'
  else if (smallSample && level === '중간') level = '낮음'
  return level
}

export function adviseFor(s: GameState, players: PlayerIndex, extra?: { pinch?: string; pitcher?: string }): CoachAdvice {
  const side = userIsBatting(s) ? 'offense' : 'defense'
  return side === 'offense' ? adviseOffense(s, players, extra?.pinch) : adviseDefense(s, players, extra?.pitcher)
}

/** 자동 진행용: 사용자 팀의 현재 장면에서 코치가 고를 작전 */
export function adviseOffense(s: GameState, players: PlayerIndex, extraPinch?: string): CoachAdvice {
  const options = offenseOptions(s, players, extraPinch)
  const metric = prefersProbMetric(s, 'offense') ? 'prob' : 'runs'
  const sorted = [...options].sort((a, b) => better(b, a, 'offense', metric))
  const best = sorted[0]
  const second = sorted[1]
  const batter = players[currentBatterId(s)]
  const pitcher = players[defense(s).pitcherId]
  const reasons: string[] = []
  const limits: string[] = []
  const bp = hitterProfile(batter, pitcher.throws)
  const handLabel = pitcher.throws === 'L' ? '좌투수' : '우투수'
  const split = batter.batting.reduce(
    (a, x) => {
      const sp = pitcher.throws === 'L' ? x.vsL : x.vsR
      return { pa: a.pa + sp.pa, h: a.h + sp.h, bb: a.bb + sp.bb }
    },
    { pa: 0, h: 0, bb: 0 },
  )

  if (best.kind === 'swing') {
    reasons.push(`${batter.name}의 ${handLabel} 상대 타율 ${fmtAvg(splitAvg(split))} (${split.pa}타석)`)
    if (s.bases.some(Boolean)) reasons.push('아웃을 내주는 작전보다 그대로 치는 쪽이 기대 득점이 높아요')
  }
  if (best.kind === 'bunt') {
    reasons.push(`${batter.name}의 통산 타율 ${fmtAvg(battingTotals(batter).avg)}로 낮은 편이에요`)
    reasons.push('경기 후반 접전이라 큰 점수보다 1점을 낼 확률이 중요해요')
  }
  if (best.kind === 'steal') {
    const r = stealCandidate(s)!
    const rp = hitterProfile(players[r.id], 'R')
    reasons.push(`${players[r.id].name}의 통산 도루 성공률 ${Math.round(rp.stealRate * 100)}% (${rp.stealAttempts}번 시도)`)
    limits.push('상대 포수의 송구 능력은 아직 반영하지 않아요')
    if (rp.stealAttempts < 15) limits.push(`도루 시도가 ${rp.stealAttempts}번뿐이라 성공률이 불확실해요`)
  }
  if (best.kind === 'pinch' && best.playerId) {
    const ph = players[best.playerId]
    const phSplit = ph.batting.reduce(
      (a, x) => {
        const sp = pitcher.throws === 'L' ? x.vsL : x.vsR
        return { pa: a.pa + sp.pa, h: a.h + sp.h, bb: a.bb + sp.bb }
      },
      { pa: 0, h: 0, bb: 0 },
    )
    reasons.push(`${ph.name}의 ${handLabel} 상대 타율 ${fmtAvg(splitAvg(phSplit))}, ${batter.name}은 ${fmtAvg(splitAvg(split))}`)
    if (phSplit.pa < 80) limits.push(`${ph.name}의 ${handLabel} 상대 표본이 ${phSplit.pa}타석으로 적어요`)
  }
  if (bp.splitPa < 80 && best.kind !== 'pinch') limits.push(`${batter.name}의 ${handLabel} 상대 표본이 ${bp.splitPa}타석으로 적어요`)
  if (s.weather.kind === 'rain' || s.weather.kind === 'heavyRain') reasons.push('비 때문에 수비 실책과 도루 실패가 늘어난 상태예요')
  limits.push('최근 컨디션과 부상은 반영하지 않아요')

  const smallSample = limits.some((l) => l.includes('표본') || l.includes('불확실'))
  return {
    side: 'offense',
    metric,
    metricLabel: metric === 'runs' ? '이번 이닝 예상 득점' : '이번 이닝 1점 이상 낼 확률',
    options,
    recommendedId: best.id,
    confidence: confidenceOf(best, second, metric, smallSample),
    reasons: reasons.slice(0, 3),
    limits: limits.slice(0, 2),
  }
}

export function adviseDefense(s: GameState, players: PlayerIndex, extraPitcher?: string): CoachAdvice {
  const options = defenseOptions(s, players, extraPitcher)
  const metric = prefersProbMetric(s, 'defense') ? 'prob' : 'runs'
  const sorted = [...options].sort((a, b) => better(b, a, 'defense', metric))
  const best = sorted[0]
  const second = sorted[1]
  const batter = players[currentBatterId(s)]
  const current = players[defense(s).pitcherId]
  const pitches = s.pitching[current.id]?.pitches ?? 0
  const reasons: string[] = []
  const limits: string[] = []
  const batterHand = batter.bats === 'L' ? '좌타자' : batter.bats === 'S' ? '양타자' : '우타자'

  if (best.kind === 'change' && best.playerId) {
    const np = players[best.playerId]
    if (pitches >= staminaOf(current) * 0.85) reasons.push(`${current.name} 투구 수 ${pitches}개로 힘이 떨어질 시점이에요`)
    const handLabel = np.throws === 'L' ? '좌투수' : '우투수'
    const split = batter.batting.reduce(
      (a, x) => {
        const sp = np.throws === 'L' ? x.vsL : x.vsR
        return { pa: a.pa + sp.pa, h: a.h + sp.h, bb: a.bb + sp.bb }
      },
      { pa: 0, h: 0, bb: 0 },
    )
    reasons.push(`${batter.name}의 ${handLabel} 상대 타율 ${fmtAvg(splitAvg(split))}`)
    if (split.pa < 80) limits.push(`${batter.name}의 ${handLabel} 상대 표본이 ${split.pa}타석으로 적어요`)
  }
  if (best.kind === 'pitch') {
    reasons.push(`${current.name} 투구 수 ${pitches}개, 아직 버틸 수 있어요`)
    const pp = pitcherProfile(current, batter.bats)
    reasons.push(`${batterHand} 상대 탈삼진 비율 ${Math.round(pp.rates.so * 100)}%`)
  }
  if (best.kind === 'ibb') {
    const team = offense(s)
    const next = players[team.lineup[(team.battingIndex + 1) % 9]]
    reasons.push(`다음 타자 ${next.name}의 통산 장타율이 ${fmtAvg(battingTotals(next).slg)}로 더 낮아요`)
    reasons.push('1루를 채우면 병살로 이닝을 끝낼 수 있어요')
  }
  if (best.kind === 'infieldIn') {
    reasons.push('3루 주자를 묶어 땅볼 때 실점을 막아요')
    limits.push('대신 내야를 빠져나가는 안타가 늘어날 수 있어요')
  }
  if (s.weather.kind === 'rain' || s.weather.kind === 'heavyRain') reasons.push('비 때문에 실책이 나오기 쉬운 상태예요')
  const burden = bullpenBurden(s, players)
  if (burden > 0.05) {
    const line = `교체 쪽 예상에는 불펜이 떠안을 남은 이닝 부담 ${burden.toFixed(2)}점이 포함돼요`
    if (best.kind === 'change') limits.unshift(line)
    else reasons.push(line)
  }
  limits.push('불펜 투수의 연투 피로는 반영하지 않아요')

  const smallSample = limits.some((l) => l.includes('표본'))
  return {
    side: 'defense',
    metric,
    metricLabel: metric === 'runs' ? '이번 이닝 예상 실점' : '이번 이닝 1점 이상 내줄 확률',
    options,
    recommendedId: best.id,
    confidence: confidenceOf(best, second, metric, smallSample),
    reasons: reasons.slice(0, 3),
    limits: limits.slice(0, 2),
  }
}

export function formatOptionValue(advice: Pick<CoachAdvice, 'metric'>, o: CoachOption) {
  return advice.metric === 'runs' ? `${o.runs.toFixed(2)}점` : `${Math.round(o.scoreProb * 100)}%`
}

// ───────── 판단 순간 ─────────

export type AskFrequency = 'key' | 'every'

/** 사용자에게 작전을 물어볼 만한 순간인지 */
export function isDecisionMoment(s: GameState, players: PlayerIndex, freq: AskFrequency): boolean {
  if (s.over) return false
  if (freq === 'every') return true
  if (userIsBatting(s)) {
    const runnersOn = s.bases.some(Boolean)
    const late = s.inning >= 7 && Math.abs(scoreDiffFor(s, offenseKey(s))) <= 3
    return (runnersOn && s.outs < 2) || (late && offense(s).bench.length > 0 && s.outs < 2)
  }
  const fatigue = fatigueOf(s, players, defense(s).pitcherId)
  const scoring = Boolean(s.bases[1] || s.bases[2])
  const late = s.inning >= 7 && Math.abs(scoreDiffFor(s, defenseKey(s))) <= 3
  const halfStart = s.outs === 0 && !s.bases.some(Boolean)
  return fatigue > 1.04 || scoring || (late && halfStart)
}
