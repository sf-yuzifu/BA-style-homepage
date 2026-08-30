import { ref } from 'vue'

const QUERY = '(prefers-reduced-motion: reduce)'

const prefersReducedMotion = ref(false)
let initialized = false

const apply = (matches: boolean) => {
  prefersReducedMotion.value = matches
}

const ensureListener = () => {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  const mq = window.matchMedia(QUERY)
  apply(mq.matches)
  mq.addEventListener('change', (e) => apply(e.matches))
}

/** 非 Vue 模块（如幕布跳转）同步读取当前偏好 */
export function prefersReducedMotionNow(): boolean {
  ensureListener()
  return prefersReducedMotion.value
}

export function useReducedMotion() {
  ensureListener()
  return { prefersReducedMotion }
}
