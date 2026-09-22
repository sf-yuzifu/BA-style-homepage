// @vitest-environment happy-dom
// useGuide 依赖 document.querySelector 解析目标点位、useSettings 走 localStorage，
// 用 happy-dom 提供两者（对齐 useWallet.test.ts 的约定）

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const STORAGE_KEY = 'fa-settings'

/** 模块级单例：每个用例重置模块注册表后重新 import，拿到干净引导状态机 */
const importGuide = async () => {
  vi.resetModules()
  return await import('@/composables/useGuide')
}

const importSettings = async () => {
  vi.resetModules()
  return await import('@/composables/useSettings')
}

const seedTargets = (names: string[]) => {
  document.body.innerHTML = names
    .map((name) =>
      name === 'stage' ? '<canvas id="l2d-canvas"></canvas>' : `<div data-tour="${name}"></div>`
    )
    .join('')
}

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.clearAllTimers()
})

describe('useGuide 步骤解析', () => {
  it('全部点位就绪：11 步全保留（含 icp 条件步与 stage 彩蛋步）', async () => {
    seedTargets([
      'level',
      'wallet',
      'settings',
      'task',
      'music',
      'l2d-toggle',
      'contact',
      'icp',
      'footer',
      'switch',
      'stage'
    ])
    const { useGuide, GUIDE_STEPS } = await importGuide()
    expect(GUIDE_STEPS).toHaveLength(11)
    const guide = useGuide()
    await guide.requestStart(0)
    expect(guide.active.value).toBe(true)
    expect(guide.steps.value).toHaveLength(11)
  })

  it('无 icp 点位：条件步自动跳过，剩 10 步', async () => {
    seedTargets([
      'level',
      'wallet',
      'settings',
      'task',
      'music',
      'l2d-toggle',
      'contact',
      'footer',
      'switch',
      'stage'
    ])
    const { useGuide } = await importGuide()
    const guide = useGuide()
    await guide.requestStart(0)
    expect(guide.steps.value).toHaveLength(10)
    expect(guide.steps.value.map((s) => s.selector)).not.toContain('[data-tour="icp"]')
  })

  it('WebGL 降级（无 canvas）：stage 彩蛋步一并跳过', async () => {
    seedTargets(['level', 'wallet', 'settings', 'task', 'music', 'l2d-toggle', 'contact', 'footer'])
    const { useGuide } = await importGuide()
    const guide = useGuide()
    await guide.requestStart(0)
    expect(guide.steps.value).toHaveLength(8)
    expect(guide.steps.value.map((s) => s.selector)).not.toContain('#l2d-canvas')
  })

  it('MusicBanner 未挂载等零星缺失：按序跳过，剩余步骤保持原顺序', async () => {
    seedTargets(['level', 'wallet', 'settings', 'task', 'contact', 'footer', 'switch', 'stage'])
    const { useGuide } = await importGuide()
    const guide = useGuide()
    await guide.requestStart(0)
    const selectors = guide.steps.value.map((s) => s.selector)
    expect(selectors).toEqual([
      '[data-tour="level"]',
      '[data-tour="wallet"]',
      '[data-tour="settings"]',
      '[data-tour="task"]',
      '[data-tour="contact"]',
      '[data-tour="footer"]',
      '[data-tour="switch"]',
      '#l2d-canvas'
    ])
  })

  it('零可用点位：不启动', async () => {
    const { useGuide } = await importGuide()
    const guide = useGuide()
    await guide.requestStart(0)
    expect(guide.active.value).toBe(false)
  })

  it('CSS 隐藏点位不进步骤（窄屏 display:none 的钱包等）', async () => {
    seedTargets(['level', 'settings', 'task', 'footer'])
    const hidden = document.createElement('div')
    hidden.setAttribute('data-tour', 'wallet')
    hidden.style.display = 'none'
    document.body.appendChild(hidden)
    const faded = document.createElement('div')
    faded.setAttribute('data-tour', 'music')
    faded.style.opacity = '0'
    document.body.appendChild(faded)
    const { useGuide } = await importGuide()
    const guide = useGuide()
    await guide.requestStart(0)
    expect(guide.active.value).toBe(true)
    expect(guide.steps.value.map((s) => s.selector)).toEqual([
      '[data-tour="level"]',
      '[data-tour="settings"]',
      '[data-tour="task"]',
      '[data-tour="footer"]'
    ])
  })

  it('multi 点位任一可见即保留（钱包三格部分渲染）', async () => {
    const gone = document.createElement('div')
    gone.setAttribute('data-tour', 'wallet')
    gone.style.display = 'none'
    document.body.appendChild(gone)
    seedTargets(['wallet', 'level'])
    const { useGuide } = await importGuide()
    const guide = useGuide()
    await guide.requestStart(0)
    expect(guide.steps.value.map((s) => s.selector)).toEqual([
      '[data-tour="level"]',
      '[data-tour="wallet"]'
    ])
  })
})

describe('useGuide 步进边界', () => {
  it('首步 prev 不动；末步 next 即结束并记 guideSeen', async () => {
    seedTargets(['level', 'wallet', 'settings'])
    const { useGuide } = await importGuide()
    const guide = useGuide()
    await guide.requestStart(0)
    expect(guide.stepIndex.value).toBe(0)
    guide.prev()
    expect(guide.stepIndex.value).toBe(0)
    guide.next()
    guide.next()
    expect(guide.stepIndex.value).toBe(2)
    expect(guide.active.value).toBe(true)
    guide.next()
    expect(guide.active.value).toBe(false)
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) as string)
    expect(saved.guideSeen).toBe(true)
  })

  it('skip 立即结束并记 guideSeen；goto 收拢越界索引', async () => {
    seedTargets(['level', 'wallet', 'settings'])
    const { useGuide } = await importGuide()
    const guide = useGuide()
    await guide.requestStart(0)
    guide.goto(99)
    expect(guide.stepIndex.value).toBe(2)
    guide.goto(-5)
    expect(guide.stepIndex.value).toBe(0)
    guide.skip()
    expect(guide.active.value).toBe(false)
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) as string)
    expect(saved.guideSeen).toBe(true)
  })
})

describe('guideSeen 持久化', () => {
  it('看过后 shouldShowGuide 为 false；删键清档后恢复可自动播放', async () => {
    seedTargets(['level'])
    const mod = await importSettings()
    const settings = mod.useSettings()
    expect(settings.shouldShowGuide()).toBe(true)
    settings.markGuideSeen()
    expect(settings.shouldShowGuide()).toBe(false)
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) as string)
    expect(saved.guideSeen).toBe(true)

    // 删键 = 清档：新实例（模拟其他标签页 storage 同步后的重载）应恢复默认
    localStorage.removeItem(STORAGE_KEY)
    const fresh = await importSettings()
    expect(fresh.useSettings().shouldShowGuide()).toBe(true)
  })

  it('seed guideSeen: true 时不再自动播放', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ guideSeen: true }))
    const mod = await importSettings()
    expect(mod.useSettings().shouldShowGuide()).toBe(false)
  })
})
