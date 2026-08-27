import { ref, computed } from 'vue'
import { useConfig } from './useConfig'

// 全局 AP 状态
const ap = ref(0)
const lastUpdateTime = ref(Date.now())
let intervalId = null

const DAY_MS = 24 * 60 * 60 * 1000 // 一天的毫秒数

export function useAp() {
  const { configs } = useConfig()

  const maxAp = computed(() => {
    if (!configs.value || !configs.value.level) return 60
    return 60 + configs.value.level * 2
  })

  // 计算当前 AP 值
  const calculateAp = () => {
    const max = maxAp.value
    const now = Date.now()
    const dayStart = new Date(
      `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()} 00:00:00`
    ).getTime()
    const elapsed = now - dayStart
    const dayProgress = elapsed / DAY_MS
    return Math.max(0, max - Math.trunc(max * dayProgress))
  }

  // 初始化 AP
  const initAp = () => {
    ap.value = calculateAp()
    lastUpdateTime.value = Date.now()
    // 启动自动恢复定时器（每秒+1）
    if (!intervalId) {
      intervalId = setInterval(() => {
        if (ap.value < maxAp.value) {
          ap.value++
        }
      }, 60000)
    }
  }

  // 停止自动恢复
  const stopApRecovery = () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  // 获取当前 AP 值
  const getCurrentAp = () => {
    // 如果超过1分钟没有更新，重新计算
    const now = Date.now()
    if (now - lastUpdateTime.value > 60000) {
      ap.value = calculateAp()
      lastUpdateTime.value = now
    }
    return ap.value
  }

  return {
    ap,
    maxAp,
    initAp,
    stopApRecovery,
    getCurrentAp
  }
}
