// 로스터 편집: 구단별로 선수 이름과 대략적 능력치를 직접 채운다

import { useRef, useState } from 'react'
import { FAN_ROSTER_WARNING, fanRoster } from '../data/fanRosters'
import { DEFAULT_HITTER, DEFAULT_PITCHER, HITTER_SCALE, PITCHER_SCALE, fromPlayer, type CustomPlayer } from '../data/ratings'
import { sampleRepository } from '../data/sampleRoster'
import { TEAMS, getTeam } from '../data/teams'
import { checkRoster, exportRosters, parseRosterFile, type CustomRoster, type RosterMap } from '../storage/rosters'
import { BackIcon } from '../ui/icons'
import { PlayerEditSheet } from '../ui/PlayerEditSheet'
import { Scene } from '../ui/Scene'
import '../ui/rosterEdit.css'
import './screens.css'

interface Props {
  rosters: RosterMap
  onChange: (map: RosterMap) => void
  onBack: () => void
}

const POS_LABEL: Record<string, string> = { C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수', DH: '지명' }
const ROLE_LABEL = { SP: '선발', RP: '불펜', CL: '마무리' }

let idSeq = 0
const newId = () => `${Date.now().toString(36)}${(idSeq++).toString(36)}`

export function RosterScreen({ rosters, onChange, onBack }: Props) {
  const [teamId, setTeamId] = useState<string | null>(null)
  const [fileMsg, setFileMsg] = useState<{ text: string; error?: boolean } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const download = () => {
    const list = Object.values(rosters)
    if (!list.length) {
      setFileMsg({ text: '아직 직접 만든 로스터가 없어요', error: true })
      return
    }
    const blob = new Blob([exportRosters(list)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'my-dugout-rosters.json'
    a.click()
    URL.revokeObjectURL(url)
    setFileMsg({ text: `${list.length}팀 로스터를 파일로 저장했어요` })
  }

  const upload = async (file: File) => {
    try {
      const loaded = parseRosterFile(await file.text(), TEAMS.map((t) => t.id))
      const next = { ...rosters }
      for (const r of loaded) next[r.teamId] = r
      onChange(next)
      setFileMsg({ text: `${loaded.map((r) => getTeam(r.teamId).short).join(', ')} 로스터를 불러왔어요` })
    } catch (e) {
      setFileMsg({ text: e instanceof Error ? e.message : '파일을 읽지 못했어요', error: true })
    }
  }

  if (teamId) {
    return (
      <TeamRoster
        teamId={teamId}
        roster={rosters[teamId]}
        onChange={(r) => {
          const next = { ...rosters }
          if (r) next[teamId] = r
          else delete next[teamId]
          onChange(next)
        }}
        onBack={() => setTeamId(null)}
      />
    )
  }

  return (
    <div className="screen">
      <Scene />
      <div className="top-bar">
        <button className="round-btn" onClick={onBack} aria-label="뒤로">
          <BackIcon />
        </button>
        <h1 className="title-text">로스터 편집</h1>
      </div>
      <p className="notice">
        선수 이름과 능력치를 직접 채워요. 실제 기록을 보고 가장 가까운 구간을 고르면 돼요. 직접 만든 로스터는 이 기기에만 저장되고, 만들지 않은 구단은 가상의 선수로 경기해요.
      </p>

      <div className="note">
        <h2>구단</h2>
        {TEAMS.map((t) => {
          const r = rosters[t.id]
          const check = r ? checkRoster(r.players) : null
          return (
            <button key={t.id} className="roster-row" onClick={() => setTeamId(t.id)}>
              <span className="order" style={{ background: t.color }} />
              <span className="rr-name">
                {t.name}
                <small>{r ? `타자 ${check!.counts.hitters} · 투수 ${check!.counts.starters + check!.counts.bullpen}` : '가상의 선수'}</small>
              </span>
              <span className={`rr-tag${check?.ok ? ' mine' : check ? ' warn' : ''}`}>{check?.ok ? '내 로스터' : check ? '채우는 중' : '만들기 ›'}</span>
            </button>
          )
        })}
      </div>

      <div className="note">
        <h2>파일</h2>
        <p className="note-sub">다른 기기로 옮기거나 친구와 주고받을 때 써요. 실명 로스터 파일을 공개된 곳에 올리지는 말아 주세요.</p>
        <div className="btn-row" style={{ marginTop: 6 }}>
          <button className="game-btn secondary" onClick={download}>
            로스터 파일로 저장
          </button>
          <button className="game-btn secondary" onClick={() => fileInput.current?.click()}>
            로스터 파일 불러오기
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
            e.target.value = ''
          }}
        />
        {fileMsg && <p className={`file-msg${fileMsg.error ? ' error' : ''}`}>{fileMsg.text}</p>}
      </div>
    </div>
  )
}

function summary(p: CustomPlayer) {
  if (p.position === 'P') {
    const r = p.pitcher ?? DEFAULT_PITCHER
    return `${ROLE_LABEL[p.role ?? 'RP']} · ${p.throws === 'L' ? '좌완' : '우완'} · 평균자책점 ${PITCHER_SCALE.era.steps[r.era]}`
  }
  const r = p.hitter ?? DEFAULT_HITTER
  return `${POS_LABEL[p.position]} · 타율 ${HITTER_SCALE.avg.steps[r.avg]} · 홈런 ${HITTER_SCALE.hr.steps[r.hr]}`
}

function TeamRoster({ teamId, roster, onChange, onBack }: { teamId: string; roster?: CustomRoster; onChange: (r: CustomRoster | null) => void; onBack: () => void }) {
  const team = getTeam(teamId)
  const [editing, setEditing] = useState<{ player: CustomPlayer; isNew: boolean } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [aiStep, setAiStep] = useState<'idle' | 'warn'>('idle')

  const save = (players: CustomPlayer[]) => onChange({ teamId, updatedAt: new Date().toISOString(), players })

  if (!roster) {
    return (
      <div className="screen centered">
        <Scene />
        <div className="center-block">
          <div className="top-bar">
            <button className="round-btn" onClick={onBack} aria-label="뒤로">
              <BackIcon />
            </button>
            <h1 className="title-text">{team.short} 로스터</h1>
          </div>
          <div className="note">
            <h2>어떻게 시작할까요?</h2>
            <p className="note-sub">가상 선수로 시작하면 25명이 이미 채워져 있어서, 이름과 능력치만 바꾸면 돼요.</p>
            <div className="btn-row">
              <button className="game-btn" onClick={() => save(sampleRepository.getRoster(teamId).map(fromPlayer))}>
                가상 선수로 시작
              </button>
              <button className="game-btn secondary" onClick={() => save([])}>
                빈 로스터
              </button>
            </div>
          </div>

          <div className="note">
            {aiStep === 'idle' ? (
              <button className="add-btn" onClick={() => setAiStep('warn')}>
                AI 초안 불러오기
              </button>
            ) : (
              <div className="ai-warn" role="alert">
                <h2>AI 초안을 불러올까요?</h2>
                <p>{FAN_ROSTER_WARNING}</p>
                <div className="btn-row">
                  <button className="game-btn secondary" onClick={() => setAiStep('idle')}>
                    그만두기
                  </button>
                  <button className="game-btn danger" onClick={() => save(fanRoster(teamId))}>
                    불러오기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const check = checkRoster(roster.players)
  const hitters = roster.players.filter((p) => p.position !== 'P')
  const pitchers = roster.players.filter((p) => p.position === 'P').sort((a, b) => ['SP', 'RP', 'CL'].indexOf(a.role ?? 'RP') - ['SP', 'RP', 'CL'].indexOf(b.role ?? 'RP'))

  const add = (pitcher: boolean) =>
    setEditing({
      isNew: true,
      player: pitcher
        ? { id: newId(), name: '', number: 0, bats: 'R', throws: 'R', position: 'P', role: 'RP', pitcher: { ...DEFAULT_PITCHER } }
        : { id: newId(), name: '', number: 0, bats: 'R', throws: 'R', position: 'LF', hitter: { ...DEFAULT_HITTER } },
    })

  const row = (p: CustomPlayer) => (
    <button key={p.id} className="roster-row" onClick={() => setEditing({ player: p, isNew: false })} data-opener={`player-${p.id}`}>
      <span className="order">{p.number}</span>
      <span className="rr-name">
        {p.name || '이름 없음'}
        <small>
          {summary(p)}
          {p.ratedBy === 'ai' && <span className="ai-tag"> · AI 등급</span>}
        </small>
      </span>
      <span className="rr-tag">›</span>
    </button>
  )

  // 시트가 열린 동안에는 뒤쪽 버튼을 그리지 않고 배경 그림만 남긴다
  if (editing) {
    return (
      <div className="screen">
        <Scene />
        <PlayerEditSheet
          teamId={teamId}
          initial={editing.player}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onDelete={() => {
            save(roster.players.filter((p) => p.id !== editing.player.id))
            setEditing(null)
          }}
          onSave={(p) => {
            const exists = roster.players.some((x) => x.id === p.id)
            save(exists ? roster.players.map((x) => (x.id === p.id ? p : x)) : [...roster.players, p])
            setEditing(null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="screen">
      <Scene />
      <div className="top-bar">
        <button className="round-btn" onClick={onBack} aria-label="뒤로">
          <BackIcon />
        </button>
        <h1 className="title-text">{team.short} 로스터</h1>
      </div>

      <div className="note">
        {check.ok ? (
          <p className="status-ok">경기에 쓸 수 있어요 · 타자 {check.counts.hitters} · 투수 {check.counts.starters + check.counts.bullpen}</p>
        ) : (
          <>
            <p className="status-ok" style={{ color: '#b9661e' }}>
              아직 경기에 못 써요
            </p>
            {check.problems.map((t) => (
              <p key={t} className="status-warn">
                · {t}
              </p>
            ))}
          </>
        )}
      </div>

      <div className="note">
        <h2>타자 {hitters.length}</h2>
        {hitters.map(row)}
        <button className="add-btn" onClick={() => add(false)} data-opener="add-hitter">
          + 타자 추가
        </button>
      </div>

      <div className="note">
        <h2>투수 {pitchers.length}</h2>
        {pitchers.map(row)}
        <button className="add-btn" onClick={() => add(true)} data-opener="add-pitcher">
          + 투수 추가
        </button>
      </div>

      <div className="btn-row">
        <button className={`game-btn secondary${confirmReset ? ' danger' : ''}`} onClick={() => (confirmReset ? onChange(null) : setConfirmReset(true))}>
          {confirmReset ? '한 번 더 누르면 가상 선수로 되돌려요' : '가상 선수로 되돌리기'}
        </button>
      </div>
    </div>
  )
}
