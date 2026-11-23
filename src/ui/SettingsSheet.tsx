// 경기 운영 방식 설정: 경기 중 언제든 바꿀 수 있다

import type { PlaySettings } from '../storage/settings'
import { Sheet } from './Sheet'
import './playerCard.css'

interface Props {
  settings: PlaySettings
  onChange: (s: PlaySettings) => void
  onClose: () => void
}

// 고른 값이 색으로만 보이면 화면을 읽는 쪽(스크린 리더, AI 에이전트)은 무엇이 골라졌는지 모른다.
function Segment<T extends string | boolean>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segment" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} className={value === o.value ? 'on' : ''} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SettingsSheet({ settings, onChange, onClose }: Props) {
  const set = (patch: Partial<PlaySettings>) => onChange({ ...settings, ...patch })
  return (
    <Sheet className="player-card settings" label="경기 운영 설정" onClose={onClose}>
        <div className="settings-head">
          <h2>운영 방식</h2>
          <button className="round-btn" onClick={onClose} aria-label="설정 닫기">
            ✕
          </button>
        </div>
        <div className="settings-row">
          <div>
            <b>공격 작전</b>
            <span>번트, 도루, 대타</span>
          </div>
          <Segment label="공격 작전" value={settings.offense} options={[{ value: 'me', label: '내가' }, { value: 'coach', label: '코치에게' }]} onChange={(v) => set({ offense: v })} />
        </div>
        <div className="settings-row">
          <div>
            <b>투수·수비</b>
            <span>투수 교체, 고의사구, 전진 수비</span>
          </div>
          <Segment label="투수·수비" value={settings.defense} options={[{ value: 'me', label: '내가' }, { value: 'coach', label: '코치에게' }]} onChange={(v) => set({ defense: v })} />
        </div>
        <div className="settings-row">
          <div>
            <b>물어보는 때</b>
            <span>내가 정하는 영역에서</span>
          </div>
          <Segment label="물어보는 때" value={settings.ask} options={[{ value: 'key', label: '중요할 때' }, { value: 'every', label: '매 타석' }]} onChange={(v) => set({ ask: v })} />
        </div>
        <div className="settings-row">
          <div>
            <b>코치 추천</b>
            <span>꺼도 작전별 예상 효과는 보여요</span>
          </div>
          <Segment label="코치 추천" value={settings.showCoach} options={[{ value: true, label: '보기' }, { value: false, label: '숨기기' }]} onChange={(v) => set({ showCoach: v })} />
        </div>
        <p className="settings-note">코치에게 맡긴 영역도 실행 전에 잠깐 기다려요. 그 사이에 언제든 끼어들 수 있어요.</p>
    </Sheet>
  )
}
