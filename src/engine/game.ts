// 경기 상태와 진행 규칙
// UI는 이 모듈의 순수 함수만 호출한다. 상태는 매번 복사본으로 돌려준다.

import type { Player, Position } from '../data/types'
import type { Rng } from './rng'
import { hitterProfile, matchupProbabilities, pitcherProfile, type PaEvent } from './stats'
import { pickWeighted } from './rng'
import { WEATHER_EFFECTS, rollWeather, type Weather } from './weather'

export type Half = 'top' | 'bottom'
export type SideKey = 'home' | 'away'

export const MAX_INNINGS = 11

export interface Runner {
  id: string
  /** 이 주자를 내보낸 투수 (실점 책임) */
  pitcherId: string
}

export type Bases = [Runner | null, Runner | null, Runner | null]

export interface BatterLine {
  pa: number
  ab: number
  h: number
  hr: number
  rbi: number
  r: number
  bb: number
  so: number
  sb: number
}

export interface PitcherLine {
  bf: number
  outs: number
  h: number
  r: number
  er: number
  bb: number
  so: number
  hr: number
  pitches: number
}

export interface TeamSide {
  teamId: string
  /** 타순 9명 (교체되면 그 자리에 들어간 선수) */
  lineup: string[]
  fielding: Record<string, Position>
  bench: string[]
  pitcherId: string
  bullpen: string[]
  usedPitchers: string[]
  battingIndex: number
}

export type OffenseAction = 'swing' | 'bunt' | 'steal'
export type DefenseAction = 'pitch' | 'ibb' | 'infieldIn'

export interface PlayResult {
  kind: PaEvent | 'bunt' | 'bunt-fail' | 'bunt-hit' | 'ibb' | 'steal' | 'caught' | 'dp' | 'sacfly' | 'error' | 'fc'
  batterId: string
  pitcherId: string
  runs: number
  /** 공이 날아간 방향 (0=좌측, 1=우측). 필드 연출용 */
  direction: number
  text: string
}

export interface LogEntry {
  id: number
  inning: number
  half: Half
  text: string
  tone: 'play' | 'score' | 'change' | 'weather' | 'info'
}

export interface GameState {
  userSide: SideKey
  home: TeamSide
  away: TeamSide
  inning: number
  half: Half
  outs: number
  bases: Bases
  score: Record<SideKey, number>
  linescore: Record<SideKey, number[]>
  hits: Record<SideKey, number>
  errors: Record<SideKey, number>
  weather: Weather
  /** 강우 지연 횟수 */
  rainDelays: number
  batting: Record<string, BatterLine>
  pitching: Record<string, PitcherLine>
  log: LogEntry[]
  lastPlay: PlayResult | null
  over: boolean
  endReason: 'normal' | 'walkoff' | 'rain' | 'tie' | null
}

export type PlayerIndex = Record<string, Player>

// ───────── 조회 도우미 ─────────

export const offenseKey = (s: GameState): SideKey => (s.half === 'top' ? 'away' : 'home')
export const defenseKey = (s: GameState): SideKey => (s.half === 'top' ? 'home' : 'away')
export const offense = (s: GameState) => s[offenseKey(s)]
export const defense = (s: GameState) => s[defenseKey(s)]
export const currentBatterId = (s: GameState) => offense(s).lineup[offense(s).battingIndex]
export const currentPitcherId = (s: GameState) => defense(s).pitcherId
export const userIsBatting = (s: GameState) => offenseKey(s) === s.userSide
export const halfLabel = (s: Pick<GameState, 'inning' | 'half'>) => `${s.inning}회 ${s.half === 'top' ? '초' : '말'}`

export function baseState(bases: Bases): string {
  const on = bases.map((b, i) => (b ? `${i + 1}` : '')).filter(Boolean)
  return on.length ? `${on.join('·')}루` : '주자 없음'
}

/** 투수 체력: 선발 95구, 불펜 25구 기준 */
export function staminaOf(p: Player) {
  return p.role === 'SP' ? 95 : 25
}

export function fatigueOf(s: GameState, players: PlayerIndex, pitcherId: string) {
  const p = players[pitcherId]
  const pitches = s.pitching[pitcherId]?.pitches ?? 0
  const stamina = staminaOf(p)
  const over = pitches - stamina * 0.8
  let f = 1 + Math.max(0, over) / (pitches > stamina ? 90 : 260)
  if (s.weather.kind === 'heavyRain') f += 0.04
  return Math.min(f, 1.4)
}

// ───────── 경기 만들기 ─────────

export function emptyBatterLine(): BatterLine {
  return { pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, r: 0, bb: 0, so: 0, sb: 0 }
}

export function emptyPitcherLine(): PitcherLine {
  return { bf: 0, outs: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, hr: 0, pitches: 0 }
}

export function createGame(params: { home: TeamSide; away: TeamSide; userSide: SideKey; rng: Rng }): GameState {
  const { home, away, userSide, rng } = params
  const weather = rollWeather(rng)
  const s: GameState = {
    userSide,
    home,
    away,
    inning: 1,
    half: 'top',
    outs: 0,
    bases: [null, null, null],
    score: { home: 0, away: 0 },
    linescore: { home: [], away: [] },
    hits: { home: 0, away: 0 },
    errors: { home: 0, away: 0 },
    weather,
    rainDelays: 0,
    batting: {},
    pitching: {},
    log: [],
    lastPlay: null,
    over: false,
    endReason: null,
  }
  s.linescore.away.push(0)
  for (const side of [home, away]) {
    s.pitching[side.pitcherId] = emptyPitcherLine()
    for (const id of side.lineup) s.batting[id] = emptyBatterLine()
  }
  addLog(s, '플레이볼! 경기가 시작됐어요.', 'info')
  if (weather.kind === 'windOut') addLog(s, '외야 쪽으로 바람이 강하게 불어요. 장타가 잘 나올 수 있어요.', 'weather')
  if (weather.kind === 'windIn') addLog(s, '홈 쪽으로 맞바람이 불어요. 큰 타구가 잘 안 뻗어요.', 'weather')
  return s
}

let logSeq = 0
function addLog(s: GameState, text: string, tone: LogEntry['tone']) {
  s.log.push({ id: ++logSeq, inning: s.inning, half: s.half, text, tone })
}

function clone(s: GameState): GameState {
  // 로그 항목은 바뀌지 않으므로 배열만 새로 만든다
  const { log, ...rest } = s
  const copy = structuredClone(rest) as GameState
  copy.log = log.slice()
  return copy
}

// ───────── 교체 ─────────

export function changePitcher(state: GameState, players: PlayerIndex, side: SideKey, newId: string): GameState {
  const s = clone(state)
  const team = s[side]
  const old = players[team.pitcherId]
  team.usedPitchers.push(team.pitcherId)
  team.bullpen = team.bullpen.filter((id) => id !== newId)
  team.pitcherId = newId
  s.pitching[newId] ??= emptyPitcherLine()
  addLog(s, `투수 교체: ${old.name} → ${players[newId].name}`, 'change')
  return s
}

export function pinchHit(state: GameState, players: PlayerIndex, side: SideKey, benchId: string): GameState {
  const s = clone(state)
  const team = s[side]
  const slot = team.battingIndex
  const outId = team.lineup[slot]
  const pos = team.fielding[outId]
  team.lineup[slot] = benchId
  team.bench = team.bench.filter((id) => id !== benchId)
  delete team.fielding[outId]
  team.fielding[benchId] = pos
  s.batting[benchId] ??= emptyBatterLine()
  addLog(s, `대타: ${players[outId].name} → ${players[benchId].name}`, 'change')
  return s
}

// ───────── 타석 진행 ─────────

interface Ctx {
  s: GameState
  players: PlayerIndex
  rng: Rng
  batterId: string
  pitcherId: string
  runs: number
  rbi: number
  unearned: boolean
}

function scoreRunner(ctx: Ctx, runner: Runner, rbi = true) {
  const { s } = ctx
  ctx.runs++
  if (rbi) ctx.rbi++
  s.batting[runner.id] ??= emptyBatterLine()
  s.batting[runner.id].r++
  const pl = (s.pitching[runner.pitcherId] ??= emptyPitcherLine())
  pl.r++
  if (!ctx.unearned) pl.er++
}

/** 밀어내기 진루 (볼넷, 고의사구, 몸에 맞는 공) */
function forceAdvance(ctx: Ctx, batter: Runner) {
  const b = ctx.s.bases
  if (b[0]) {
    if (b[1]) {
      if (b[2]) scoreRunner(ctx, b[2])
      b[2] = b[1]
    }
    b[1] = b[0]
  }
  b[0] = batter
}

/** 모든 주자를 n루씩 진루 */
function advanceAll(ctx: Ctx, n: number, rbi = true) {
  const b = ctx.s.bases
  const next: Bases = [null, null, null]
  for (let i = 2; i >= 0; i--) {
    const r = b[i]
    if (!r) continue
    const to = i + n
    if (to >= 3) scoreRunner(ctx, r, rbi)
    else next[to] = r
  }
  ctx.s.bases = next
}

function speedOf(ctx: Ctx, id: string) {
  return hitterProfile(ctx.players[id], 'R').speed
}

function recordOut(ctx: Ctx, n = 1) {
  ctx.s.outs += n
  ctx.s.pitching[ctx.pitcherId].outs += n
}

function pitchCountFor(rng: Rng, kind: string) {
  const base = kind === 'so' ? 4.8 : kind === 'bb' ? 5.6 : kind === 'ibb' ? 0 : kind.startsWith('bunt') ? 2 : 3.4
  return Math.max(kind === 'ibb' ? 0 : 1, Math.round(base + (rng() - 0.5) * 3))
}

function name(ctx: Ctx, id: string) {
  return ctx.players[id].name
}

export interface PlayOptions {
  offense: OffenseAction
  defense: DefenseAction
}

/**
 * 한 타석을 진행한다.
 * 도루는 타석 전에 먼저 처리하고, 이닝이 끝나지 않았으면 같은 타자가 이어서 친다.
 */
export function playPlateAppearance(state: GameState, players: PlayerIndex, rng: Rng, opts: PlayOptions): GameState {
  if (state.over) return state
  const s = clone(state)
  const offKey = offenseKey(s)
  const off = s[offKey]
  const batterId = off.lineup[off.battingIndex]
  const pitcherId = defense(s).pitcherId
  const ctx: Ctx = { s, players, rng, batterId, pitcherId, runs: 0, rbi: 0, unearned: false }
  const fx = WEATHER_EFFECTS[s.weather.kind]
  const texts: string[] = []
  s.batting[batterId] ??= emptyBatterLine()
  s.pitching[pitcherId] ??= emptyPitcherLine()

  // 1) 도루
  if (opts.offense === 'steal') {
    const leadIdx: number = s.bases[1] && !s.bases[2] ? 1 : s.bases[0] && !s.bases[1] ? 0 : -1
    if (leadIdx >= 0) {
      const lead = leadIdx as 0 | 1
      const runner = s.bases[lead]!
      const prof = hitterProfile(players[runner.id], 'R')
      const p = Math.min(0.92, prof.stealRate * (lead === 1 ? 0.88 : 1) + fx.steal)
      s.bases[lead] = null
      if (rng() < p) {
        s.bases[lead + 1] = runner
        s.batting[runner.id] ??= emptyBatterLine()
        s.batting[runner.id].sb++
        texts.push(`${name(ctx, runner.id)} ${lead + 2}루 도루 성공!`)
        s.lastPlay = { kind: 'steal', batterId, pitcherId, runs: 0, direction: 0.5, text: texts[0] }
      } else {
        recordOut(ctx)
        texts.push(`${name(ctx, runner.id)} 도루 실패, 아웃.`)
        s.lastPlay = { kind: 'caught', batterId, pitcherId, runs: 0, direction: 0.5, text: texts[0] }
      }
      if (s.outs >= 3) {
        addLog(s, texts.join(' '), 'play')
        return endHalf(s, rng)
      }
    }
  }

  const batterRunner: Runner = { id: batterId, pitcherId }
  const line = s.batting[batterId]
  const pl = s.pitching[pitcherId]
  line.pa++
  pl.bf++
  let kind: PlayResult['kind']
  const direction = rng()

  if (opts.defense === 'ibb') {
    kind = 'ibb'
  } else if (opts.offense === 'bunt' && (s.bases[0] || s.bases[1]) && s.outs < 2) {
    const roll = rng() - fx.bunt
    kind = roll < 0.66 ? 'bunt' : roll < 0.84 ? 'bunt-fail' : roll < 0.92 ? 'bunt-hit' : 'out'
  } else {
    const probs = matchupProbabilities(
      hitterProfile(players[batterId], players[pitcherId].throws).rates,
      pitcherProfile(players[pitcherId], players[batterId].bats).rates,
      { pitcherFatigue: fatigueOf(s, players, pitcherId), hrFactor: fx.hr, hitFactor: opts.defense === 'infieldIn' ? 1.08 : 1 },
    )
    kind = pickWeighted(rng, probs)
  }

  const b = s.bases
  switch (kind) {
    case 'ibb':
      line.bb++
      pl.bb++
      forceAdvance(ctx, batterRunner)
      texts.push(`${name(ctx, batterId)} 고의사구로 1루에 나가요.`)
      break
    case 'bb':
      line.bb++
      pl.bb++
      forceAdvance(ctx, batterRunner)
      texts.push(`${name(ctx, batterId)} 볼넷.`)
      break
    case 'so':
      line.ab++
      line.so++
      pl.so++
      recordOut(ctx)
      texts.push(`${name(ctx, batterId)} 삼진 아웃.`)
      break
    case 'hr': {
      line.ab++
      line.h++
      line.hr++
      pl.h++
      pl.hr++
      advanceAll(ctx, 4)
      scoreRunner(ctx, batterRunner)
      const label = ctx.runs === 4 ? '만루 홈런!' : ctx.runs > 1 ? `${ctx.runs}점 홈런!` : '솔로 홈런!'
      texts.push(`${name(ctx, batterId)} ${label}`)
      break
    }
    case 'triple':
      line.ab++
      line.h++
      pl.h++
      advanceAll(ctx, 3)
      s.bases[2] = batterRunner
      texts.push(`${name(ctx, batterId)} 3루타!`)
      break
    case 'double': {
      line.ab++
      line.h++
      pl.h++
      const first = b[0]
      if (b[2]) scoreRunner(ctx, b[2])
      if (b[1]) scoreRunner(ctx, b[1])
      s.bases = [null, batterRunner, null]
      if (first) {
        if (rng() < 0.35 + speedOf(ctx, first.id) * 0.35) scoreRunner(ctx, first)
        else s.bases[2] = first
      }
      texts.push(`${name(ctx, batterId)} 2루타!`)
      break
    }
    case 'single':
    case 'bunt-hit': {
      line.ab++
      line.h++
      pl.h++
      const [first, second, third] = b
      const next: Bases = [batterRunner, null, null]
      if (third) scoreRunner(ctx, third)
      if (second) {
        if (rng() < 0.5 + speedOf(ctx, second.id) * 0.3) scoreRunner(ctx, second)
        else next[2] = second
      }
      if (first) {
        if (!next[2] && rng() < 0.22 + speedOf(ctx, first.id) * 0.2) next[2] = first
        else next[1] = first
      }
      s.bases = next
      texts.push(kind === 'bunt-hit' ? `${name(ctx, batterId)} 기습 번트 안타!` : `${name(ctx, batterId)} 안타!`)
      break
    }
    case 'bunt': {
      // 희생번트는 타수에 넣지 않는다
      recordOut(ctx)
      if (s.outs < 3) advanceAll(ctx, 1)
      texts.push(`${name(ctx, batterId)} 희생번트 성공. 주자가 한 베이스씩 나가요.`)
      break
    }
    case 'bunt-fail': {
      line.ab++
      // 선행 주자 아웃, 타자 주자는 1루
      const leadIdx = b[1] ? 1 : 0
      b[leadIdx] = null
      if (leadIdx === 1 && b[0]) {
        b[1] = b[0]
      }
      b[0] = batterRunner
      recordOut(ctx)
      texts.push(`번트 실패. 선행 주자가 잡혔어요.`)
      break
    }
    case 'out':
    default:
      kind = resolveBallInPlay(ctx, opts, batterRunner, texts, fx.error)
  }

  if (kind === 'single' || kind === 'double' || kind === 'triple' || kind === 'hr' || kind === 'bunt-hit') s.hits[offKey]++

  line.rbi += kind === 'error' || kind === 'dp' ? 0 : ctx.rbi
  pl.pitches += pitchCountFor(rng, kind)
  s.score[offKey] += ctx.runs
  const inningIdx = s.inning - 1
  s.linescore[offKey][inningIdx] = (s.linescore[offKey][inningIdx] ?? 0) + ctx.runs
  if (ctx.runs > 0 && !texts[texts.length - 1].includes('홈런')) texts.push(`${ctx.runs}점 득점!`)

  s.lastPlay = { kind, batterId, pitcherId, runs: ctx.runs, direction, text: texts.join(' ') }
  addLog(s, texts.join(' '), ctx.runs > 0 ? 'score' : 'play')

  off.battingIndex = (off.battingIndex + 1) % 9

  // 끝내기
  if (s.half === 'bottom' && s.inning >= 9 && s.score.home > s.score.away) {
    s.over = true
    s.endReason = 'walkoff'
    addLog(s, '끝내기! 경기 종료.', 'score')
    return s
  }
  if (s.outs >= 3) return endHalf(s, rng)
  return s
}

function resolveBallInPlay(ctx: Ctx, opts: PlayOptions, batterRunner: Runner, texts: string[], errorRate: number): PlayResult['kind'] {
  const { s, rng, batterId } = ctx
  const b = s.bases
  const line = s.batting[batterId]
  line.ab++
  const defKey = defenseKey(s)

  if (rng() < errorRate) {
    s.errors[defKey]++
    ctx.unearned = true
    advanceAll(ctx, 1, false)
    s.bases[0] = batterRunner
    texts.push(`수비 실책! ${name(ctx, batterId)} 1루에 살아나가요.`)
    return 'error'
  }

  const roll = rng()
  if (roll < 0.47) {
    // 땅볼
    if (b[0] && s.outs < 2 && rng() < 0.42 * (1 - speedOf(ctx, batterId) * 0.4)) {
      b[0] = null
      recordOut(ctx, 2)
      if (s.outs < 3) {
        if (b[2] && opts.defense !== 'infieldIn') {
          scoreRunner(ctx, b[2], false)
          b[2] = null
        }
        if (b[1]) {
          b[2] = b[1]
          b[1] = null
        }
      }
      texts.push(`${name(ctx, batterId)} 병살타.`)
      return 'dp'
    }
    recordOut(ctx)
    if (s.outs < 3) {
      const third = b[2]
      const holdThird = opts.defense === 'infieldIn' ? rng() < 0.85 : rng() < 0.45
      const next: Bases = [null, null, null]
      if (third) {
        if (holdThird) next[2] = third
        else scoreRunner(ctx, third)
      }
      if (b[1]) {
        if (!next[2]) next[2] = b[1]
        else next[1] = b[1]
      }
      if (b[0]) {
        if (!next[1]) next[1] = b[0]
        else next[0] = b[0]
      }
      s.bases = next
    }
    texts.push(`${name(ctx, batterId)} 땅볼 아웃.`)
    return 'out'
  }
  if (roll < 0.87) {
    // 뜬공
    recordOut(ctx)
    if (s.outs < 3 && b[2] && rng() < 0.62) {
      const r = b[2]
      b[2] = null
      scoreRunner(ctx, r)
      if (b[1] && rng() < 0.3) {
        b[2] = b[1]
        b[1] = null
      }
      texts.push(`${name(ctx, batterId)} 희생플라이!`)
      return 'sacfly'
    }
    if (s.outs < 3 && b[1] && !b[2] && rng() < 0.3) {
      b[2] = b[1]
      b[1] = null
    }
    texts.push(`${name(ctx, batterId)} 뜬공 아웃.`)
    return 'out'
  }
  recordOut(ctx)
  texts.push(`${name(ctx, batterId)} 직선타 아웃.`)
  return 'out'
}

function endHalf(state: GameState, rng: Rng): GameState {
  const s = state
  const offKey = offenseKey(s)
  const left = s.bases.filter(Boolean).length
  s.outs = 0
  s.bases = [null, null, null]
  s.linescore[offKey][s.inning - 1] ??= 0
  if (left > 0) addLog(s, `잔루 ${left}명.`, 'info')

  if (s.half === 'top') {
    // 9회 초 이후 홈팀이 앞서면 말 공격 없이 종료
    if (s.inning >= 9 && s.score.home > s.score.away) {
      s.over = true
      s.endReason = 'normal'
      addLog(s, '경기 종료!', 'info')
      return s
    }
    s.half = 'bottom'
  } else {
    if (s.inning >= 9 && s.score.home !== s.score.away) {
      s.over = true
      s.endReason = 'normal'
      addLog(s, '경기 종료!', 'info')
      return s
    }
    if (s.inning >= MAX_INNINGS) {
      s.over = true
      s.endReason = 'tie'
      addLog(s, `${MAX_INNINGS}회까지 승부가 나지 않아 무승부예요.`, 'info')
      return s
    }
    s.inning++
    s.half = 'top'
  }
  s.linescore[offenseKey(s)][s.inning - 1] ??= 0
  addLog(s, `${halfLabel(s)} 공격 시작.`, 'info')
  return applyWeatherChange(s, rng)
}

/** 반 이닝이 시작될 때 날씨가 바뀔 수 있다 */
function applyWeatherChange(s: GameState, rng: Rng): GameState {
  const before = s.weather.kind
  const roll = rng()
  let next = before
  if (before === 'clear' || before === 'windOut' || before === 'windIn') {
    if (roll < 0.025) next = 'rain'
  } else if (before === 'rain') {
    if (roll < 0.28) next = 'heavyRain'
    else if (roll < 0.5) next = 'clear'
  } else if (before === 'heavyRain') {
    if (roll < 0.35) next = 'rain'
  }
  if (next !== before) {
    s.weather = { kind: next, since: s.inning }
    if (next === 'rain') addLog(s, before === 'heavyRain' ? '빗줄기가 조금 약해졌어요.' : '갑자기 비가 내리기 시작해요! 그라운드가 미끄러워 실책이 늘 수 있어요.', 'weather')
    if (next === 'heavyRain') addLog(s, '폭우가 쏟아져요! 공이 손에서 미끄러지고 타구가 덜 뻗어요.', 'weather')
    if (next === 'clear') addLog(s, '비가 그쳤어요.', 'weather')
  }

  if (s.weather.kind === 'heavyRain') {
    const regulation = s.inning > 5 || (s.inning === 5 && s.half === 'bottom' && s.score.home > s.score.away)
    if (regulation && s.rainDelays >= 1) {
      s.over = true
      s.endReason = 'rain'
      addLog(s, '폭우로 경기가 중단됐어요. 5회를 넘겨 강우 콜드게임으로 끝나요.', 'weather')
      return s
    }
    s.rainDelays++
    addLog(s, '폭우로 잠시 경기가 중단됐다가 다시 시작해요.', 'weather')
  }
  return s
}

export function winner(s: GameState): SideKey | null {
  if (!s.over || s.score.home === s.score.away) return null
  return s.score.home > s.score.away ? 'home' : 'away'
}

export function isUsedUp(s: GameState, side: SideKey, id: string) {
  return s[side].usedPitchers.includes(id)
}
