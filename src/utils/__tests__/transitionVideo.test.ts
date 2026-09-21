import { describe, it, expect } from 'vitest'
import {
  drawTransitionVariant,
  TRANSITION_SETS,
  type TransitionVariant
} from '@/utils/transitionVideo'

describe('drawTransitionVariant', () => {
  it('注入 rng：< 0.5 抽中 PLANA', () => {
    expect(drawTransitionVariant(() => 0.49)).toBe('plana')
  })

  it('注入 rng：边界 0.5 归 Arona 侧', () => {
    expect(drawTransitionVariant(() => 0.5)).toBe('arona')
  })

  it('注入 rng：两端取值', () => {
    expect(drawTransitionVariant(() => 0)).toBe('plana')
    expect(drawTransitionVariant(() => 0.999)).toBe('arona')
  })

  it('默认 Math.random：结果只在两变体内', () => {
    const valid: TransitionVariant[] = ['arona', 'plana']
    for (let i = 0; i < 50; i++) {
      expect(valid).toContain(drawTransitionVariant())
    }
  })
})

describe('TRANSITION_SETS', () => {
  it('两变体字段完整且非空', () => {
    for (const key of ['arona', 'plana'] as const) {
      const set = TRANSITION_SETS[key]
      expect(set.mov).toMatch(/^\/.+\.mov$/)
      expect(set.webm).toMatch(/^\/.+\.webm$/)
      expect(set.curtainBg).toMatch(/^\/.+\.png$/)
    }
  })

  it('两变体资源互不相同', () => {
    expect(TRANSITION_SETS.arona.mov).not.toBe(TRANSITION_SETS.plana.mov)
    expect(TRANSITION_SETS.arona.webm).not.toBe(TRANSITION_SETS.plana.webm)
    expect(TRANSITION_SETS.arona.curtainBg).not.toBe(TRANSITION_SETS.plana.curtainBg)
  })
})
