import { ref, onMounted, onUnmounted } from 'vue'

/** Arco Modal 关闭后容器可能仍在 DOM 中，需看 computed display */
export function isModalOpen(): boolean {
  const container = document.querySelector('.arco-modal-container')
  return !!container && window.getComputedStyle(container).display !== 'none'
}

/** 响应式追踪页面上是否有可见的 Arco 弹窗（设置 / 跳过确认等） */
export function useModalOpen() {
  const modalOpen = ref(false)

  const sync = () => {
    modalOpen.value = isModalOpen()
  }

  let observer: MutationObserver | null = null

  onMounted(() => {
    sync()
    observer = new MutationObserver(sync)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    })
  })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
  })

  return { modalOpen, syncModalOpen: sync }
}
