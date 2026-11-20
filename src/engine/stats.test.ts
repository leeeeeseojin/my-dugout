import { describe, expect, test } from 'vitest'
import { generateRoster } from '../data/sampleRoster'
import type { Player } from '../data/types'
import { LEAGUE, hitterProfile, matchupProbabilities, pitcherProfile } from './stats'

function rookie(): Player {
  return {
    id: 'x',
    teamId: 't',
    name: '신인',
    number: 1,
    bats: 'R',
    throws: 'R',
    position: 'LF',
    positions: ['LF'],
    batting: [
      {
        year: 2026, pa: 10, ab: 10, h: 6, double: 0, triple: 0, hr: 3, bb: 0, so: 0, sb: 0, cs: 0,
        vsL: { pa: 3, h: 2, hr: 1, bb: 0, so: 0 },
        vsR: { pa: 7, h: 4, hr: 2, bb: 0, so: 0 },
      },
    ],
    pitching: [],
    look: { skin: '#fff', hair: '#000' },
  }
}

describe('표본 보정', () => {
  test('10타석 3홈런 신인도 리그 평균에 가깝게 당겨진다', () => {
    const p = hitterProfile(rookie(), 'R')
    expect(p.rates.hr).toBeLessThan(LEAGUE.hr * 2)
    expect(p.rates.hr).toBeGreaterThan(LEAGUE.hr)
  })
})

describe('매치업 확률', () => {
  test('확률 합은 1이다', () => {
    const roster = generateRoster('lg')
    const batter = roster.find((p) => p.position !== 'P')!
    const pitcher = roster.find((p) => p.position === 'P')!
    const probs = matchupProbabilities(hitterProfile(batter, pitcher.throws).rates, pitcherProfile(pitcher, batter.bats).rates)
    const sum = Object.values(probs).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 6)
  })

  test('리그 평균끼리 붙으면 리그 평균이 나온다', () => {
    const probs = matchupProbabilities(LEAGUE, LEAGUE)
    expect(probs.so).toBeCloseTo(LEAGUE.so, 3)
    expect(probs.hr).toBeCloseTo(LEAGUE.hr, 3)
  })

  test('지친 투수는 볼넷과 안타를 더 내준다', () => {
    const fresh = matchupProbabilities(LEAGUE, LEAGUE)
    const tired = matchupProbabilities(LEAGUE, LEAGUE, { pitcherFatigue: 1.2 })
    expect(tired.bb).toBeGreaterThan(fresh.bb)
    expect(tired.single).toBeGreaterThan(fresh.single)
    expect(tired.so).toBeLessThan(fresh.so)
  })
})
