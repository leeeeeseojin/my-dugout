import { describe, expect, test } from 'vitest'
import { fromPlayer } from '../data/ratings'
import { sampleRepository } from '../data/sampleRoster'
import { checkRoster, createRepository, exportRosters, parseRosterFile, type CustomRoster } from './rosters'

function sampleCustom(teamId: string): CustomRoster {
  return { teamId, updatedAt: '', players: sampleRepository.getRoster(teamId).map(fromPlayer) }
}

describe('로스터 검사', () => {
  test('가상 선수로 시작한 로스터는 바로 경기에 쓸 수 있다', () => {
    expect(checkRoster(sampleCustom('lg').players).ok).toBe(true)
  })

  test('타자 9명, 포수, 선발이 없으면 이유를 알려준다', () => {
    const check = checkRoster([{ id: '1', name: '혼자', number: 1, bats: 'R', throws: 'R', position: 'LF' }])
    expect(check.ok).toBe(false)
    expect(check.problems).toHaveLength(3)
  })
})

describe('엔진 연결', () => {
  test('직접 만든 로스터가 있는 구단만 그 선수를 쓰고, 나머지는 가상 선수를 쓴다', () => {
    const repo = createRepository({ lg: sampleCustom('lg') })
    expect(repo.getRoster('lg').every((p) => p.custom)).toBe(true)
    expect(repo.getRoster('ds').some((p) => p.custom)).toBe(false)
  })

  test('경기에 못 쓰는 로스터는 가상 선수로 대신한다', () => {
    const repo = createRepository({ lg: { teamId: 'lg', updatedAt: '', players: [] } })
    expect(repo.getRoster('lg').length).toBeGreaterThan(0)
    expect(repo.getRoster('lg').some((p) => p.custom)).toBe(false)
  })
})

describe('파일', () => {
  test('내보낸 파일을 다시 불러오면 같은 선수가 나온다', () => {
    const r = sampleCustom('kia')
    const back = parseRosterFile(exportRosters([r]), ['kia'])
    expect(back[0].players.map((p) => p.name)).toEqual(r.players.map((p) => p.name))
    expect(back[0].players[0].hitter ?? back[0].players[0].pitcher).toEqual(r.players[0].hitter ?? r.players[0].pitcher)
  })

  test('범위를 벗어난 값은 잘라내고, 다른 형식의 파일은 거절한다', () => {
    const text = JSON.stringify({ app: 'my-dugout-roster', rosters: [{ teamId: 'lg', players: [{ name: 'x', position: 'C', hitter: { avg: 99, vsLefty: -5 } }] }] })
    const r = parseRosterFile(text, ['lg'])
    expect(r[0].players[0].hitter?.avg).toBe(4)
    expect(r[0].players[0].hitter?.vsLefty).toBe(-1)
    expect(() => parseRosterFile('{"hello":1}', ['lg'])).toThrow()
    expect(() => parseRosterFile('not json', ['lg'])).toThrow()
  })
})
