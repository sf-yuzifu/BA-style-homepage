import { ref, computed } from 'vue'
import { getLobbySettled, live2dReady } from '@/init/live2d'

export type ResourceStatus = 'pending' | 'loading' | 'loaded' | 'error'
export type ResourceType = 'font' | 'live2d' | 'generic'

export interface ResourceItem {
  id: string
  url: string
  type: ResourceType
  status: ResourceStatus
  startTime: number | null
  endTime: number | null
  error: unknown
}

// 模块级单例状态，确保 useLoading 与 Loading.vue 共享同一实例
const resources = ref(new Map<string, ResourceItem>())
const loadedCount = ref(0)
const totalCount = ref(0)
const isLoading = ref(false)
const isComplete = ref(false)

// 计算加载进度
const progress = computed(() => {
  if (totalCount.value === 0) return 0
  return loadedCount.value / totalCount.value
})

export function useResourceLoader() {
  // 添加资源到加载队列
  const addResource = (id: string, url: string, type: ResourceType = 'generic') => {
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
      error: null
    })

    totalCount.value++
    console.log(`添加资源到加载队列: ${id} (${url})`)
  }

  // 开始加载资源
  const loadResource = async (id: string) => {
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
      } else if (resource.type === 'live2d') {
        await loadLive2D(resource)
      } else {
        console.warn(`未知资源类型: ${resource.type}，跳过实际加载`)
      }

      // 记录结束时间
      resource.endTime = Date.now()
      const actualLoadTime = resource.endTime - resource.startTime

      // 如果实际加载时间小于最小时间，等待剩余时间
      if (actualLoadTime < minLoadTime) {
        const remainingTime = minLoadTime - actualLoadTime
        await new Promise((resolve) => setTimeout(resolve, remainingTime))
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

      // 降级策略：失败也计入完成，保证进度能到 100% 进大厅。
      // 真实的失败重试在上游完成（init/live2d.ts 逐角色重试 3 次），这里只是兜底统计；
      // 重试后仍失败的角色由 useLoading 在进大厅时统一给出用户可见提示
      loadedCount.value++
    }
  }

  // 获取不同类型资源的最小加载时间
  const getMinLoadTime = (type: ResourceType) => {
    const baseTimes: Partial<Record<ResourceType, number>> = {
      font: 10, // 字体：10ms
      live2d: 10 // Live2D：10ms
    }

    return baseTimes[type] || 10
  }

  // 加载字体
  const loadFont = async (resource: ResourceItem) => {
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

  // 加载Live2D资源（实际加载在 init/live2d.ts 中进行）：
  // live2d_${index} 按角色等待其完成事件，进度条随角色逐个推进；
  // 无法解析出角色索引时回退等待全局完成 Promise（兜底，正常不会走到）
  const loadLive2D = async (resource: ResourceItem) => {
    const match = /^live2d_(\d+)$/.exec(resource.id)
    if (match) {
      console.log(`等待Live2D角色资源: ${resource.id}`)
      await getLobbySettled(Number(match[1]))
    } else {
      await live2dReady
    }
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
    reset
  }
}
