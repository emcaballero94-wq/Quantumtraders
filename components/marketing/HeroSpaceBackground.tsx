'use client'

import { useEffect, useRef } from 'react'

// Deep-space backdrop for the hero: drifting nebula glow, a bright twinkling
// starfield, "matrix" glyph rain, and a neural-network mesh with traveling
// light pulses (nodes = neurons, moving dots = information). Pure canvas 2D,
// additive ("lighter") blending for a luminous look, no dependencies.

interface Star {
  x: number
  y: number
  r: number
  baseAlpha: number
  twinkleSpeed: number
  twinklePhase: number
  driftSpeed: number
  hero: boolean
}

interface MatrixStream {
  x: number
  y: number
  speed: number
  chars: string[]
  nextGlitch: number
}

interface NeuralNode {
  x: number
  y: number
  vx: number
  vy: number
}

interface Pulse {
  from: number
  to: number
  t: number
  speed: number
}

const GLYPHS = '01アカサ01$01%01+01-0101'.split('')
const NEBULA_COLORS = ['59, 130, 246', '0, 201, 167', '124, 58, 237']

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
}

export function HeroSpaceBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1

    let width = 0
    let height = 0
    let stars: Star[] = []
    let streams: MatrixStream[] = []
    let nodes: NeuralNode[] = []
    let pulses: Pulse[] = []

    const buildScene = () => {
      const rect = container.getBoundingClientRect()
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const area = width * height

      const starCount = Math.round(Math.min(280, Math.max(90, area / 3600)))
      stars = Array.from({ length: starCount }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.5 + 0.5,
        baseAlpha: Math.random() * 0.5 + 0.45,
        twinkleSpeed: Math.random() * 1.8 + 0.5,
        twinklePhase: Math.random() * Math.PI * 2,
        driftSpeed: Math.random() * 5 + 2,
        hero: i % 11 === 0,
      }))

      const streamCount = Math.round(Math.min(30, Math.max(10, width / 48)))
      streams = Array.from({ length: streamCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height - height,
        speed: Math.random() * 26 + 18,
        chars: Array.from({ length: 7 + Math.floor(Math.random() * 5) }, randomGlyph),
        nextGlitch: Math.random() * 2,
      }))

      const nodeCount = Math.round(Math.min(32, Math.max(16, area / 13000)))
      nodes = Array.from({ length: nodeCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7,
      }))

      pulses = Array.from({ length: Math.round(nodeCount * 0.9) }, () => ({
        from: Math.floor(Math.random() * nodes.length),
        to: Math.floor(Math.random() * nodes.length),
        t: Math.random(),
        speed: Math.random() * 0.3 + 0.22,
      }))
    }

    buildScene()
    const ro = new ResizeObserver(() => buildScene())
    ro.observe(container)

    let raf = 0
    let last = performance.now()
    const linkDist = () => Math.min(190, Math.max(120, width / 7.5))

    const draw = (elapsed: number, dt: number) => {
      ctx.clearRect(0, 0, width, height)

      // Nebula glow — additive, colorful, concentrated (not a flat wash)
      ctx.globalCompositeOperation = 'lighter'
      NEBULA_COLORS.forEach((rgb, i) => {
        const cx = width * (0.68 + i * 0.14) + Math.sin(elapsed * 0.06 + i * 2) * width * 0.06
        const cy = height * (0.35 + (i % 2) * 0.3) + Math.cos(elapsed * 0.05 + i) * height * 0.08
        const radius = Math.max(width, height) * 0.3
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        g.addColorStop(0, `rgba(${rgb}, 0.22)`)
        g.addColorStop(1, `rgba(${rgb}, 0)`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, width, height)
      })

      // Stars — twinkling, slow drift, a handful glow as focal points
      for (const s of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(elapsed * s.twinkleSpeed + s.twinklePhase)
        const alpha = s.baseAlpha * (0.35 + twinkle * 0.65)
        s.x -= s.driftSpeed * dt
        if (s.x < -2) s.x = width + 2
        if (s.hero) {
          ctx.shadowColor = 'rgba(180, 210, 255, 0.9)'
          ctx.shadowBlur = 6
        }
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.hero ? s.r + 0.6 : s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(225, 236, 255, ${alpha})`
        ctx.fill()
        if (s.hero) ctx.shadowBlur = 0
      }

      // Matrix rain — sparse falling glyph trails, brand-tinted, additive glow
      ctx.font = '600 13px "IBM Plex Mono", monospace'
      ctx.textBaseline = 'middle'
      for (const stream of streams) {
        stream.y += stream.speed * dt
        stream.nextGlitch -= dt
        if (stream.nextGlitch <= 0) {
          stream.chars[0] = randomGlyph()
          stream.nextGlitch = Math.random() * 1.5 + 0.4
        }
        if (stream.y - stream.chars.length * 17 > height) {
          stream.y = -Math.random() * height * 0.4
          stream.x = Math.random() * width
        }
        stream.chars.forEach((ch, i) => {
          const y = stream.y - i * 17
          if (y < -17 || y > height + 17) return
          const alpha = Math.max(0, (1 - i / stream.chars.length) * 0.75)
          if (i === 0) {
            ctx.shadowColor = 'rgba(0, 201, 167, 0.95)'
            ctx.shadowBlur = 8
            ctx.fillStyle = `rgba(120, 255, 220, ${Math.min(1, alpha + 0.2)})`
          } else {
            ctx.shadowBlur = 0
            ctx.fillStyle = `rgba(70, 150, 255, ${alpha})`
          }
          ctx.fillText(ch, stream.x, y)
        })
        ctx.shadowBlur = 0
      }

      // Neural mesh — connections fade in with proximity
      const maxDist = linkDist()
      for (const n of nodes) {
        n.x += n.vx * dt
        n.y += n.vy * dt
        if (n.x < 0 || n.x > width) n.vx *= -1
        if (n.y < 0 || n.y > height) n.vy *= -1
        n.x = Math.min(width, Math.max(0, n.x))
        n.y = Math.min(height, Math.max(0, n.y))
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > maxDist) continue
          const alpha = (1 - dist / maxDist) * 0.4
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = `rgba(90, 160, 255, ${alpha})`
          ctx.lineWidth = 0.8
          ctx.stroke()
        }
      }
      ctx.shadowColor = 'rgba(120, 180, 255, 0.9)'
      ctx.shadowBlur = 5
      for (const n of nodes) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, 2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(190, 215, 255, 0.85)'
        ctx.fill()
      }
      ctx.shadowBlur = 0

      // Pulses — information traveling along live synapses
      for (const p of pulses) {
        const a = nodes[p.from]
        const b = nodes[p.to]
        if (!a || !b) continue
        const dx = a.x - b.x
        const dy = a.y - b.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        p.t += p.speed * dt
        if (p.t >= 1 || dist > maxDist * 1.6) {
          p.t = 0
          p.from = Math.floor(Math.random() * nodes.length)
          p.to = Math.floor(Math.random() * nodes.length)
          continue
        }
        const px = a.x + (b.x - a.x) * p.t
        const py = a.y + (b.y - a.y) * p.t
        const fade = Math.sin(p.t * Math.PI)
        ctx.shadowColor = 'rgba(0, 224, 184, 1)'
        ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.arc(px, py, 2.6, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(140, 255, 230, ${0.95 * fade})`
        ctx.fill()
        ctx.shadowBlur = 0
      }

      ctx.globalCompositeOperation = 'source-over'

      // Gentle left-side contrast wash so headline text stays legible
      const wash = ctx.createLinearGradient(0, 0, width, 0)
      wash.addColorStop(0, 'rgba(4, 5, 10, 0.45)')
      wash.addColorStop(0.32, 'rgba(4, 5, 10, 0.18)')
      wash.addColorStop(0.5, 'rgba(4, 5, 10, 0)')
      ctx.fillStyle = wash
      ctx.fillRect(0, 0, width, height)
    }

    if (reduceMotion) {
      draw(0, 0)
      return () => ro.disconnect()
    }

    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = (now - startTime) / 1000
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      draw(elapsed, dt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="block w-full h-full" aria-hidden="true" />
    </div>
  )
}
