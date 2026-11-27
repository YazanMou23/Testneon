import { useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { pointer } from './hooks/pointerStore'
import Hud from './components/Hud'
import Stairs from './components/Stairs'
import { prefersReducedMotion } from './utils/webgl'

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
  const rm = useMemo(prefersReducedMotion, [])

  const rise = (delay: number) =>
    rm
      ? {}
      : {
          initial: { opacity: 0, y: 22 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: 'easeOut' as const },
        }

  return (
    <section className="hero">
      <ParallaxBg />
      <Hud />
      <div className="hero-content">
        <motion.p className="eyebrow" {...rise(0.1)}>
          DIGITALE LÖSUNGEN FÜR WACHSTUM
        </motion.p>
        <motion.h1 {...rise(0.2)}>
          DIGITALLÖSUNGEN
          <br />
          <span className="outline">ZUM WACHSEN.</span>
        </motion.h1>
        <motion.p className="lede" {...rise(0.35)}>
          Websites und Software für Unternehmen, die Schritt für Schritt mitwachsen.
        </motion.p>
        <motion.div className="cta-row" {...rise(0.5)}>
          <a className="btn btn-primary" href="#kontakt">
            Projekt starten
          </a>
          <a className="btn btn-ghost" href="#leistungen">
            Leistungen ansehen
          </a>
        </motion.div>
      </div>
      <div className="hero-art">
        <Stairs />
      </div>
    </section>
  )
}
