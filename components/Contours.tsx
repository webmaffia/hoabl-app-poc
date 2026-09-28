// Survey-map contour lines, the land-record motif used behind hero areas.

export function Contours({ className = "", stroke = "currentColor", opacity = 0.18 }: { className?: string; stroke?: string; opacity?: number }) {
  const rings = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <svg className={className} viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke={stroke} strokeWidth="1" opacity={opacity}>
        {rings.map((i) => {
          const r = 40 + i * 26;
          const w = 1 + i * 0.05;
          return (
            <path
              key={i}
              d={`M ${260 - r * w} ${150}
                  C ${260 - r * w} ${150 - r * 0.9}, ${260 + r * 0.6} ${150 - r * 1.05}, ${260 + r * 1.02} ${150 - r * 0.2}
                  S ${260 + r * 0.4} ${150 + r * 1.1}, ${260 - r * 0.35} ${150 + r * 0.85}
                  S ${260 - r * w} ${150 + r * 0.3}, ${260 - r * w} ${150} Z`}
            />
          );
        })}
      </g>
    </svg>
  );
}

/** A small plot-grid glyph: four columns of plots, a road, one plot highlighted. */
export function PlotGrid({ className = "" }: { className?: string }) {
  const cells = Array.from({ length: 12 }, (_, i) => i);
  return (
    <svg className={className} viewBox="0 0 120 92" aria-hidden="true">
      <rect x="0" y="40" width="120" height="10" fill="currentColor" opacity="0.12" />
      {cells.map((i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 4 + col * 29;
        const y = row === 0 ? 4 : row === 1 ? 54 : 74;
        const h = row === 0 ? 32 : 16;
        const hot = i === 5;
        const sold = i === 2 || i === 7 || i === 9;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width="25"
            height={h}
            rx="2"
            fill={hot ? "var(--gold)" : sold ? "currentColor" : "none"}
            fillOpacity={hot ? 0.9 : sold ? 0.18 : 0}
            stroke="currentColor"
            strokeOpacity="0.55"
          />
        );
      })}
    </svg>
  );
}
