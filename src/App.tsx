import { useMemo, useState } from 'react'
import { sampleRepository } from './data/sampleRoster'
import type { Team } from './data/types'
import { createGame, winner, type GameState, type PlayerIndex } from './engine/game'
import { defaultLineup, toTeamSide, type LineupPlan } from './engine/lineup'
import type { DecisionRecord } from './engine/review'
import { createRng } from './engine/rng'
import { GameScreen } from './screens/GameScreen'
import { HomeScreen } from './screens/HomeScreen'
import { LineupScreen } from './screens/LineupScreen'
import { RecordsScreen } from './screens/RecordsScreen'
import { ResultScreen } from './screens/ResultScreen'
import { TeamSelectScreen } from './screens/TeamSelectScreen'
import { addRecord } from './storage/records'
import { loadSettings, saveSettings, type PlaySettings } from './storage/settings'

const repo = sampleRepository

type Screen =
  | { name: 'home' }
  | { name: 'team' }
  | { name: 'lineup'; my: Team; opp: Team; myHome: boolean; plan: LineupPlan }
  | { name: 'game'; my: Team; opp: Team; myHome: boolean; game: GameState; seed: number }
  | { name: 'result'; my: Team; opp: Team; myHome: boolean; game: GameState; decisions: DecisionRecord[] }
  | { name: 'records' }

function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [settings, setSettings] = useState<PlaySettings>(loadSettings)
  const updateSettings = (s: PlaySettings) => {
    saveSettings(s)
    setSettings(s)
  }
  const [rngSeed] = useState(() => Date.now() % 2147483647)
  const rng = useMemo(() => createRng(rngSeed), [rngSeed])

  const goLineup = (my: Team, opp: Team, myHome: boolean) => {
    const plan = defaultLineup(repo.getRoster(my.id), rng)
    setScreen({ name: 'lineup', my, opp, myHome, plan })
  }

  const startGame = (my: Team, opp: Team, myHome: boolean, plan: LineupPlan) => {
    const myRoster = repo.getRoster(my.id)
    const oppRoster = repo.getRoster(opp.id)
    const mySide = toTeamSide(my.id, myRoster, plan)
    const oppSide = toTeamSide(opp.id, oppRoster, defaultLineup(oppRoster, rng))
    const game = createGame({ home: myHome ? mySide : oppSide, away: myHome ? oppSide : mySide, userSide: myHome ? 'home' : 'away', rng })
    setScreen({ name: 'game', my, opp, myHome, game, seed: Date.now() })
  }

  const saveRecord = (s: Extract<Screen, { name: 'game' }>, game: GameState, decisions: DecisionRecord[]) => {
    const me = game.userSide
    const other = me === 'home' ? 'away' : 'home'
    const w = winner(game)
    const manual = decisions.filter((d) => !d.delegated)
    addRecord({
      id: `${Date.now()}`,
      playedAt: new Date().toISOString(),
      myTeamId: s.my.id,
      oppTeamId: s.opp.id,
      myScore: game.score[me],
      oppScore: game.score[other],
      result: w === null ? 'T' : w === me ? 'W' : 'L',
      endReason: game.endReason,
      innings: game.inning,
      decisions: decisions.length,
      agreedWithCoach: manual.filter((d) => d.userPickId === d.coachPickId).length,
      delegated: decisions.length - manual.length,
      rained: game.log.some((l) => l.tone === 'weather' && (l.text.includes('비가 내리기') || l.text.includes('폭우'))),
    })
  }

  const showResult = (s: Extract<Screen, { name: 'game' }>, game: GameState, decisions: DecisionRecord[]) => {
    setScreen({ name: 'result', my: s.my, opp: s.opp, myHome: s.myHome, game, decisions })
  }

  return <div className="app-frame">{render()}</div>

  function render() {
    switch (screen.name) {
      case 'home':
        return <HomeScreen sourceLabel={repo.sourceLabel} settings={settings} onSettings={updateSettings} onStart={() => setScreen({ name: 'team' })} onRecords={() => setScreen({ name: 'records' })} />
      case 'team':
        return <TeamSelectScreen onBack={() => setScreen({ name: 'home' })} onConfirm={goLineup} />
      case 'lineup':
        return (
          <LineupScreen
            team={screen.my}
            roster={repo.getRoster(screen.my.id)}
            initial={screen.plan}
            settings={settings}
            onSettings={updateSettings}
            onBack={() => setScreen({ name: 'team' })}
            onStart={(plan) => startGame(screen.my, screen.opp, screen.myHome, plan)}
          />
        )
      case 'game': {
        const players: PlayerIndex = Object.fromEntries([...repo.getRoster(screen.my.id), ...repo.getRoster(screen.opp.id)].map((p) => [p.id, p]))
        const teams = screen.myHome ? { home: screen.my, away: screen.opp } : { home: screen.opp, away: screen.my }
        return (
          <GameScreen
            key={screen.seed}
            initial={screen.game}
            players={players}
            teams={teams}
            rng={rng}
            settings={settings}
            onSettings={updateSettings}
            onGameOver={(game, decisions) => saveRecord(screen, game, decisions)}
            onFinish={(game, decisions) => showResult(screen, game, decisions)}
          />
        )
      }
      case 'result': {
        const teams = screen.myHome ? { home: screen.my, away: screen.opp } : { home: screen.opp, away: screen.my }
        return (
          <ResultScreen
            game={screen.game}
            decisions={screen.decisions}
            teams={teams}
            onAgain={() => goLineup(screen.my, screen.opp, screen.myHome)}
            onRecords={() => setScreen({ name: 'records' })}
            onHome={() => setScreen({ name: 'home' })}
          />
        )
      }
      case 'records':
        return <RecordsScreen onBack={() => setScreen({ name: 'home' })} />
    }
  }
}

export default App
