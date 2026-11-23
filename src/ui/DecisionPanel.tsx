// 작전 결정 패널
// - 지금 고를 수 있는 작전만 보여주고, 작전마다 예상 효과를 붙인다 (AI를 꺼도 유지)
// - 코치 추천은 미리 골라져 있을 뿐, 결정 버튼은 사용자가 누른다
// - 코치에게 맡긴 영역은 실행 전 잠깐 기다리며 그 사이에 끼어들 수 있다

import { useEffect, useState } from 'react'
import type { Player } from '../data/types'
import { formatOptionValue, type CoachAdvice } from '../engine/coach'

export interface Candidate {
  player: Player
  note: string
}

interface Props {
  title: string
  advice: CoachAdvice
  showCoach: boolean
  mode: 'decide' | 'delegate'
  delegateMs: number
  candidates: Candidate[]
  /** 지금 골라 둔 작전. 시트를 여닫느라 패널이 다시 그려져도 남도록 바깥에서 들고 있다. 없으면 기본값 */
  picked: string | null
  onPick: (optionId: string) => void
  onPickCandidate: (id: string) => void
  onDecide: (optionId: string) => void
  onIntervene: () => void
}

const CONF_COLOR = { 높음: '#7ed38a', 중간: '#f2c35b', 낮음: '#ff9f8f' }

export function DecisionPanel(props: Props) {
  const { title, advice, showCoach, mode, delegateMs, candidates, onPick, onPickCandidate, onDecide, onIntervene } = props
  const picked = props.picked ?? (showCoach ? advice.recommendedId : advice.options[0].id)
  const [why, setWhy] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const recommended = advice.options.find((o) => o.id === advice.recommendedId)!

  useEffect(() => {
    if (mode !== 'delegate') return
    const t = setTimeout(() => onDecide(advice.recommendedId), delegateMs)
    return () => clearTimeout(t)
  }, [mode, delegateMs, advice.recommendedId, onDecide])

  const otherLabel = advice.side === 'offense' ? '다른 대타 고르기' : '다른 투수 고르기'

  if (mode === 'delegate') {
    return (
      <div className="decision">
        <div className="dp-title">{title}</div>
        <div className="coach-line">
          <span>코치가 결정했어요: <b>{recommended.label}</b></span>
          <span className="dp-soft">{advice.reasons[0]}</span>
        </div>
        <div className="countdown" aria-hidden>
          <span style={{ animationDuration: `${delegateMs}ms` }} />
        </div>
        <button className="game-btn secondary dp-wide" onClick={onIntervene}>
          잠깐, 내가 고를게요
        </button>
      </div>
    )
  }

  return (
    <div className="decision">
      <div className="dp-title">{title}</div>

      {showCoach && (
        <div className="coach-line">
          <span>
            코치: <b>{recommended.label}</b> 추천
            <span className="conf" style={{ color: CONF_COLOR[advice.confidence] }}>
              {' '}· 확신 {advice.confidence}
            </span>
          </span>
          <span className="dp-soft">{advice.reasons[0]}</span>
          {why && (
            <div className="why">
              {advice.reasons.slice(1).map((r) => (
                <span key={r} className="dp-soft">· {r}</span>
              ))}
              {advice.limits.map((l) => (
                <span key={l} className="dp-limit">한계 · {l}</span>
              ))}
            </div>
          )}
          <button className="why-btn" onClick={() => setWhy((w) => !w)}>
            {why ? '접기' : '근거와 한계 보기'}
          </button>
        </div>
      )}

      <div className="dp-metric">{advice.metricLabel}</div>
      <div role="radiogroup" aria-label="작전 선택">
        {advice.options.map((o) => (
          <button key={o.id} role="radio" aria-checked={picked === o.id} className={`dp-opt${picked === o.id ? ' on' : ''}`} onClick={() => onPick(o.id)}>
            <span className="dot" />
            <span className="dp-label">
              {o.label}
              {showCoach && o.id === advice.recommendedId && <span className="coach-tag">코치</span>}
            </span>
            <span className="dp-value">{formatOptionValue(advice, o)}</span>
          </button>
        ))}
        {candidates.length > 0 && (
          <button className="dp-opt more" onClick={() => setChoosing((c) => !c)}>
            <span className="dot hollow" />
            <span className="dp-label">{otherLabel}</span>
            <span className="dp-value">{choosing ? '닫기' : '›'}</span>
          </button>
        )}
        {choosing && (
          <div className="cand-list">
            {candidates.map((c) => (
              <button
                key={c.player.id}
                className="cand"
                onClick={() => {
                  onPickCandidate(c.player.id)
                  setChoosing(false)
                }}
              >
                <span>{c.player.name}</span>
                <span className="dp-soft">{c.note}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button className="game-btn dp-wide" onClick={() => onDecide(picked)}>
        결정
      </button>
    </div>
  )
}
