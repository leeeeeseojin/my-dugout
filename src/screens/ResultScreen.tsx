// 경기 결과와 복기: 판단 순간마다 나 · 코치 · 실제 감독(사례)을 나란히 보여준다

import type { Team } from '../data/types'
import { winner, type GameState, type SideKey } from '../engine/game'
import { situationText, type DecisionRecord } from '../engine/review'
import { STYLES, styleMatch } from '../engine/styles'
import { Scene } from '../ui/Scene'
import './screens.css'

interface Props {
  game: GameState
  decisions: DecisionRecord[]
  teams: { home: Team; away: Team }
  onAgain: () => void
  onRecords: () => void
  onHome: () => void
}

export function ResultScreen({ game, decisions, teams, onAgain, onRecords, onHome }: Props) {
  const me = game.userSide
  const opp: SideKey = me === 'home' ? 'away' : 'home'
  const w = winner(game)
  const result = w === null ? 'T' : w === me ? 'W' : 'L'
  const innings = Math.max(game.linescore.away.length, game.linescore.home.length, 9)
  const manual = decisions.filter((d) => !d.delegated)
  const agreed = manual.filter((d) => d.userPickId === d.coachPickId).length

  return (
    <div className="screen">
      <Scene />
      <div className="note">
        <div className="result-head">
          <span className={`stamp ${result}`}>{result === 'W' ? '승리' : result === 'L' ? '패배' : '무승부'}</span>
          <p className="final">
            {teams[me].short} {game.score[me]} : {game.score[opp]} {teams[opp].short}
          </p>
          <small style={{ color: 'var(--ink-soft)' }}>
            {game.endReason === 'rain' && `${game.inning}회 강우 콜드게임`}
            {game.endReason === 'walkoff' && '끝내기로 경기 종료'}
            {game.endReason === 'tie' && '연장 끝 무승부'}
          </small>
        </div>
        <table className="linescore">
          <thead>
            <tr>
              <th />
              {Array.from({ length: innings }, (_, i) => (
                <th key={i}>{i + 1}</th>
              ))}
              <th>R</th>
              <th>H</th>
              <th>E</th>
            </tr>
          </thead>
          <tbody>
            {(['away', 'home'] as SideKey[]).map((k) => (
              <tr key={k}>
                <td>{teams[k].short}</td>
                {Array.from({ length: innings }, (_, i) => (
                  <td key={i}>{game.linescore[k][i] ?? (game.over ? '-' : '')}</td>
                ))}
                <td className="rhe">{game.score[k]}</td>
                <td className="rhe">{game.hits[k]}</td>
                <td className="rhe">{game.errors[k]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="note">
        <h2>판단 복기</h2>
        <p className="note-sub">
          판단 {decisions.length}번
          {manual.length > 0 && ` · 직접 고른 ${manual.length}번 중 코치와 같은 선택 ${agreed}번`}
          {decisions.length - manual.length > 0 && ` · 코치에게 맡김 ${decisions.length - manual.length}번`}
        </p>
        <StyleSummary decisions={decisions} />
        {decisions.length === 0 && <p className="review-note">이번 경기에는 작전을 고른 순간이 없었어요. 설정에서 "매 타석"으로 바꾸면 더 자주 물어봐요.</p>}
        {decisions.map((d) => (
          <ReviewItem key={d.id} d={d} />
        ))}
        <p className="review-note">
          예상 수치는 코치의 시뮬레이션 값이고, 실제 결과는 이번 경기에서 일어난 일이에요. 둘은 다를 수 있어요. 세 AI 감독은 실제 감독이 아니라, 같은 상황을 서로 다른 철학으로 본 가상의 관점이에요. 정답이 아니라 비교를 위한 거예요.
        </p>
      </div>

      <div className="btn-row">
        <button className="game-btn" onClick={onAgain}>
          한 경기 더
        </button>
        <button className="game-btn secondary" onClick={onRecords}>
          기록
        </button>
        <button className="game-btn secondary" onClick={onHome}>
          처음으로
        </button>
      </div>
    </div>
  )
}

function StyleSummary({ decisions }: { decisions: DecisionRecord[] }) {
  const m = styleMatch(decisions)
  if (!m.total) return null
  return (
    <div className="style-summary">
      {m.closest ? (
        <p className="style-closest">
          나와 가장 닮은 감독: <b>{m.closest.name}</b>
          <small>{m.closest.motto}</small>
        </p>
      ) : (
        <p className="style-closest">
          세 AI 감독 누구와도 다른 <b>나만의 스타일</b>
        </p>
      )}
      <div className="style-bars">
        {m.counts.map((c) => (
          <span key={c.style.id}>
            {c.style.name} <b>{c.same}</b>/{m.total}
          </span>
        ))}
      </div>
    </div>
  )
}

function ReviewItem({ d }: { d: DecisionRecord }) {
  const option = (id: string) => d.options.find((o) => o.id === id) ?? d.options[0]
  const mine = option(d.userPickId)
  const coach = option(d.coachPickId)
  const same = mine.id === coach.id
  const runsText = d.runsAfter === null ? '' : d.situation.side === 'offense' ? `이 이닝 ${d.runsAfter}점 냄` : `이 이닝 ${d.runsAfter}점 내줌`
  return (
    <div className="review">
      <div className="review-sit">
        {situationText(d.situation)} · {d.situation.side === 'offense' ? '공격' : '수비'}
      </div>
      <div className="review-grid">
        <span className="who">나</span>
        <span className="me">
          {mine.label}
          {d.delegated && <small style={{ color: 'var(--ink-soft)', fontSize: 12 }}> (코치에게 맡김)</small>}
        </span>
        <span className="val">
          예상 {mine.value}
          {runsText && ` · 실제로는 ${runsText}`}
        </span>

        <span className="who">코치</span>
        <span>
          {coach.label} <small className={same ? 'agree' : 'differ'}>{same ? '같은 선택' : '다른 선택'}</small>
        </span>
        <span className="val">
          예상 {coach.value} · 확신 {d.coachConfidence}
        </span>

        {(d.styles ?? []).map((p) => {
          const style = STYLES.find((s) => s.id === p.id)!
          const o = option(p.optionId)
          return (
            <span key={p.id} className="style-row">
              <span className="who">{style.name.replace('형', '')}</span>
              <span>
                {o.label} {o.id === mine.id && <small className="agree">나와 같음</small>}
                <small className="style-why">{p.reason}</small>
              </span>
              <span className="val">예상 {o.value}</span>
            </span>
          )
        })}
      </div>
      <p className="review-note">{d.metricLabel} 기준 예상치예요.</p>
    </div>
  )
}
