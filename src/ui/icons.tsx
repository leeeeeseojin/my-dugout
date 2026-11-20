// 날씨·조작 아이콘 (직접 그린 단순한 도형)

import type { WeatherKind } from '../engine/weather'

export function WeatherIcon({ kind, size = 24 }: { kind: WeatherKind; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {kind === 'clear' && (
        <g>
          <circle cx={12} cy={12} r={5} fill="#f2b233" />
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x={11} y={1.5} width={2} height={3.5} rx={1} fill="#f2b233" transform={`rotate(${i * 45} 12 12)`} />
          ))}
        </g>
      )}
      {(kind === 'windOut' || kind === 'windIn') && (
        <g stroke="#48b8d8" strokeWidth={2.2} fill="none" strokeLinecap="round">
          <path d="M3 9 h11 a3 3 0 1 0 -3 -3" />
          <path d="M3 14 h15 a3 3 0 1 1 -3 3" />
        </g>
      )}
      {(kind === 'rain' || kind === 'heavyRain') && (
        <g>
          <path d="M6 14 a4 4 0 0 1 1 -7.8 a5 5 0 0 1 9.6 1.2 a3.3 3.3 0 0 1 1 6.6 z" fill="#9fb3bf" />
          <g stroke="#48b8d8" strokeWidth={2} strokeLinecap="round">
            <path d="M8 17 l-1 3" />
            <path d="M12 17 l-1 3" />
            {kind === 'heavyRain' && <path d="M16 17 l-1 3" />}
          </g>
        </g>
      )}
    </svg>
  )
}

export function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden>
      {playing ? (
        <g fill="currentColor">
          <rect x={3} y={2} width={4} height={14} rx={1.5} />
          <rect x={11} y={2} width={4} height={14} rx={1.5} />
        </g>
      ) : (
        <path d="M4 2.5 L15 9 L4 15.5 Z" fill="currentColor" strokeLinejoin="round" />
      )}
    </svg>
  )
}

export function GearIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden>
      <g fill="currentColor">
        {Array.from({ length: 6 }, (_, i) => (
          <rect key={i} x={8.5} y={1} width={3} height={18} rx={1.2} transform={`rotate(${i * 30} 10 10)`} />
        ))}
        <circle cx={10} cy={10} r={6} />
      </g>
      <circle cx={10} cy={10} r={2.6} fill="var(--cream)" />
    </svg>
  )
}
