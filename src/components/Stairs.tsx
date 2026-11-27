/** Line-drawn growth staircase. Pure SVG + CSS, no libraries: each tread draws
 *  itself in turn, the growth arrow follows, then the corner nodes pulse. */
const STEPS = 5
const W = 86 // tread width
const H = 66 // riser height
const X0 = 24
const Y0 = 392

export default function Stairs() {
  const treads = Array.from({ length: STEPS }, (_, i) => {
    const x = X0 + i * W
    const y = Y0 - (i + 1) * H
    // riser up from previous level, then the tread along the top
    return { d: i === 0 ? `M${x} ${Y0} V${y} H${x + W}` : `M${x} ${y + H} V${y} H${x + W}`, x, y, i }
  })
  const topX = X0 + STEPS * W
  // growth arrow runs just above the tread corners (same slope as the steps)
  const AX0 = X0 + 6
  const AY0 = Y0 - 32
  const AX1 = topX - 36
  const AY1 = AY0 - ((AX1 - AX0) * H) / W
  const ang = Math.atan2(AY1 - AY0, AX1 - AX0)
  const wing = (da: number) => `${(AX1 - 22 * Math.cos(ang + da)).toFixed(1)} ${(AY1 - 22 * Math.sin(ang + da)).toFixed(1)}`
  const head = `M${wing(0.5)} L${AX1} ${AY1} L${wing(-0.5)}`
  return (
    <svg className="stairs" viewBox="0 0 520 430" role="img" aria-label="Treppe als Symbol für Wachstum" preserveAspectRatio="xMidYMid meet">
      <g className="stairs-bars">
        {treads.map((t) => (
          <rect key={t.i} x={t.x + 6} y={t.y + 8} width={W - 12} height={Y0 - t.y - 8} style={{ animationDelay: `${0.9 + t.i * 0.35}s` }} />
        ))}
      </g>
      <line className="stairs-base" x1={X0} y1={Y0} x2={topX} y2={Y0} pathLength={1} />
      {treads.map((t) => (
        <path key={t.i} className="stairs-line" d={t.d} pathLength={1} style={{ animationDelay: `${0.3 + t.i * 0.35}s` }} />
      ))}
      <path className="stairs-arrow" d={`M${AX0} ${AY0} L${AX1} ${AY1}`} pathLength={1} />
      <path className="stairs-head" d={head} pathLength={1} />
      {treads.map((t) => (
        <circle key={t.i} className="stairs-node" cx={t.x + W} cy={t.y} r="4" style={{ animationDelay: `${0.7 + t.i * 0.35}s` }} />
      ))}
    </svg>
  )
}
