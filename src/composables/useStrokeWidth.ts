import { computed, onMounted, onUnmounted, ref } from 'vue'

/**
 * 经验条描边宽度：跟随设计单位 --u 缩放（与游戏 UI 比例一致），下限 4px。
 * 与 CSS 的 calc(N * var(--u)) 同公式：u = min(1vw, 1.78vh)（宽高比 >16:9 时跟高度走）。
 * LevelCard.vue 使用（大厅与简介页的等级卡片已收敛为同一组件）。
 */
export function useStrokeWidth() {
  const windowWidth = ref(window.innerWidth)
  const windowHeight = ref(window.innerHeight)

  const updateWidth = () => {
    windowWidth.value = window.innerWidth
    windowHeight.value = window.innerHeight
  }

  onMounted(() => {
    window.addEventListener('resize', updateWidth)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateWidth)
  })

  const strokeWidth = computed(() => {
    const u = Math.min(windowWidth.value / 100, windowHeight.value * 0.0178)
    return Math.max(4, Math.round(0.25 * u))
  })

  return { strokeWidth }
}
