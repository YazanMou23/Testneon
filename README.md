# Testneon — Interactive 3D Hero

A premium, Awwwards-style hero section: full-screen, split layout with bold
typography on the left and an interactive 3D human face on the right that
tracks the mouse (desktop) or touch (mobile), with damped motion, idle
breathing, blinking, floating particles, cinematic lighting and a dark
`#08090D` art direction.

## Stack

- React 19 + TypeScript + Vite
- three.js via @react-three/fiber (+ @react-three/drei)
- Framer Motion for UI entrance animations

## Run

```bash
npm install
npm run dev       # dev server
npm run build     # type-check + production build
npm run preview   # serve the production build
```

## Structure

- `src/App.tsx` — hero layout, entrance animations, background parallax, WebGL fallback
- `src/components/FaceCanvas.tsx` — canvas, cinematic lights, glow, particles, camera rig, responsive placement
- `src/components/Face.tsx` — the 3D face. Currently a clearly-marked procedural
  placeholder (original code, repo license); designed to be swapped for a
  Gemini 4 Argon generated face behind the same component contract.
- `src/hooks/pointerStore.ts` — shared pointer/touch state (no re-renders)

Fallbacks: no WebGL → static glow orb; `prefers-reduced-motion` → reduced
animation; coarse pointers → autonomous idle head motion until first touch.
