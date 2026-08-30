import router from '@/router'
import { prefersReducedMotionNow } from '@/composables/useReducedMotion'

const CURTAIN_NAV_DELAY = 900
const CURTAIN_HIDE_DELAY = 3000

// 独立的幕布跳转函数，可以直接导出使用
export function navigateWithCurtain(path: string) {
  if (prefersReducedMotionNow()) {
    router.push(path)
    return
  }
  const curtain = document.querySelector('#curtain') as HTMLElement | null
  if (curtain) {
    curtain.style.display = 'block'
    setTimeout(() => {
      curtain.style.display = ''
    }, CURTAIN_HIDE_DELAY)
  }
  setTimeout(() => {
    router.push(path)
  }, CURTAIN_NAV_DELAY)
}

function showCurtain() {
  if (prefersReducedMotionNow()) return
  const curtain = document.querySelector('#curtain') as HTMLElement | null
  if (curtain) {
    curtain.style.display = 'block'
    setTimeout(() => {
      curtain.style.display = ''
    }, CURTAIN_HIDE_DELAY)
  }
}

function openLinkWithDelay(url: string) {
  const delay = prefersReducedMotionNow() ? 0 : CURTAIN_NAV_DELAY
  setTimeout(() => {
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }, delay)
}

// document 级 click 事件委托：一次注册、无需轮询、天然支持动态新增的 <a>
const SKIP_CURTAIN_HOSTS = new Set(['beian.miit.gov.cn', 'beian.mps.gov.cn'])

function shouldUseCurtain(url: string, link: Element): boolean {
  if (url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
    return false
  }
  // 备案 / 公安网安：法定外链，直接跳，不走黑幕
  if (link.closest('#icp-container')) return false
  try {
    return !SKIP_CURTAIN_HOSTS.has(new URL(url, document.baseURI).hostname)
  } catch {
    return true
  }
}

function handleDocumentClick(e: MouseEvent) {
  const link = e.target instanceof Element ? e.target.closest('a[href]') : null
  if (!link) return

  const url = link.getAttribute('href')
  if (url && shouldUseCurtain(url, link)) {
    e.preventDefault()
    showCurtain()
    openLinkWithDelay(url)
  }
}

export function initLinkHandler() {
  let initialized = false

  function setupLinks() {
    if (initialized) return
    initialized = true

    document.addEventListener('click', handleDocumentClick)
  }

  function cleanup() {
    if (!initialized) return
    initialized = false

    document.removeEventListener('click', handleDocumentClick)
  }

  setupLinks()

  return {
    setup: setupLinks,
    cleanup
  }
}
