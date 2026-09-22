import { computed, nextTick, ref } from 'vue'
import { useSettings } from '@/composables/useSettings'

/** 单步定义：目标 DOM 选择器 + 文案键 */
export interface GuideStep {
  /** 目标选择器（data-tour 点位；舞台彩蛋步为 #l2d-canvas） */
  selector: string
  titleKey: string
  descKey: string
  /** 多元素目标（钱包三格 / 双侧箭头）：逐元素挖孔 */
  multi?: boolean
  /** 居中卡片、不挖孔（舞台彩蛋步：彩蛋在整个画布上，挖孔无意义） */
  center?: boolean
}

/**
 * 全量步骤表（10 固定 + 1 条件）：icp 步仅在配置了备案时有点位；
 * stage 步仅在 WebGL 可用（canvas 存在）时保留。resolve 阶段过滤缺失点位，
 * MusicBanner 等晚挂载点位由 requestStart 的 settle 等待覆盖。
 */
export const GUIDE_STEPS: GuideStep[] = [
  { selector: '[data-tour="level"]', titleKey: 'guideStep1Title', descKey: 'guideStep1Desc' },
  {
    selector: '[data-tour="wallet"]',
    titleKey: 'guideStep2Title',
    descKey: 'guideStep2Desc',
    multi: true
  },
  { selector: '[data-tour="settings"]', titleKey: 'guideStep3Title', descKey: 'guideStep3Desc' },
  { selector: '[data-tour="task"]', titleKey: 'guideStep4Title', descKey: 'guideStep4Desc' },
  { selector: '[data-tour="music"]', titleKey: 'guideStep5Title', descKey: 'guideStep5Desc' },
  {
    selector: '[data-tour="l2d-toggle"]',
    titleKey: 'guideStep6Title',
    descKey: 'guideStep6Desc'
  },
  { selector: '[data-tour="contact"]', titleKey: 'guideStep7Title', descKey: 'guideStep7Desc' },
  { selector: '[data-tour="icp"]', titleKey: 'guideStep8Title', descKey: 'guideStep8Desc' },
  { selector: '[data-tour="footer"]', titleKey: 'guideStep9Title', descKey: 'guideStep9Desc' },
  {
    selector: '[data-tour="switch"]',
    titleKey: 'guideStep10Title',
    descKey: 'guideStep10Desc',
    multi: true
  },
  {
    selector: '#l2d-canvas',
    titleKey: 'guideStep11Title',
    descKey: 'guideStep11Desc',
    center: true
  }
]

/** 晚挂载点位（MusicBanner 首次揭示才挂异步 chunk）的等待上限 */
const DEFAULT_SETTLE_MS = 350

const active = ref(false)
const stepIndex = ref(0)
const steps = ref<GuideStep[]>([])

const currentStep = computed<GuideStep | null>(() => steps.value[stepIndex.value] ?? null)

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 元素可见性：覆盖自身与祖先的 display/visibility/opacity；旧环境回退本元素 computed style */
export const isElVisible = (el: HTMLElement): boolean => {
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  }
  const cs = window.getComputedStyle(el)
  return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) !== 0
}

/** 仅保留 DOM 中有**可见**点位的步骤：CSS 藏掉的（窄屏 `display:none` 的钱包等）不算，
 * icp / stage 等条件步由此自动跳过；multi 点位任一可见即保留 */
const isTargetVisible = (selector: string): boolean =>
  Array.from(document.querySelectorAll<HTMLElement>(selector)).some(isElVisible)

const selectAvailable = (
  list: GuideStep[],
  isPresent: (selector: string) => boolean
): GuideStep[] => list.filter((step) => isPresent(step.selector))

const finish = () => {
  active.value = false
  steps.value = []
  stepIndex.value = 0
  useSettings().markGuideSeen()
}

export function useGuide() {
  /** 启动引导：等晚挂载点位落位后解析可用步骤；零可用步骤则不启动 */
  const requestStart = async (settleMs: number = DEFAULT_SETTLE_MS) => {
    if (active.value) return
    await nextTick()
    if (settleMs > 0) await delay(settleMs)
    const resolved = selectAvailable(GUIDE_STEPS, isTargetVisible)
    if (resolved.length === 0) return
    steps.value = resolved
    stepIndex.value = 0
    active.value = true
  }

  const goto = (index: number) => {
    if (!active.value || steps.value.length === 0) return
    stepIndex.value = Math.min(Math.max(index, 0), steps.value.length - 1)
  }

  /** 前进；已在末步即结束引导 */
  const next = () => {
    if (!active.value) return
    if (stepIndex.value >= steps.value.length - 1) {
      finish()
      return
    }
    stepIndex.value += 1
  }

  const prev = () => goto(stepIndex.value - 1)
  /** 跳过 = 立即结束（tour 非破坏性，不做确认） */
  const skip = () => finish()

  return {
    active,
    stepIndex,
    steps,
    currentStep,
    requestStart,
    next,
    prev,
    goto,
    skip,
    finish
  }
}
