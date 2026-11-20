import { describe, expect, test } from 'vitest'
import { hitterProfile, pitcherProfile, battingTotals, pitchingTotals } from '../engine/stats'
import { DEFAULT_HITTER, DEFAULT_PITCHER, fromPlayer, toPlayer, type CustomPlayer, type HitterRatings, type PitcherRatings } from './ratings'
import { sampleRepository } from './sampleRoster'

function hitter(r: Partial<HitterRatings>, bats: 'L' | 'R' = 'R'): CustomPlayer {
  return { id: 'h', name: '타자', number: 1, bats, throws: 'R', position: 'LF', hitter: { ...DEFAULT_HITTER, ...r } }
}

function pitcher(r: Partial<PitcherRatings>, role: 'SP' | 'RP' = 'SP'): CustomPlayer {
  return { id: 'p', name: '투수', number: 11, bats: 'R', throws: 'R', position: 'P', role, pitcher: { ...DEFAULT_PITCHER, ...r } }
}

describe('능력치 → 예상 기록', () => {
  test('고른 타율 구간과 예상 기록의 타율이 거의 같다', () => {
    const p = toPlayer('lg', hitter({ avg: 3 }), 0)
    expect(battingTotals(p).avg).toBeCloseTo(0.31, 2)
    expect(battingTotals(p).hr).toBe(15)
  })

  test('고른 평균자책점 구간과 예상 기록의 평균자책점이 거의 같다', () => {
    const p = toPlayer('lg', pitcher({ era: 0 }), 0)
    expect(pitchingTotals(p).era).toBeCloseTo(2.5, 1)
  })

  test('타율 구간을 올리면 엔진의 안타 확률도 오른다', () => {
    const low = hitterProfile(toPlayer('lg', hitter({ avg: 0 }), 0), 'R').rates.single
    const high = hitterProfile(toPlayer('lg', hitter({ avg: 4 }), 0), 'R').rates.single
    expect(high).toBeGreaterThan(low * 1.3)
  })

  test('좌투수에 강하다고 고르면 좌투수 상대 홈런 확률이 더 높다', () => {
    const p = toPlayer('lg', hitter({ hr: 3, vsLefty: 1 }), 0)
    expect(hitterProfile(p, 'L').rates.hr).toBeGreaterThan(hitterProfile(p, 'R').rates.hr)
  })

  test('탈삼진 구간을 올리면 투수의 삼진 확률이 오른다', () => {
    const low = pitcherProfile(toPlayer('lg', pitcher({ strikeout: 0 }), 0), 'R').rates.so
    const high = pitcherProfile(toPlayer('lg', pitcher({ strikeout: 4 }), 0), 'R').rates.so
    expect(high).toBeGreaterThan(low * 1.6)
  })
})

describe('가상 선수에서 시작하기', () => {
  test('가상 선수를 능력치로 바꾸면 이름·포지션은 유지되고 구간이 채워진다', () => {
    const roster = sampleRepository.getRoster('ds')
    for (const p of roster) {
      const c = fromPlayer(p)
      expect(c.name).toBe(p.name)
      expect(c.position).toBe(p.position)
      if (p.position === 'P') expect(c.pitcher).toBeDefined()
      else expect(c.hitter).toBeDefined()
    }
  })
})
