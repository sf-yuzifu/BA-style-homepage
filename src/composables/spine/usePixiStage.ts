import { ref, onMounted, onActivated, onDeactivated, onUnmounted, type Ref } from 'vue'
import * as PIXI from 'pixi.js'
import { tryCreatePixiApp } from './createPixiApp'

/**
 * 舞台对外回调：应用层（useSpineLifecycle）注入，角色逻辑（useSpineSwitcher）不直接知情。
 * 与 Background.vue 的 pointerHooks 同一模式——先传占位实现，编排层接线后再回填，
 * 用来断开「舞台激活要加载角色」与「角色加载依赖舞台就绪」的循环引用。
 */
export interface PixiStageHooks {
  /** WebGL 不可用 / 创建失败 / 激活时仍无 app：降级为静态背景并展开 HUD */
  onAppFailed: () => void
  /** WebGL 上下文丢失：停语音、摘 canvas 指针监听、展开 HUD */
  onContextLost: () => void
  /** keep-alive 重新激活且 app 就绪：装配/恢复角色 */
  onStageActivated: () => void
  /** 卸载销毁 app 之前：摘交互与指针监听（保证先摘交互再 destroy） */
  beforeDestroy: () => void
}

export interface PixiStage {
  /** PIXI 8 异步入驻：所有依赖 app/canvas/stage 的操作都经它就绪后再执行 */
  appReady: Promise<PIXI.Application | null>
  webglFailed: Ref<boolean>
  getApp: () => PIXI.Application | null
  getCanvas: () => HTMLCanvasElement | null
  getSpineLayer: () => PIXI.Container | null
  addCanvasToBackground: () => void
}

/**
 * PIXI 应用托管：创建（WebGL 失败降级）、canvas 挂载到 #background、
 * 上下文丢失处理、keep-alive 激活/停用时的 ticker 启停、卸载销毁。
 */
export function usePixiStage(hooks: PixiStageHooks): PixiStage {
  let l2d: PIXI.Application | null = null
  let canvas: HTMLCanvasElement | null = null
  let spineLayer: PIXI.Container | null = null
  const webglFailed = ref(false)
  let canvasRetryTimer: number | null = null
  let isComponentUnmounted = false
  // 组件是否处于 keep-alive 激活窗口（onActivated/onDeactivated 维护）：
  // 防止 appReady 在组件停用后才 resolve，错误地把 ticker 重新拉起
  let viewActive = false

  // PIXI 8：应用只能异步创建（构造器不再接受参数）。appReady 收敛创建时序，
  // 所有依赖 app/canvas/stage 的操作（挂载 canvas、加载角色、生命周期钩子）都经它就绪后再执行；
  // 创建失败时置 webglFailed，由 onMounted 里的 appReady 分支经 hooks 降级（静态背景）
  const appReady: Promise<PIXI.Application | null> = tryCreatePixiApp({
    width: 2560,
    height: 1440,
    backgroundAlpha: 0,
    // Spine 边缘由图集 alpha 平滑（MSAA 只作用于几何边缘，此处收益极小），
    // 关闭 MSAA 并把渲染倍率压到 1.5，显著降低低端 GPU 的每帧光栅开销
    antialias: false,
    resolution: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.5),
    powerPreference: 'high-performance'
  }).then((app) => {
    if (!app) {
      webglFailed.value = true
      return null
    }
    l2d = app
    canvas = app.canvas as HTMLCanvasElement
    spineLayer = app.stage
    return app
  })

  const handleContextLost = (event: Event) => {
    event.preventDefault()
    if (webglFailed.value) return
    webglFailed.value = true
    l2d?.ticker.stop()
    hooks.onContextLost()
    canvas?.removeEventListener('webglcontextlost', handleContextLost)
    if (canvas?.parentNode) canvas.parentNode.removeChild(canvas)
  }

  const addCanvasToBackground = () => {
    if (isComponentUnmounted || !canvas) return

    try {
      const backgroundElement = document.querySelector('#background')
      if (backgroundElement) {
        if (!canvas.parentNode || canvas.parentNode !== backgroundElement) {
          if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas)
          }
          backgroundElement.appendChild(canvas)
          canvas.id = 'l2d-canvas'
          canvas.style.position = 'relative'
          canvas.style.pointerEvents = 'auto'
          canvas.style.zIndex = '1'
        }
      } else {
        canvasRetryTimer = window.setTimeout(addCanvasToBackground, 100)
      }
    } catch {
      canvasRetryTimer = window.setTimeout(addCanvasToBackground, 100)
    }
  }

  onMounted(() => {
    void appReady.then((app) => {
      if (!app) {
        hooks.onAppFailed()
        return
      }
      if (isComponentUnmounted || !canvas) return
      addCanvasToBackground()
      canvas.addEventListener('webglcontextlost', handleContextLost)
    })
  })

  onActivated(() => {
    viewActive = true
    void appReady.then((app) => {
      if (!app) {
        hooks.onAppFailed()
        return
      }
      // appReady resolve 前组件可能已停用/卸载——不要把 ticker 重新拉起
      if (!viewActive || isComponentUnmounted) return
      app.ticker.start()
      addCanvasToBackground()
      hooks.onStageActivated()
    })
  })

  onDeactivated(() => {
    viewActive = false
    if (!webglFailed.value) l2d?.ticker.stop()
  })

  onUnmounted(() => {
    isComponentUnmounted = true
    if (canvasRetryTimer) {
      clearTimeout(canvasRetryTimer)
      canvasRetryTimer = null
    }
    // 先摘交互/指针监听（hooks），再销毁 app——保持原单文件时代的同帧清理顺序
    hooks.beforeDestroy()
    canvas?.removeEventListener('webglcontextlost', handleContextLost)
    try {
      l2d?.destroy(true)
    } catch {
      /* 上下文已丢失时 destroy 可能再抛 */
    }
  })

  return {
    appReady,
    webglFailed,
    getApp: () => l2d,
    getCanvas: () => canvas,
    getSpineLayer: () => spineLayer,
    addCanvasToBackground
  }
}
