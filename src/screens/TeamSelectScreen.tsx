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
