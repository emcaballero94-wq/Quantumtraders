'use client'

import { useEffect, useRef } from 'react'

// Deep-space backdrop for the hero: a drifting nebula, a twinkling starfield,
// "matrix" glyph rain, and a neural-network mesh with traveling light pulses
// (nodes = neurons, moving dots = information). Pure canvas 2D.
//
// Perf notes: glow is done via pre-rendered sprites (drawImage) instead of
// per-shape shadowBlur, the nebula is rendered once to an offscreen layer
// instead of recomputed every frame, and the loop is capped at ~30fps since
// this is a decorative background, not something that needs 60fps.

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
const NEBULA_COLORS = ['232, 180, 76', '16, 185, 129', '249, 115, 22']
const TARGET_FRAME_TIME = 1 / 30

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
}

function makeGlowSprite(rgb: string, size: number) {
  const sprite = document.createElement('canvas')
  sprite.width = size
  sprite.height = size
  const sctx = sprite.getContext('2d')
  if (!sctx) return sprite
  const r = size / 2
  const g = sctx.createRadialGradient(r, r, 0, r, r, r)
  g.addColorStop(0, `rgba(${rgb}, 1)`)
  g.addColorStop(0.4, `rgba(${rgb}, 0.55)`)
  g.addColorStop(1, `rgba(${rgb}, 0)`)
  sctx.fillStyle = g
  sctx.fillRect(0, 0, size, size)
  return sprite
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
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1

    const starSprite = makeGlowSprite('255, 244, 224', 24)
    const nodeSprite = makeGlowSprite('235, 210, 150', 20)
    const pulseSprite = makeGlowSprite('110, 231, 183', 26)
    const matrixHeadSprite = makeGlowSprite('16, 185, 129', 22)
    const nebulaLayer = document.createElement('canvas')
    const nebulaCtx = nebulaLayer.getContext('2d')

    let width = 0
    let height = 0
    let stars: Star[] = []
    let streams: MatrixStream[] = []
    let nodes: NeuralNode[] = []
    let pulses: Pulse[] = []

    const renderNebula = () => {
      // Rendered once at low resolution and blitted every frame — the alternative
      // (recomputing 3 full-canvas radial gradients per frame) is the single
      // costliest thing a decorative background can do.
      const nw = Math.max(1, Math.round(width / 3))
      const nh = Math.max(1, Math.round(height / 3))
      nebulaLayer.width = nw
      nebulaLayer.height = nh
      if (!nebulaCtx) return
      nebulaCtx.clearRect(0, 0, nw, nh)
      nebulaCtx.globalCompositeOperation = 'lighter'
      NEBULA_COLORS.forEach((rgb, i) => {
        const cx = nw * (0.68 + i * 0.14)
        const cy = nh * (0.35 + (i % 2) * 0.3)
        const radius = Math.max(nw, nh) * 0.32
        const g = nebulaCtx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        g.addColorStop(0, `rgba(${rgb}, 0.32)`)
        g.addColorStop(1, `rgba(${rgb}, 0)`)
        nebulaCtx.fillStyle = g
        nebulaCtx.fillRect(0, 0, nw, nh)
      })
    }

    const buildScene = () => {
      const rect = container.getBoundingClientRect()
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      renderNebula()

      const area = width * height

      const starCount = Math.round(Math.min(150, Math.max(60, area / 6500)))
      stars = Array.from({ length: starCount }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.4 + 0.5,
        baseAlpha: Math.random() * 0.5 + 0.45,
        twinkleSpeed: Math.random() * 1.8 + 0.5,
        twinklePhase: Math.random() * Math.PI * 2,
        driftSpeed: Math.random() * 5 + 2,
        hero: i % 12 === 0,
      }))

      const streamCount = Math.round(Math.min(18, Math.max(8, width / 90)))
      streams = Array.from({ length: streamCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height - height,
        speed: Math.random() * 26 + 18,
        chars: Array.from({ length: 6 + Math.floor(Math.random() * 4) }, randomGlyph),
        nextGlitch: Math.random() * 2,
      }))

      const nodeCount = Math.round(Math.min(20, Math.max(12, area / 22000)))
      nodes = Array.from({ length: nodeCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7,
      }))

      pulses = Array.from({ length: Math.round(nodeCount * 0.7) }, () => ({
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
    const linkDist = () => Math.min(180, Math.max(110, width / 7.5))

    const draw = (elapsed: number, dt: number) => {
      ctx.clearRect(0, 0, width, height)

      ctx.globalCompositeOperation = 'lighter'
      ctx.drawImage(nebulaLayer, 0, 0, width, height)

      // Stars — twinkling, slow drift; a subset glow via sprite blit
      for (const s of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(elapsed * s.twinkleSpeed + s.twinklePhase)
        const alpha = s.baseAlpha * (0.35 + twinkle * 0.65)
        s.x -= s.driftSpeed * dt
        if (s.x < -2) s.x = width + 2
        if (s.hero) {
          const size = 16
          ctx.globalAlpha = Math.min(1, alpha + 0.15)
          ctx.drawImage(starSprite, s.x - size / 2, s.y - size / 2, size, size)
          ctx.globalAlpha = 1
        } else {
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(245, 232, 210, ${alpha})`
          ctx.fill()
        }
      }

      // Matrix rain — sparse falling glyph trails, brand-tinted
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
            const size = 18
            ctx.globalAlpha = Math.min(1, alpha + 0.3)
            ctx.drawImage(matrixHeadSprite, stream.x - size / 2, y - size / 2, size, size)
            ctx.globalAlpha = 1
            ctx.fillStyle = `rgba(110, 231, 183, ${Math.min(1, alpha + 0.2)})`
          } else {
            ctx.fillStyle = `rgba(232, 180, 76, ${alpha})`
          }
          ctx.fillText(ch, stream.x, y)
        })
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
      ctx.strokeStyle = 'rgba(232, 180, 76, 0.35)'
      ctx.lineWidth = 0.8
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const distSq = dx * dx + dy * dy
          if (distSq > maxDist * maxDist) continue
          const dist = Math.sqrt(distSq)
          ctx.globalAlpha = (1 - dist / maxDist) * 0.4
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
      for (const n of nodes) {
        const size = 14
        ctx.drawImage(nodeSprite, n.x - size / 2, n.y - size / 2, size, size)
      }

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
        const size = 18
        ctx.globalAlpha = 0.95 * fade
        ctx.drawImage(pulseSprite, px - size / 2, py - size / 2, size, size)
        ctx.globalAlpha = 1
      }

      ctx.globalCompositeOperation = 'source-over'

      // Gentle left-side contrast wash so headline text stays legible
      const wash = ctx.createLinearGradient(0, 0, width, 0)
      wash.addColorStop(0, 'rgba(10, 9, 8, 0.45)')
      wash.addColorStop(0.32, 'rgba(10, 9, 8, 0.18)')
      wash.addColorStop(0.5, 'rgba(10, 9, 8, 0)')
      ctx.fillStyle = wash
      ctx.fillRect(0, 0, width, height)
    }

    if (reduceMotion) {
      draw(0, 0)
      return () => ro.disconnect()
    }

    const startTime = performance.now()
    let last = startTime
    let acc = 0
    const tick = (now: number) => {
      const elapsed = (now - startTime) / 1000
      const realDt = Math.min(0.1, (now - last) / 1000)
      last = now
      acc += realDt
      if (acc >= TARGET_FRAME_TIME) {
        draw(elapsed, acc)
        acc = 0
      }
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
