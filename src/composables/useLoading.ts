import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Modal } from '@arco-design/web-vue'
import { useResourceLoader } from './useResourceLoader'
import { useConfig } from './useConfig'
import { loadFonts } from '@/init/fonts'
import { getFailedLobbyPaths, initLive2D } from '@/init/live2d'
import { prefersReducedMotionNow } from './useReducedMotion'

export function useLoading() {
  const loading = ref(true)
  const percent = ref(0)
  const isReady = ref(false)

  // 添加平滑动画相关状态
  const targetPercent = ref(0)
  const animationFrame = ref<number | null>(null)

  // 使用资源加载管理器和配置
  const resourceLoader = useResourceLoader()
  const { configs, waitForConfig } = useConfig()

  // 平滑动画函数
  const animateProgress = () => {
    const current = percent.value
    const target = targetPercent.value

    if (Math.abs(target - current) < 0.001) {
      percent.value = target
      animationFrame.value = null
      return
    }

    // 使用缓动函数实现平滑过渡
    const easeProgress = current + (target - current) * 0.1
    percent.value = easeProgress

    animationFrame.value = requestAnimationFrame(animateProgress)
  }

  // 开始动画
  const startAnimation = () => {
    if (prefersReducedMotionNow()) {
      if (animationFrame.value) {
        cancelAnimationFrame(animationFrame.value)
        animationFrame.value = null
      }
      percent.value = targetPercent.value
      return
    }
    if (animationFrame.value) {
      cancelAnimationFrame(animationFrame.value)
    }
    animationFrame.value = requestAnimationFrame(animateProgress)
  }

  // 监听加载进度变化 - 使用目标进度和动画
  watch(
    () => ({
      progress: resourceLoader.progress.value,
      loaded: resourceLoader.loadedCount.value,
      total: resourceLoader.totalCount.value,
      isComplete: resourceLoader.isComplete.value,
      isLoading: resourceLoader.isLoading.value
    }),
    (newState) => {
      // 计算平滑进度
      const baseProgress = newState.progress

      // 为正在加载的资源添加额外进度
      let smoothProgress = baseProgress
      if (newState.total > 0 && newState.loaded < newState.total) {
        const loadingBonus = Math.min((newState.total - newState.loaded) * 0.1, 0.1)
        smoothProgress = Math.min(baseProgress + loadingBonus, 0.95) // 最多到95%
      }

      // 如果所有资源都加载完成，确保进度达到100%
      if (newState.isComplete && !newState.isLoading) {
        smoothProgress = 1.0
      }

      // 更新目标进度，启动动画
      targetPercent.value = smoothProgress
      startAnimation()

      // 检查是否所有资源都加载完成
      if (newState.isComplete && !newState.isLoading) {
        // 确保进度达到100%
        targetPercent.value = 1
        startAnimation()

        if (prefersReducedMotionNow()) {
          finishLoading()
        } else {
          setTimeout(() => {
            finishLoading()
          }, 800)
        }
      }
    },
    { immediate: true }
  )

  // 初始化资源加载
  const initializeResourceLoading = async () => {
    // 等待配置加载完成
    const config = await waitForConfig()

    // 添加字体加载任务
    resourceLoader.addResource('fonts_ready', '', 'font')

    // 添加Live2D资源（根据实际配置动态添加）
    if (config.memorialLobbies && Array.isArray(config.memorialLobbies)) {
      config.memorialLobbies.forEach((lobby, index) => {
        resourceLoader.addResource(`live2d_skeleton_${index}`, lobby.path + lobby.skel, 'live2d')
        resourceLoader.addResource(`live2d_atlas_${index}`, lobby.path + lobby.atlas, 'live2d')
      })
    }

    // 等待字体加载完成
    await loadFonts()

    // 等待Live2D加载完成
    await initLive2D()
  }

  // 开始加载
  const startLoading = async () => {
    await initializeResourceLoading()

    // 开始批量加载
    await resourceLoader.loadAll()
  }

  onUnmounted(() => {
    // 清理动画帧与资源加载状态
    if (animationFrame.value) {
      cancelAnimationFrame(animationFrame.value)
    }
    resourceLoader.reset()
  })

  // 完成加载（仅在资源全部就绪时调用）
  const finishLoading = () => {
    // 清理动画
    if (animationFrame.value) {
      cancelAnimationFrame(animationFrame.value)
      animationFrame.value = null
    }

    percent.value = 1
    loading.value = false
    isReady.value = true

    notifyIfDegraded()
  }

  // 有角色资源重试后仍失败时，给出用户可见的降级提示（与 PWA 更新提示一致走 Modal）
  const notifyIfDegraded = () => {
    if (getFailedLobbyPaths().length === 0) return

    const t = configs.value?.translate
    Modal.open({
      title: t?.info || 'Info',
      content:
        t?.loadDegraded ||
        'Some resources failed to load after several attempts. Check your network and refresh to retry.',
      okText: t?.ok || 'OK',
      hideCancel: true
    })
  }

  onMounted(() => {
    const begin = () => {
      startLoading().catch((error) => {
        // 有意不强制进大厅：资源未全部就绪则留在加载屏（还原游戏必须加载完才进）
        console.error('资源加载失败，停留在加载界面:', error)
      })
    }
    // 减少动效时跳过人为延迟，否则让 Loading 先亮起再从 0% 开始
    if (prefersReducedMotionNow()) {
      begin()
    } else {
      setTimeout(begin, 300)
    }
  })

  return {
    // 响应式状态
    loading,
    percent,
    isReady,

    // 资源加载器状态
    resourceLoader,

    // 方法
    startLoading,
    finishLoading,

    // 获取详细状态
    getLoadingStatus: () => resourceLoader.getStatus()
  }
}
