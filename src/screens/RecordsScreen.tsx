// 지금까지 기록: 구단별 카드와 전체 성적, 최근 경기

import { getTeam } from '../data/teams'
import { loadRecords, summarize } from '../storage/records'
import { Character } from '../ui/Character'
import { Scene } from '../ui/Scene'
import './screens.css'

export function RecordsScreen({ onBack }: { onBack: () => void }) {
  const records = loadRecords()
  const sum = summarize(records)

  return (
    <div className="screen">
      <Scene />
      <div className="top-bar">
        <button className="round-btn" onClick={onBack} aria-label="뒤로">
          ‹
        </button>
        <h1 className="title-text">지금까지 기록</h1>
      </div>

      {records.length === 0 ? (
        <div className="empty">
          <p>아직 치른 경기가 없어요. 첫 경기를 시작해 보세요!</p>
          <button className="game-btn" onClick={onBack}>
            돌아가기
          </button>
        </div>
      ) : (
        <>
          <div className="record-cards">
            {sum.byTeam.map((t, i) => {
              const team = getTeam(t.teamId)
              return (
                <div key={t.teamId} className="record-card">
                  <span className="rank">{i + 1}</span>
                  <svg className="rc-scene" viewBox="-40 -60 80 70" preserveAspectRatio="xMidYMid meet" aria-hidden>
                    <rect x={-60} y={-80} width={120} height={120} fill="#8fcf86" />
                    <path d="M -60 -6 Q 0 -30 60 -6 L 60 30 L -60 30 Z" fill="#d9a066" />
                    <Character jersey={team.color} cap={team.accent === '#ffffff' ? team.color : team.accent} skin="#f2c7a5" hair="#2b2a26" facing="down" pose="bat-r" />
                  </svg>
                  <span className="rc-name">{team.short}</span>
                  <div className="rc-foot">
                    <span>
                      {t.w}
                      <small>승</small>
                    </span>
                    <span>
                      {t.games}
                      <small>경기</small>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="note">
            <div className="big-stats">
              <div>
                <b>
                  {sum.wins}-{sum.losses}
                </b>
                <span>승-패</span>
              </div>
              <div>
                <b>{sum.wins + sum.losses ? (sum.wins / (sum.wins + sum.losses)).toFixed(3).replace(/^0/, '') : '-'}</b>
                <span>승률</span>
              </div>
              <div>
                <b>{sum.agreeRate === null ? '-' : `${Math.round(sum.agreeRate * 100)}%`}</b>
                <span>코치와 같은 선택</span>
              </div>
              <div>
                <b>{sum.walkoffs}</b>
                <span>끝내기 승</span>
              </div>
              <div>
                <b>{sum.rainGames}</b>
                <span>비 온 경기</span>
              </div>
              <div>
                <b>{sum.games}</b>
                <span>전체 경기</span>
              </div>
            </div>
          </div>

          <div className="note">
            <h2>최근 경기</h2>
            {records.slice(0, 10).map((r) => (
              <div key={r.id} className="recent-row">
                <span className={`res ${r.result}`}>{r.result === 'W' ? '승' : r.result === 'L' ? '패' : '무'}</span>
                <div className="rr-main">
                  {getTeam(r.myTeamId).short} {r.myScore} : {r.oppScore} {getTeam(r.oppTeamId).short}
                  <div className="rr-sub">
                    {new Date(r.playedAt).toLocaleDateString('ko-KR')} · 판단 {r.decisions}번
                    {r.endReason === 'rain' ? ' · 강우 콜드' : r.rained ? ' · 비' : ''}
                    {r.endReason === 'walkoff' ? ' · 끝내기' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
