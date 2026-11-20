import { describe, expect, test } from 'vitest'
import { createGame, type PlayerIndex } from '../engine/game'
import { defaultLineup, toTeamSide } from '../engine/lineup'
import { autoStep } from '../engine/manager'
import { createRng } from '../engine/rng'
import { checkRoster } from '../storage/rosters'
import { fanRoster } from './fanRosters'
import { toPlayer } from './ratings'
import { TEAMS } from './teams'

const fanPlayers = (teamId: string) => fanRoster(teamId).map((p, i) => toPlayer(teamId, p, i, 'ai'))

describe('AI 초안', () => {
  test('모든 구단이 타자 13명, 투수 12명이고 바로 경기에 쓸 수 있다', () => {
    for (const t of TEAMS) {
      const roster = fanRoster(t.id)
      expect(roster.filter((p) => p.position !== 'P')).toHaveLength(13)
      expect(roster.filter((p) => p.position === 'P')).toHaveLength(12)
      expect(checkRoster(roster).ok).toBe(true)
    }
  })

  test('한 구단 안에서 이름과 등번호가 겹치지 않는다', () => {
    for (const t of TEAMS) {
      const roster = fanRoster(t.id)
      expect(new Set(roster.map((p) => p.name)).size).toBe(roster.length)
      expect(new Set(roster.map((p) => p.number)).size).toBe(roster.length)
    }
  })

  test('불러온 선수는 모두 AI 등급으로 표시된다', () => {
    expect(fanRoster('lg').every((p) => p.ratedBy === 'ai')).toBe(true)
  })

  test('AI 초안끼리 경기해도 팀당 평균 득점이 현실적이다', { timeout: 30000 }, () => {
    let runs = 0
    const games = 120
    for (let g = 0; g < games; g++) {
      const rng = createRng(g * 31 + 5)
      const home = TEAMS[g % 10].id
      const away = TEAMS[(g + 3) % 10].id
      const hr = fanPlayers(home)
      const ar = fanPlayers(away)
      const players: PlayerIndex = Object.fromEntries([...hr, ...ar].map((p) => [p.id, p]))
      let s = createGame({ home: toTeamSide(home, hr, defaultLineup(hr, rng)), away: toTeamSide(away, ar, defaultLineup(ar, rng)), userSide: 'home', rng })
      for (let i = 0; i < 400 && !s.over; i++) s = autoStep(s, players, rng)
      runs += s.score.home + s.score.away
    }
    const perTeam = runs / games / 2
    console.log('AI 초안 팀당 평균 득점', perTeam.toFixed(2))
    expect(perTeam).toBeGreaterThan(3)
    expect(perTeam).toBeLessThan(6.5)
  })
})
