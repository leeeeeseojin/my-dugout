import { describe, expect, test } from 'vitest'
import { findSimilarCases, similarity, type RealCase, type Situation } from './review'

const base: Situation = { inning: 8, scoreDiff: 1, outs: 1, bases: [true, true, false], side: 'defense', batterHand: 'L', pitcherHand: 'R' }

function caseOf(s: Partial<Situation>, action: RealCase['action'] = 'change', runs = 0): RealCase {
  return { id: Math.random().toString(), situation: { ...base, ...s }, action, runsAfter: runs, source: 'test' }
}

describe('유사 상황 검색', () => {
  test('같은 상황은 유사도 1', () => {
    expect(similarity(base, base)).toBeCloseTo(1)
  })

  test('공격과 수비는 비교하지 않는다', () => {
    expect(similarity(base, { ...base, side: 'offense' })).toBe(0)
  })

  test('사례가 충분하지 않으면 억지로 보여주지 않는다', () => {
    const lib = [caseOf({}), caseOf({}), caseOf({ inning: 2, scoreDiff: -4, outs: 0, bases: [false, false, false] })]
    expect(findSimilarCases(base, lib)).toBeNull()
  })

  test('비슷한 사례를 행동별로 묶는다', () => {
    const lib = [caseOf({}, 'change', 0), caseOf({}, 'change', 1), caseOf({ inning: 9 }, 'pitch', 2), caseOf({}, 'change', 0)]
    const match = findSimilarCases(base, lib)!
    expect(match.cases.length).toBe(4)
    expect(match.counts[0]).toMatchObject({ action: 'change', count: 3 })
    expect(match.counts[0].avgRuns).toBeCloseTo(1 / 3)
  })
})
