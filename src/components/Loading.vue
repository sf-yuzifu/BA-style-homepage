<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { canPlayTransitionVideo, TRANSITION_MOV, TRANSITION_WEBM } from '@/utils/transitionVideo'

const props = defineProps<{ percent: number }>()

const percentInt = computed(() => Math.floor(props.percent * 100))

const canPlayTransition = canPlayTransitionVideo()

const imgList = [
  '/img/loading/avatar1.png',
  '/img/loading/avatar2.png',
  '/img/loading/avatar3.png',
  '/img/loading/avatar4.png'
]
const imgUrl = ref(imgList[0])

let a = 1
const imgTimer = setInterval(() => {
  imgUrl.value = imgList[a % imgList.length]
  a++
}, 2000)

onUnmounted(() => {
  clearInterval(imgTimer)
})
</script>

<template>
  <div class="loading_wrapper">
    <div class="avatar_img bounce-top">
      <img class="loading" :src="imgUrl" alt="" />
      <div class="hide">
        <img :src="imgList[0]" alt="" />
        <img :src="imgList[1]" alt="" />
        <img :src="imgList[2]" alt="" />
        <img :src="imgList[3]" alt="" />
        <video v-if="canPlayTransition" muted preload="auto">
          <source :src="TRANSITION_MOV" type='video/mp4; codecs="hvc1"' />
          <source :src="TRANSITION_WEBM" type='video/webm; codecs="vp9"' />
        </video>
        <img src="/shitim/Tran_Shitim_Icon.png" alt="" />
      </div>
    </div>
    <div class="progress_wrapper">
      <h1 class="title">connecting...</h1>
      <div class="percent" role="status" aria-live="polite" aria-atomic="true">
        {{ percentInt }}%
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes move {
  0% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-26.6666666672px);
  }
  100% {
    transform: translateY(0);
  }
}

@media screen and (min-width: 1600px) {
  @keyframes move {
    50% {
      transform: translateY(-1.6666666667vw);
    }
  }
}

.loading {
  animation: move 2s ease-in-out infinite;
  width: 100%;
}

img {
  user-select: none;
  -webkit-user-drag: none;
}

@font-face {
  font-family: TVPS-Vain-Capital-2;
  /* 本地子集（仅 "connecting." + 数字 + % 共 18 字符，4.2KB），替代 CDN 完整 TTF（31.7KB） */
  src: url('/fonts/TVPS-Vain-Capital-2.woff2') format('woff2');
  font-display: swap;
}

.loading_wrapper {
  background: url('/img/loading/bg.png') center;
  background-size: cover;
  overflow: hidden;
  z-index: 99;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.progress_wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  margin-top: clamp(32px, 2vw, 100vw);
}

.progress_wrapper .title {
  font-family: TVPS-Vain-Capital-2, system-ui;
  color: #1289f9;
  font-size: clamp(28.8px, 1.8vw, 100vw);
}

.progress_wrapper .percent {
  margin-top: clamp(5.8666666672px, 0.3666666667vw, 100vw);
  font-size: clamp(22.4px, 1.4vw, 100vw);
  font-family: TVPS-Vain-Capital-2, system-ui;
  color: #1289f9;
}

.hide {
  opacity: 0;
  position: absolute;
  z-index: -1;
  top: 0;
  left: 0;
}

.avatar_img {
  height: clamp(340px, 21.25vw, 100vw);
  width: clamp(250px, 15.625vw, 100vw);
}
</style>
