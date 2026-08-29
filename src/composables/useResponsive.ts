import { ref, onMounted, onUnmounted } from 'vue'

export function useResponsive() {
  const changeDirection = ref<'left' | 'right'>('left')
  const isMobile = ref(false)

  const updateResponsive = () => {
    isMobile.value = window.innerWidth <= 768
    changeDirection.value = window.innerWidth <= 768 ? 'right' : 'left'
  }

  const checkScreenSize = () => {
    updateResponsive()
  }

  onMounted(() => {
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', checkScreenSize)
  })

  return {
    changeDirection,
    isMobile,
    updateResponsive,
    checkScreenSize
  }
}
