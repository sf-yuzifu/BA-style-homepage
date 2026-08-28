<script setup>
import { ref, computed } from 'vue'
import { useConfig } from '@/composables/useConfig'
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

const props = defineProps(['l2dOnly'])

// 转场时序（毫秒）
const CURTAIN_OPEN_DELAY = 700 // 开场视频开始播放后，幕布拉开的延迟
const PAGE_OPEN_DELAY = 300 // 幕布拉开后打开目标页面的延迟
// 幕布随机停留时长：1000 或 1250
const randomCurtainDuration = () => Math.floor(Math.random() * 2 + 4) * 250

const skip = () => {
  bg.value = true
  setTimeout(() => {
    curtain.value = true
    setTimeout(() => {
      const href = taskInfo.value.href
      if (href && href !== '#') {
        window.open(href)
      }
    }, PAGE_OPEN_DELAY)
    setTimeout(() => {
      bg.value = false
      curtain.value = false
    }, randomCurtainDuration())
  }, CURTAIN_OPEN_DELAY)
}
</script>

<template>
  <transition name="down2">
    <div
      v-if="!props.l2dOnly"
      :name="taskInfo.name"
      class="task css-cursor-hover-enabled"
      role="button"
      tabindex="0"
      :aria-label="taskInfo.name"
      @click="skip"
      @keydown.enter.prevent="skip"
      @keydown.space.prevent="skip"
    ></div>
  </transition>
  <transition name="curtain">
    <div v-if="bg" class="video-container">
      <video autoplay muted playsinline>
        <source src="/transfrom.webm" type="video/webm" />
        Your browser does not support WebM video.
      </video>
    </div>
  </transition>
  <transition name="curtain">
    <div v-if="curtain" class="curtain">
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

/* 视频元素（关键：object-fit: cover + min-width/min-height） */
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
  background: url('/shitim/Event_Main_Stage_Bg.png') center;
  background-size: cover;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.curtain img {
  width: clamp(500px, 31.25vw, 100vw);
  height: auto;
}

.task {
  position: absolute;
  bottom: clamp(40px, 2.5vw, 100vw);
  right: clamp(30px, 1.875vw, 100vw);
  width: clamp(220px, 13.75vw, 100vw);
  aspect-ratio: 329 / 232;
  background: url('/task.png') center;
  background-size: cover;
  transition: transform 0.1s;
  z-index: 3;
}

.task:before {
  content: '';
  position: absolute;
  left: clamp(30px, 1.875vw, 100vw);
  bottom: 0;
  height: clamp(50px, 3.125vw, 100vw);
  width: calc(100% - clamp(30px, 1.875vw, 100vw));
  border-radius: clamp(8px, 0.5vw, 100vw);
  background: #003153;
  transform: skewX(-10deg);
}

.task:after {
  content: attr(name);
  position: absolute;
  left: clamp(30px, 1.875vw, 100vw);
  bottom: 0;
  height: clamp(50px, 3.125vw, 100vw);
  width: calc(100% - clamp(30px, 1.875vw, 100vw));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: clamp(26px, 1.625vw, 100vw);
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
    right: 60px;
    bottom: 140px;
  }
}

@media screen and (max-width: 495px) {
  .task {
    right: 40px;
    bottom: 140px;
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
