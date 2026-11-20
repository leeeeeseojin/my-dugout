// 지금까지 치른 경기 기록 (이 기기에만 저장)

export interface GameRecord {
  id: string
  playedAt: string
  myTeamId: string
  oppTeamId: string
  myScore: number
  oppScore: number
  result: 'W' | 'L' | 'T'
  endReason: 'normal' | 'walkoff' | 'rain' | 'tie' | null
  innings: number
  decisions: number
  /** 코치 추천과 같은 선택을 한 횟수 (맡긴 판단 제외) */
  agreedWithCoach: number
  delegated: number
  rained: boolean
}

const KEY = 'my-dugout:records'

export function loadRecords(): GameRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as GameRecord[]) : []
  } catch {
    return []
  }
}

export function addRecord(record: GameRecord) {
  const all = [record, ...loadRecords()].slice(0, 200)
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // 저장 실패 시 기록 화면에만 빠진다
  }
  return all
}

export function summarize(records: GameRecord[]) {
  const byTeam = new Map<string, { games: number; w: number; l: number; t: number }>()
  for (const r of records) {
    const v = byTeam.get(r.myTeamId) ?? { games: 0, w: 0, l: 0, t: 0 }
    v.games++
    if (r.result === 'W') v.w++
    else if (r.result === 'L') v.l++
    else v.t++
    byTeam.set(r.myTeamId, v)
  }
  const manual = records.reduce((a, r) => a + r.decisions - r.delegated, 0)
  const agreed = records.reduce((a, r) => a + r.agreedWithCoach, 0)
  return {
    games: records.length,
    wins: records.filter((r) => r.result === 'W').length,
    losses: records.filter((r) => r.result === 'L').length,
    rainGames: records.filter((r) => r.rained).length,
    walkoffs: records.filter((r) => r.endReason === 'walkoff' && r.result === 'W').length,
    agreeRate: manual ? agreed / manual : null,
    byTeam: [...byTeam.entries()].map(([teamId, v]) => ({ teamId, ...v })).sort((a, b) => b.games - a.games),
  }
}
