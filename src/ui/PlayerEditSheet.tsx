// 선수 한 명 편집: 이름·번호·투타·포지션과 대략적 능력치 구간

import { useMemo, useState } from 'react'
import {
  DEFAULT_HITTER,
  DEFAULT_PITCHER,
  HITTER_SCALE,
  PITCHER_SCALE,
  PLATOON_LABEL,
  toPlayer,
  type CustomPlayer,
  type HitterRatings,
  type Level,
  type PitcherRatings,
  type Platoon,
} from '../data/ratings'
import type { Hand, PitcherRole, Position } from '../data/types'
import { battingTotals, fmtAvg, pitchingTotals } from '../engine/stats'
import './playerCard.css'
import './rosterEdit.css'

const FIELD_POSITIONS: { value: Position; label: string }[] = [
  { value: 'C', label: '포수' },
  { value: '1B', label: '1루' },
  { value: '2B', label: '2루' },
  { value: '3B', label: '3루' },
  { value: 'SS', label: '유격' },
  { value: 'LF', label: '좌익' },
  { value: 'CF', label: '중견' },
  { value: 'RF', label: '우익' },
  { value: 'DH', label: '지명' },
]

const ROLES: { value: PitcherRole; label: string }[] = [
  { value: 'SP', label: '선발' },
  { value: 'RP', label: '불펜' },
  { value: 'CL', label: '마무리' },
]

interface Props {
  teamId: string
  initial: CustomPlayer
  isNew: boolean
  onSave: (p: CustomPlayer) => void
  onDelete: () => void
  onClose: () => void
}

function Steps<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="steps" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const levels = (steps: readonly string[]) => steps.map((label, i) => ({ value: i as Level, label }))
const platoons = [-1, 0, 1].map((v) => ({ value: v as Platoon, label: PLATOON_LABEL[v as Platoon] }))

export function PlayerEditSheet({ teamId, initial, isNew, onSave, onDelete, onClose }: Props) {
  const [p, setP] = useState(initial)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isPitcher = p.position === 'P'
  const set = (patch: Partial<CustomPlayer>) => setP((cur) => ({ ...cur, ...patch }))
  const setH = (patch: Partial<HitterRatings>) => setP((cur) => ({ ...cur, hitter: { ...(cur.hitter ?? DEFAULT_HITTER), ...patch } }))
  const setPi = (patch: Partial<PitcherRatings>) => setP((cur) => ({ ...cur, pitcher: { ...(cur.pitcher ?? DEFAULT_PITCHER), ...patch } }))
  const h = p.hitter ?? DEFAULT_HITTER
  const pi = p.pitcher ?? DEFAULT_PITCHER

  // 고른 구간으로 계산한 예상 성적 미리보기
  const preview = useMemo(() => {
    const player = toPlayer(teamId, p, 0)
    if (isPitcher) {
      const t = pitchingTotals(player)
      return `평균자책점 ${t.era.toFixed(2)} · 탈삼진 ${t.so} · 볼넷 ${t.bb} (${player.role === 'SP' ? '150' : '62'}이닝 기준)`
    }
    const t = battingTotals(player)
    return `타율 ${fmtAvg(t.avg)} · ${t.hr}홈런 · 출루율 ${fmtAvg(t.obp)} · ${t.sb}도루 (550타석 기준)`
  }, [p, teamId, isPitcher])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="player-card edit-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="선수 편집">
        <div className="settings-head">
          <h2>{isNew ? (isPitcher ? '투수 추가' : '타자 추가') : '선수 편집'}</h2>
          <button className="round-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="edit-row two">
          <label>
            <span>이름</span>
            <input value={p.name} maxLength={20} placeholder="찐팬만 아는 이름" onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="num">
            <span>번호</span>
            <input inputMode="numeric" value={p.number} onChange={(e) => set({ number: Math.max(0, Math.min(99, Number(e.target.value.replace(/\D/g, '')) || 0)) })} />
          </label>
        </div>

        {isPitcher ? (
          <div className="edit-row">
            <span className="edit-label">역할</span>
            <Steps value={p.role ?? 'RP'} options={ROLES} onChange={(v) => set({ role: v })} />
          </div>
        ) : (
          <div className="edit-row">
            <span className="edit-label">포지션</span>
            <Steps value={p.position} options={FIELD_POSITIONS} onChange={(v) => set({ position: v })} />
          </div>
        )}

        <div className="edit-row two">
          <div>
            <span className="edit-label">던지는 손</span>
            <Steps<Hand> value={p.throws === 'S' ? 'R' : p.throws} options={[{ value: 'L', label: '좌' }, { value: 'R', label: '우' }]} onChange={(v) => set({ throws: v, ...(isPitcher ? { bats: v } : {}) })} />
          </div>
          {!isPitcher && (
            <div>
              <span className="edit-label">치는 손</span>
              <Steps<Hand> value={p.bats} options={[{ value: 'L', label: '좌' }, { value: 'R', label: '우' }, { value: 'S', label: '양' }]} onChange={(v) => set({ bats: v })} />
            </div>
          )}
        </div>

        <p className="edit-hint">실제 기록을 보고 가장 가까운 구간을 골라 주세요. 정확한 숫자는 넣지 않아요.</p>

        {isPitcher ? (
          <>
            {(['era', 'strikeout', 'walk'] as const).map((k) => (
              <div className="edit-row" key={k}>
                <span className="edit-label">{PITCHER_SCALE[k].label}</span>
                <Steps value={pi[k]} options={levels(PITCHER_SCALE[k].steps)} onChange={(v) => setPi({ [k]: v })} />
              </div>
            ))}
            <div className="edit-row">
              <span className="edit-label">좌타자 상대</span>
              <Steps value={pi.vsLefty} options={platoons} onChange={(v) => setPi({ vsLefty: v })} />
            </div>
          </>
        ) : (
          <>
            {(['avg', 'hr', 'walk', 'strikeout', 'speed'] as const).map((k) => (
              <div className="edit-row" key={k}>
                <span className="edit-label">{HITTER_SCALE[k].label}</span>
                <Steps value={h[k]} options={levels(HITTER_SCALE[k].steps)} onChange={(v) => setH({ [k]: v })} />
              </div>
            ))}
            <div className="edit-row">
              <span className="edit-label">좌투수 상대</span>
              <Steps value={h.vsLefty} options={platoons} onChange={(v) => setH({ vsLefty: v })} />
            </div>
          </>
        )}

        <p className="edit-preview">예상: {preview}</p>

        <div className="btn-row">
          {!isNew && (
            <button className={`game-btn secondary${confirmDelete ? ' danger' : ''}`} onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}>
              {confirmDelete ? '한 번 더 누르면 삭제' : '삭제'}
            </button>
          )}
          <button className="game-btn" onClick={() => onSave({ ...p, name: p.name.trim() })}>
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
