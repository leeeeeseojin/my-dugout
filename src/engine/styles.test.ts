import { describe, expect, test } from 'vitest'
import { sampleRepository } from '../data/sampleRoster'
import { adviseDefense, adviseOffense } from './coach'
import { createGame, type GameState, type PlayerIndex } from './game'
import { defaultLineup, toTeamSide } from './lineup'
import { createRng } from './rng'
import { styleMatch, stylePicks } from './styles'

function scene(mutate: (s: GameState) => void) {
  const rng = createRng(7)
  const hr = sampleRepository.getRoster('ss')
  const ar = sampleRepository.getRoster('lt')
  const players: PlayerIndex = Object.fromEntries([...hr, ...ar].map((p) => [p.id, p]))
  const s = createGame({ home: toTeamSide('ss', hr, defaultLineup(hr, rng)), away: toTeamSide('lt', ar, defaultLineup(ar, rng)), userSide: 'away', rng })
  mutate(s)
  return { s, players }
}

describe('AI 감독 스타일', () => {
  test('무사 1루면 작전 야구형은 번트를 고른다', () => {
    const { s, players } = scene((g) => {
      g.bases = [{ id: g.away.lineup[0], pitcherId: g.home.pitcherId }, null, null]
    })
    const picks = stylePicks(adviseOffense(s, players), s, players)
    expect(picks.find((p) => p.id === 'smallball')!.optionId).toBe('bunt')
  })

  test('데이터형은 예상 득점이 가장 높은 작전을 고른다', () => {
    const { s, players } = scene((g) => {
      g.bases = [{ id: g.away.lineup[0], pitcherId: g.home.pitcherId }, null, null]
    })
    const advice = adviseOffense(s, players)
    const best = [...advice.options].sort((a, b) => b.runs - a.runs)[0]
    expect(stylePicks(advice, s, players).find((p) => p.id === 'data')!.optionId).toBe(best.id)
  })

  test('득점권 위기면 불펜 총력형은 투수를 바꾼다', () => {
    const { s, players } = scene((g) => {
      g.userSide = 'home'
      g.bases = [null, { id: g.away.lineup[0], pitcherId: g.home.pitcherId }, null]
    })
    const pick = stylePicks(adviseDefense(s, players), s, players).find((p) => p.id === 'bullpen')!
    expect(pick.optionId).toMatch(/^change:/)
  })

  test('직접 고른 판단과 가장 많이 겹친 스타일을 찾는다', () => {
    const rec = (user: string, delegated = false) => ({
      userPickId: user,
      delegated,
      styles: [
        { id: 'smallball' as const, optionId: 'bunt', reason: '' },
        { id: 'data' as const, optionId: 'swing', reason: '' },
        { id: 'bullpen' as const, optionId: 'swing', reason: '' },
      ],
    })
    const m = styleMatch([rec('bunt'), rec('bunt'), rec('swing'), rec('swing', true), rec('swing', true)])
    expect(m.total).toBe(3)
    expect(m.closest?.id).toBe('smallball')
  })
})
