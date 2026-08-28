<script setup>
import { ref, computed, onMounted, onUnmounted, h } from 'vue'
import { Modal } from '@arco-design/web-vue'
import { useConfig } from '@/composables/useConfig'
import Header from '@/components/Header.vue'
import Live2D from '@/components/Live2D.vue'

const { configs } = useConfig()

const currentConfig = computed(() => configs.value)

const exp = computed(() => {
  if (!currentConfig.value || currentConfig.value.exp === undefined) return 0
  return currentConfig.value.exp
})

const nextExp = computed(() => {
  if (!currentConfig.value || currentConfig.value.nextExp === undefined) return 100
  return currentConfig.value.nextExp
})

const level = computed(() => {
  if (!currentConfig.value || currentConfig.value.level === undefined) return 1
  return currentConfig.value.level
})

const author = computed(() => {
  if (!currentConfig.value || !currentConfig.value.author) return 'Unknown'
  return currentConfig.value.author
})

// i18n 翻译
const translate = computed(() => {
  return currentConfig.value?.translate || {}
})

// bio 配置
const bioConfig = computed(() => {
  return currentConfig.value?.bio || {}
})

const bioButtons = computed(() => {
  return bioConfig.value?.bth || []
})

// 打开图片 Dialog（命令式 Modal，无需响应式状态）
const openImageDialog = (btn) => {
  if (!btn.path) return

  // 图片加载完成前显示加载占位（防止弹窗高度塌陷），完成后淡入；
  // content 会被 Arco 包装为默认插槽在渲染期调用，loaded 的读写是响应式的
  const loaded = ref(false)
  const finish = () => {
    loaded.value = true
  }

  Modal.open({
    title: btn.name,
    modalClass: 'card',
    content: () =>
      h('div', { class: ['card-image-box', { loaded: loaded.value }] }, [
        !loaded.value && h('div', { class: 'card-image-loading' }),
        h('img', {
          src: btn.path,
          alt: btn.name,
          // 加载失败同样结束占位，露出 alt 兜底
          onLoad: finish,
          onError: finish
        })
      ]),
    footer: false
  })
}

const windowWidth = ref(window.innerWidth)

const updateWidth = () => {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  window.addEventListener('resize', updateWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateWidth)
})

const strokeWidth = computed(() => {
  return Math.max(4, Math.round(windowWidth.value * 0.0025))
})

// Carousel 指示器状态
const currentSlide = ref(0)
const carouselWrapper = ref(null)

const updateCurrentSlide = () => {
  if (!carouselWrapper.value) return
  const scrollLeft = carouselWrapper.value.scrollLeft
  const slideWidth = carouselWrapper.value.clientWidth
  currentSlide.value = Math.round(scrollLeft / slideWidth)
}

const goToSlide = (index) => {
  if (!carouselWrapper.value) return
  const slideWidth = carouselWrapper.value.clientWidth
  carouselWrapper.value.scrollTo({
    left: slideWidth * index,
    behavior: 'smooth'
  })
}

// 轮播圆点的无障碍标签（i18n，{n} 占位符替换为页码）
const slideLabel = (index) =>
  (translate.value.carouselPage || 'Page {n}').replace('{n}', String(index + 1))

onMounted(() => {
  // 监听 carousel 滚动
  if (carouselWrapper.value) {
    carouselWrapper.value.addEventListener('scroll', updateCurrentSlide)
  }
})

onUnmounted(() => {
  if (carouselWrapper.value) {
    carouselWrapper.value.removeEventListener('scroll', updateCurrentSlide)
  }
})
</script>

<template>
  <div class="bio-page">
    <!-- 头栏 -->
    <Header :title="translate.bio || ''" />
    <!-- 背景 -->
    <div class="bio-background"></div>
    <!-- 主容器 -->
    <div class="bio-container">
      <!-- Carousel 指示器 (移动端: 圆点, 电脑端: 箭头) -->
      <div class="carousel-dots">
        <div
          v-for="index in 2"
          :key="index - 1"
          class="dot"
          :class="{ active: currentSlide === index - 1 }"
          role="button"
          tabindex="0"
          :aria-label="slideLabel(index - 1)"
          @click="goToSlide(index - 1)"
          @keydown.enter.prevent="goToSlide(index - 1)"
          @keydown.space.prevent="goToSlide(index - 1)"
        ></div>
      </div>

      <!-- 电脑端箭头导航 -->
      <div class="carousel-arrows">
        <img
          src="/l2d/arrow.png"
          class="arrow arrow-left css-cursor-hover-enabled"
          :class="{ disabled: currentSlide === 0 }"
          role="button"
          tabindex="0"
          :aria-disabled="currentSlide === 0"
          @click="goToSlide(0)"
          @keydown.enter.prevent="goToSlide(0)"
          @keydown.space.prevent="goToSlide(0)"
          :alt="translate.prevPage || ''"
        />
        <img
          src="/l2d/arrow.png"
          class="arrow arrow-right css-cursor-hover-enabled"
          :class="{ disabled: currentSlide === 1 }"
          role="button"
          tabindex="0"
          :aria-disabled="currentSlide === 1"
          @click="goToSlide(1)"
          @keydown.enter.prevent="goToSlide(1)"
          @keydown.space.prevent="goToSlide(1)"
          :alt="translate.nextPage || ''"
        />
      </div>

      <div ref="carouselWrapper" class="carousel-wrapper">
        <div class="carousel-track">
          <div class="carousel-slide" id="left">
            <Live2D />
            <div class="level-box">
              <div class="container">
                <div class="level">
                  <span>Lv.</span>
                  <p>{{ level }}</p>
                </div>
                <div class="right">
                  <span class="name">{{ author }}</span>
                  <div>
                    <a-progress
                      :percent="nextExp > 0 ? exp / nextExp : 1"
                      :show-text="false"
                      :color="exp >= nextExp ? '#ffe433' : '#89d5fd'"
                      :stroke-width="strokeWidth"
                      trackColor="#535E67"
                    >
                    </a-progress>
                    <p :style="{ color: exp >= nextExp ? '#ffe433' : '#66E0FE' }">
                      {{ exp >= nextExp ? 'MAX' : exp + '/' + nextExp }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="carousel-slide" id="right">
            <div class="intro-title">
              <div class="title">{{ translate.bioTitle || '' }}</div>
            </div>
            <div class="intro-content">
              <div class="content">
                <!-- v-html 渲染的是仓库内受信任的 YAML 配置（translate.bioContent），
                     仅项目维护者可修改；切勿改为渲染外部输入（XSS 风险） -->
                <p v-for="(item, index) in translate.bioContent" :key="index" v-html="item"></p>
              </div>
            </div>
            <div class="btn-container">
              <a-button
                v-for="(btn, index) in bioButtons"
                :key="index"
                class="btn"
                type="primary"
                @click="openImageDialog(btn)"
              >
                {{ btn.name }}
              </a-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bio-page {
  width: 100vw;
  height: 100dvh;
  position: relative;
  overflow: hidden;
}

/* 背景 */
.bio-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('/shitim/Event_Main_Stage_Bg.png');
  background-position: center;
  background-size: cover;
  z-index: -1;
}

.bio-container {
  width: 100vw;
  height: calc(100dvh - clamp(120px, 7.5vw, 100vw));
  display: flex;
  padding-top: clamp(60px, 3.75vw, 100vw);
}

/* Carousel 结构 */
.carousel-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.carousel-track {
  display: flex;
  width: 100%;
  height: 100%;
}

.carousel-slide {
  flex: 1;
  min-width: 50%;
  height: 100%;
}

/* Carousel 指示器 */
.carousel-dots {
  display: none;
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  gap: 10px;
}

.carousel-dots .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  cursor: url('/cursors/link.cur'), pointer;
  transition: background 0.3s;
}

.carousel-dots .dot.active {
  background: #fff;
}

/* 电脑端箭头导航 */
.carousel-arrows {
  display: none;
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  z-index: 10;
  justify-content: space-between;
  padding: 0 20px;
  pointer-events: none;
}

.carousel-arrows .arrow {
  width: clamp(32px, 2vw, 100vw);
  height: auto;
  pointer-events: auto;
  transition: opacity 0.3s;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  animation: moveReverse 2s ease-in-out infinite;
}

.carousel-arrows .arrow-left {
  animation: move 2s ease-in-out infinite;
}

.carousel-arrows .arrow.disabled {
  opacity: 0.3;
  /* !important 用于压过全局 .css-cursor-hover-enabled 的链接光标 */
  cursor: url('/cursors/block.cur'), not-allowed !important;
}

@keyframes move {
  0% {
    transform: translateX(clamp(-10px, -0.625vw, 100vw));
  }
  50% {
    transform: translateX(clamp(10px, 0.625vw, 100vw));
  }
  100% {
    transform: translateX(clamp(-10px, -0.625vw, 100vw));
  }
}

@keyframes moveReverse {
  0% {
    transform: rotate(180deg) translateX(clamp(-10px, -0.625vw, 100vw));
  }
  50% {
    transform: rotate(180deg) translateX(clamp(10px, 0.625vw, 100vw));
  }
  100% {
    transform: rotate(180deg) translateX(clamp(-10px, -0.625vw, 100vw));
  }
}

.bio-container #left,
.bio-container #right {
  flex: 1;
}

#left {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

/* Level.vue 样式复刻 */
.level-box {
  width: 40%;
  height: clamp(96px, 6vw, 100vw);
  background: #003153dd;
  position: absolute;
  bottom: clamp(40px, 2.5vw, 100vw);
  border-radius: clamp(8px, 0.5vw, 100vw);
  transform: skewX(-10deg);
  display: flex;
  z-index: 2;
}

.level-box .container {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin: auto 0 auto clamp(26px, 1.625vw, 100vw);
  width: 100%;
  height: calc(100% - clamp(26px, 1.625vw, 100vw));
  transform: skewX(10deg);
}

.level {
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.1s;
}

.level-box:active .level {
  transform: scale(0.85);
}

.container .level p {
  color: #fff;
  font-size: clamp(42px, 2.625vw, 100vw);
  font-weight: medium;
  transform: skewX(-10deg);
}

.container .name {
  color: #fff;
  font-size: clamp(24px, 1.5vw, 100vw);
  font-weight: medium;
}

.container .level span {
  color: #ffe433;
  font-size: clamp(24px, 1.5vw, 100vw);
  font-weight: medium;
  transform: skewX(-10deg);
}

.right {
  align-self: flex-start;
  margin: 0 clamp(20px, 1.25vw, 100vw);
  display: flex;
  flex-direction: column;
  width: 100%;
  justify-content: space-between;
  height: 100%;
}

.right p {
  font-size: clamp(20px, 1.25vw, 100vw);
  font-weight: medium;
  color: #003153;
}

#right {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.intro-title {
  width: 80%;
  color: #fff;
  background-color: #003153;
  transform: skewX(-10deg);
  padding: clamp(10px, 0.625vw, 100vw) clamp(20px, 1.25vw, 100vw);
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: clamp(8px, 0.5vw, 100vw);
}

.intro-title::after {
  content: '';
  width: 80%;
  height: 100%;
  background: #0003;
  position: absolute;
  transform: skew(50deg);
  border-radius: clamp(8px, 0.5vw, 100vw);
  z-index: -1;
  transition: all 0.3s;
}

.intro-title .title {
  font-size: clamp(32px, 2.0625vw, 100vw);
  transform: skewX(10deg);
}

#right .intro-content {
  width: 80%;
  margin-top: clamp(20px, 1.25vw, 100vw);
  margin-bottom: clamp(20px, 1.25vw, 100vw);
  flex: 0 1 auto;
  min-height: 0;
  padding: clamp(20px, 1.25vw, 100vw);
  background-color: #fff;
  border-radius: clamp(8px, 0.5vw, 100vw);
  font-size: clamp(20px, 1.25vw, 100vw);
}

#right .intro-content .content {
  height: 101%;
  overflow-y: auto;
  font-size: clamp(24px, 1.5vw, 100vw);
}

#right .intro-content .content::-webkit-scrollbar {
  display: none;
}

#right .btn-container {
  width: 80%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  direction: rtl;
  margin-top: auto;
  gap: clamp(10px, 0.625vw, 100vw);
  margin-bottom: clamp(40px, 2.5vw, 100vw);
}

#right .btn {
  width: 100%;
  filter: drop-shadow(0px clamp(1px, 0.0625vw, 100vw) clamp(2px, 0.125vw, 100vw) #0004);
  padding: clamp(30px, 1.875vw, 100vw) 0 !important;
  font-size: clamp(24px, 1.5vw, 100vw) !important;
  border-radius: clamp(8px, 0.5vw, 100vw) !important;
}

@media screen and (max-width: 768px) {
  .carousel-arrows {
    display: flex;
  }
  .bio-container {
    flex-direction: column;
    position: relative;
  }

  .carousel-dots {
    display: flex;
  }

  .carousel-wrapper {
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .carousel-wrapper::-webkit-scrollbar {
    display: none;
  }

  .carousel-track {
    width: 200%;
  }

  .carousel-slide {
    min-width: 50%;
    scroll-snap-align: start;
  }

  /* 调整左侧内容 */
  #left {
    justify-content: end;
  }

  .level-box {
    width: 80%;
    position: relative;
  }

  /* 调整右侧内容 */
  #right {
    justify-content: space-between;
  }

  #right .btn-container {
    width: 80%;
    position: relative;
    margin-top: auto;
  }
}
</style>

<style>
/* 图片弹窗：给定响应式宽度（覆盖 Arco 内联的默认 520px），
   弹窗尺寸不再依赖图片是否加载完成 */
.card.arco-modal {
  width: min(92vw, 1200px) !important;
}

.card.arco-modal .arco-modal-body {
  max-width: none !important;
  max-height: calc(90vh - clamp(48px, 3vw, 100vw)) !important;
  padding: 0 !important;
  overflow: hidden;
}

/* 图片加载前按名片图约 2:1 的比例占位，加载完成后切换为图片自然高度 */
.card.arco-modal .card-image-box {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 2 / 1;
  max-height: inherit;
}

.card.arco-modal .card-image-box.loaded {
  aspect-ratio: auto;
}

.card.arco-modal .card-image-box img {
  width: 100%;
  height: auto;
  max-height: inherit;
  object-fit: contain;
  opacity: 0;
  transition: opacity 0.3s;
}

.card.arco-modal .card-image-box.loaded img {
  opacity: 1;
}

/* 加载中转圈 */
.card.arco-modal .card-image-loading {
  position: absolute;
  width: clamp(32px, 4vw, 48px);
  height: clamp(32px, 4vw, 48px);
  border: 3px solid #89d5fd33;
  border-top-color: #89d5fd;
  border-radius: 50%;
  animation: card-image-spin 0.8s linear infinite;
}

@keyframes card-image-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
