// 경기 결과와 복기: 판단 순간마다 나 · 코치 · 실제 감독(사례)을 나란히 보여준다

import { CASE_SOURCE_LABEL, sampleCases } from '../data/sampleCases'
import type { Team } from '../data/types'
import { winner, type GameState, type SideKey } from '../engine/game'
import { ACTION_LABEL, findSimilarCases, similarityLabel, situationText, type DecisionRecord } from '../engine/review'
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
        {decisions.length === 0 && <p className="review-note">이번 경기에는 작전을 고른 순간이 없었어요. 설정에서 "매 타석"으로 바꾸면 더 자주 물어봐요.</p>}
        {decisions.map((d) => (
          <ReviewItem key={d.id} d={d} />
        ))}
        <p className="review-note">
          예상 수치는 코치의 시뮬레이션 값이고, 실제 결과는 이번 경기에서 일어난 일이에요. 둘은 다를 수 있어요. 실제 감독 칸은 {CASE_SOURCE_LABEL}이며, 감독의 의도가 아니라 실제로 한 행동만 보여줘요.
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

function ReviewItem({ d }: { d: DecisionRecord }) {
  const mine = d.options.find((o) => o.id === d.userPickId)!
  const coach = d.options.find((o) => o.id === d.coachPickId)!
  const same = mine.id === coach.id
  const match = findSimilarCases(d.situation, sampleCases())
  const runsText = d.runsAfter === null ? '' : d.situation.side === 'offense' ? `이 이닝 ${d.runsAfter}점 냄` : `이 이닝 ${d.runsAfter}점 내줌`
  const total = match ? match.cases.length : 0
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
        <span className="val">{runsText}</span>

        <span className="who">코치</span>
        <span>
          {coach.label} <small className={same ? 'agree' : 'differ'}>{same ? '같은 선택' : '다른 선택'}</small>
        </span>
        <span className="val">
          예상 {coach.value} · 확신 {d.coachConfidence}
        </span>

        <span className="who">실제</span>
        {match ? (
          <span>
            {match.counts.map((c) => `${ACTION_LABEL[c.action]} ${c.count}`).join(' · ')}
            <small style={{ display: 'block', color: 'var(--ink-soft)', fontSize: 11 }}>
              {match.counts.map((c) => `${ACTION_LABEL[c.action]} 뒤 평균 ${c.avgRuns.toFixed(1)}점`).join(' · ')}
            </small>
          </span>
        ) : (
          <span style={{ color: 'var(--ink-soft)' }}>조건에 맞는 실제 사례 없음</span>
        )}
        <span className="val">{match ? `${total}경기 · ${similarityLabel(match.similarity)}` : ''}</span>
      </div>
      {!same && !d.delegated && (
        <p className="review-note">
          내 선택 예상 {mine.value} · 코치 선택 예상 {coach.value} ({d.metricLabel})
        </p>
      )}
    </div>
  )
}
