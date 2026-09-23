'use client'

import { useEffect, useRef } from 'react'
import { getActiveSessions } from '@/lib/oracle/timing-engine'
import type { SessionName } from '@/lib/oracle/types'
import { LAND_POINTS as RAW_LAND_POINTS } from '@/lib/geo/land-points'

interface CityMarker {
  name: SessionName
  label: string
  lat: number
  lng: number
}

const CITIES: CityMarker[] = [
  { name: 'Sydney', label: 'SYDNEY', lat: -33.87, lng: 151.21 },
  { name: 'Tokyo', label: 'TOKYO', lat: 35.68, lng: 139.69 },
  { name: 'London', label: 'LONDON', lat: 51.51, lng: -0.13 },
  { name: 'New York', label: 'NEW YORK', lat: 40.71, lng: -74.01 },
]

const ARCS: [string, string][] = [
  ['London', 'New York'],
  ['Tokyo', 'London'],
  ['Sydney', 'Tokyo'],
]

const ROTATION_PERIOD_SECONDS = 90

// Real coastline data (Natural Earth 110m, see scripts/generate-land-points.mjs)
const LAND_POINTS: { lat: number; lng: number }[] = RAW_LAND_POINTS.map(([lat, lng]) => ({ lat, lng }))

function unitVector(latDeg: number, lngDeg: number) {
  const latRad = (latDeg * Math.PI) / 180
  const lngRad = (lngDeg * Math.PI) / 180
  return {
    x: Math.cos(latRad) * Math.sin(lngRad),
    y: Math.sin(latRad),
    z: Math.cos(latRad) * Math.cos(lngRad),
  }
}

function dot3(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function subsolarPoint(date: Date): { lat: number; lng: number } {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start) / 86_400_000)
  const declination = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10))
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const subsolarLng = (12 - utcHours) * 15
  return { lat: declination, lng: subsolarLng }
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function RotatingGlobe({ size = 380 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)

    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cx = size / 2
    const cy = size / 2
    const radius = size * 0.42

    let raf = 0
    const startTime = performance.now()

    const project = (latDeg: number, lngDeg: number, rotationRad: number) => {
      const latRad = (latDeg * Math.PI) / 180
      const lngRad = (lngDeg * Math.PI) / 180 + rotationRad
      const x = Math.cos(latRad) * Math.sin(lngRad)
      const y = Math.sin(latRad)
      const z = Math.cos(latRad) * Math.cos(lngRad)
      return { x: cx + x * radius, y: cy - y * radius, z }
    }

    const render = (rotationRad: number) => {
      ctx.clearRect(0, 0, size, size)

      const now = new Date()
      const sun = subsolarPoint(now)
      const sunVec = unitVector(sun.lat, sun.lng)
      const activeSessions = new Set(getActiveSessions(now).filter((s) => s.isActive).map((s) => s.name))

      // Sphere base
      const sphereGradient = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius)
      sphereGradient.addColorStop(0, 'rgba(45, 35, 20, 0.55)')
      sphereGradient.addColorStop(1, 'rgba(10, 9, 8, 0.75)')
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fillStyle = sphereGradient
      ctx.fill()
      ctx.strokeStyle = 'rgba(232, 180, 76, 0.18)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Latitude/longitude grid (faint)
      ctx.strokeStyle = 'rgba(232, 180, 76, 0.12)'
      ctx.lineWidth = 0.5
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath()
        let started = false
        for (let lng = -180; lng <= 180; lng += 5) {
          const p = project(lat, lng, rotationRad)
          if (p.z < -0.05) {
            started = false
            continue
          }
          if (!started) {
            ctx.moveTo(p.x, p.y)
            started = true
          } else {
            ctx.lineTo(p.x, p.y)
          }
        }
        ctx.stroke()
      }
      for (let lng = -150; lng <= 180; lng += 30) {
        ctx.beginPath()
        let started = false
        for (let lat = -90; lat <= 90; lat += 5) {
          const p = project(lat, lng, rotationRad)
          if (p.z < -0.05) {
            started = false
            continue
          }
          if (!started) {
            ctx.moveTo(p.x, p.y)
            started = true
          } else {
            ctx.lineTo(p.x, p.y)
          }
        }
        ctx.stroke()
      }

      // Land points, shaded by real sun position (independent of decorative rotation).
      // Continents stay clearly visible on the night side too — day/night is a
      // brightness modulation, not a visibility toggle.
      for (const point of LAND_POINTS) {
        const p = project(point.lat, point.lng, rotationRad)
        if (p.z < 0.02) continue
        const lit = dot3(unitVector(point.lat, point.lng), sunVec)
        const brightness = smoothstep(-0.35, 0.35, lit)
        const edgeFade = smoothstep(0, 0.1, p.z)
        const alpha = (0.5 + brightness * 0.45) * edgeFade
        const r = (1.3 + brightness * 0.7) * edgeFade + 0.3
        const cr = Math.round(120 + brightness * 112)
        const cg = Math.round(100 + brightness * 80)
        const cb = Math.round(60 + brightness * 16)
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`
        ctx.fill()
      }

      // Arcs between financial centers
      for (const [fromName, toName] of ARCS) {
        const from = CITIES.find((c) => c.name === fromName)!
        const to = CITIES.find((c) => c.name === toName)!
        const a = unitVector(from.lat, from.lng)
        const b = unitVector(to.lat, to.lng)
        const steps = 32
        ctx.beginPath()
        let started = false
        for (let i = 0; i <= steps; i++) {
          const t = i / steps
          const nx = a.x + (b.x - a.x) * t
          const ny = a.y + (b.y - a.y) * t
          const nz = a.z + (b.z - a.z) * t
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
          const bulge = 1 + Math.sin(t * Math.PI) * 0.08
          const lat = (Math.asin((ny / len)) * 180) / Math.PI
          const lng = (Math.atan2(nx / len, nz / len) * 180) / Math.PI
          const p = project(lat, lng, rotationRad)
          if (p.z < 0.03) {
            started = false
            continue
          }
          const px = cx + (p.x - cx) * bulge
          const py = cy + (p.y - cy) * bulge
          if (!started) {
            ctx.moveTo(px, py)
            started = true
          } else {
            ctx.lineTo(px, py)
          }
        }
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)'
        ctx.lineWidth = 0.75
        ctx.stroke()
      }

      // City markers
      ctx.font = '600 10px "IBM Plex Mono", monospace'
      ctx.textBaseline = 'middle'
      for (const city of CITIES) {
        const p = project(city.lat, city.lng, rotationRad)
        if (p.z < 0.05) continue
        const isActive = activeSessions.has(city.name)
        const glowColor = isActive ? '16, 185, 129' : '232, 180, 76'

        const pulse = isActive && !reduceMotion ? 0.6 + 0.4 * Math.sin(performance.now() / 400) : 1
        ctx.beginPath()
        ctx.arc(p.x, p.y, 5 * pulse, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${glowColor}, 0.15)`
        ctx.fill()
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
        ctx.fillStyle = isActive ? '#10B981' : '#E8B44C'
        ctx.fill()

        ctx.fillStyle = isActive ? 'rgba(16, 185, 129, 0.95)' : 'rgba(184, 173, 152, 0.85)'
        ctx.fillText(city.label, p.x + 7, p.y + 3)
        if (isActive) {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.7)'
          ctx.fillText('● LIVE', p.x + 7, p.y + 13)
        }
      }
    }

    const tick = () => {
      const elapsed = (performance.now() - startTime) / 1000
      const rotationRad = reduceMotion ? Math.PI * 0.15 : ((elapsed / ROTATION_PERIOD_SECONDS) * Math.PI * 2) % (Math.PI * 2)
      render(rotationRad)
      if (!reduceMotion) raf = requestAnimationFrame(tick)
    }

    if (reduceMotion) {
      render(Math.PI * 0.15)
      const interval = setInterval(() => render(Math.PI * 0.15), 60_000)
      return () => clearInterval(interval)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [size])

  return <canvas ref={canvasRef} className="block" aria-hidden="true" />
}
