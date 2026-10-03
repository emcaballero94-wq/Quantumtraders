// Walking routes on the Tree of Life floor: the shortest way along the
// sketch's lines (TREE_PATHS) between two stations. Pure, so it is unit
// tested in tree-route.test.ts.

import { QUANTUM_CITY_STATIONS, TREE_PATHS, TREE_SLOTS, type StationId, type TreeSlot } from '@/components/quantum-city/stations'

type Point = [number, number]

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Slots visited from `from` to `to` (both included), shortest by floor distance. */
export function shortestSlotPath(from: TreeSlot, to: TreeSlot): TreeSlot[] {
  const best = new Map<TreeSlot, number>([[from, 0]])
  const prev = new Map<TreeSlot, TreeSlot>()
  const open = new Set<TreeSlot>([from])
  while (open.size > 0) {
    let cur: TreeSlot | null = null
    for (const s of open) if (cur === null || best.get(s)! < best.get(cur)!) cur = s
    if (cur === null || cur === to) break
    open.delete(cur)
    for (const [a, b] of TREE_PATHS) {
      const next = a === cur ? b : b === cur ? a : null
      if (!next) continue
      const d = best.get(cur)! + dist(TREE_SLOTS[cur], TREE_SLOTS[next])
      if (d < (best.get(next) ?? Infinity)) {
        best.set(next, d)
        prev.set(next, cur)
        open.add(next)
      }
    }
  }
  if (!best.has(to)) return [from, to]
  const path: TreeSlot[] = [to]
  while (path[0] !== from) path.unshift(prev.get(path[0])!)
  return path
}

/**
 * Floor points a courier walks from one station to another: out of the
 * source platform, along the tree's lines, into the target platform.
 * Stations off the tree (the pipeline row) walk straight.
 */
export function walkRoute(fromId: StationId, toId: StationId, radiusOf: (id: StationId) => number): Point[] {
  const from = QUANTUM_CITY_STATIONS.find((s) => s.id === fromId)
  const to = QUANTUM_CITY_STATIONS.find((s) => s.id === toId)
  if (!from || !to) return []

  const points: Point[] = [from.position]
  if (from.slot && to.slot) {
    for (const slot of shortestSlotPath(from.slot, to.slot)) {
      const p = TREE_SLOTS[slot]
      // A twin station (JOURNAL/REVIEW) first steps to its circle's center.
      if (dist(p, points[points.length - 1]) > 0.01 && dist(p, to.position) > 0.01) points.push(p)
    }
  }
  points.push(to.position)

  // Start at the edge of the source platform and stop at the target's edge.
  const trim = (a: Point, b: Point, r: number): Point => {
    const d = dist(a, b)
    if (d <= r) return a
    return [a[0] + ((b[0] - a[0]) * r) / d, a[1] + ((b[1] - a[1]) * r) / d]
  }
  const n = points.length
  points[0] = trim(points[0], points[1], radiusOf(fromId) * 0.95)
  points[n - 1] = trim(points[n - 1], points[n - 2], radiusOf(toId) * 1.02)
  return points
}
