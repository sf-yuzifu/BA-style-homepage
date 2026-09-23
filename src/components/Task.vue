<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { prefersReducedMotionNow } from '@/composables/useReducedMotion'
import {
  canPlayTransitionVideo,
  drawTransitionVariant,
  TRANSITION_SETS,
  type TransitionVariant
} from '@/utils/transitionVideo'

const { configs } = useConfig()

const currentConfig = computed(() => configs.value)

const taskInfo = computed(() => {
  if (!currentConfig.value || !currentConfig.value.task) {
    return { name: '', href: '#' }
  }
  return currentConfig.value.task
})

const curtain = ref(false)
const bg = ref(false)
/** 每次转场抽签结果：arona（亮色蓝）/ plana（暗色紫） */
const variant = ref<TransitionVariant>('arona')
const activeSet = computed(() => TRANSITION_SETS[variant.value])

const canPlayTransition = canPlayTransitionVideo()

const props = defineProps<{ l2dOnly: boolean }>()

// 转场时序（毫秒）
const CURTAIN_OPEN_DELAY = 700 // 开场视频开始播放后，幕布拉开的延迟
const PAGE_OPEN_DELAY = 300 // 幕布拉开后打开目标页面的延迟
// 幕布随机停留时长：1000 或 1250
const randomCurtainDuration = () => Math.floor(Math.random() * 2 + 4) * 250

let curtainTimer: ReturnType<typeof setTimeout> | null = null
/** 在途守卫：一次点击只触发一次转场与 window.open，连点 / 双击 / 长按 Enter 连发不重复打开标签页 */
let inFlight = false

// noopener 防 tabnabbing，与 init/links.ts 动态 <a> 的 rel="noopener noreferrer" 行为一致
const openTaskPage = () => {
  const href = taskInfo.value.href
  if (href && href !== '#') {
    window.open(href, '_blank', 'noopener,noreferrer')
  }
}

const openCurtain = () => {
  curtain.value = true
  setTimeout(openTaskPage, PAGE_OPEN_DELAY)
  setTimeout(() => {
    bg.value = false
    curtain.value = false
    // 幕布收场后复位守卫，允许用户之后再次打开
    inFlight = false
  }, randomCurtainDuration())
}

const onFlashError = () => {
  bg.value = false
  if (!curtain.value) {
    if (curtainTimer) {
      clearTimeout(curtainTimer)
      curtainTimer = null
    }
    openCurtain()
  }
}

const skip = () => {
  // 在途守卫：转场进行中忽略后续点击，防止旧定时器 / reduced-motion 直跳路径重复 window.open
  if (inFlight) return
  inFlight = true
  // 抽签：亮色 / PLANA 紫 各 1/2
  variant.value = drawTransitionVariant()
  if (prefersReducedMotionNow()) {
    openTaskPage()
    // 无幕布可等，延迟复位守卫以允许之后再次打开
    setTimeout(() => {
      inFlight = false
    }, CURTAIN_OPEN_DELAY)
    return
  }
  if (canPlayTransition) {
    bg.value = true
    curtainTimer = setTimeout(() => {
      curtainTimer = null
      openCurtain()
    }, CURTAIN_OPEN_DELAY)
  } else {
    openCurtain()
  }
}
</script>

<template>
  <transition name="down2">
    <!-- 原生 button：Enter/Space 激活交由浏览器原生行为（skip 内的 inFlight 守卫同样覆盖键盘连发） -->
    <button
      v-if="!props.l2dOnly"
      type="button"
      :name="taskInfo.name"
      class="task css-cursor-hover-enabled"
      data-tour="task"
      :aria-label="taskInfo.name"
      @click="skip"
    ></button>
  </transition>
  <transition name="curtain">
    <div v-if="bg" class="video-container">
      <video autoplay muted playsinline @error="onFlashError">
        <source :src="activeSet.mov" type='video/mp4; codecs="hvc1"' />
        <source :src="activeSet.webm" type='video/webm; codecs="vp9"' />
      </video>
    </div>
  </transition>
  <transition name="curtain">
    <div v-if="curtain" class="curtain" :style="{ backgroundImage: `url(${activeSet.curtainBg})` }">
      <img src="/shitim/Tran_Shitim_Icon.png" alt="" />
    </div>
  </transition>
</template>

<style scoped>
/* 全屏容器 */
.video-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 20000;
}

/* 闪光视频：铺满容器 */
.video-container video {
  min-width: 100%;
  min-height: 100%;
  object-fit: cover; /* 关键属性：填充容器并裁剪多余部分 */
}

.curtain {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* 底图由模板 inline style 按抽签结果注入（蓝/紫舞台） */
  background-position: center;
  background-size: cover;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.curtain img {
  width: clamp(500px, calc(31.25 * var(--u)), 100vw);
  height: auto;
}

.task {
  /* 原生 button 的 UA 样式重置：视觉保持与 div 时代一致 */
  appearance: none;
  border: none;
  padding: 0;
  font: inherit;
  position: absolute;
  bottom: calc(clamp(40px, calc(2.5 * var(--u)), 100vw) + var(--safe-bottom));
  right: calc(clamp(30px, calc(1.875 * var(--u)), 100vw) + var(--safe-right));
  width: clamp(220px, calc(13.75 * var(--u)), 100vw);
  aspect-ratio: 329 / 232;
  background: url('/task.png') center;
  background-size: cover;
  transition: transform 0.1s;
  z-index: 3;
}

.task:before {
  content: '';
  position: absolute;
  left: clamp(30px, calc(1.875 * var(--u)), 100vw);
  bottom: 0;
  height: clamp(50px, calc(3.125 * var(--u)), 100vw);
  width: calc(100% - clamp(30px, calc(1.875 * var(--u)), 100vw));
  border-radius: clamp(8px, calc(0.5 * var(--u)), 100vw);
  background: #003153;
  transform: skewX(-10deg);
}

.task:after {
  content: attr(name);
  position: absolute;
  left: clamp(30px, calc(1.875 * var(--u)), 100vw);
  bottom: 0;
  height: clamp(50px, calc(3.125 * var(--u)), 100vw);
  width: calc(100% - clamp(30px, calc(1.875 * var(--u)), 100vw));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: clamp(26px, calc(1.625 * var(--u)), 100vw);
  font-weight: bold;
}

.task:active {
  transform: scale(0.9);
}

.curtain-leave-to {
  transform: scaleY(0%);
}

.curtain-leave-from {
  transform: scaleY(100%);
}

.curtain-leave-active {
  transition:
    opacity 0.1s ease-in-out,
    transform 0.25s ease-in-out;
}

@media screen and (max-height: 630px) {
  .task {
    width: 160px;
  }

  /* 矮窗口下任务牌缩小：:before（背景）与 :after（文字）的 left/width/height 必须
     成对覆写保持一致，否则文字会与背景错位；width: 100% + 4px 对应 left: 0（占满整宽并微突出右缘） */
  .task:before,
  .task:after {
    left: 0;
    width: calc(100% + 4px);
    height: 40px;
  }

  .task:after {
    font-size: 20px;
  }
}

@media screen and (max-width: 1120px) {
  .task {
    right: calc(60px + var(--safe-right));
    bottom: calc(140px + var(--safe-bottom));
  }
}

@media screen and (max-width: 495px) {
  .task {
    right: calc(40px + var(--safe-right));
    bottom: calc(140px + var(--safe-bottom));
  }
}

/* ---- 极小/短窗紧凑档（≤495px 移动档 ∪ max-height:768px 矮窗档）----
   任务牌 220→150px（对齐 max-h:630px 档的 160px 量级），板面装饰同步微缩，
   空间再紧走 P7/P8 藏序而不是继续缩牌 */
@media screen and (max-width: 495px), screen and (max-height: 768px) {
  .task {
    width: clamp(150px, calc(13.75 * var(--u)), 100vw);
  }

  /* 板面装饰同步缩（覆盖 max-height:630px 档的定高 40px） */
  .task:before,
  .task:after {
    height: clamp(36px, calc(3.125 * var(--u)), 100vw);
  }

  .task:after {
    font-size: clamp(18px, calc(1.625 * var(--u)), 100vw);
  }
}

/* 下带联动档（仅 ≤495px 移动档）：bottom 与 Footer/ICP 实高对齐（弃用固定 140px）。
   短宽窗保持 base bottom 让公告板照旧立在 Dock 上（设计重叠），故不并入本档 */
@media screen and (max-width: 495px) {
  .task {
    right: calc(clamp(16px, calc(1.875 * var(--u)), 100vw) + var(--safe-right));
    /* ICP 底栏 50px + icp-mode Footer 60px + 8px 间隙；无 ICP 时 Footer(80+25=105px) 同被 118px 覆盖 */
    bottom: calc(50px + 60px + 8px + var(--safe-bottom));
  }
}

/* P7 藏序第三：极窄/极矮弃板面装饰（:before 底板 + :after 名称条）。
   阈值 ≤ P6（标签 ≤330px/540px）保证板面后于标签弃 */
@media screen and (max-width: 310px), screen and (max-height: 500px) {
  .task:before,
  .task:after {
    display: none;
  }
}

/* P8 整块藏序第三：Music（≤300px/440px）→Contact（≤280px/380px）之后最后弃任务（备案/等级卡/设置必留）。
   高度阈值 370px = 下带 118px + 牌高 78px + l2d 开关底缘 172px，再矮牌顶就会撞上工具箱第二行 */
@media screen and (max-width: 260px), screen and (max-height: 370px) {
  .task {
    display: none;
  }
}

.down2-leave-to,
.down2-enter-from {
  transform: translateY(300px);
}

.down2-leave-from,
.down2-enter-to {
  transform: translateY(0);
}

.down2-leave-active {
  transition: transform 0.3s ease-in;
}

.down2-enter-active {
  transition: transform 0.3s ease-out;
}
</style>
