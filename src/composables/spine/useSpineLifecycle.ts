import { watch, onMounted, onUnmounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { usePixiStage, type PixiStageHooks } from './usePixiStage'
import { useSpineSwitcher, type SpineSwitcherDeps } from './useSpineSwitcher'

export type { L2DTarget, SpineLifecyclePointerHooks } from './useSpineSwitcher'

/** 编排层对外 deps：switcher 的全部依赖，外加 webgl-failed 事件（舞台降级路径用） */
export interface SpineLifecycleDeps extends Omit<SpineSwitcherDeps, 'stage' | 'emit'> {
  emit: {
    (e: 'canskip', value: boolean): void
    (e: 'update:changeL2D', value: boolean): void
    (e: 'webgl-failed'): void
  }
}

/**
 * Spine 大厅编排层：把「PIXI 舞台托管」（usePixiStage）与「角色装配切换」
 * （useSpineSwitcher）接线——舞台事件经 hooks 回调驱动角色逻辑，循环引用
 * 用「先占位、后回填」的 hooks 对象断开（同 Background.vue 的 pointerHooks 模式）。
 * 对外 API 与拆分前一致（Background.vue 无感）。
 */
export function useSpineLifecycle(deps: SpineLifecycleDeps) {
  const {
    emit,
    currentConfig,
    canSkip,
    showDialogue,
    talkPlayer,
    gaze,
    pat,
    boneDrag,
    randomClips,
    pointer
  } = deps

  const revealHud = (failed = false) => {
    canSkip.value = false
    emit('canskip', false)
    emit('update:changeL2D', false)
    if (failed) emit('webgl-failed')
  }

  // 占位 hooks：onStageActivated / beforeDestroy 依赖 switcher，switcher 建好后回填。
  // 触发点都在 setup 之后（onMounted/appReady.then/onActivated/onUnmounted），回填必然先完成
  const stageHooks: PixiStageHooks = {
    onAppFailed: () => revealHud(true),
    onContextLost: () => {
      talkPlayer.stopAllVoices()
      pointer.removeEventListenersFromCanvas()
      revealHud(true)
    },
    onStageActivated: () => {},
    beforeDestroy: () => {}
  }

  const stage = usePixiStage(stageHooks)

  const switcher = useSpineSwitcher({
    stage,
    emit,
    currentConfig,
    canSkip,
    showDialogue,
    talkPlayer,
    gaze,
    pat,
    boneDrag,
    randomClips,
    pointer
  })

  stageHooks.onStageActivated = switcher.onStageActivated
  stageHooks.beforeDestroy = () => {
    pointer.cancelHoverRaf()
    pointer.cancelPressSession()
    switcher.detachInteractions()
    pointer.removeEventListenersFromCanvas()
  }

  const handleWindowResize = () => {
    pointer.invalidateViewRect()
  }

  onMounted(() => {
    window.addEventListener('resize', handleWindowResize)
  })

  onBeforeRouteLeave(() => {
    switcher.stopAllVoiceAndCleanup()
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleWindowResize)
  })

  watch(
    currentConfig,
    (newConfig) => {
      if (newConfig?.memorialLobbies && newConfig.memorialLobbies.length > 0) {
        switcher.initLive2DWhenReady()
      }
    },
    { immediate: true }
  )

  return {
    // PIXI 8 异步入驻：以 getter 暴露，消费方（Background.vue 的 getApp/getCanvas）始终读到最新值
    get app() {
      return stage.getApp()
    },
    get canvas() {
      return stage.getCanvas()
    },
    webglFailed: stage.webglFailed,
    getSpine: switcher.getSpine,
    getId: switcher.getId,
    isReady: switcher.isReady,
    setL2D: switcher.setL2D,
    skipStartIdle: switcher.skipStartIdle
  }
}
