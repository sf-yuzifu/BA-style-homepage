<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Spine } from '@esotericsoftware/spine-pixi-v7'
import { useConfig } from '@/composables/useConfig'
import { useModalOpen } from '@/composables/useModalOpen'
import { useTalkPlayer } from '@/composables/spine/useTalkPlayer'
import { useGazeFollow } from '@/composables/spine/useGazeFollow'
import { useHeadPat } from '@/composables/spine/useHeadPat'
import { useBoneDrag } from '@/composables/spine/useBoneDrag'
import { useRandomClips } from '@/composables/spine/useRandomClips'
import { usePointerSession } from '@/composables/spine/usePointerSession'
import {
  useSpineLifecycle,
  type DialoguePosition,
  type SpineLifecyclePointerHooks
} from '@/composables/spine/useSpineLifecycle'
import { isHeadRegionBone } from '@/composables/spine/boneDetect'
import type { SpineInteractionContext } from '@/composables/spine/types'

const { configs, locale } = useConfig()
const { modalOpen } = useModalOpen()
const emit = defineEmits<{
  canskip: [value: boolean]
  'update:changeL2D': [value: boolean]
  'webgl-failed': []
}>()
const props = defineProps<{
  l2dOnly: boolean
}>()

const currentConfig = computed(() => configs.value)
const canSkip = ref(true)
const dialogue = ref('')
const showDialogue = ref(false)
const dialogueDisplay = ref<{
  x: number
  y: number
  position: DialoguePosition
}>({
  x: 0,
  y: 0,
  position: 'left'
})

const spineApi = {
  getSpine: (): Spine | null => null,
  getId: () => 0,
  isReady: () => false
}

const ctx: SpineInteractionContext = {
  getSpine: () => spineApi.getSpine(),
  getLobby: () => currentConfig.value?.memorialLobbies?.[spineApi.getId()],
  getLocale: () => locale.value,
  isReady: () => spineApi.isReady(),
  isIdleMode: () => spineApi.getSpine()?.state?.getCurrent(0)?.animation?.name === 'Idle_01',
  dialogue,
  showDialogue,
  flags: { talking: ref(false), ifPetting: ref(false) },
  getPat: () => pat,
  getGaze: () => gaze,
  getBoneDrag: () => boneDrag
}

const talkPlayer = useTalkPlayer(ctx)
const gaze = useGazeFollow(ctx)
const pat = useHeadPat(ctx)
const boneDrag = useBoneDrag(ctx)
const randomClips = useRandomClips(ctx)

const pointerHooks: SpineLifecyclePointerHooks = {
  cancelPressSession: () => {},
  invalidateViewRect: () => {},
  addEventListenersToCanvas: () => {},
  removeEventListenersFromCanvas: () => {},
  cancelHoverRaf: () => {}
}

const spine = useSpineLifecycle({
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
  pointer: pointerHooks
})

spineApi.getSpine = spine.getSpine
spineApi.getId = spine.getId
spineApi.isReady = spine.isReady

const pointer = usePointerSession({
  getSpine: spine.getSpine,
  getCanvas: () => spine.canvas,
  getApp: () => spine.app,
  isReady: spine.isReady,
  ctx,
  pat,
  gaze,
  boneDrag,
  talkPlayer
})

pointerHooks.cancelPressSession = pointer.cancelPressSession
pointerHooks.invalidateViewRect = pointer.invalidateViewRect
pointerHooks.addEventListenersToCanvas = pointer.addEventListenersToCanvas
pointerHooks.removeEventListenersFromCanvas = pointer.removeEventListenersFromCanvas
pointerHooks.cancelHoverRaf = pointer.cancelHoverRaf

const { setL2D, skipStartIdle, webglFailed } = spine

/** 弹窗打开时不显示台词（避免挡在 Modal 上方） */
const dialogueVisible = computed(() => showDialogue.value && !modalOpen.value)

const dialoguePopupClass = computed(() => [
  'dialogue-popup',
  `dialogue-popup--${dialogueDisplay.value.position === 'left' ? 'left' : 'right'}`
])

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

// 弹窗打开时方向键归弹窗自己用（关闭后 Arco 可能保留 display:none 的容器）
const onLobbyKeydown = (e: KeyboardEvent) => {
  if (props.l2dOnly || webglFailed.value) return
  if (isEditableTarget(e.target)) return
  if (modalOpen.value) return
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    setL2D('-')
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    setL2D('+')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onLobbyKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onLobbyKeydown)
})

if (import.meta.env.DEV) {
  window.__l2dDebug = {
    getState: () => {
      const currentAnimation = spine.getSpine()
      return {
        ready: spine.isReady(),
        idle: ctx.isIdleMode(),
        talking: ctx.flags.talking.value,
        petting: ctx.flags.ifPetting.value,
        gazing: gaze.isActive(),
        dragging: boneDrag.isActive(),
        gazeBone: gaze.boneName(),
        pat: pat.debugInfo(),
        dragBones: boneDrag.targetNames(),
        tracks: currentAnimation?.state
          ? [0, 1, 2, 3, 4].map(
              (track) => currentAnimation.state.getCurrent(track)?.animation?.name ?? null
            )
          : [],
        character: currentAnimation?.skeleton?.data?.name ?? null
      }
    },
    boneClientPos: (name) => {
      const animation = spine.getSpine()
      if (!animation || !spine.canvas || !spine.app) return null
      const bone = animation.skeleton.findBone(name)
      if (!bone) return null
      const rect = spine.canvas.getBoundingClientRect()
      const scaleX = rect.width / spine.app.screen.width
      const scaleY = rect.height / spine.app.screen.height
      return {
        x: (bone.worldX * animation.scale.x + animation.x) * scaleX + rect.left,
        y: (bone.worldY * animation.scale.y + animation.y) * scaleY + rect.top
      }
    },
    headClientPos: () => {
      const animation = spine.getSpine()
      if (!animation || !spine.canvas) return null
      const bone = animation.skeleton.bones.find((b) => isHeadRegionBone(b.data.name))
      return bone ? (window.__l2dDebug?.boneClientPos(bone.data.name) ?? null) : null
    },
    switchCharacter: (index) => setL2D(index),
    listBones: (pattern) => {
      const animation = spine.getSpine()
      if (!animation) return []
      const re = new RegExp(pattern, 'i')
      return animation.skeleton.bones.filter((b) => re.test(b.data.name)).map((b) => b.data.name)
    }
  }
}
</script>

<template>
  <div id="change" v-if="!props.l2dOnly && !webglFailed">
    <img
      class="css-cursor-hover-enabled"
      role="button"
      tabindex="0"
      :aria-label="currentConfig?.translate?.prevPage"
      @click="setL2D('-')"
      @keydown.enter.prevent="setL2D('-')"
      @keydown.space.prevent="setL2D('-')"
      @keydown.left.prevent="setL2D('-')"
      @keydown.right.prevent="setL2D('+')"
      src="/l2d/arrow.png"
      alt=""
    />
    <img
      class="css-cursor-hover-enabled"
      role="button"
      tabindex="0"
      :aria-label="currentConfig?.translate?.nextPage"
      @click="setL2D('+')"
      @keydown.enter.prevent="setL2D('+')"
      @keydown.space.prevent="setL2D('+')"
      @keydown.left.prevent="setL2D('-')"
      @keydown.right.prevent="setL2D('+')"
      src="/l2d/arrow.png"
      alt=""
    />
  </div>
  <div
    v-if="props.l2dOnly && canSkip && !webglFailed"
    style="position: fixed; width: 100%; height: 100%; z-index: 2"
    role="button"
    tabindex="0"
    :aria-label="
      typeof currentConfig?.translate?.skipIntro === 'string'
        ? currentConfig.translate.skipIntro
        : undefined
    "
    @click="skipStartIdle()"
    @keydown.enter.prevent="skipStartIdle()"
    @keydown.space.prevent="skipStartIdle()"
  ></div>
  <a-trigger
    v-if="dialogueVisible"
    :popup-visible="dialogueVisible"
    :popup-translate="[dialogueDisplay.x, dialogueDisplay.y]"
    :position="dialogueDisplay.position"
    :show-arrow="false"
    :popup-offset="10"
    :content-class="dialoguePopupClass"
  >
    <div class="interaction" aria-hidden="true"></div>
    <template #content>
      <div
        class="dialogue"
        :class="`dialogue--${dialogueDisplay.position === 'left' ? 'left' : 'right'}`"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ dialogue }}
      </div>
    </template>
  </a-trigger>
</template>

<style scoped>
.dialogue {
  position: relative;
  padding: clamp(30px, 1.875vw, 100vw) clamp(20px, 1.25vw, 100vw);
  max-width: clamp(280px, 17.5vw, 100vw);
  width: calc(40vw - clamp(20px, 1.25vw, 100vw));
  font-size: clamp(24px, 1.5vw, 100vw);
  background-color: #f0f0f0dd;
  border-radius: clamp(10px, 0.625vw, 100vw);
  box-shadow: 0 clamp(2px, 0.125vw, 100vw) clamp(8px, 0.5vw, 100vw) 0 rgba(0, 0, 0, 0.15);
  pointer-events: none;
}

/* 三角箭头（只画向外的一半，避免旋转方块与半透明底叠色） */
.dialogue--right {
  margin-left: clamp(8px, 0.5vw, 100vw);
}

.dialogue--left {
  margin-right: clamp(8px, 0.5vw, 100vw);
}

.dialogue--right::before,
.dialogue--left::before {
  content: '';
  position: absolute;
  top: 50%;
  width: 0;
  height: 0;
  background: none;
  box-shadow: none;
  transform: translateY(-50%);
  pointer-events: none;
  border-top: clamp(9px, 0.5625vw, 100vw) solid transparent;
  border-bottom: clamp(9px, 0.5625vw, 100vw) solid transparent;
}

/* 气泡在右：左侧箭头指向角色 */
.dialogue--right::before {
  left: 0;
  transform: translate(calc(-100% + 1px), -50%);
  border-right: clamp(10px, 0.625vw, 100vw) solid #f0f0f0dd;
  border-left: none;
}

/* 气泡在左：右侧箭头指向角色 */
.dialogue--left::before {
  right: 0;
  transform: translate(calc(100% - 1px), -50%);
  border-left: clamp(10px, 0.625vw, 100vw) solid #f0f0f0dd;
  border-right: none;
}

/* 低于 Arco Modal（~1000），高于 Live2D / HUD */
:deep(.dialogue-popup.arco-trigger-popup) {
  z-index: 50 !important;
}

:deep(.dialogue-popup .arco-trigger-content) {
  padding: 0;
  background: transparent;
  box-shadow: none;
}

#change {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: var(--safe-left);
  padding-right: var(--safe-right);
  box-sizing: border-box;
}

.interaction {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: auto;
  width: 66%;
  height: 100%;
  user-select: none;
  -webkit-user-drag: none;
  opacity: 0;
  pointer-events: none;
}

img {
  width: clamp(32px, 2vw, 100vw);
  height: auto;
  animation: move 2s ease-in-out infinite;
  z-index: 1000;
}

img:last-child {
  transform: rotate(180deg);
  animation: moveReverse 2s ease-in-out infinite;
}

@keyframes move {
  0% {
    transform: translateX(clamp(10px, 0.625vw, 100vw));
  }
  50% {
    transform: translateX(clamp(30px, 1.875vw, 100vw));
  }
  100% {
    transform: translateX(clamp(10px, 0.625vw, 100vw));
  }
}

@keyframes moveReverse {
  0% {
    transform: rotate(180deg) translateX(clamp(10px, 0.625vw, 100vw));
  }
  50% {
    transform: rotate(180deg) translateX(clamp(30px, 1.875vw, 100vw));
  }
  100% {
    transform: rotate(180deg) translateX(clamp(10px, 0.625vw, 100vw));
  }
}

@media (prefers-reduced-motion: reduce) {
  img {
    animation: none;
    transform: translateX(clamp(30px, 1.875vw, 100vw));
  }

  img:last-child {
    transform: rotate(180deg) translateX(clamp(30px, 1.875vw, 100vw));
  }
}
</style>
