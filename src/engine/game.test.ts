import { describe, expect, test } from 'vitest'
import { sampleRepository } from '../data/sampleRoster'
import type { Player } from '../data/types'
import { createGame, playPlateAppearance, type GameState, type PlayerIndex } from './game'
import { defaultLineup, toTeamSide } from './lineup'
import { autoStep } from './manager'
import { createRng } from './rng'

function setup(seed: number) {
  const rng = createRng(seed)
  const homeRoster = sampleRepository.getRoster('lg')
  const awayRoster = sampleRepository.getRoster('ds')
  const players: PlayerIndex = Object.fromEntries([...homeRoster, ...awayRoster].map((p: Player) => [p.id, p]))
  const home = toTeamSide('lg', homeRoster, defaultLineup(homeRoster, rng))
  const away = toTeamSide('ds', awayRoster, defaultLineup(awayRoster, rng))
  return { rng, players, state: createGame({ home, away, userSide: 'home', rng }) }
}

function playOut(seed: number) {
  const { rng, players } = setup(seed)
  let { state } = setup(seed)
  let guard = 0
  while (!state.over && guard++ < 400) {
    state = autoStep(state, players, rng)
    assertValid(state)
  }
  return state
}

function assertValid(s: GameState) {
  expect(s.outs).toBeLessThan(3)
  const ids = s.bases.filter(Boolean).map((r) => r!.id)
  expect(new Set(ids).size).toBe(ids.length)
  const lineSum = (k: 'home' | 'away') => s.linescore[k].reduce((a, b) => a + b, 0)
  expect(lineSum('home')).toBe(s.score.home)
  expect(lineSum('away')).toBe(s.score.away)
}

describe('경기 진행', () => {
  test('경기는 항상 끝난다', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = playOut(seed)
      expect(s.over).toBe(true)
      expect(s.inning).toBeGreaterThanOrEqual(5)
    }
  })

  test('평균 득점이 현실적인 범위에 있다', { timeout: 30000 }, () => {
    let runs = 0
    const games = 200
    for (let seed = 1; seed <= games; seed++) {
      const s = playOut(seed * 13)
      runs += s.score.home + s.score.away
    }
    const perTeam = runs / games / 2
    expect(perTeam).toBeGreaterThan(3)
    console.log('팀당 평균 득점', perTeam.toFixed(2))
    expect(perTeam).toBeLessThan(6.5)
  })

  test('9회 말 홈팀이 앞서면 그 즉시 끝난다', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = playOut(seed)
      if (s.endReason === 'walkoff') {
        expect(s.half).toBe('bottom')
        expect(s.score.home).toBeGreaterThan(s.score.away)
      }
    }
  })
})

describe('작전', () => {
  test('고의사구는 타자를 1루에 내보낸다', () => {
    const { rng, players, state } = setup(5)
    const batter = state.away.lineup[0]
    const next = playPlateAppearance(state, players, rng, { offense: 'swing', defense: 'ibb' })
    expect(next.bases[0]?.id).toBe(batter)
    expect(next.batting[batter].bb).toBe(1)
  })

  test('1루 주자가 없으면 도루 작전은 무시하고 타격한다', () => {
    const { rng, players, state } = setup(9)
    const next = playPlateAppearance(state, players, rng, { offense: 'steal', defense: 'pitch' })
    expect(next.batting[state.away.lineup[0]].pa).toBe(1)
  })
})
