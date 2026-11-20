import { useState } from 'react'
import { TEAMS } from '../data/teams'
import type { Team } from '../data/types'
import { Character } from '../ui/Character'
import { BackIcon } from '../ui/icons'
import { Scene } from '../ui/Scene'
import './screens.css'

interface Props {
  onBack: () => void
  onConfirm: (my: Team, opp: Team, myHome: boolean) => void
}

/** 받침이 있으면 "은", 없으면 "는" (LG·KIA처럼 영문 약칭은 모음으로 끝나 "는") */
function withTopic(name: string) {
  const code = name.charCodeAt(name.length - 1) - 0xac00
  const batchim = code >= 0 && code <= 11171 && code % 28 !== 0
  return name + (batchim ? '은' : '는')
}

function TeamFigure({ team, size = 52 }: { team: Team; size?: number }) {
  return (
    <svg viewBox="-20 -50 40 56" width={size} height={size * 1.4} aria-hidden>
      <Character jersey={team.color} cap={team.accent === '#ffffff' ? team.color : team.accent} skin="#f2c7a5" hair="#2b2a26" facing="down" />
    </svg>
  )
}

export function TeamSelectScreen({ onBack, onConfirm }: Props) {
  const [match, setMatch] = useState<{ my: Team; opp: Team; myHome: boolean } | null>(null)

  const choose = (my: Team) => {
    const others = TEAMS.filter((t) => t.id !== my.id)
    const opp = others[Math.floor(Math.random() * others.length)]
    setMatch({ my, opp, myHome: Math.random() < 0.5 })
  }

  if (match) {
    const away = match.myHome ? match.opp : match.my
    const home = match.myHome ? match.my : match.opp
    return (
      <div className="screen centered">
        <Scene />
        <div className="versus center-block">
          <p className="title-text" style={{ fontSize: 22, margin: 0 }}>
            오늘의 상대는
          </p>
          <h1 className="title-text" style={{ fontSize: 40 }}>
            {match.opp.name}
          </h1>
          <div className="vs-row">
            <div className="vs-team">
              <TeamFigure team={away} size={64} />
              {away.short}
              <small>원정</small>
            </div>
            <span className="vs title-text">VS</span>
            <div className="vs-team">
              <TeamFigure team={home} size={64} />
              {home.short}
              <small>홈 · {home.city}</small>
            </div>
          </div>
          <p className="vs-side title-text">{withTopic(match.my.short)} {match.myHome ? '홈에서 수비부터' : '원정에서 공격부터'} 시작해요</p>
          <button className="game-btn secondary" style={{ width: 240 }} onClick={() => setMatch({ ...match, myHome: !match.myHome })}>
            {match.myHome ? '원정으로 바꾸기' : '홈으로 바꾸기'}
          </button>
          <button className="game-btn" onClick={() => onConfirm(match.my, match.opp, match.myHome)}>
            라인업 짜기
          </button>
          <button className="game-btn secondary" style={{ width: 240 }} onClick={() => setMatch(null)}>
            구단 다시 고르기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen split">
      <Scene />
      <div className="top-bar">
        <button className="round-btn" onClick={onBack} aria-label="뒤로">
          <BackIcon />
        </button>
        <h1 className="title-text">내 구단 고르기</h1>
      </div>
      <div className="split-body">
        <div className="team-grid">
          {TEAMS.map((t) => (
            <button key={t.id} className="team-btn" onClick={() => choose(t)}>
              <TeamFigure team={t} />
              <div>
                <b>{t.short}</b>
                <span>{t.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="split-foot">
        <button className="game-btn" onClick={() => choose(TEAMS[Math.floor(Math.random() * TEAMS.length)])}>
          아무 구단이나
        </button>
      </div>
    </div>
  )
}
