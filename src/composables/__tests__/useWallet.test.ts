// @vitest-environment happy-dom
// useWallet 依赖 localStorage / document.visibilityState / window 事件，用 happy-dom 提供

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// useWallet 依赖 useConfig，而 useConfig 模块顶层 import '/_config.yaml'（Vitest 无 yaml 插件）——
// mock 掉；configs 为 null 时 maxAp 走默认 60、gold/pyroxene 初始值走 0
vi.mock('@/composables/useConfig', async () => {
  const { ref } = await import('vue')
  return { useConfig: () => ({ configs: ref(null) }) }
})

const STORAGE_KEY = 'fa-wallet'

/** 模块级单例：每个用例重置模块注册表后重新 import，拿到干净钱包 */
const importWallet = async () => {
  vi.resetModules()
  return await import('@/composables/useWallet')
}

const seedWallet = (state: Record<string, unknown>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const readWallet = (): Record<string, unknown> =>
  JSON.parse(localStorage.getItem(STORAGE_KEY) as string)

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-17T12:00:00'))
})

afterEach(() => {
  // 清掉上一用例模块残留的 tick 定时器，避免跨用例写 localStorage 污染断言
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('useWallet 初始化与签到', () => {
  it('首次访问：满体力（默认上限 60），签到 +40 青辉石、连续 1 天', async () => {
    const { useWallet } = await importWallet()
    const wallet = useWallet()
    wallet.initWallet()
    expect(wallet.ap.value).toBe(60)
    expect(wallet.maxAp.value).toBe(60)
    expect(wallet.pyroxene.value).toBe(40)
  })

  it('连续签到：昨天已签 → 天数 +1，青辉石 +40', async () => {
    seedWallet({ lastSignIn: '2026-09-16', signInDays: 3, pyroxene: 100 })
    const { useWallet } = await importWallet()
    const wallet = useWallet()
    wallet.initWallet()
    expect(wallet.pyroxene.value).toBe(140)
    // signInDays 未直接暴露，经 tooltip 文案验证（configs 为 null 时走英文兜底模板）
    expect(wallet.pyroxeneTooltip.value).toBe('Daily sign-in streak: 4')
  })

  it('断签：上次签到是前天 → 连续天数重置为 1，仍 +40', async () => {
    seedWallet({ lastSignIn: '2026-09-15', signInDays: 3, pyroxene: 100 })
    const { useWallet } = await importWallet()
    const wallet = useWallet()
    wallet.initWallet()
    expect(wallet.pyroxene.value).toBe(140)
    expect(wallet.pyroxeneTooltip.value).toBe('Daily sign-in streak: 1')
  })

  it('同日重复访问：不重复签到', async () => {
    seedWallet({ lastSignIn: '2026-09-17', signInDays: 5, pyroxene: 200 })
    const { useWallet } = await importWallet()
    const wallet = useWallet()
    wallet.initWallet()
    expect(wallet.pyroxene.value).toBe(200)
    expect(wallet.pyroxeneTooltip.value).toBe('Daily sign-in streak: 5')
  })
})

describe('useWallet 体力时间恢复模型', () => {
  it('离线补算：30 分钟恢复 5 点（每 6 分钟 1 点）', async () => {
    seedWallet({ ap: 40, apSettleAt: Date.now() - 30 * 60 * 1000, lastSignIn: '2026-09-17' })
    const { useWallet } = await importWallet()
    const wallet = useWallet()
    wallet.initWallet()
    expect(wallet.ap.value).toBe(45)
  })

  it('恢复不超过上限：59 + 30 分钟 → 60', async () => {
    seedWallet({ ap: 59, apSettleAt: Date.now() - 30 * 60 * 1000, lastSignIn: '2026-09-17' })
    const { useWallet } = await importWallet()
    const wallet = useWallet()
    wallet.initWallet()
    expect(wallet.ap.value).toBe(60)
  })

  it('不足一个恢复间隔：不补点', async () => {
    seedWallet({ ap: 40, apSettleAt: Date.now() - 5 * 60 * 1000, lastSignIn: '2026-09-17' })
    const { useWallet } = await importWallet()
    const wallet = useWallet()
    wallet.initWallet()
    expect(wallet.ap.value).toBe(40)
  })

  it('运行中到点恢复：tick 推进 6 分钟 +1', async () => {
    seedWallet({ ap: 40, apSettleAt: Date.now(), lastSignIn: '2026-09-17' })
    const { useWallet } = await importWallet()
    const wallet = useWallet()
    wallet.initWallet()
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000)
    expect(wallet.ap.value).toBe(41)
  })
})

describe('useWallet 陪伴累积与持久化', () => {
  it('可见时每秒 +6 信用点；每 5 tick 落盘一次', async () => {
    const { useWallet } = await importWallet()
    const wallet = useWallet()
    wallet.initWallet()
    await vi.advanceTimersByTimeAsync(1000)
    expect(wallet.gold.value).toBe(6)
    await vi.advanceTimersByTimeAsync(4000)
    expect(wallet.gold.value).toBe(30)
    expect(readWallet().gold).toBe(30)
  })

  it('后台（visibilityState=hidden）不累积信用点', async () => {
    const { useWallet } = await importWallet()
    const wallet = useWallet()
    wallet.initWallet()
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await vi.advanceTimersByTimeAsync(3000)
    expect(wallet.gold.value).toBe(0)
    spy.mockRestore()
  })
})
