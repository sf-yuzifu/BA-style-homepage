import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useResourceLoader } from './useResourceLoader'
import { useConfig } from './useConfig'
import { loadFonts } from '@/init/fonts'
import { initLive2D } from '@/init/live2d'

export function useLoading() {
  const loading = ref(true)
  const percent = ref(0)
  const isReady = ref(false)
  
  // 添加平滑动画相关状态
  const targetPercent = ref(0)
  const animationFrame = ref(null)

  // 使用资源加载管理器和配置
  const resourceLoader = useResourceLoader()
  const { waitForConfig } = useConfig()

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
    if (animationFrame.value) {
      cancelAnimationFrame(animationFrame.value)
    }
    animationFrame.value = requestAnimationFrame(animateProgress)
  }

  // 监听加载进度变化 - 使用目标进度和动画
  watch(
    () => ({ progress: resourceLoader.progress.value, loaded: resourceLoader.loadedCount.value, total: resourceLoader.totalCount.value, isComplete: resourceLoader.isComplete.value, isLoading: resourceLoader.isLoading.value }),
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
      
      console.log(`加载进度更新: ${(smoothProgress * 100).toFixed(1)}% (${newState.loaded}/${newState.total})`)
      
      // 检查是否所有资源都加载完成
      if (newState.isComplete && !newState.isLoading) {
        console.log('资源加载完成，准备隐藏加载界面')
        
        // 确保进度达到100%
        targetPercent.value = 1
        startAnimation()
        
        // 等待动画完成后隐藏加载界面
        setTimeout(() => {
          finishLoading()
        }, 800)
      }
    },
    { immediate: true }
  )

  // 监听完成状态变化
  watch(
    [() => resourceLoader.isComplete.value, () => resourceLoader.isLoading.value],
    ([isComplete, isLoading]) => {
      console.log(`加载状态变化 - 完成: ${isComplete}, 加载中: ${isLoading}`)
      
      if (isComplete && !isLoading) {
        console.log('检测到资源加载完成')
      }
    }
  )

  // 初始化资源加载
  const initializeResourceLoading = async () => {
    console.log('开始初始化资源加载...')
    
    // 等待配置加载完成
    const config = await waitForConfig()

    // 添加字体加载任务
    resourceLoader.addResource('fonts_ready', '', 'font')
    
    // 添加配置资源
    resourceLoader.addResource('config_main', '/_config.yaml', 'config')

    // 添加Live2D资源（根据实际配置动态添加）
    if (config.memorialLobbies && Array.isArray(config.memorialLobbies)) {
      config.memorialLobbies.forEach((lobby, index) => {
        resourceLoader.addResource(`live2d_skeleton_${index}`, lobby.path + lobby.skel, 'live2d')
        resourceLoader.addResource(`live2d_atlas_${index}`, lobby.path + lobby.atlas, 'live2d')
      })
      console.log(`添加了 ${config.memorialLobbies.length} 个Live2D角色的资源`)
    }

    console.log(`资源加载器初始化完成，共 ${resourceLoader.totalCount.value} 个资源`)
    
    // 等待字体加载完成
    await loadFonts()
    
    // 等待配置资源加载完成后再初始化Live2D
    // 等待Live2D加载完成
    await initLive2D()
    
    console.log('字体和Live2D初始化完成')
  }

  // 开始加载
  const startLoading = async () => {
    console.log('开始资源加载...')
    
    await initializeResourceLoading()
    
    // 开始批量加载
    console.log('开始批量加载资源...')
    await resourceLoader.loadAll()
  }

  onUnmounted(() => {
    // 清理动画帧
    if (animationFrame.value) {
      cancelAnimationFrame(animationFrame.value)
    }
  })

  // 完成加载
  const finishLoading = () => {
    // 清理动画
    if (animationFrame.value) {
      cancelAnimationFrame(animationFrame.value)
      animationFrame.value = null
    }
    
    percent.value = 1
    loading.value = false
    isReady.value = true
    
    console.log('应用加载完成，准备切换到主界面')
  }

  // 强制完成加载（用于错误情况）
  const forceComplete = () => {
    console.warn('强制完成加载，防止无限等待')
    finishLoading()
  }

  onMounted(() => {
    // 延迟一点开始加载，让Loading组件先显示，然后从0%开始
    setTimeout(() => {
      startLoading()
      
      // 设置超时机制，防止无限等待
      const timeoutId = setTimeout(() => {
        console.warn('资源加载超时，强制完成加载')
        forceComplete()
      }, 15000) // 15秒超时
      
      // 如果正常完成加载，取消超时
      watch(() => loading.value, (newLoading) => {
        if (!newLoading) {
          clearTimeout(timeoutId)
        }
      })
    }, 300) // 增加延迟时间
  })

  onUnmounted(() => {
    resourceLoader.reset()
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
    forceComplete,
    
    // 获取详细状态
    getLoadingStatus: () => resourceLoader.getStatus()
  }
}
