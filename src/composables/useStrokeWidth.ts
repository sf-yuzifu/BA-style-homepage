import { computed, onMounted, onUnmounted, ref } from 'vue'

/**
 * 经验条描边宽度：跟随视口宽度缩放（与游戏 UI 比例一致），下限 4px。
 * LevelCard.vue 使用（大厅与简介页的等级卡片已收敛为同一组件）。
 */
export function useStrokeWidth() {
  const windowWidth = ref(window.innerWidth)

  const updateWidth = () => {
    windowWidth.value = window.innerWidth
  }

  onMounted(() => {
    window.addEventListener('resize', updateWidth)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateWidth)
  })

  const strokeWidth = computed(() => Math.max(4, Math.round(windowWidth.value * 0.0025)))

  return { strokeWidth }
}
