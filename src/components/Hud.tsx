import { useEffect, useRef } from 'react'
import { pointer } from '../hooks/pointerStore'
import { prefersReducedMotion } from '../utils/webgl'

/** HUD / Sci-Fi FUI overlay: corner brackets, fine grid, one scan line and a
 *  live pointer readout. Purely decorative (aria-hidden). */
export default function Hud() {
  const readout = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    let raf = 0
    let last = ''
    const loop = () => {
      const el = readout.current
      if (el) {
        const t = pointer.active
          ? `X ${pointer.x.toFixed(2).padStart(5, ' ')}  Y ${pointer.y.toFixed(2).padStart(5, ' ')}`
          : 'X  0.00  Y  0.00'
        if (t !== last) {
          el.textContent = t
          last = t
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="hud" aria-hidden="true">
      <div className="hud-grid" />
      <div className="hud-scan" />
      <span className="hud-corner tl" />
      <span className="hud-corner tr" />
      <span className="hud-corner bl" />
      <span className="hud-corner br" />
      <div className="hud-label hud-top-right">
        <i className="hud-dot" /> ONLINE
      </div>
      <div className="hud-label hud-bottom-left">
        <span>TESTNEON / V1.0</span>
        <span>MODE HUD</span>
      </div>
      <div className="hud-label hud-bottom-right">
        <span ref={readout}>X  0.00  Y  0.00</span>
      </div>
    </div>
  )
}
