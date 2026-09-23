<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { useGuide, isElVisible } from '@/composables/useGuide'
import { useModalOpen } from '@/composables/useModalOpen'

const { active, stepIndex, steps, currentStep, next, prev, goto, skip } = useGuide()
const { configs } = useConfig()
const { modalOpen } = useModalOpen()

const t = computed(() => configs.value?.translate ?? {})
const title = computed(() => {
  const key = currentStep.value?.titleKey
  return (key && t.value[key]) || ''
})
const desc = computed(() => {
  const key = currentStep.value?.descKey
  return (key && t.value[key]) || ''
})
const isLast = computed(() => stepIndex.value >= steps.value.length - 1)

interface SpotRect {
  left: number
  top: number
  width: number
  height: number
}

const spots = ref<SpotRect[]>([])
const cardEl = ref<HTMLElement | null>(null)
const cardPos = ref({ left: 0, top: 0 })
const clipD = ref('')

const GAP = 14
const VIEWPORT_MARGIN = 12
/** 方框外扩：兜住 drop-shadow / skew 角部一类视觉溢出 */
const HOLE_PAD = 10
/** 后代溢出计入上限：角标上溢（BGM♪）、内部撑出（Footer project-box）计入；translateX(100vw) 隐藏图标排除 */
const CHILD_OVERFLOW = 56
/** multi 目标邻近合并阈值：间距不超过它的矩形并成一个方框（钱包三格合一） */
const MERGE_GAP = 24

const clamp = (value: number, min: number, max: number) =>
  max < min ? min : Math.min(Math.max(value, min), max)

const parsePx = (value: string): number | null => {
  if (!value || value === 'auto') return null
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

type Box = { left: number; top: number; width: number; height: number }

/**
 * 元素视觉并集：自身 + 可见后代近端溢出 + 可测的绝对定位伪元素，再外扩 HOLE_PAD。
 * 隐藏元素（display/visibility/opacity）与远端图标（l2d 按钮 translateX(100vw)）不计入。
 */
const measureElRect = (el: HTMLElement): SpotRect => {
  let l = Infinity
  let t = Infinity
  let r = -Infinity
  let b = -Infinity
  const eat = (rect: Box) => {
    if (rect.width <= 0 || rect.height <= 0) return
    l = Math.min(l, rect.left)
    t = Math.min(t, rect.top)
    r = Math.max(r, rect.left + rect.width)
    b = Math.max(b, rect.top + rect.height)
  }

  const base = el.getBoundingClientRect()
  eat({ left: base.left, top: base.top, width: base.width, height: base.height })

  el.querySelectorAll<HTMLElement>('*').forEach((child) => {
    const cs = window.getComputedStyle(child)
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return
    const rect = child.getBoundingClientRect()
    eat({
      left: Math.max(rect.left, base.left - CHILD_OVERFLOW),
      top: Math.max(rect.top, base.top - CHILD_OVERFLOW),
      width:
        Math.min(rect.right, base.right + CHILD_OVERFLOW) -
        Math.max(rect.left, base.left - CHILD_OVERFLOW),
      height:
        Math.min(rect.bottom, base.bottom + CHILD_OVERFLOW) -
        Math.max(rect.top, base.top - CHILD_OVERFLOW)
    })
  })

  // 绝对定位伪元素（LevelCard 斜切尾巴等）：按 computed 偏移量还原矩形
  ;(['::before', '::after'] as const).forEach((pseudo) => {
    const cs = window.getComputedStyle(el, pseudo)
    if (!cs.content || cs.content === 'none' || cs.content === 'normal') return
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return
    if (cs.position !== 'absolute' && cs.position !== 'fixed') return
    const w = parsePx(cs.width)
    const h = parsePx(cs.height)
    const left = parsePx(cs.left)
    const right = parsePx(cs.right)
    const top = parsePx(cs.top)
    const bottom = parsePx(cs.bottom)
    let pl: number | null = null
    let pt: number | null = null
    let pw = w
    let ph = h
    if (w != null && left != null) pl = base.left + left
    else if (w != null && right != null) pl = base.right - right - w
    else if (left != null && right != null) {
      pl = base.left + left
      pw = base.width - left - right
    }
    if (h != null && top != null) pt = base.top + top
    else if (h != null && bottom != null) pt = base.bottom - bottom - h
    else if (top != null && bottom != null) {
      pt = base.top + top
      ph = base.height - top - bottom
    }
    if (pl == null || pt == null || pw == null || ph == null) return
    eat({ left: pl, top: pt, width: pw, height: ph })
  })

  if (!isFinite(l)) return { left: 0, top: 0, width: 0, height: 0 }
  return {
    left: l - HOLE_PAD,
    top: t - HOLE_PAD,
    width: r - l + HOLE_PAD * 2,
    height: b - t + HOLE_PAD * 2
  }
}

/** 邻近矩形合并：gap ≤ MERGE_GAP 的两两并集，迭代至稳定（钱包三格 → 一个框） */
const mergeSpots = (rects: SpotRect[]): SpotRect[] => {
  let merged = [...rects]
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < merged.length && !changed; i += 1) {
      for (let j = i + 1; j < merged.length; j += 1) {
        const a = merged[i]
        const b = merged[j]
        const apartX =
          a.left > b.left + b.width + MERGE_GAP || b.left > a.left + a.width + MERGE_GAP
        const apartY = a.top > b.top + b.height + MERGE_GAP || b.top > a.top + a.height + MERGE_GAP
        if (apartX || apartY) continue
        const union = {
          left: Math.min(a.left, b.left),
          top: Math.min(a.top, b.top),
          width: Math.max(a.left + a.width, b.left + b.width) - Math.min(a.left, b.left),
          height: Math.max(a.top + a.height, b.top + b.height) - Math.min(a.top, b.top)
        }
        merged = merged.filter((_, k) => k !== i && k !== j).concat(union)
        changed = true
        break
      }
    }
  }
  return merged
}

const measureSpots = (): SpotRect[] => {
  const step = currentStep.value
  if (!step || step.center) return []
  const els = (
    step.multi
      ? Array.from(document.querySelectorAll<HTMLElement>(step.selector))
      : ([document.querySelector<HTMLElement>(step.selector)].filter(Boolean) as HTMLElement[])
  ).filter(isElVisible)
  return mergeSpots(els.map(measureElRect).filter((r) => r.width > 2 && r.height > 2))
}

/** SVG 路径 evenodd 挖孔：外框 + 各孔子路径，单层遮罩多孔不叠影（box-shadow 多孔会互相涂暗） */
const buildClipD = (rects: Box[], vw: number, vh: number): string => {
  const rectPath = (b: Box) =>
    `M ${b.left} ${b.top} H ${b.left + b.width} V ${b.top + b.height} H ${b.left} Z`
  return [rectPath({ left: 0, top: 0, width: vw, height: vh }), ...rects.map(rectPath)].join(' ')
}

const layout = async () => {
  if (!active.value || !currentStep.value) return
  spots.value = measureSpots()
  const vw = window.innerWidth
  const vh = window.innerHeight
  clipD.value = currentStep.value.center ? '' : buildClipD(spots.value, vw, vh)
  await nextTick()
  const cardRect = cardEl.value?.getBoundingClientRect()
  const cardW = cardRect?.width || 300
  const cardH = cardRect?.height || 140

  if (currentStep.value.center || spots.value.length === 0) {
    cardPos.value = {
      left: clamp((vw - cardW) / 2, VIEWPORT_MARGIN, vw - cardW - VIEWPORT_MARGIN),
      top: clamp((vh - cardH) / 2, VIEWPORT_MARGIN, vh - cardH - VIEWPORT_MARGIN)
    }
    return
  }

  const left0 = Math.min(...spots.value.map((s) => s.left))
  const top0 = Math.min(...spots.value.map((s) => s.top))
  const right0 = Math.max(...spots.value.map((s) => s.left + s.width))
  const bottom0 = Math.max(...spots.value.map((s) => s.top + s.height))

  // 优先落在目标下方，放不下依次上 / 右 / 左，最后视口收边
  let top = bottom0 + GAP
  if (top + cardH > vh - VIEWPORT_MARGIN) top = top0 - GAP - cardH
  if (top < VIEWPORT_MARGIN) {
    top = clamp((top0 + bottom0 - cardH) / 2, VIEWPORT_MARGIN, vh - cardH - VIEWPORT_MARGIN)
  }
  const left = clamp((left0 + right0 - cardW) / 2, VIEWPORT_MARGIN, vw - cardW - VIEWPORT_MARGIN)
  cardPos.value = { left, top }
}

const onKeydown = (e: KeyboardEvent) => {
  if (!active.value || modalOpen.value) return
  // capture 阶段吞掉引导键，先于 window 冒泡监听（大厅 ←/→ 切角色、MusicBanner seek）
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    e.stopPropagation()
    next()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    e.stopPropagation()
    prev()
  } else if (e.key === 'Home') {
    e.preventDefault()
    e.stopPropagation()
    goto(0)
  } else if (e.key === 'End') {
    e.preventDefault()
    e.stopPropagation()
    goto(steps.value.length - 1)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    skip()
  }
}

const onResize = () => {
  void layout()
}

watch([active, stepIndex], async () => {
  if (active.value) {
    await layout()
    cardEl.value?.focus()
  } else {
    spots.value = []
    clipD.value = ''
  }
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown, true)
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div v-if="active && !modalOpen" class="guide-root">
    <!-- 全屏吃点击（目标区不可点，同 ElTour target-area-clickable:false） -->
    <div class="guide-backdrop" aria-hidden="true" @click="skip"></div>
    <!-- SVG clipPath evenodd 挖孔（单层遮罩多孔不叠影）；pointer-events:none 不挡点击 -->
    <svg class="guide-clip-defs" width="0" height="0" aria-hidden="true">
      <defs>
        <clipPath id="guide-holes" clipPathUnits="userSpaceOnUse">
          <path :d="clipD" clip-rule="evenodd"></path>
        </clipPath>
      </defs>
    </svg>
    <div
      class="guide-mask"
      :style="clipD ? { clipPath: 'url(#guide-holes)' } : undefined"
      aria-hidden="true"
    ></div>
    <!-- 可见方框：把目标括起来 -->
    <div
      v-for="(spot, index) in spots"
      :key="index"
      class="guide-frame"
      :style="{
        left: spot.left + 'px',
        top: spot.top + 'px',
        width: spot.width + 'px',
        height: spot.height + 'px'
      }"
      aria-hidden="true"
    ></div>
    <div
      ref="cardEl"
      class="guide-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-card-title"
      :style="{ left: cardPos.left + 'px', top: cardPos.top + 'px' }"
      tabindex="-1"
    >
      <p id="guide-card-title" class="guide-card-title">{{ title }}</p>
      <p class="guide-card-desc">{{ desc }}</p>
      <div class="guide-card-foot">
        <span class="guide-card-count">{{ stepIndex + 1 }} / {{ steps.length }}</span>
        <div class="guide-card-actions">
          <button
            type="button"
            class="guide-btn css-cursor-hover-enabled"
            :disabled="stepIndex === 0"
            @click="prev"
          >
            {{ t.guidePrev || 'Previous' }}
          </button>
          <button
            type="button"
            class="guide-btn css-cursor-hover-enabled"
            @click="isLast ? skip() : next()"
          >
            {{ isLast ? t.guideDone || 'Done' : t.guideNext || 'Next' }}
          </button>
          <button type="button" class="guide-btn css-cursor-hover-enabled" @click="skip">
            {{ t.guideSkip || 'Skip' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* z 60：高于台词层 50、低于 Modal。三层分离：backdrop 吃点击 / mask 挖孔涂暗 / frame 亮框 */
.guide-root {
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: none;
}

.guide-backdrop {
  position: fixed;
  inset: 0;
  pointer-events: auto;
}

.guide-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.guide-clip-defs {
  position: absolute;
  width: 0;
  height: 0;
}

.guide-frame {
  position: fixed;
  border: clamp(2px, calc(0.125 * var(--u)), 100vw) solid #4ec3f5;
  border-radius: clamp(6px, calc(0.375 * var(--u)), 100vw);
  box-sizing: border-box;
  pointer-events: none;
}

.guide-card {
  position: fixed;
  z-index: 61;
  pointer-events: auto;
  width: min(clamp(300px, calc(24 * var(--u)), 420px), calc(100vw - 2 * var(--safe-left) - 24px));
  padding: clamp(14px, calc(0.875 * var(--u)), 100vw) clamp(18px, calc(1.125 * var(--u)), 100vw);
  box-sizing: border-box;
  background: #fff;
  color: #003153;
  border: 1px solid #e8f0f5;
  border-radius: clamp(8px, calc(0.5 * var(--u)), 100vw);
  box-shadow: 0 clamp(4px, calc(0.25 * var(--u)), 100vw) clamp(16px, calc(1 * var(--u)), 100vw)
    rgba(0, 0, 0, 0.18);
  outline: none;
}

.guide-card:focus-visible {
  outline: clamp(2px, calc(0.125 * var(--u)), 100vw) solid #3987ff;
}

.guide-card-title {
  margin: 0 0 clamp(6px, calc(0.375 * var(--u)), 100vw);
  font-weight: bold;
  font-size: clamp(16px, calc(1 * var(--u)), 100vw);
}

.guide-card-desc {
  margin: 0 0 clamp(10px, calc(0.625 * var(--u)), 100vw);
  font-size: clamp(14px, calc(0.875 * var(--u)), 100vw);
  line-height: 1.6;
}

.guide-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(8px, calc(0.5 * var(--u)), 100vw);
}

.guide-card-count {
  font-size: clamp(13px, calc(0.8125 * var(--u)), 100vw);
  white-space: nowrap;
  opacity: 0.75;
}

.guide-card-actions {
  display: flex;
  gap: clamp(6px, calc(0.375 * var(--u)), 100vw);
}

.guide-btn {
  appearance: none;
  border: none;
  padding: clamp(4px, calc(0.25 * var(--u)), 100vw) clamp(12px, calc(0.75 * var(--u)), 100vw);
  font: inherit;
  font-size: clamp(13px, calc(0.8125 * var(--u)), 100vw);
  font-weight: bold;
  color: #003153;
  background: #e8f6fd;
  border-radius: clamp(4px, calc(0.25 * var(--u)), 100vw);
  cursor: pointer;
}

@media (prefers-reduced-motion: no-preference) {
  .guide-card,
  .guide-frame {
    transition:
      left 0.25s ease,
      top 0.25s ease,
      width 0.25s ease,
      height 0.25s ease;
  }
}

.guide-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.guide-btn:not(:disabled):hover {
  background: #d3effc;
}
</style>
