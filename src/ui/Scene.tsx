// 메뉴 화면 뒤에 깔리는 숲과 잔디 배경

export function Scene() {
  const trees: [number, number, number, 'r' | 'p'][] = [
    [-10, 40, 40, 'r'], [60, 10, 26, 'p'], [330, 20, 30, 'p'], [400, 60, 44, 'r'], [20, 160, 22, 'p'],
    [380, 220, 26, 'p'], [-6, 560, 44, 'r'], [70, 640, 30, 'p'], [340, 610, 34, 'p'], [410, 520, 40, 'r'],
  ]
  return (
    <svg className="scene-bg" viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width={400} height={700} fill="#5cb85c" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={i * 48 - 10} y={0} width={24} height={700} fill="#62bb61" />
      ))}
      <path d="M 120 700 Q 160 520 260 470 Q 340 430 400 450 L 400 700 Z" fill="#d9a066" opacity={0.55} />
      {trees.map(([x, y, r, k], i) =>
        k === 'r' ? (
          <g key={i}>
            <ellipse cx={x} cy={y + r * 0.6} rx={r} ry={r * 0.3} fill="rgba(20,50,25,0.22)" />
            <circle cx={x} cy={y} r={r} fill="#3f9150" />
            <circle cx={x - r * 0.3} cy={y - r * 0.25} r={r * 0.55} fill="#4ea35d" />
          </g>
        ) : (
          <g key={i} transform={`translate(${x} ${y})`}>
            <rect x={-3} y={-8} width={6} height={14} fill="#7a5532" />
            <path d={`M 0 ${-r * 2.2} L ${r} -6 L ${-r} -6 Z`} fill="#2f7a43" />
            <path d={`M 0 ${-r * 2.2} L ${r * 0.15} -6 L ${-r} -6 Z`} fill="#3b8c4f" />
          </g>
        ),
      )}
    </svg>
  )
}
