import { describe, expect, test } from 'vitest'
import { sampleRepository } from '../data/sampleRoster'
import { createGame, playPlateAppearance, type GameState, type PlayerIndex } from './game'
import { adviseDefense, adviseOffense } from './coach'
import { defaultLineup, toTeamSide } from './lineup'
import { createRng } from './rng'

function scene(mutate: (s: GameState) => void) {
  const rng = createRng(3)
  const hr = sampleRepository.getRoster('kia')
  const ar = sampleRepository.getRoster('nc')
  const players: PlayerIndex = Object.fromEntries([...hr, ...ar].map((p) => [p.id, p]))
  const s = createGame({ home: toTeamSide('kia', hr, defaultLineup(hr, rng)), away: toTeamSide('nc', ar, defaultLineup(ar, rng)), userSide: 'away', rng })
  mutate(s)
  return { s, players, rng }
}

describe('AI 코치', () => {
  test('주자가 없으면 번트나 도루를 선택지로 내지 않는다', () => {
    const { s, players } = scene(() => {})
    const advice = adviseOffense(s, players)
    expect(advice.options.map((o) => o.kind)).not.toContain('bunt')
    expect(advice.options.map((o) => o.kind)).not.toContain('steal')
  })

  test('추천과 함께 근거와 한계를 돌려준다', () => {
    const { s, players } = scene((g) => {
      g.bases = [{ id: g.away.lineup[8], pitcherId: g.home.pitcherId }, null, null]
    })
    const advice = adviseOffense(s, players)
    expect(advice.options.find((o) => o.id === advice.recommendedId)).toBeTruthy()
    expect(advice.reasons.length).toBeGreaterThan(0)
    expect(advice.limits.length).toBeGreaterThan(0)
  })

  test('주자가 많을수록 예상 득점이 높다', () => {
    const empty = scene(() => {})
    const loaded = scene((g) => {
      const r = (i: number) => ({ id: g.away.lineup[i], pitcherId: g.home.pitcherId })
      g.bases = [r(6), r(7), r(8)]
    })
    const a = adviseOffense(empty.s, empty.players).options.find((o) => o.kind === 'swing')!
    const b = adviseOffense(loaded.s, loaded.players).options.find((o) => o.kind === 'swing')!
    expect(b.runs).toBeGreaterThan(a.runs + 0.8)
  })

  test('지친 선발 투수 상황에서 교체 선택지를 비교한다', () => {
    const { s, players, rng } = scene(() => {})
    let g = playPlateAppearance(s, players, rng, { offense: 'swing', defense: 'pitch' })
    g = { ...g, half: 'top', pitching: { ...g.pitching, [g.home.pitcherId]: { ...g.pitching[g.home.pitcherId], pitches: 110 } } }
    g.userSide = 'home'
    const advice = adviseDefense(g, players)
    const keep = advice.options.find((o) => o.kind === 'pitch')!
    const change = advice.options.find((o) => o.kind === 'change')!
    expect(change.runs).toBeLessThan(keep.runs)
  })
})
