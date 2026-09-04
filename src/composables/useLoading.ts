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

  // 注册资源加载队列（只注册，不开始加载；真实加载在 startLoading 中与进度消费并行启动）
  const initializeResourceLoading = async () => {
    // 等待配置加载完成
    const config = await waitForConfig()

    // 添加字体加载任务
    resourceLoader.addResource('fonts_ready', '', 'font')

    // 添加Live2D资源：按角色注册（粒度 N+1），逐角色完成时进度条线性推进
    if (config.memorialLobbies && Array.isArray(config.memorialLobbies)) {
      config.memorialLobbies.forEach((lobby, index) => {
        resourceLoader.addResource(`live2d_${index}`, lobby.path + lobby.skel, 'live2d')
      })
    }
  }

  // 开始加载
  const startLoading = async () => {
    await initializeResourceLoading()

    // 真实加载与进度消费并行：字体 / L2D 立即开始下载，
    // loadAll 逐项等待真实完成事件（字体就绪 / 逐角色加载完成），进度条实时推进
    const fontsPromise = loadFonts()
    const live2dPromise = initLive2D()
    await resourceLoader.loadAll()
    // loadAll 内部已吞掉单项错误（失败计入完成、降级进大厅）；
    // 这里再观察一遍两个加载 Promise：initLive2D 自身不抛错，
    // loadFonts 极端失败时明确日志（进度按降级已走完，不会像旧版那样留在加载屏）
    await Promise.all([
      fontsPromise.catch((error) => console.error('字体加载失败，按降级继续:', error)),
      live2dPromise
    ])
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

  // 仅 App.vue 消费（加载屏显隐 + 进度百分比）；内部方法与状态不外曝
  return { loading, percent }
}
