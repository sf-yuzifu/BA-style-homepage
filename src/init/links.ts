import router from '@/router'

// 独立的幕布跳转函数，可以直接导出使用
export function navigateWithCurtain(path: string) {
  const curtain = document.querySelector('#curtain') as HTMLElement | null
  if (curtain) {
    curtain.style.display = 'block'
    setTimeout(() => {
      curtain.style.display = ''
    }, 3000)
  }
  setTimeout(() => {
    router.push(path)
  }, 900)
}

function showCurtain() {
  const curtain = document.querySelector('#curtain') as HTMLElement | null
  if (curtain) {
    curtain.style.display = 'block'
    setTimeout(() => {
      curtain.style.display = ''
    }, 3000)
  }
}

function openLinkWithDelay(url: string) {
  setTimeout(() => {
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }, 900)
}

// document 级 click 事件委托：一次注册、无需轮询、天然支持动态新增的 <a>
function handleDocumentClick(e: MouseEvent) {
  const link = e.target instanceof Element ? e.target.closest('a[href]') : null
  if (!link) return

  const url = link.getAttribute('href')
  if (url && !url.startsWith('#') && !url.startsWith('mailto:') && !url.startsWith('tel:')) {
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
