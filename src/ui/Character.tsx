// 선수 캐릭터: 둥근 머리와 모자, 유니폼 색만으로 표현하는 납작한 그림
// 기준점(0,0)은 발 아래 그림자 중심이다.

interface Props {
  jersey: string
  cap: string
  skin: string
  hair: string
  pose?: 'stand' | 'bat-r' | 'bat-l' | 'pitch' | 'crouch' | 'run'
  facing?: 'up' | 'down'
  highlight?: boolean
}

export function Character({ jersey, cap, skin, hair, pose = 'stand', facing = 'up', highlight }: Props) {
  const back = facing === 'up'
  const crouch = pose === 'crouch'
  const bodyY = crouch ? -22 : -28
  return (
    <g>
      <ellipse cx={0} cy={0} rx={11} ry={4} fill="rgba(20,40,20,0.25)" />
      {highlight && <ellipse cx={0} cy={0} rx={15} ry={6} fill="none" stroke="#f2b233" strokeWidth={2.5} />}
      {/* 다리 */}
      {!crouch && (
        <g fill="#f4efe2" stroke="rgba(0,0,0,0.08)">
          <rect x={-6} y={-12} width={5} height={12} rx={2} transform={pose === 'run' ? 'rotate(18 -3 -12)' : undefined} />
          <rect x={1} y={-12} width={5} height={12} rx={2} transform={pose === 'run' ? 'rotate(-18 3 -12)' : undefined} />
        </g>
      )}
      {crouch && <rect x={-9} y={-10} width={18} height={9} rx={4} fill="#f4efe2" />}
      {/* 몸통 */}
      <rect x={-8} y={bodyY} width={16} height={17} rx={6} fill={jersey} />
      {/* 팔 */}
      {pose === 'bat-r' && <rect x={4} y={bodyY - 14} width={3} height={20} rx={1.5} fill="#b07a45" transform={`rotate(35 6 ${bodyY + 4})`} />}
      {pose === 'bat-l' && <rect x={-7} y={bodyY - 14} width={3} height={20} rx={1.5} fill="#b07a45" transform={`rotate(-35 -6 ${bodyY + 4})`} />}
      <circle cx={-9} cy={bodyY + 9} r={3} fill={skin} />
      <circle cx={9} cy={bodyY + 9} r={3} fill={pose === 'pitch' ? '#fffaf0' : skin} />
      {/* 머리 */}
      <circle cx={0} cy={bodyY - 8} r={9} fill={back ? hair : skin} />
      {!back && <circle cx={-3} cy={bodyY - 7} r={1.1} fill="#2b2a26" />}
      {!back && <circle cx={3} cy={bodyY - 7} r={1.1} fill="#2b2a26" />}
      {/* 모자 */}
      <path d={`M -9 ${bodyY - 10} A 9 9 0 0 1 9 ${bodyY - 10} Z`} fill={cap} />
      {!back && <rect x={-10} y={bodyY - 11.5} width={20} height={3} rx={1.5} fill={cap} />}
      {back && <rect x={-6} y={bodyY - 19} width={12} height={2.5} rx={1.2} fill={cap} opacity={0.85} />}
    </g>
  )
}
