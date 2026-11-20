// 선수 카드: 오늘 기록, 통산, 최근 시즌, 좌우 상대 기록

import type { Player, Team } from '../data/types'
import { staminaOf, type GameState } from '../engine/game'
import { battingTotals, fmtAvg, pitchingTotals, seasonAvg, splitAvg } from '../engine/stats'
import { Character } from './Character'
import './playerCard.css'

const POS_LABEL: Record<string, string> = {
  P: '투수', C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수', DH: '지명타자',
}
const ROLE_LABEL = { SP: '선발', RP: '불펜', CL: '마무리' }
const HAND = { L: '좌', R: '우', S: '양' }

interface Props {
  player: Player
  team: Team
  game?: GameState
  onClose: () => void
}

function sumSplits<T extends { pa?: number; bf?: number; h: number; bb: number; hr: number; so: number }>(rows: T[]) {
  return rows.reduce((a, s) => ({ pa: a.pa + (s.pa ?? s.bf ?? 0), h: a.h + s.h, bb: a.bb + s.bb, hr: a.hr + s.hr, so: a.so + s.so }), { pa: 0, h: 0, bb: 0, hr: 0, so: 0 })
}

export function PlayerCard({ player, team, game, onClose }: Props) {
  const isPitcher = player.position === 'P'
  const debut = (isPitcher ? player.pitching : player.batting)[0]?.year
  const today = game?.batting[player.id]
  const todayP = game?.pitching[player.id]

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="player-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${player.name} 선수 카드`}>
        <div className="pc-head" style={{ background: team.color }}>
          <svg className="pc-avatar" viewBox="-24 -52 48 60" width={72} height={90} aria-hidden>
            <Character jersey={team.color} cap={team.accent === '#ffffff' ? team.color : team.accent} skin={player.look.skin} hair={player.look.hair} facing="down" pose={isPitcher ? 'pitch' : 'stand'} />
          </svg>
          <div className="pc-title">
            <span className="pc-number">No.{player.number}</span>
            <h2>{player.name}</h2>
            <span className="pc-sub">
              {team.short} · {isPitcher ? ROLE_LABEL[player.role ?? 'RP'] + ' ' : ''}
              {POS_LABEL[player.position]} · {HAND[player.throws]}투{HAND[player.bats]}타 · {player.custom ? '직접 만든 선수' : `${debut}년 데뷔`}
            </span>
          </div>
          <button className="pc-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {isPitcher ? <PitcherBody player={player} todayLine={todayP} /> : <HitterBody player={player} todayLine={today} />}
      </div>
    </div>
  )
}

function HitterBody({ player, todayLine }: { player: Player; todayLine?: GameState['batting'][string] }) {
  const t = battingTotals(player)
  const vsL = sumSplits(player.batting.map((s) => s.vsL))
  const vsR = sumSplits(player.batting.map((s) => s.vsR))
  const recent = player.batting.slice(-5).reverse()
  return (
    <div className="pc-body">
      {todayLine && todayLine.pa > 0 && (
        <p className="pc-today">
          오늘 {todayLine.ab}타수 {todayLine.h}안타{todayLine.hr ? ` ${todayLine.hr}홈런` : ''}{todayLine.rbi ? ` ${todayLine.rbi}타점` : ''}{todayLine.bb ? ` ${todayLine.bb}볼넷` : ''}
        </p>
      )}
      <div className="pc-stats">
        <Stat label={player.custom ? '예상 타율' : '통산 타율'} value={fmtAvg(t.avg)} />
        <Stat label="홈런" value={t.hr} />
        <Stat label="출루율" value={fmtAvg(t.obp)} />
        <Stat label="장타율" value={fmtAvg(t.slg)} />
        <Stat label="도루" value={t.sb} />
      </div>
      <div className="pc-split">
        <span>좌투수 상대 <b>{fmtAvg(splitAvg(vsL))}</b> {!player.custom && <small>{vsL.pa}타석</small>}</span>
        <span>우투수 상대 <b>{fmtAvg(splitAvg(vsR))}</b> {!player.custom && <small>{vsR.pa}타석</small>}</span>
      </div>
      {player.custom ? (
        <p className="pc-note">직접 매긴 대략적 능력치로 계산한 예상 성적이에요. 실제 기록이 아니에요.</p>
      ) : (
        <table className="pc-table">
          <thead>
            <tr>
              <th>시즌</th>
              <th>타석</th>
              <th>타율</th>
              <th>홈런</th>
              <th>볼넷</th>
              <th>삼진</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((s) => (
              <tr key={s.year}>
                <td>{s.year}</td>
                <td>{s.pa}</td>
                <td>{fmtAvg(seasonAvg(s))}</td>
                <td>{s.hr}</td>
                <td>{s.bb}</td>
                <td>{s.so}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {player.batting.length > 5 && <p className="pc-note">최근 5시즌만 표시 · 통산은 {player.batting.length}시즌 합계</p>}
    </div>
  )
}

function PitcherBody({ player, todayLine }: { player: Player; todayLine?: GameState['pitching'][string] }) {
  const t = pitchingTotals(player)
  const vsL = sumSplits(player.pitching.map((s) => s.vsL))
  const vsR = sumSplits(player.pitching.map((s) => s.vsR))
  const recent = player.pitching.slice(-5).reverse()
  const stamina = staminaOf(player)
  const used = todayLine?.pitches ?? 0
  const left = Math.max(0, 1 - used / stamina)
  return (
    <div className="pc-body">
      {todayLine && todayLine.bf > 0 && (
        <>
          <p className="pc-today">
            오늘 {Math.floor(todayLine.outs / 3)}{todayLine.outs % 3 ? `⅓⅔`[todayLine.outs % 3 - 1] : ''}이닝 {todayLine.r}실점 {todayLine.so}탈삼진 · {used}구
          </p>
          <div className="pc-stamina" aria-label={`남은 체력 ${Math.round(left * 100)}%`}>
            <span style={{ width: `${left * 100}%`, background: left > 0.4 ? '#5cb85c' : left > 0.15 ? '#f2b233' : '#e85d4f' }} />
          </div>
        </>
      )}
      <div className="pc-stats">
        <Stat label={player.custom ? '예상 ERA' : '통산 ERA'} value={t.era.toFixed(2)} />
        <Stat label="승패" value={`${t.w}-${t.l}`} />
        <Stat label="세이브" value={t.sv} />
        <Stat label="WHIP" value={t.whip.toFixed(2)} />
        <Stat label="탈삼진" value={t.so} />
      </div>
      <div className="pc-split">
        <span>좌타자 피안타율 <b>{fmtAvg(splitAvg(vsL))}</b> {!player.custom && <small>{vsL.pa}타자</small>}</span>
        <span>우타자 피안타율 <b>{fmtAvg(splitAvg(vsR))}</b> {!player.custom && <small>{vsR.pa}타자</small>}</span>
      </div>
      {player.custom ? (
        <p className="pc-note">직접 매긴 대략적 능력치로 계산한 예상 성적이에요. 실제 기록이 아니에요.</p>
      ) : (
        <table className="pc-table">
          <thead>
            <tr>
              <th>시즌</th>
              <th>경기</th>
              <th>이닝</th>
              <th>ERA</th>
              <th>삼진</th>
              <th>볼넷</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((s) => (
              <tr key={s.year}>
                <td>{s.year}</td>
                <td>{s.g}</td>
                <td>{Math.round(s.ip)}</td>
                <td>{s.ip ? ((s.er * 9) / s.ip).toFixed(2) : '-'}</td>
                <td>{s.so}</td>
                <td>{s.bb}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {player.pitching.length > 5 && <p className="pc-note">최근 5시즌만 표시 · 통산은 {player.pitching.length}시즌 합계</p>}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="pc-stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  )
}
