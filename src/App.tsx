import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { pointer } from './hooks/pointerStore'
import Hud from './components/Hud'
import { prefersReducedMotion, webglAvailable } from './utils/webgl'

// Lazy-load the whole 3D layer so first paint is never blocked by three.js.
const FaceCanvas = lazy(() => import('./components/FaceCanvas'))

function ParallaxBg() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (prefersReducedMotion()) return
    let raf = 0
    const cur = { x: 0, y: 0 }
    const loop = () => {
      const el = ref.current
      if (el) {
        const tx = pointer.active ? pointer.x * -18 : 0
        const ty = pointer.active ? pointer.y * -12 : 0
        cur.x += (tx - cur.x) * 0.05
        cur.y += (ty - cur.y) * 0.05
        el.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0) scale(1.06)`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <div ref={ref} className="hero-bg" />
}

export default function App() {
  const [compact, setCompact] = useState(() => window.innerWidth < 900)
  const [webgl] = useState(webglAvailable)
  const rm = useMemo(prefersReducedMotion, [])

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const rise = (delay: number) =>
    rm
      ? {}
      : {
          initial: { opacity: 0, y: 26 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, delay, ease: 'easeOut' as const },
        }

  return (
    <section className="hero">
      <ParallaxBg />
      <Hud />
      <div className="hero-giant" aria-hidden="true">
        <span>NEON</span>
      </div>
      {webgl ? (
        <Suspense fallback={null}>
          <FaceCanvas compact={compact} />
        </Suspense>
      ) : (
        <div className="fallback-orb" aria-hidden="true" />
      )}
      <div className="hero-content">
        <motion.p className="eyebrow" {...rise(0.15)}>
          SYS // INTERACTIVE EXPERIENCE
        </motion.p>
        <motion.h1 {...rise(0.3)}>
          DESIGN BEYOND
          <br />
          <span className="outline">THE ORDINARY.</span>
        </motion.h1>
        <motion.p className="lede" {...rise(0.45)}>
          Experience a new dimension of digital creativity. Where technology, design, and human
          interaction come together.
        </motion.p>
        <motion.div className="cta-row" {...rise(0.6)}>
          <button type="button" className="btn btn-primary" aria-label="Explore the experience">
            Explore Experience
          </button>
          <button type="button" className="btn btn-ghost">
            Discover More
          </button>
        </motion.div>
      </div>
    </section>
  )
}
