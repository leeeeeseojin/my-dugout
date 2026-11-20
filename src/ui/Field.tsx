// 위에서 내려다본 초록 야구장. 수비수·타자·주자를 캐릭터로 그리고, 누르면 선수 카드를 연다.

import { useMemo } from 'react'
import type { Player, Position, Team } from '../data/types'
import { currentBatterId, defense, offense, type GameState, type PlayerIndex } from '../engine/game'
import { Character } from './Character'
import './field.css'

export const FIELD_W = 400
export const FIELD_H = 640

const HOME = { x: 200, y: 420 }
const BASES = [
  { x: 286, y: 340 },
  { x: 200, y: 258 },
  { x: 114, y: 340 },
]

const SPOTS: Record<Exclude<Position, 'DH'>, { x: number; y: number }> = {
  P: { x: 200, y: 346 },
  C: { x: 200, y: 452 },
  '1B': { x: 312, y: 306 },
  '2B': { x: 262, y: 236 },
  SS: { x: 138, y: 236 },
  '3B': { x: 88, y: 306 },
  LF: { x: 78, y: 158 },
  CF: { x: 200, y: 104 },
  RF: { x: 322, y: 158 },
}

interface Props {
  game: GameState
  players: PlayerIndex
  teams: { home: Team; away: Team }
  onSelect: (playerId: string) => void
  selectedId?: string | null
}

const PLAY_LABEL: Record<string, string> = {
  single: '안타!',
  double: '2루타!',
  triple: '3루타!',
  hr: '홈런!',
  so: '삼진',
  bb: '볼넷',
  ibb: '고의사구',
  dp: '병살',
  sacfly: '희생플라이',
  bunt: '희생번트',
  'bunt-hit': '번트 안타!',
  'bunt-fail': '번트 실패',
  error: '실책!',
  steal: '도루 성공!',
  caught: '도루 실패',
  fc: '야수 선택',
  out: '아웃',
}

function ballTarget(kind: string, text: string, dir: number) {
  if (kind === 'so') return SPOTS.C
  if (kind === 'hr') return { x: 70 + dir * 260, y: 30 }
  if (kind === 'triple') return { x: dir < 0.5 ? 46 : 354, y: 150 }
  if (kind === 'double') return { x: dir < 0.5 ? 64 : 336, y: 120 + dir * 30 }
  if (kind === 'single') return { x: 100 + dir * 200, y: 205 }
  if (kind === 'sacfly') return { x: 120 + dir * 160, y: 150 }
  if (kind.startsWith('bunt')) return { x: 180 + dir * 40, y: 372 }
  if (text.includes('뜬공')) return { x: 90 + dir * 220, y: 165 }
  if (text.includes('직선타')) return { x: 150 + dir * 100, y: 270 }
  return { x: 130 + dir * 140, y: 300 }
}

function Tree({ x, y, r, kind }: { x: number; y: number; r: number; kind: 'round' | 'pine' }) {
  if (kind === 'pine') {
    return (
      <g transform={`translate(${x} ${y})`}>
        <ellipse cx={0} cy={4} rx={r * 0.8} ry={r * 0.25} fill="rgba(20,50,25,0.25)" />
        <rect x={-2} y={-6} width={4} height={10} fill="#7a5532" />
        <path d={`M 0 ${-r * 2.2} L ${r} ${-4} L ${-r} ${-4} Z`} fill="#2f7a43" />
        <path d={`M 0 ${-r * 2.2} L ${r * 0.15} ${-4} L ${-r} ${-4} Z`} fill="#3b8c4f" />
      </g>
    )
  }
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={r * 0.6} rx={r} ry={r * 0.3} fill="rgba(20,50,25,0.25)" />
      <circle cx={0} cy={0} r={r} fill="#3f9150" />
      <circle cx={-r * 0.3} cy={-r * 0.25} r={r * 0.55} fill="#4ea35d" />
    </g>
  )
}

function Label({ x, y, text, accent }: { x: number; y: number; text: string; accent?: boolean }) {
  return (
    <text x={x} y={y + 14} className={`field-name${accent ? ' accent' : ''}`} textAnchor="middle">
      {text}
    </text>
  )
}

function Figure(props: {
  id: string
  x: number
  y: number
  player: Player
  team: Team
  pose: Parameters<typeof Character>[0]['pose']
  facing: 'up' | 'down'
  onSelect: (id: string) => void
  selected: boolean
  accent?: boolean
}) {
  const { id, x, y, player, team, pose, facing, onSelect, selected, accent } = props
  return (
    <g className="figure" style={{ transform: `translate(${x}px, ${y}px)` }} onClick={() => onSelect(id)}>
      <rect x={-18} y={-50} width={36} height={68} fill="transparent" />
      <g transform="scale(0.88)"><Character jersey={team.color} cap={team.accent === '#ffffff' ? team.color : team.accent} skin={player.look.skin} hair={player.look.hair} pose={pose} facing={facing} highlight={selected} /></g>
      <Label x={0} y={0} text={player.name} accent={accent} />
    </g>
  )
}

export function Field({ game, players, teams, onSelect, selectedId }: Props) {
  const off = offense(game)
  const def = defense(game)
  const offTeam = game.half === 'top' ? teams.away : teams.home
  const defTeam = game.half === 'top' ? teams.home : teams.away
  const batterId = currentBatterId(game)
  const batter = players[batterId]
  const lefty = batter.bats === 'L' || (batter.bats === 'S' && players[def.pitcherId].throws === 'R')

  const drops = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ x: (i * 53) % FIELD_W, y: (i * 97) % FIELD_H, d: 0.5 + ((i * 7) % 10) / 20 })), [])
  const raining = game.weather.kind === 'rain' || game.weather.kind === 'heavyRain'
  const heavy = game.weather.kind === 'heavyRain'

  const play = game.lastPlay
  const playKey = game.log.length
  const target = play ? ballTarget(play.kind, play.text, play.direction) : null
  const showBall = play && !['bb', 'ibb', 'steal', 'caught'].includes(play.kind)

  const fielders = Object.entries(def.fielding).filter(([, pos]) => pos !== 'DH') as [string, Exclude<Position, 'DH'>][]

  return (
    <div className={`field-wrap${raining ? ' raining' : ''}${heavy ? ' heavy' : ''}`}>
      <svg className="field-svg" viewBox={`0 0 ${FIELD_W} ${FIELD_H}`} preserveAspectRatio="xMidYMin slice">
        <defs>
          <clipPath id="outfield">
            <path d="M 200 420 L 6 226 Q 200 -70 394 226 Z" />
          </clipPath>
        </defs>
        <rect width={FIELD_W} height={FIELD_H} fill="#5cb85c" />
        {/* 바깥 숲 */}
        {[
          [20, 40, 22, 'round'], [64, 22, 18, 'pine'], [110, 10, 16, 'round'], [300, 12, 17, 'round'], [342, 26, 18, 'pine'],
          [384, 50, 22, 'round'], [14, 120, 16, 'pine'], [388, 128, 16, 'pine'], [10, 300, 20, 'round'], [392, 300, 20, 'round'],
          [26, 520, 22, 'round'], [374, 520, 22, 'round'], [70, 600, 18, 'pine'], [330, 600, 18, 'pine'], [200, 630, 24, 'round'],
        ].map(([x, y, r, k], i) => (
          <Tree key={i} x={x as number} y={y as number} r={r as number} kind={k as 'round' | 'pine'} />
        ))}
        {/* 외야 잔디 줄무늬 */}
        <g clipPath="url(#outfield)">
          <rect width={FIELD_W} height={FIELD_H} fill="#6cc46a" />
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x={i * 48 - 10} y={0} width={24} height={FIELD_H} fill="#62bb61" />
          ))}
        </g>
        <path d="M 200 420 L 6 226 Q 200 -70 394 226 Z" fill="none" stroke="#3f8f45" strokeWidth={5} strokeLinejoin="round" />
        {/* 파울 라인 */}
        <path d="M 200 420 L 6 226 M 200 420 L 394 226" stroke="#fffaf0" strokeWidth={2} opacity={0.85} />
        {/* 내야 흙 */}
        <path d="M 200 440 L 314 340 Q 200 168 86 340 Z" fill="#d9a066" />
        <path d="M 200 402 L 266 340 L 200 278 L 134 340 Z" fill="#6cc46a" />
        <circle cx={200} cy={346} r={13} fill="#d9a066" />
        <circle cx={200} cy={346} r={4} fill="#c48a52" />
        <circle cx={HOME.x} cy={HOME.y + 2} r={20} fill="#d9a066" />
        {/* 베이스 */}
        <path d={`M ${HOME.x - 6} ${HOME.y - 4} h 12 v 5 l -6 5 l -6 -5 z`} fill="#fffaf0" />
        {BASES.map((b, i) => (
          <rect key={i} x={b.x - 6} y={b.y - 6} width={12} height={12} rx={2} fill={game.bases[i] ? '#f2b233' : '#fffaf0'} transform={`rotate(45 ${b.x} ${b.y})`} />
        ))}

        {/* 수비수 */}
        {fielders.map(([id, pos]) => (
          <Figure key={id} id={id} x={SPOTS[pos].x} y={SPOTS[pos].y} player={players[id]} team={defTeam} pose={pos === 'C' ? 'crouch' : 'stand'} facing="down" onSelect={onSelect} selected={selectedId === id} />
        ))}
        <Figure key={def.pitcherId} id={def.pitcherId} x={SPOTS.P.x} y={SPOTS.P.y} player={players[def.pitcherId]} team={defTeam} pose="pitch" facing="down" onSelect={onSelect} selected={selectedId === def.pitcherId} />

        {/* 주자와 타자: 같은 선수는 같은 key라 타석에서 베이스로 움직인다 */}
        {game.bases.map((r, i) =>
          r && r.id !== batterId ? (
            <Figure key={r.id} id={r.id} x={BASES[i].x + (i === 1 ? 0 : i === 0 ? -6 : 6)} y={BASES[i].y + 10} player={players[r.id]} team={offTeam} pose="run" facing="up" onSelect={onSelect} selected={selectedId === r.id} />
          ) : null,
        )}
        <Figure key={batterId} id={batterId} x={HOME.x + (lefty ? 20 : -20)} y={HOME.y + 6} player={batter} team={offTeam} pose={lefty ? 'bat-l' : 'bat-r'} facing="up" onSelect={onSelect} selected={selectedId === batterId} accent />

        {/* 공 */}
        {showBall && target && (
          <circle
            key={`ball-${playKey}`}
            className="ball"
            r={4}
            fill="#fffaf0"
            stroke="#c9c2ad"
            style={{ ['--tx' as string]: `${target.x - HOME.x}px`, ['--ty' as string]: `${target.y - HOME.y}px`, transform: `translate(${HOME.x}px, ${HOME.y}px)` }}
          />
        )}

        {/* 빗방울 */}
        {raining && (
          <g className="rain">
            {drops.slice(0, heavy ? 70 : 35).map((d, i) => (
              <line key={i} x1={d.x} y1={d.y} x2={d.x - 3} y2={d.y + 12} stroke="#e3f3ff" strokeWidth={1.4} style={{ animationDuration: `${d.d}s`, animationDelay: `${-i * 0.07}s` }} />
            ))}
          </g>
        )}
      </svg>
      {play && (
        <div key={`pop-${playKey}`} className={`play-pop kind-${play.kind}`}>
          {PLAY_LABEL[play.kind] ?? '아웃'}
          {play.runs > 0 && <span className="pop-runs">+{play.runs}점</span>}
        </div>
      )}
      <span className="sr-only">{off.teamId} 공격 중</span>
    </div>
  )
}
