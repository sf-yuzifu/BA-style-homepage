<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useResourceLoader } from '@/composables/useResourceLoader'

const props = defineProps(['percent'])

// 获取资源加载器状态以显示详细信息
const resourceLoader = useResourceLoader()

// 计算Live2D资源状态
const live2dResources = computed(() => {
  const resources = resourceLoader.getStatus().resources
  return Object.entries(resources)
    .filter(([id]) => id.startsWith('live2d_'))
    .map(([id, resource]) => ({ id, ...resource }))
})

const imgUrl = ref('https://webcnstatic.yostar.net/ba_cn_web/prod/web/assets/avatar2.b84283e9.png')
const imgList = [
  'https://webcnstatic.yostar.net/ba_cn_web/prod/web/assets/avatar1.c18ce793.png',
  'https://webcnstatic.yostar.net/ba_cn_web/prod/web/assets/avatar2.b84283e9.png',
  'https://webcnstatic.yostar.net/ba_cn_web/prod/web/assets/avatar3.c9d108f1.png',
  'https://webcnstatic.yostar.net/ba_cn_web/prod/web/assets/avatar4.8656c817.png'
]

document.oncontextmenu = function () {
  return false
}
let a = 0
imgUrl.value = imgList[a % 4]
a++
const imgTimer = setInterval(() => {
  imgUrl.value = imgList[a % 4]
  a++
}, 2000)

onUnmounted(() => {
  clearInterval(imgTimer)
})
</script>

<template>
  <div class="loading_wrapper">
    <div ref="loadingImg" class="avatar_img bounce-top">
      <img class="loading" :src="imgUrl" alt="" />
      <div class="hide">
        <img :src="imgList[0]" alt="" />
        <img :src="imgList[1]" alt="" />
        <img :src="imgList[2]" alt="" />
        <img :src="imgList[3]" alt="" />
        <video autoplay src="/transfrom.webm"></video>
        <img src="/shitim/Tran_Shitim_Icon.png" alt="" />
      </div>
    </div>
    <div class="progress_wrapper">
      <h1 class="title">connecting...</h1>
      <div class="percent">{{ Math.floor(props.percent * 100) + '%' }}</div>

      <!-- 显示加载详情 -->
      <div v-if="resourceLoader.totalCount.value > 0" class="loading_details">
        <div class="detail_item">
          <span class="label">字体:</span>
          <span
            class="status"
            :class="{
              loaded: resourceLoader.getStatus().resources.fonts_ready?.status === 'loaded'
            }"
          >
            {{
              resourceLoader.getStatus().resources.fonts_ready?.status === 'loaded' ? '✓' : '...'
            }}
          </span>
        </div>
        <div class="detail_item" v-for="resource in live2dResources" :key="resource.id">
          <span class="label">Live2D:</span>
          <span
            class="status"
            :class="{ loaded: resource.status === 'loaded', error: resource.status === 'error' }"
          >
            {{ resource.status === 'loaded' ? '✓' : resource.status === 'error' ? '✗' : '...' }}
          </span>
        </div>
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
  src: url(https://webcnstatic.yostar.net/ba_cn_web/prod/web/assets/TVPS-Vain-Capital-2.cca90a05.ttf);
}

.loading_wrapper {
  background: url('https://webcnstatic.yostar.net/ba_cn_web/prod/web/assets/loading_bg_pc.ba246778.png')
    center;
  background-size: cover;
  overflow: hidden;
  z-index: 99;
}

.loading_wrapper {
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

/* 加载详情样式 */
.loading_details {
  margin-top: clamp(16px, 1vw, 100vw);
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 0.5vw, 100vw);
  align-items: center;
}

.detail_item {
  display: flex;
  align-items: center;
  gap: clamp(8px, 0.5vw, 100vw);
  font-size: clamp(14.4px, 0.9vw, 100vw);
  color: #666;
}

.detail_item .label {
  color: #999;
}

.detail_item .status {
  font-weight: bold;
  color: #1289f9;
}

.detail_item .status.loaded {
  color: #52c41a;
}

.detail_item .status.error {
  color: #ff4d4f;
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
