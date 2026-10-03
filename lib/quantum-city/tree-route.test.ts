import { describe, expect, it } from 'vitest'
import { shortestSlotPath, walkRoute } from './tree-route'
import { TREE_SLOTS } from '@/components/quantum-city/stations'

describe('shortestSlotPath', () => {
  it('goes straight down the middle from the top to the center', () => {
    expect(shortestSlotPath('keter', 'tiferet')).toEqual(['keter', 'tiferet'])
  })

  it('walks from the bottom up through yesod to the center', () => {
    expect(shortestSlotPath('malkuth', 'tiferet')).toEqual(['malkuth', 'yesod', 'tiferet'])
  })

  it('uses the GEX → FLOW line directly', () => {
    expect(shortestSlotPath('chokmah', 'chesed')).toEqual(['chokmah', 'chesed'])
  })

  it('goes through the center between the two lower sides (no line joins them)', () => {
    const path = shortestSlotPath('hod', 'netzach')
    expect(path[0]).toBe('hod')
    expect(path[path.length - 1]).toBe('netzach')
    expect(path).toHaveLength(3)
  })
})

describe('walkRoute', () => {
  const radius = () => 1

  it('sends JOURNAL to the center of its shared circle before walking up', () => {
    const route = walkRoute('tools', 'mando', radius)
    expect(route).toContainEqual(TREE_SLOTS.malkuth)
    expect(route).toContainEqual(TREE_SLOTS.yesod)
  })

  it('starts and ends at the platform edges, not their centers', () => {
    const route = walkRoute('pulse', 'mando', radius)
    expect(route).toHaveLength(2)
    expect(route[0][1]).toBeCloseTo(TREE_SLOTS.keter[1] + 0.95)
    expect(route[1][1]).toBeCloseTo(TREE_SLOTS.tiferet[1] - 1.02)
  })

  it('walks straight for a station off the tree', () => {
    expect(walkRoute('risk', 'mando', radius)).toHaveLength(2)
  })
})
