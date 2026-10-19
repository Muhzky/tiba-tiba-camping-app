import { describe, expect, it } from 'vitest'
import { evaluateRecommender, precisionAtK, recallAtK } from './evaluate'

describe('metrik evaluasi (murni)', () => {
  it('precisionAtK: rasio hit terhadap k', () => {
    const rel = new Set(['a', 'b'])
    expect(precisionAtK(['a', 'b', 'c', 'd'], rel, 4)).toBeCloseTo(0.5)
    expect(precisionAtK(['a', 'b', 'c', 'd'], rel, 2)).toBeCloseTo(1)
    expect(precisionAtK(['x', 'y'], rel, 2)).toBe(0)
    expect(precisionAtK(['a'], rel, 0)).toBe(0)
  })

  it('recallAtK: proporsi relevan yang ditemukan', () => {
    const rel = new Set(['a', 'b'])
    expect(recallAtK(['a', 'c', 'd'], rel, 3)).toBeCloseTo(0.5)
    expect(recallAtK(['x', 'a'], rel, 2)).toBeCloseTo(0.5)
    expect(recallAtK([], rel, 3)).toBe(0)
    expect(recallAtK(['a'], new Set(), 1)).toBe(0)
  })

  it('evaluateRecommender: bentuk hasil & rentang nilai valid', async () => {
    const result = await evaluateRecommender([3, 5])
    expect(result.ks).toEqual([3, 5])
    expect(result.cbf).toHaveLength(2)
    expect(result.baseline).toHaveLength(2)
    expect(result.users).toBeGreaterThanOrEqual(0)
    expect(result.candidates).toBeGreaterThanOrEqual(0)
    for (const m of [...result.cbf, ...result.baseline]) {
      expect(m.precision).toBeGreaterThanOrEqual(0)
      expect(m.precision).toBeLessThanOrEqual(1)
      expect(m.recall).toBeGreaterThanOrEqual(0)
      expect(m.recall).toBeLessThanOrEqual(1)
    }
  })
})
