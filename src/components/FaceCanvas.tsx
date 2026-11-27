import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import FaceModel from './Face'
import Particles from './Particles'
import { pointer } from '../hooks/pointerStore'

/** Subtle camera parallax against the pointer. */
function CameraRig() {
  const { camera } = useThree()
  useFrame((_, dt) => {
    const tx = pointer.active ? pointer.x * 0.18 : 0
    const ty = pointer.active ? -pointer.y * 0.12 : 0
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tx, 2, dt)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, ty, 2, dt)
    camera.lookAt(0.4, -0.05, 0)
  })
  return null
}

/** Soft ambient glow disc behind the face. */
function Glow() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(120,160,255,0.5)')
    grad.addColorStop(0.5, 'rgba(90,110,220,0.16)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    return new THREE.CanvasTexture(c)
  }, [])
  return (
    <mesh position={[0, 0.1, -1.8]} scale={[5.5, 5.5, 1]}>
      <planeGeometry />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  )
}

/** Places the face on the right (desktop) or lower center (compact), with an
 *  ease-out scale-up entrance. */
function FaceRig({ compact }: { compact: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const intro = useRef(0)
  useFrame((_, dt) => {
    intro.current = Math.min(1, intro.current + dt / 1.4)
    const e = 1 - Math.pow(1 - intro.current, 3)
    const base = compact ? 0.58 : 0.92
    ref.current.scale.setScalar(base * (0.82 + 0.18 * e))
    ref.current.position.set(compact ? 0.1 : 1.55, compact ? -1.1 : -0.12, 0)
  })
  return (
    <group ref={ref}>
      <Glow />
      <FaceModel />
    </group>
  )
}

export default function FaceCanvas({ compact }: { compact: boolean }) {
  return (
    <div className="canvas-layer" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 35 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <CameraRig />
        {/* cinematic three-point lighting */}
        <ambientLight intensity={0.25} />
        <directionalLight position={[3.5, 4, 4]} intensity={2.4} color="#ffe8d6" />
        <directionalLight position={[-4, 1.5, -3]} intensity={2.6} color="#6fa8ff" />
        <pointLight position={[0, -1.6, 3]} intensity={6} color="#4653c8" />
        <FaceRig compact={compact} />
        <Particles />
      </Canvas>
    </div>
  )
}
