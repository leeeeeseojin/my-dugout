// 경기 진행 화면: 필드 전체 + 위쪽 점수판 + 아래쪽 진행 상황·작전 패널

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Team } from '../data/types'
import { adviseFor, isDecisionMoment, pinchCandidates, relieverCandidates, type CoachAdvice } from '../engine/coach'
import {
  baseState,
  changePitcher,
  currentBatterId,
  defense,
  defenseKey,
  halfLabel,
  offenseKey,
  pinchHit,
  playPlateAppearance,
  userIsBatting,
  type DefenseAction,
  type GameState,
  type Half,
  type OffenseAction,
  type PlayerIndex,
  type SideKey,
} from '../engine/game'
import { autoDefense, autoOffense, autoPitchingChange, scoreDiffFor } from '../engine/manager'
import type { DecisionRecord } from '../engine/review'
import { stylePicks } from '../engine/styles'
import type { Rng } from '../engine/rng'
import { battingTotals, fmtAvg, pitcherProfile } from '../engine/stats'
import { WEATHER_EFFECTS } from '../engine/weather'
import type { PlaySettings } from '../storage/settings'
import { DecisionPanel, type Candidate } from '../ui/DecisionPanel'
import { Field } from '../ui/Field'
import { GearIcon, PlayIcon, WeatherIcon } from '../ui/icons'
import { PlayerCard } from '../ui/PlayerCard'
import { SettingsSheet } from '../ui/SettingsSheet'
import './game.css'

interface Props {
  initial: GameState
  players: PlayerIndex
  teams: { home: Team; away: Team }
  rng: Rng
  settings: PlaySettings
  onSettings: (s: PlaySettings) => void
  /** 경기가 끝난 순간 한 번 호출 (기록 저장) */
  onGameOver: (game: GameState, decisions: DecisionRecord[]) => void
  onFinish: (game: GameState, decisions: DecisionRecord[]) => void
}

type Phase = 'auto' | 'decide' | 'delegate' | 'over'

const SPEEDS = [
  { label: '1배', ms: 1700 },
  { label: '2배', ms: 900 },
  { label: '4배', ms: 380 },
]

interface Pending {
  recordId: number
  inning: number
  half: Half
  offKey: SideKey
  scoreBefore: number
}

export function GameScreen({ initial, players, teams, rng, settings, onSettings, onGameOver, onFinish }: Props) {
  const [game, setGame] = useState(initial)
  const [phase, setPhase] = useState<Phase>('auto')
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [advice, setAdvice] = useState<CoachAdvice | null>(null)
  /** 작전 패널에서 골라 둔 작전. 시트를 열었다 닫아도 그대로 남는다 */
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [decisions, setDecisions] = useState<DecisionRecord[]>([])
  const [cardId, setCardId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  /** 이번 판단에서 "내가 고를게요"로 끼어들었는지. 끼어든 판단은 다시 코치에게 넘기지 않는다 */
  const [intervened, setIntervened] = useState(false)
  const pending = useRef<Pending[]>([])
  const saved = useRef(false)

  const userTeam = teams[game.userSide]

  /** 판단 이후 그 이닝에 난 점수를 반 이닝이 끝날 때 채운다 */
  const settle = useCallback((next: GameState) => {
    const done = pending.current.filter((p) => next.over || p.inning !== next.inning || p.half !== next.half)
    if (!done.length) return
    pending.current = pending.current.filter((p) => !done.includes(p))
    setDecisions((list) =>
      list.map((d) => {
        const p = done.find((x) => x.recordId === d.id)
        return p ? { ...d, runsAfter: next.score[p.offKey] - p.scoreBefore } : d
      }),
    )
  }, [])

  const advance = useCallback(
    (next: GameState) => {
      settle(next)
      setGame(next)
      setPhase(next.over ? 'over' : 'auto')
      setAdvice(null)
      setPickedId(null)
      setIntervened(false)
    },
    [settle],
  )

  // 경기가 끝나는 순간 기록을 저장한다 (결과 화면으로 넘어가지 않아도 남도록)
  useEffect(() => {
    if (phase !== 'over' || saved.current) return
    saved.current = true
    onGameOver(game, decisions)
  }, [phase, game, decisions, onGameOver])

  // ───────── 자동 진행 ─────────
  useEffect(() => {
    if (phase !== 'auto' || paused || cardId || showSettings) return
    const t = setTimeout(() => {
      if (game.over) {
        setPhase('over')
        return
      }
      if (isDecisionMoment(game, players, settings.ask)) {
        const owner = userIsBatting(game) ? settings.offense : settings.defense
        setAdvice(adviseFor(game, players))
        setPhase(owner === 'coach' ? 'delegate' : 'decide')
        return
      }
      let s = game
      let off: OffenseAction = 'swing'
      let def: DefenseAction = 'pitch'
      if (userIsBatting(s)) {
        const change = autoPitchingChange(s, players)
        if (change) s = changePitcher(s, players, defenseKey(s), change)
        def = autoDefense(s, players)
      } else {
        off = autoOffense(s, players)
      }
      advance(playPlateAppearance(s, players, rng, { offense: off, defense: def }))
    }, SPEEDS[speed].ms)
    return () => clearTimeout(t)
  }, [game, phase, paused, speed, cardId, showSettings, players, rng, settings, advance])

  // 설정에서 맡기기로 바꾸면 지금 판단도 바로 맡긴다. 단, 사용자가 직접 끼어든 판단은 그대로 둔다
  useEffect(() => {
    if (phase !== 'decide' || !advice || intervened) return
    const owner = advice.side === 'offense' ? settings.offense : settings.defense
    if (owner === 'coach') setPhase('delegate')
  }, [settings, phase, advice, intervened])

  // ───────── 사용자 판단 적용 ─────────
  const decide = useCallback(
    (optionId: string) => {
      if (!advice) return
      const opt = advice.options.find((o) => o.id === optionId) ?? advice.options[0]
      const delegated = phase === 'delegate'
      const offKey = offenseKey(game)
      const batter = players[currentBatterId(game)]
      const pitcher = players[defense(game).pitcherId]
      const record: DecisionRecord = {
        id: decisions.length + 1,
        situation: {
          inning: game.inning,
          scoreDiff: scoreDiffFor(game, game.userSide),
          outs: game.outs,
          bases: game.bases.map(Boolean) as [boolean, boolean, boolean],
          side: advice.side,
          batterHand: batter.bats,
          pitcherHand: pitcher.throws,
        },
        label: `${halfLabel(game)} · ${game.outs}사 ${baseState(game.bases)}`,
        batterName: batter.name,
        pitcherName: pitcher.name,
        metricLabel: advice.metricLabel,
        options: advice.options.map((o) => ({
          id: o.id,
          kind: o.kind,
          label: o.label,
          value: advice.metric === 'runs' ? `${o.runs.toFixed(2)}점` : `${Math.round(o.scoreProb * 100)}%`,
        })),
        coachPickId: advice.recommendedId,
        coachConfidence: advice.confidence,
        styles: stylePicks(advice, game, players),
        userPickId: opt.id,
        delegated,
        runsAfter: null,
      }
      setDecisions((list) => [...list, record])
      pending.current.push({ recordId: record.id, inning: game.inning, half: game.half, offKey, scoreBefore: game.score[offKey] })

      let s = game
      let off: OffenseAction = 'swing'
      let def: DefenseAction = 'pitch'
      if (advice.side === 'offense') {
        if (opt.kind === 'pinch' && opt.playerId) s = pinchHit(s, players, game.userSide, opt.playerId)
        if (opt.kind === 'bunt' || opt.kind === 'steal') off = opt.kind
        const change = autoPitchingChange(s, players)
        if (change) s = changePitcher(s, players, defenseKey(s), change)
        def = autoDefense(s, players)
      } else {
        if (opt.kind === 'change' && opt.playerId) s = changePitcher(s, players, game.userSide, opt.playerId)
        if (opt.kind === 'ibb' || opt.kind === 'infieldIn') def = opt.kind
        off = autoOffense(s, players)
      }
      advance(playPlateAppearance(s, players, rng, { offense: off, defense: def }))
    },
    [advice, phase, game, players, rng, decisions.length, advance],
  )

  const pickCandidate = useCallback(
    (id: string) => {
      const next = adviseFor(game, players, advice?.side === 'offense' ? { pinch: id } : { pitcher: id })
      setAdvice(next)
      // 새로 추가한 대타·투수는 바로 선택 상태로
      const opt = next.options.find((o) => o.playerId === id)
      if (opt) setPickedId(opt.id)
    },
    [game, players, advice],
  )

  const candidates: Candidate[] = useMemo(() => {
    if (!advice) return []
    if (advice.side === 'offense') {
      const hand = players[defense(game).pitcherId].throws === 'L' ? '좌투' : '우투'
      return pinchCandidates(game, players).map((c) => ({
        player: c.player,
        note: `${c.player.bats === 'L' ? '좌타' : c.player.bats === 'S' ? '양타' : '우타'} · 통산 ${fmtAvg(battingTotals(c.player).avg)} · ${hand} 상대`,
      }))
    }
    const batter = players[currentBatterId(game)]
    return relieverCandidates(game, players).map((c) => {
      const k = pitcherProfile(c.player, batter.bats).rates.so
      return { player: c.player, note: `${c.player.throws === 'L' ? '좌완' : '우완'} · ${c.player.role === 'CL' ? '마무리' : '불펜'} · 탈삼진 ${Math.round(k * 100)}%` }
    })
  }, [advice, game, players])

  // ───────── 화면 ─────────
  const cardPlayer = cardId ? players[cardId] : null
  const cardTeam = cardPlayer ? (cardPlayer.teamId === teams.home.id ? teams.home : teams.away) : null
  const lastLogs = game.log.slice(-3).reverse()
  const diffText = (() => {
    const d = scoreDiffFor(game, game.userSide)
    return d === 0 ? '동점' : d > 0 ? `${d}점 앞섬` : `${-d}점 뒤짐`
  })()
  const decisionTitle = advice
    ? `${halfLabel(game)} · ${diffText} · ${game.outs}사 ${baseState(game.bases)} · ${advice.side === 'offense' ? '공격' : '수비'} 작전`
    : ''

  // 시트가 열린 동안에는 경기장·버튼을 그리지 않는다. 경기 상태는 이 컴포넌트에 남아 있고 진행도 멈춰 있다
  if ((cardPlayer && cardTeam) || showSettings) {
    return (
      <div className="game-screen">
        {cardPlayer && cardTeam && <PlayerCard player={cardPlayer} team={cardTeam} game={game} onClose={() => setCardId(null)} />}
        {showSettings && <SettingsSheet settings={settings} onChange={onSettings} onClose={() => setShowSettings(false)} />}
      </div>
    )
  }

  return (
    <div className={`game-screen${phase === 'decide' || phase === 'delegate' ? ' deciding' : ''}`}>
      <Field game={game} players={players} teams={teams} onSelect={setCardId} selectedId={cardId} />

      <header className="hud">
        <div className="scoreboard">
          {(['away', 'home'] as SideKey[]).map((k) => (
            <div key={k} className={`sb-team${offenseKey(game) === k ? ' batting' : ''}`}>
              <span className="sb-chip" style={{ background: teams[k].color }} />
              <span className="sb-name">
                {teams[k].short}
                {k === game.userSide && <small> 나</small>}
              </span>
              <span className="sb-score">{game.score[k]}</span>
            </div>
          ))}
        </div>
        <div className="inning-box">
          <span className="inning">
            {game.inning}
            <span className={`arrow ${game.half}`} />
          </span>
          <span className="outs" aria-label={`${game.outs}아웃`}>
            {[0, 1].map((i) => (
              <i key={i} className={i < game.outs ? 'on' : ''} />
            ))}
          </span>
        </div>
        <div className="hud-right">
          <span className="weather" title={WEATHER_EFFECTS[game.weather.kind].label}>
            <WeatherIcon kind={game.weather.kind} />
          </span>
          <button className="round-btn" onClick={() => setShowSettings(true)} aria-label="운영 방식 설정" data-opener="settings">
            <GearIcon />
          </button>
        </div>
      </header>

      <section className={`bottom-panel${logOpen ? ' open' : ''}`}>
        {(phase === 'decide' || phase === 'delegate') && advice ? (
          <DecisionPanel
            key={`${game.log.length}-${phase}`}
            title={decisionTitle}
            advice={advice}
            showCoach={settings.showCoach}
            mode={phase}
            delegateMs={settings.delegateDelay}
            candidates={candidates}
            picked={pickedId}
            onPick={setPickedId}
            onPickCandidate={pickCandidate}
            onDecide={decide}
            onIntervene={() => {
              setIntervened(true)
              setPhase('decide')
            }}
          />
        ) : phase === 'over' ? (
          <div className="over">
            <h2>경기 종료</h2>
            <p>
              {teams.away.short} {game.score.away} : {game.score.home} {teams.home.short}
              {game.endReason === 'rain' && ' · 강우 콜드'}
              {game.endReason === 'walkoff' && ' · 끝내기'}
              {game.endReason === 'tie' && ' · 무승부'}
            </p>
            <button className="game-btn dp-wide" onClick={() => onFinish(game, decisions)}>
              결과와 복기 보기
            </button>
          </div>
        ) : (
          <>
            <button className="log" onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen}>
              {(logOpen ? [...game.log].reverse() : lastLogs).map((l, i) => (
                <p key={l.id} className={`log-line tone-${l.tone}${i === 0 ? ' latest' : ''}`}>
                  {logOpen && <span className="log-inning">{l.inning}회{l.half === 'top' ? '초' : '말'}</span>}
                  {l.text}
                </p>
              ))}
            </button>
            <div className="matchup">
              <span>
                타석 <b>{players[currentBatterId(game)].name}</b>
              </span>
              <span>
                투수 <b>{players[defense(game).pitcherId].name}</b> {game.pitching[defense(game).pitcherId]?.pitches ?? 0}구
              </span>
            </div>
            <div className="controls">
              <button className="round-btn" onClick={() => setPaused((p) => !p)} aria-label={paused ? '계속 진행' : '일시정지'}>
                <PlayIcon playing={!paused} />
              </button>
              <div className="segment dark">
                {SPEEDS.map((s, i) => (
                  <button key={s.label} className={speed === i ? 'on' : ''} onClick={() => setSpeed(i)}>
                    {s.label}
                  </button>
                ))}
              </div>
              <span className="owner-hint">
                공격 {settings.offense === 'me' ? '내가' : '코치'} · 수비 {settings.defense === 'me' ? '내가' : '코치'}
              </span>
            </div>
          </>
        )}
      </section>

      <span className="sr-only">{userTeam.name}</span>
    </div>
  )
}
