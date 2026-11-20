// 라인업 짜기: 타순 바꾸기, 후보와 바꾸기, 선발 투수 고르기

import { useMemo, useState } from 'react'
import type { Player, Team } from '../data/types'
import type { LineupPlan } from '../engine/lineup'
import { battingTotals, fmtAvg, pitchingTotals } from '../engine/stats'
import { PlayerCard } from '../ui/PlayerCard'
import { Scene } from '../ui/Scene'
import './screens.css'

const POS_LABEL: Record<string, string> = {
  C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수', DH: '지명',
}

interface Props {
  team: Team
  roster: Player[]
  initial: LineupPlan
  onBack: () => void
  onStart: (plan: LineupPlan) => void
}

type Sel = { kind: 'order'; index: number } | { kind: 'bench'; id: string } | null

export function LineupScreen({ team, roster, initial, onBack, onStart }: Props) {
  const [plan, setPlan] = useState(initial)
  const [sel, setSel] = useState<Sel>(null)
  const [cardId, setCardId] = useState<string | null>(null)
  const byId = useMemo(() => Object.fromEntries(roster.map((p) => [p.id, p])), [roster])
  const starters = roster.filter((p) => p.role === 'SP')

  const tapOrder = (index: number) => {
    if (sel?.kind === 'order') {
      if (sel.index !== index) {
        const order = [...plan.order]
        ;[order[sel.index], order[index]] = [order[index], order[sel.index]]
        setPlan({ ...plan, order })
      }
      setSel(null)
    } else if (sel?.kind === 'bench') {
      swapIn(index, sel.id)
    } else setSel({ kind: 'order', index })
  }

  const swapIn = (index: number, benchId: string) => {
    const outId = plan.order[index]
    const pos = plan.fielding[outId]
    const order = [...plan.order]
    order[index] = benchId
    const fielding = { ...plan.fielding }
    delete fielding[outId]
    fielding[benchId] = pos
    setPlan({ ...plan, order, fielding, bench: plan.bench.map((id) => (id === benchId ? outId : id)) })
    setSel(null)
  }

  const tapBench = (id: string) => {
    if (sel?.kind === 'order') swapIn(sel.index, id)
    else setSel(sel?.kind === 'bench' && sel.id === id ? null : { kind: 'bench', id })
  }

  const hint = sel?.kind === 'order' ? '바꿀 타순이나 후보 선수를 누르세요' : sel?.kind === 'bench' ? '들어갈 타순을 누르세요' : '선수를 누르면 자리를 바꿀 수 있어요'

  return (
    <div className="screen">
      <Scene />
      <div className="top-bar">
        <button className="round-btn" onClick={onBack} aria-label="뒤로">
          ‹
        </button>
        <h1 className="title-text">{team.short} 라인업</h1>
      </div>

      <div className="note">
        <h2>타순</h2>
        <p className="note-sub">{hint}</p>
        {plan.order.map((id, i) => {
          const p = byId[id]
          const t = battingTotals(p)
          const pos = plan.fielding[id]
          const offPos = pos !== 'DH' && !p.positions.includes(pos)
          return (
            <div key={id} className={`lineup-row${sel?.kind === 'order' && sel.index === i ? ' selected' : ''}`}>
              <button className="lineup-row" style={{ border: 'none', flex: 1 }} onClick={() => tapOrder(i)}>
                <span className="order">{i + 1}</span>
                <span className="lr-name">{p.name}</span>
                <span className={`lr-pos${offPos ? ' lr-warn' : ''}`}>{POS_LABEL[pos]}{offPos ? ' (낯섦)' : ''}</span>
                <span className="lr-stat">
                  {fmtAvg(t.avg)} · {t.hr}홈런
                </span>
              </button>
              <button className="info-btn" onClick={() => setCardId(id)} aria-label={`${p.name} 선수 카드`}>
                i
              </button>
            </div>
          )
        })}
      </div>

      <div className="note">
        <h2>후보</h2>
        <p className="note-sub">경기 중 대타로 쓸 수 있어요</p>
        {plan.bench.map((id) => {
          const p = byId[id]
          const t = battingTotals(p)
          return (
            <div key={id} className={`lineup-row${sel?.kind === 'bench' && sel.id === id ? ' selected' : ''}`}>
              <button className="lineup-row" style={{ border: 'none', flex: 1 }} onClick={() => tapBench(id)}>
                <span className="order" style={{ background: 'var(--ink-soft)' }}>-</span>
                <span className="lr-name">{p.name}</span>
                <span className="lr-pos">{POS_LABEL[p.position]}</span>
                <span className="lr-stat">
                  {fmtAvg(t.avg)} · {p.bats === 'L' ? '좌타' : p.bats === 'S' ? '양타' : '우타'}
                </span>
              </button>
              <button className="info-btn" onClick={() => setCardId(id)} aria-label={`${p.name} 선수 카드`}>
                i
              </button>
            </div>
          )
        })}
      </div>

      <div className="note">
        <h2>선발 투수</h2>
        <div className="chips">
          {starters.map((p) => {
            const t = pitchingTotals(p)
            return (
              <button key={p.id} className={`chip${plan.starterId === p.id ? ' on' : ''}`} onClick={() => setPlan({ ...plan, starterId: p.id })} onDoubleClick={() => setCardId(p.id)}>
                {p.name}
                <small>
                  {p.throws === 'L' ? '좌완' : '우완'} · ERA {t.era.toFixed(2)}
                </small>
              </button>
            )
          })}
        </div>
        <p className="note-sub" style={{ marginTop: 8 }}>
          불펜 {roster.filter((p) => p.role === 'RP').length}명과 마무리 1명은 경기 중에 쓸 수 있어요
        </p>
      </div>

      <div className="sticky-start">
        <button className="game-btn" onClick={() => onStart(plan)}>
          플레이볼!
        </button>
      </div>

      {cardId && <PlayerCard player={byId[cardId]} team={team} onClose={() => setCardId(null)} />}
    </div>
  )
}
