import { useState } from 'react'
import type { PlaySettings } from '../storage/settings'
import { Character } from '../ui/Character'
import { GearIcon } from '../ui/icons'
import { Scene } from '../ui/Scene'
import { SettingsSheet } from '../ui/SettingsSheet'
import './screens.css'

interface Props {
  sourceLabel: string
  settings: PlaySettings
  onSettings: (s: PlaySettings) => void
  onStart: () => void
  onRosters: () => void
  onRecords: () => void
}

export function HomeScreen({ sourceLabel, settings, onSettings, onStart, onRosters, onRecords }: Props) {
  const [showSettings, setShowSettings] = useState(false)

  // 시트가 열린 동안에는 뒤쪽 버튼을 그리지 않고 배경 그림만 남긴다
  if (showSettings) {
    return (
      <div className="screen home">
        <Scene />
        <SettingsSheet settings={settings} onChange={onSettings} onClose={() => setShowSettings(false)} />
      </div>
    )
  }

  return (
    <div className="screen home">
      <Scene />
      <button className="round-btn corner-btn" onClick={() => setShowSettings(true)} aria-label="운영 방식 설정" data-opener="settings">
        <GearIcon />
      </button>
      <svg viewBox="-60 -60 120 70" width={220} height={128} aria-hidden>
        <g transform="translate(-30 0)">
          <Character jersey="#c30452" cap="#2b2a26" skin="#f2c7a5" hair="#2b2a26" facing="down" pose="bat-r" />
        </g>
        <g transform="translate(30 0)">
          <Character jersey="#131230" cap="#ed1c24" skin="#d9a07a" hair="#3a2a1e" facing="down" pose="pitch" />
        </g>
      </svg>
      <h1 className="title-text">MY DUGOUT</h1>
      <p className="tagline">내가 감독이라면?</p>
      <button className="game-btn" onClick={onStart}>
        경기 시작
      </button>
      <button className="game-btn secondary" onClick={onRosters}>
        로스터 편집
      </button>
      <button className="game-btn secondary" onClick={onRecords}>
        지금까지 기록
      </button>
      <p className="data-note">
        {sourceLabel}
        <br />
        비공식 팬 게임 · KBO, 구단, 선수와 관계없어요
      </p>
    </div>
  )
}
