import {
  watch,
  ref,
  onMounted,
  onUnmounted,
  onActivated,
  onDeactivated,
  type ComputedRef,
  type Ref
} from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Spine } from '@esotericsoftware/spine-pixi-v7'
import type { AnimationState, AnimationStateListener } from '@esotericsoftware/spine-core'
import * as PIXI from 'pixi.js'
import { Modal } from '@arco-design/web-vue'
import type { ModalReturn } from '@arco-design/web-vue'
import { prefersReducedMotionNow } from '@/composables/useReducedMotion'
import { useSettings } from '@/composables/useSettings'
import type { AppConfig } from '@/types/config'
import { tryCreatePixiApp } from './createPixiApp'
import { initTracks } from './useSpineTracks'

export type L2DTarget = number | '+' | '-'
export type DialoguePosition =
  'left' | 'right' | 'br' | 'rt' | 'tr' | 'rb' | 'top' | 'tl' | 'bottom' | 'bl' | 'lt' | 'lb'

const LIVE2D_TIME_SCALE = 0.6

const parseFraction = (value: string | number | undefined): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0

  const expression = value.replace(/\s+/g, '')
  const terms = expression.match(/[+-]?[^+-]+/g)
  if (!terms || terms.join('') !== expression) return 0

  return terms.reduce((sum, term) => {
    const sign = term.startsWith('-') ? -1 : 1
    const unsigned = term.replace(/^[+-]/, '')
    const parts = unsigned.split('/')
    if (parts.length > 2) return sum
    const numerator = Number(parts[0])
    const denominator = parts.length === 2 ? Number(parts[1]) : 1
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return sum
    }
    return sum + sign * (numerator / denominator)
  }, 0)
}

const parseOffset = (offset: number | string | undefined, fallback = 0.7): number => {
  const parsed = Number(offset)
  return Number.isNaN(parsed) ? fallback : parsed
}

export interface SpineLifecyclePointerHooks {
  cancelPressSession: () => void
  invalidateViewRect: () => void
  addEventListenersToCanvas: () => void
  removeEventListenersFromCanvas: () => void
  cancelHoverRaf: () => void
}

interface InteractModule {
  attach: (spine: Spine) => void
  detach: () => void
  update: (dt: number) => void
}

interface SpineLifecycleDeps {
  emit: {
    (e: 'canskip', value: boolean): void
    (e: 'update:changeL2D', value: boolean): void
    (e: 'webgl-failed'): void
  }
  currentConfig: ComputedRef<AppConfig | null>
  canSkip: Ref<boolean>
  showDialogue: Ref<boolean>
  dialogueDisplay: Ref<{ x: number; y: number; position: DialoguePosition }>
  talkPlayer: {
    reset: () => void
    stopAllVoices: () => void
    clearVoiceAndDialogue: () => void
    attachEventListener: (state: AnimationState) => void
  }
  gaze: InteractModule
  pat: InteractModule
  boneDrag: InteractModule
  randomClips: { start: () => void; stop: () => void }
  pointer: SpineLifecyclePointerHooks
}

export function useSpineLifecycle(deps: SpineLifecycleDeps) {
  const {
    emit,
    currentConfig,
    canSkip,
    showDialogue,
    dialogueDisplay,
    talkPlayer,
    gaze,
    pat,
    boneDrag,
    randomClips,
    pointer
  } = deps

  let animation: Spine | null = null
  let id = 0
  let animationReady = false
  let modalRef: ModalReturn | null = null
  let originalOffsetPercent = 70
  let loadedL2DKey: string | null = null
  let canvasRetryTimer: number | null = null
  let isComponentUnmounted = false
  let setL2DInFlight: Promise<void> | null = null
  let isFirstLoad = true
  // 首帧加载才受「开场演出」偏好约束；手动切换角色始终播放各自的入场
  let introDecided = false

  const { shouldPlayIntro, markIntroSeen } = useSettings()

  const webglFailed = ref(false)
  const revealHud = (failed = false) => {
    canSkip.value = false
    emit('canskip', false)
    emit('update:changeL2D', false)
    if (failed) emit('webgl-failed')
  }

  const l2d = tryCreatePixiApp({
    width: 2560,
    height: 1440,
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2),
    powerPreference: 'high-performance'
  })
  const canvas = (l2d?.view as HTMLCanvasElement | undefined) ?? null
  const spineLayer = l2d?.stage ?? null

  if (!l2d || !canvas || !spineLayer) {
    webglFailed.value = true
    onMounted(() => revealHud(true))
    return {
      app: null,
      canvas: null,
      webglFailed,
      getSpine: () => null,
      getId: () => 0,
      isReady: () => false,
      setL2D: async () => {},
      skipStartIdle: () => revealHud()
    }
  }

  const handleContextLost = (event: Event) => {
    event.preventDefault()
    if (webglFailed.value) return
    webglFailed.value = true
    l2d.ticker.stop()
    talkPlayer.stopAllVoices()
    pointer.removeEventListenersFromCanvas()
    canvas.removeEventListener('webglcontextlost', handleContextLost)
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
    revealHud(true)
  }

  const changeL2D = (value: boolean) => {
    emit('update:changeL2D', value)
  }

  const updateDialoguePosition = () => {
    const lobby = currentConfig.value?.memorialLobbies?.[id]
    const display = lobby?.dialogueDisplay
    if (!display) return
    dialogueDisplay.value.x = parseFraction(display.x) * document.documentElement.clientWidth
    dialogueDisplay.value.y = parseFraction(display.y) * document.documentElement.clientHeight
  }

  const handleWindowResize = () => {
    pointer.invalidateViewRect()
    updateDialoguePosition()
  }

  const handleBeforeUpdateWorldTransforms = () => {
    const dt = PIXI.Ticker.shared.deltaMS / 1000
    gaze.update(dt)
    pat.update(dt)
    boneDrag.update(dt)
  }

  const attachInteractions = (spine: Spine) => {
    spine.beforeUpdateWorldTransforms = handleBeforeUpdateWorldTransforms
    gaze.attach(spine)
    pat.attach(spine)
    boneDrag.attach(spine)
    if (!prefersReducedMotionNow()) {
      randomClips.start()
    }
  }

  const detachInteractions = () => {
    gaze.detach()
    pat.detach()
    boneDrag.detach()
    randomClips.stop()
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

  const addAssetAlias = (alias: string, src: string) => {
    if (!PIXI.Assets.resolver.hasKey(alias)) {
      PIXI.Assets.add({ alias, src })
    }
  }

  const applyDialogueDisplay = (lobby: NonNullable<AppConfig['memorialLobbies']>[number]) => {
    const display = lobby.dialogueDisplay
    dialogueDisplay.value.x = parseFraction(display?.x) * document.documentElement.clientWidth
    dialogueDisplay.value.y = parseFraction(display?.y) * document.documentElement.clientHeight
    dialogueDisplay.value.position = (display?.position || 'left') as DialoguePosition
  }

  const applyCanvasOffset = (lobby: NonNullable<AppConfig['memorialLobbies']>[number]) => {
    originalOffsetPercent = parseOffset(lobby.offset) * 100
    canvas.style.transform = `translateX(calc((50% - ${originalOffsetPercent} * 1%) * (1 - min(1, 100vw / 1200px))))`
    pointer.invalidateViewRect()
  }

  const finishSpineSetup = (spine: Spine, skeletonPath: string, atlasPath: string) => {
    initTracks(spine)
    spineLayer.addChild(spine)
    loadedL2DKey = skeletonPath + '|' + atlasPath
    spine.scale.set(0.85)
    spine.state.setAnimation(0, 'Idle_01', true)
    spine.state.timeScale = LIVE2D_TIME_SCALE
    spine.autoUpdate = true
    spine.y = 1440
    spine.x = 2560 / 2
    attachInteractions(spine)
  }

  const doSetL2D = async (num: L2DTarget): Promise<void> => {
    if (webglFailed.value) return
    addCanvasToBackground()

    if (!currentConfig.value?.memorialLobbies) {
      return
    }

    const lobbies = currentConfig.value.memorialLobbies

    let newId: number
    switch (num) {
      case '-':
        newId = id === 0 ? lobbies.length - 1 : id - 1
        break
      case '+':
        newId = id === lobbies.length - 1 ? 0 : id + 1
        break
      default:
        newId = num
    }

    if (newId < 0 || newId >= lobbies.length) {
      return
    }

    const lobby = lobbies[newId]
    if (!lobby.path || !lobby.skel || !lobby.atlas) {
      return
    }

    id = newId
    canSkip.value = true
    emit('canskip', true)
    talkPlayer.reset()
    pointer.cancelPressSession()
    talkPlayer.stopAllVoices()

    if (animation) {
      detachInteractions()
      spineLayer.removeChild(animation)
      animation.destroy()
      animation = null
    }

    applyDialogueDisplay(lobby)

    try {
      const skeletonPath = lobby.path + lobby.skel
      const atlasPath = lobby.path + lobby.atlas
      const skeletonAlias = `skeleton_${id}`
      const atlasAlias = `atlas_${id}`

      addAssetAlias(skeletonAlias, skeletonPath)
      addAssetAlias(atlasAlias, atlasPath)
      await PIXI.Assets.load([skeletonAlias, atlasAlias])

      animation = Spine.from(skeletonAlias, atlasAlias)
      if (!animation) return
      finishSpineSetup(animation, skeletonPath, atlasPath)
    } catch {
      return
    }

    applyCanvasOffset(lobby)
    showDialogue.value = false
    let startIdle = 'Start_Idle_01'
    if (!animation.state.data.skeletonData.findAnimation('Start_Idle_01'))
      startIdle = 'Start_idle_01'
    talkPlayer.attachEventListener(animation.state)
    const isInitialLoad = !introDecided
    introDecided = true
    const playStartIdle =
      !prefersReducedMotionNow() &&
      animation.state.data.skeletonData.findAnimation(startIdle) &&
      (!isInitialLoad || shouldPlayIntro())
    if (playStartIdle) {
      if (isInitialLoad) markIntroSeen()
      changeL2D(true)
      animation.state.setAnimation(0, startIdle, false)
      const currentTrack = animation.state.getCurrent(0)
      if (
        currentTrack &&
        currentTrack.animation &&
        currentTrack.animation.name !== 'Idle_01' &&
        animation.state.data.skeletonData.findAnimation('Idle_01')
      ) {
        animation.state.addAnimation(0, 'Idle_01', true)
      }
      const targetAnimation = animation
      const listener: AnimationStateListener = {
        complete: (entry) => {
          if (entry.trackIndex === 0 && entry.animation?.name !== 'Idle_01') {
            changeL2D(false)
            targetAnimation.state.listeners = []
            talkPlayer.attachEventListener(targetAnimation.state)
            canSkip.value = false
            emit('canskip', false)
            modalRef?.close()
          }
        }
      }
      animation.state.addListener(listener)
    } else {
      changeL2D(false)
      canSkip.value = false
      emit('canskip', false)
      modalRef?.close()
      if (animation?.state) {
        const currentTrack = animation.state.getCurrent(0)
        if (
          currentTrack?.animation?.name !== 'Idle_01' &&
          animation.state.data.skeletonData.findAnimation('Idle_01')
        ) {
          animation.state.setAnimation(0, 'Idle_01', true)
        }
        animation.state.listeners = []
        talkPlayer.attachEventListener(animation.state)
      }
    }

    animationReady = true
    pointer.addEventListenersToCanvas()
  }

  const setL2D = (num: L2DTarget): Promise<void> => {
    if (setL2DInFlight) return setL2DInFlight
    setL2DInFlight = doSetL2D(num).finally(() => {
      setL2DInFlight = null
    })
    return setL2DInFlight
  }

  const loadL2DSkipIdle = async (num: number): Promise<void> => {
    if (webglFailed.value) return
    addCanvasToBackground()

    if (!currentConfig.value?.memorialLobbies) {
      return
    }

    canSkip.value = false
    emit('canskip', false)
    talkPlayer.reset()
    pointer.cancelPressSession()
    talkPlayer.stopAllVoices()

    const lobbies = currentConfig.value.memorialLobbies
    if (num < 0 || num >= lobbies.length) {
      return
    }

    const lobby = lobbies[num]
    if (!lobby.path || !lobby.skel || !lobby.atlas) {
      return
    }

    applyDialogueDisplay(lobby)

    try {
      const skeletonPath = lobby.path + lobby.skel
      const atlasPath = lobby.path + lobby.atlas
      const skeletonAlias = `skeleton_${num}`
      const atlasAlias = `atlas_${num}`

      addAssetAlias(skeletonAlias, skeletonPath)
      addAssetAlias(atlasAlias, atlasPath)
      await PIXI.Assets.load([skeletonAlias, atlasAlias])

      animation = Spine.from(skeletonAlias, atlasAlias)
      if (!animation) return
      finishSpineSetup(animation, skeletonPath, atlasPath)
    } catch {
      return
    }

    applyCanvasOffset(lobby)
    showDialogue.value = false
    talkPlayer.attachEventListener(animation.state)
    animationReady = true
    pointer.addEventListenersToCanvas()
  }

  const stopAllVoiceAndCleanup = () => {
    talkPlayer.clearVoiceAndDialogue()
    if (modalRef) {
      modalRef.close()
      modalRef = null
    }
    pointer.cancelPressSession()
    detachInteractions()
    if (animation) {
      if (animation.state) {
        animation.state.listeners = []
      }
      spineLayer.removeChild(animation)
      animation.destroy()
      animation = null
    }
    talkPlayer.reset()
    animationReady = false
  }

  const skipStartIdle = () => {
    if (modalRef) return

    if (!animation || !animation.state || !animationReady) {
      changeL2D(false)
      return
    }

    try {
      const currentTrack = animation.state.getCurrent(0)
      if (!currentTrack || !currentTrack.animation) {
        changeL2D(false)
        return
      }

      if (
        currentTrack.animation.name !== 'Idle_01' &&
        animation.state.data.skeletonData.findAnimation('Idle_01')
      ) {
        if (!currentConfig.value?.translate) {
          changeL2D(false)
          return
        }

        modalRef = Modal.open({
          title: currentConfig.value.translate.info,
          content: currentConfig.value.translate.ifSkip || '',
          okText: currentConfig.value.translate.ok,
          cancelText: currentConfig.value.translate.cancel,
          onOk: () => {
            changeL2D(false)
            talkPlayer.stopAllVoices()

            if (animation && animation.state) {
              animation.state.setAnimation(0, 'Idle_01', true)
              initTracks(animation)
              animation.state.listeners = []
              talkPlayer.attachEventListener(animation.state)
            }

            canSkip.value = false
            emit('canskip', false)
          },
          onClose: () => {
            modalRef = null
          }
        })
      }
    } catch {
      changeL2D(false)
    }
  }

  const initLive2DWhenReady = () => {
    if (!currentConfig.value?.memorialLobbies) {
      return
    }

    const lobby = currentConfig.value.memorialLobbies[id]
    const key = lobby && lobby.path ? lobby.path + lobby.skel + '|' + lobby.atlas : null
    if (animation && key && key === loadedL2DKey) {
      return
    }

    setL2D(id)
  }

  onMounted(() => {
    addCanvasToBackground()
    canvas.addEventListener('webglcontextlost', handleContextLost)
    window.addEventListener('resize', handleWindowResize)
  })

  onBeforeRouteLeave((_to, _from, next) => {
    stopAllVoiceAndCleanup()
    next()
  })

  onActivated(() => {
    if (webglFailed.value) {
      revealHud(true)
      return
    }
    l2d.ticker.start()
    addCanvasToBackground()
    if (!animation && currentConfig.value?.memorialLobbies) {
      if (isFirstLoad) {
        setL2D(id)
        isFirstLoad = false
      } else {
        loadL2DSkipIdle(id)
      }
    }
    talkPlayer.reset()
  })

  onDeactivated(() => {
    if (!webglFailed.value) l2d.ticker.stop()
  })

  onUnmounted(() => {
    isComponentUnmounted = true
    if (canvasRetryTimer) {
      clearTimeout(canvasRetryTimer)
      canvasRetryTimer = null
    }
    pointer.cancelHoverRaf()
    pointer.cancelPressSession()
    detachInteractions()
    pointer.removeEventListenersFromCanvas()
    window.removeEventListener('resize', handleWindowResize)
    canvas.removeEventListener('webglcontextlost', handleContextLost)
    try {
      l2d.destroy(true)
    } catch {
      /* 上下文已丢失时 destroy 可能再抛 */
    }
  })

  watch(
    currentConfig,
    (newConfig) => {
      if (newConfig?.memorialLobbies && newConfig.memorialLobbies.length > 0) {
        initLive2DWhenReady()
      }
    },
    { immediate: true }
  )

  return {
    app: l2d,
    canvas,
    webglFailed,
    getSpine: () => animation,
    getId: () => id,
    isReady: () => animationReady,
    setL2D,
    skipStartIdle
  }
}
