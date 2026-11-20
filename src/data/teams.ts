import type { Team } from './types'

// 로고는 쓰지 않고 구단명과 대표 색만 사용한다.
export const TEAMS: Team[] = [
  { id: 'lg', name: 'LG 트윈스', short: 'LG', city: '서울', color: '#c30452', accent: '#2b2a26' },
  { id: 'hh', name: '한화 이글스', short: '한화', city: '대전', color: '#f37321', accent: '#2b2a26' },
  { id: 'ssg', name: 'SSG 랜더스', short: 'SSG', city: '인천', color: '#ce0e2d', accent: '#ffcd00' },
  { id: 'ss', name: '삼성 라이온즈', short: '삼성', city: '대구', color: '#074ca1', accent: '#ffffff' },
  { id: 'nc', name: 'NC 다이노스', short: 'NC', city: '창원', color: '#315288', accent: '#c7a079' },
  { id: 'kt', name: 'KT 위즈', short: 'KT', city: '수원', color: '#2b2a26', accent: '#eb1c24' },
  { id: 'lt', name: '롯데 자이언츠', short: '롯데', city: '부산', color: '#041e42', accent: '#d00f31' },
  { id: 'kia', name: 'KIA 타이거즈', short: 'KIA', city: '광주', color: '#ea0029', accent: '#06141f' },
  { id: 'ds', name: '두산 베어스', short: '두산', city: '서울', color: '#131230', accent: '#ed1c24' },
  { id: 'kw', name: '키움 히어로즈', short: '키움', city: '서울', color: '#820024', accent: '#b07f4a' },
]

export function getTeam(id: string): Team {
  const team = TEAMS.find((t) => t.id === id)
  if (!team) throw new Error(`알 수 없는 구단: ${id}`)
  return team
}
