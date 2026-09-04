import { ref, onMounted, onUnmounted } from 'vue'

export function useResponsive() {
  const changeDirection = ref<'left' | 'right'>('left')

  const updateDirection = () => {
    changeDirection.value = window.innerWidth <= 768 ? 'right' : 'left'
  }

  onMounted(() => {
    updateDirection()
    window.addEventListener('resize', updateDirection)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateDirection)
  })

  return {
    changeDirection
  }
}
