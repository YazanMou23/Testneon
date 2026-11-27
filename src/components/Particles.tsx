import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface CloudProps {
  count: number
  color: string
  size: number
  speed: number
  spread: [number, number, number]
  opacity: number
}

function ParticleCloud({ count, color, size, speed, spread, opacity }: CloudProps) {
  const ref = useRef<THREE.Points>(null!)
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count * 3; i++) arr[i] = (Math.random() - 0.5) * spread[i % 3]
    return arr
  }, [count, spread])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    ref.current.rotation.y = t * speed
    ref.current.position.y = Math.sin(t * 0.12 + speed * 40) * 0.1
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        color={color}
        transparent
        opacity={opacity}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export default function Particles() {
  return (
    <>
      <ParticleCloud count={110} color="#9cc2ff" size={0.035} speed={0.016} spread={[9, 5, 4]} opacity={0.55} />
      <ParticleCloud count={70} color="#5a6d9e" size={0.06} speed={0.008} spread={[12, 7, 6]} opacity={0.3} />
    </>
  )
}
