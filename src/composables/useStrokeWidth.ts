import { computed, onMounted, onUnmounted, ref } from 'vue'

/**
 * 经验条描边宽度：跟随视口宽度缩放（与游戏 UI 比例一致），下限 4px。
 * Level.vue（大厅）与 Bio.vue（简介页）共用。
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
