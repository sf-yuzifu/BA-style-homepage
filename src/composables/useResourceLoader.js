import { ref, computed } from 'vue'

export function useResourceLoader() {
  const resources = ref(new Map())
  const loadedCount = ref(0)
  const totalCount = ref(0)
  const isLoading = ref(false)
  const isComplete = ref(false)

  // 计算加载进度
  const progress = computed(() => {
    if (totalCount.value === 0) return 0
    return loadedCount.value / totalCount.value
  })

  // 平滑进度计算 - 在加载过程中提供更自然的进度体验
  const getSmoothProgress = () => {
    if (totalCount.value === 0) return 0
    
    const baseProgress = loadedCount.value / totalCount.value
    
    // 如果资源正在加载，提供部分进度反馈
    let loadingProgress = baseProgress
    for (const resource of resources.value.values()) {
      if (resource.status === 'loading') {
        // 对于正在加载的资源，给予20%的虚拟进度
        loadingProgress += 0.2 / totalCount.value
      }
    }
    
    return Math.min(loadingProgress, baseProgress + 0.1) // 最大不超过基础进度+10%
  }

  // 添加资源到加载队列
  const addResource = (id, url, type = 'generic') => {
    if (resources.value.has(id)) {
      console.warn(`资源 ${id} 已存在，跳过添加`)
      return
    }

    resources.value.set(id, {
      id,
      url,
      type,
      status: 'pending', // pending, loading, loaded, error
      startTime: null,
      endTime: null,
      size: null,
      error: null
    })

    totalCount.value++
    console.log(`添加资源到加载队列: ${id} (${url})`)
  }

  // 开始加载资源
  const loadResource = async (id) => {
    const resource = resources.value.get(id)
    if (!resource || resource.status !== 'pending') {
      return
    }

    resource.status = 'loading'
    resource.startTime = Date.now()

    // 获取最小加载时间并延迟
    const minLoadTime = getMinLoadTime(resource.type)
    
    try {
      if (resource.type === 'font') {
        await loadFont(resource)
      } else if (resource.type === 'image') {
        await loadImage(resource)
      } else if (resource.type === 'config') {
        await loadConfig(resource)
      } else if (resource.type === 'live2d') {
        await loadLive2D(resource)
      } else {
        await loadGeneric(resource)
      }

      // 记录结束时间
      resource.endTime = Date.now()
      const actualLoadTime = resource.endTime - resource.startTime
      
      // 如果实际加载时间小于最小时间，等待剩余时间
      if (actualLoadTime < minLoadTime) {
        const remainingTime = minLoadTime - actualLoadTime
        await new Promise(resolve => setTimeout(resolve, remainingTime))
        resource.endTime = Date.now() // 更新最终结束时间
      }

      resource.status = 'loaded'
      loadedCount.value++
      
      console.log(`资源加载完成: ${id} (${resource.endTime - resource.startTime}ms)`)
    } catch (error) {
      resource.status = 'error'
      resource.error = error
      resource.endTime = Date.now()
      
      console.error(`资源加载失败: ${id}`, error)
      
      // 即使加载失败，也算作完成，避免无限加载
      loadedCount.value++
    }
  }

  // 获取不同类型资源的最小加载时间
  const getMinLoadTime = (type) => {
    const baseTimes = {
      'font': 10, // 字体：10ms
      'config': 10, // 配置：10ms
      'live2d': 10, // Live2D：10ms
      'image': 10, // 图片：10ms
      'generic': 10 // 通用：10ms
    }

    return baseTimes[type] || 10
  }

  // 加载字体
  const loadFont = async (resource) => {
    try {
      console.log(`开始加载字体资源: ${resource.id}`)
      
      // 使用CSS Font Loading API，等待所有字体加载完成
      if ('fonts' in document) {
        console.log('等待CSS字体加载完成...')
        await document.fonts.ready
        console.log('CSS字体加载完成')
      }
      
      console.log(`字体资源加载完成: ${resource.id}`)
    } catch (error) {
      console.warn(`字体加载警告 ${resource.id}:`, error)
    }
  }

  // 加载图片
  const loadImage = async (resource) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        resource.size = img.naturalWidth + 'x' + img.naturalHeight
        resolve()
      }
      img.onerror = () => reject(new Error(`图片加载失败: ${resource.url}`))
      img.src = resource.url
    })
  }

  // 加载配置
  const loadConfig = async (resource) => {
    const response = await fetch(resource.url)
    if (!response.ok) {
      throw new Error(`配置加载失败: ${response.status}`)
    }
    
    const yamlText = await response.text()
    // 使用js-yaml解析YAML
    const yaml = await import('js-yaml')
    return yaml.load(yamlText)
  }

  // 加载Live2D资源
  const loadLive2D = async (resource) => {
    try {
      // 这里我们只需要标记资源为已加载
      // 实际的Live2D加载在live2d.js中处理
      console.log(`Live2D资源准备就绪: ${resource.id}`)
      
      // 检查是否有全局的Live2D加载状态
      if (typeof window.l2d_complete !== 'undefined') {
        // 等待Live2D初始化完成
        return new Promise((resolve) => {
          const checkLive2D = () => {
            if (window.l2d_complete === true) {
              resolve()
            } else {
              setTimeout(checkLive2D, 100) // 每100ms检查一次
            }
          }
          checkLive2D()
        })
      }
      
      // 如果没有全局状态，直接标记为完成
      return Promise.resolve()
    } catch (error) {
      console.warn(`Live2D资源加载警告 ${resource.id}:`, error)
      return Promise.resolve() // 即使失败也继续
    }
  }

  // 通用加载
  const loadGeneric = async (resource) => {
    const response = await fetch(resource.url)
    if (!response.ok) {
      throw new Error(`资源加载失败: ${response.status}`)
    }
    return response
  }

  // 开始批量加载（并行加载，进度由 loadedCount 响应式更新，界面平滑动画由 useLoading 负责）
  const loadAll = async () => {
    if (totalCount.value === 0) {
      isComplete.value = true
      return
    }

    isLoading.value = true
    isComplete.value = false
    console.log(`开始加载 ${totalCount.value} 个资源`)

    const pendingResources = Array.from(resources.value.values())
    await Promise.all(pendingResources.map((resource) => loadResource(resource.id)))

    isComplete.value = true
    console.log(`所有资源加载完成: ${loadedCount.value}/${totalCount.value}`)
    isLoading.value = false
    console.log('资源加载状态更新完成')
  }

  // 获取加载状态
  const getStatus = () => {
    return {
      loaded: loadedCount.value,
      total: totalCount.value,
      progress: progress.value,
      isLoading: isLoading.value,
      isComplete: isComplete.value,
      resources: Object.fromEntries(resources.value)
    }
  }

  // 重置加载器
  const reset = () => {
    resources.value.clear()
    loadedCount.value = 0
    totalCount.value = 0
    isLoading.value = false
    isComplete.value = false
  }

  return {
    // 响应式状态
    progress,
    loadedCount,
    totalCount,
    isLoading,
    isComplete,
    
    // 方法
    addResource,
    loadResource,
    loadAll,
    getStatus,
    reset,
    getSmoothProgress
  }
}