// 선수 데이터 모델
// 구단 명단은 "현재 소속 선수"만, 선수별 기록은 데뷔 시즌부터 현재까지 시즌 단위로 쌓는다.

export type Hand = 'L' | 'R' | 'S'

export type Position = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH'

export interface Team {
  id: string
  name: string
  short: string
  city: string
  color: string
  accent: string
}

/** 상대 투수 손 기준 타격 기록 */
export interface BattingSplit {
  pa: number
  h: number
  hr: number
  bb: number
  so: number
}

export interface BattingSeason {
  year: number
  pa: number
  ab: number
  h: number
  double: number
  triple: number
  hr: number
  bb: number
  so: number
  sb: number
  cs: number
  vsL: BattingSplit
  vsR: BattingSplit
}

/** 상대 타자 손 기준 투구 기록 */
export interface PitchingSplit {
  bf: number
  h: number
  hr: number
  bb: number
  so: number
}

export interface PitchingSeason {
  year: number
  g: number
  gs: number
  ip: number
  bf: number
  h: number
  hr: number
  bb: number
  so: number
  er: number
  w: number
  l: number
  sv: number
  vsL: PitchingSplit
  vsR: PitchingSplit
}

export type PitcherRole = 'SP' | 'RP' | 'CL'

export interface Player {
  id: string
  teamId: string
  name: string
  number: number
  bats: Hand
  throws: Hand
  /** 주 포지션. 투수는 'P' */
  position: Position
  /** 수비 가능한 포지션 */
  positions: Position[]
  role?: PitcherRole
  /** 데뷔 시즌부터 현재 시즌까지, 오래된 순 */
  batting: BattingSeason[]
  pitching: PitchingSeason[]
  /** 캐릭터 피부색 등 외형 표현용 */
  look: { skin: string; hair: string }
  /** 사용자가 로스터 편집기에서 능력치로 만든 선수. 기록은 능력치로 계산한 예상치다 */
  custom?: boolean
  /** 능력치를 누가 매겼는지: 사용자가 직접(user) 또는 팬 로스터 초안의 AI 등급(ai) */
  ratedBy?: 'user' | 'ai'
}

/**
 * 실제 데이터 연결 지점.
 * 지금은 샘플 생성기가 구현하고, 이후 실제 KBO 기록 소스로 교체한다.
 */
export interface PlayerRepository {
  /** 데이터의 출처 표시 (화면 하단 안내에 사용) */
  readonly sourceLabel: string
  /** 현재 시즌 기준 현역 소속 선수만 반환 */
  getRoster(teamId: string): Player[]
}
