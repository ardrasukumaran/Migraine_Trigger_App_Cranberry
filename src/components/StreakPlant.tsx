// Tiny SVG plant that grows with streak length.
// 0 = seed, 1-6 = sprout → small plant, 7-20 = bigger, 21+ = flowering.
export function StreakPlant({ days, size = 180 }: { days: number; size?: number }) {
  const stage = days <= 0 ? 0 : days < 3 ? 1 : days < 7 ? 2 : days < 14 ? 3 : days < 30 ? 4 : 5;

  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-label={`Plant at stage ${stage}`}>
      {/* Pot */}
      <defs>
        <linearGradient id="pot" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="oklch(0.4 0.04 30)" />
          <stop offset="1" stopColor="oklch(0.28 0.04 30)" />
        </linearGradient>
        <linearGradient id="leaf" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--streak)" />
          <stop offset="1" stopColor="oklch(0.5 0.14 160)" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="172" rx="46" ry="6" fill="oklch(0 0 0 / 0.25)" />
      <path
        d="M60 140 L140 140 L132 178 Q100 188 68 178 Z"
        fill="url(#pot)"
        stroke="oklch(0.5 0.05 30)"
        strokeWidth="1.2"
      />
      <rect x="58" y="136" width="84" height="8" rx="2" fill="oklch(0.46 0.05 30)" />
      {/* Soil */}
      <ellipse cx="100" cy="142" rx="38" ry="4" fill="oklch(0.2 0.02 30)" />

      {/* Stage 0 - seed */}
      {stage === 0 && (
        <circle cx="100" cy="141" r="3.5" fill="oklch(0.5 0.05 60)" />
      )}

      {/* Stages 1+ : stem */}
      {stage >= 1 && (
        <path
          d={`M100 142 Q100 ${142 - 18 * stage} 100 ${142 - 20 * stage}`}
          stroke="var(--streak)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Stage 1 - tiny sprout leaves */}
      {stage >= 1 && (
        <>
          <ellipse cx="92" cy="130" rx="8" ry="4" fill="url(#leaf)" transform="rotate(-30 92 130)" />
          <ellipse cx="108" cy="130" rx="8" ry="4" fill="url(#leaf)" transform="rotate(30 108 130)" />
        </>
      )}

      {/* Stage 2+ : second leaf set */}
      {stage >= 2 && (
        <>
          <ellipse cx="86" cy="112" rx="12" ry="5" fill="url(#leaf)" transform="rotate(-25 86 112)" />
          <ellipse cx="114" cy="112" rx="12" ry="5" fill="url(#leaf)" transform="rotate(25 114 112)" />
        </>
      )}

      {/* Stage 3+ : top leaves */}
      {stage >= 3 && (
        <>
          <ellipse cx="80" cy="92" rx="16" ry="7" fill="url(#leaf)" transform="rotate(-20 80 92)" />
          <ellipse cx="120" cy="92" rx="16" ry="7" fill="url(#leaf)" transform="rotate(20 120 92)" />
          <ellipse cx="100" cy="80" rx="9" ry="14" fill="url(#leaf)" />
        </>
      )}

      {/* Stage 4+ : taller crown */}
      {stage >= 4 && (
        <>
          <ellipse cx="78" cy="70" rx="14" ry="6" fill="url(#leaf)" transform="rotate(-18 78 70)" />
          <ellipse cx="122" cy="70" rx="14" ry="6" fill="url(#leaf)" transform="rotate(18 122 70)" />
        </>
      )}

      {/* Stage 5 : flowers */}
      {stage >= 5 && (
        <>
          <g transform="translate(100 50)">
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <ellipse
                key={a}
                cx="0"
                cy="-9"
                rx="5"
                ry="8"
                fill="oklch(0.85 0.16 350)"
                transform={`rotate(${a})`}
              />
            ))}
            <circle r="4" fill="var(--brand-yellow)" />
          </g>
        </>
      )}
    </svg>
  );
}
