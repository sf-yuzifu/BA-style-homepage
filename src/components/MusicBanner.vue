<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick, type Ref } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { useMusicPlayer } from '@/composables/useMusicPlayer'

// 播放器状态机（随机池/Howl/失败降级/seek）在 useMusicPlayer；本组件只留 DOM 交互与样式
const {
  visible,
  songName,
  songArtist,
  songCover,
  songSeq,
  playing,
  duration,
  seeking,
  percent,
  togglePlay,
  nextSong,
  beginSeek,
  updateSeek,
  endSeek
} = useMusicPlayer()

// 使用i18n配置系统
const { configs } = useConfig()

const ifICP = computed(() => configs.value?.ICP || '')
const translate = computed(() => configs.value?.translate)

const coverFailed = ref(false)
/** 窄屏（≤768px）圆盘模式；显示 ICP 备案号时恒为圆盘（旧 APlayer mini 模式的等价行为） */
const isNarrow = ref(false)
const isMini = computed(() => !!ifICP.value || isNarrow.value)

const barRef = ref<HTMLDivElement | null>(null)

// 每次换歌封面重新尝试加载（以歌曲序号为准：同 URL 连播也要重建 img 重试）
watch(songSeq, () => {
  coverFailed.value = false
})

// ---- 进度条：点击跳转 + 按住拖动（Pointer Events + setPointerCapture，触屏同路径）----
// DOM 换算比例 → 秒数交给 useMusicPlayer 的 seek API

const ratioFromEvent = (e: PointerEvent): number => {
  const bar = barRef.value
  if (!bar) return 0
  const rect = bar.getBoundingClientRect()
  return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
}

const onBarPointerDown = (e: PointerEvent) => {
  if (duration.value <= 0) return
  e.preventDefault()
  beginSeek(ratioFromEvent(e) * duration.value)
  barRef.value?.setPointerCapture(e.pointerId)
}

const onBarPointerMove = (e: PointerEvent) => {
  if (!seeking.value) return
  updateSeek(ratioFromEvent(e) * duration.value)
}

const onBarPointerUp = (e: PointerEvent) => {
  if (!seeking.value) return
  endSeek(ratioFromEvent(e) * duration.value)
}

/** 播放/暂停在 mini 圆盘模式下由覆盖盘面的真实 button 承担（键盘可达），根容器不再挂点击 */

// ---- 歌名/艺术家跑马灯：文本超宽时启用，双副本平移实现无缝循环 ----

const nameEl = ref<HTMLElement | null>(null)
const artistEl = ref<HTMLElement | null>(null)
const nameMarquee = ref(false)
const artistMarquee = ref(false)
const nameMarqueeDuration = ref('0s')
const artistMarqueeDuration = ref('0s')
/** 跑马灯两份副本之间的间隔（须与 CSS 中 .music-banner__gap 的 width 一致） */
const MARQUEE_GAP_PX = 48
/** 跑马灯滚动速度（px/s），时长按文本长度折算保持恒速 */
const MARQUEE_SPEED = 45

/** 测量并更新跑马灯状态；元素隐藏（L2D 全屏 / mini 圆盘）时跳过，保留原状态 */
const checkMarquee = () => {
  const pairs: Array<[HTMLElement | null, Ref<boolean>, Ref<string>]> = [
    [nameEl.value, nameMarquee, nameMarqueeDuration],
    [artistEl.value, artistMarquee, artistMarqueeDuration]
  ]
  for (const [el, active, durationRef] of pairs) {
    if (!el || el.clientWidth === 0) continue
    // 量第一份文本副本的原始宽度（gap 是独立元素，不计入内）
    const textWidth =
      (el.querySelector('.music-banner__text') as HTMLElement | null)?.scrollWidth ?? 0
    active.value = textWidth > el.clientWidth + 1
    if (active.value) {
      durationRef.value = `${((textWidth + MARQUEE_GAP_PX) / MARQUEE_SPEED).toFixed(2)}s`
    }
  }
}

watch([songName, songArtist], () => {
  void nextTick(checkMarquee)
})

const checkScreenSize = () => {
  isNarrow.value = window.innerWidth <= 768
  checkMarquee()
}

onMounted(() => {
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
  // 字体子集按需异步加载，字体到位后文本宽度会变，需要重新测量
  document.fonts.addEventListener('loadingdone', checkMarquee)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkScreenSize)
  document.fonts.removeEventListener('loadingdone', checkMarquee)
})
</script>

<template>
  <div
    class="music-banner"
    :class="{
      'is-mini': isMini,
      'is-playing': playing,
      'is-hidden': !visible,
      'css-cursor-hover-enabled': isMini
    }"
  >
    <!-- 封面满铺（游戏大厅左下 EVENT 海报风） -->
    <img
      v-if="songCover && !coverFailed"
      class="music-banner__cover"
      :src="songCover"
      alt=""
      draggable="false"
      @error="coverFailed = true"
    />
    <!-- 底部暗渐变条：保证白字在任意封面上的可读性（无封面时退化为白卡+暗条） -->
    <div class="music-banner__mask"></div>
    <!-- 红色斜体角标（仿游戏 EVENT! 标签） -->
    <div class="music-banner__tag">BGM♪</div>

    <div class="music-banner__info">
      <p ref="nameEl" class="music-banner__name">
        <span
          class="music-banner__marquee"
          :class="{ 'is-active': nameMarquee }"
          :style="{ '--marquee-duration': nameMarqueeDuration }"
        >
          <span class="music-banner__text">{{ songName }}</span>
          <template v-if="nameMarquee">
            <span class="music-banner__gap" aria-hidden="true"></span>
            <span class="music-banner__text" aria-hidden="true">{{ songName }}</span>
            <span class="music-banner__gap" aria-hidden="true"></span>
          </template>
        </span>
      </p>
      <p ref="artistEl" class="music-banner__artist">
        <span
          class="music-banner__marquee"
          :class="{ 'is-active': artistMarquee }"
          :style="{ '--marquee-duration': artistMarqueeDuration }"
        >
          <span class="music-banner__text">{{ songArtist }}</span>
          <template v-if="artistMarquee">
            <span class="music-banner__gap" aria-hidden="true"></span>
            <span class="music-banner__text" aria-hidden="true">{{ songArtist }}</span>
            <span class="music-banner__gap" aria-hidden="true"></span>
          </template>
        </span>
      </p>
    </div>

    <div class="music-banner__actions">
      <button
        type="button"
        class="music-banner__btn css-cursor-hover-enabled"
        :aria-label="playing ? translate?.musicPause : translate?.musicPlay"
        @click="togglePlay"
      >
        <svg v-if="playing" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      <button
        type="button"
        class="music-banner__btn css-cursor-hover-enabled"
        :aria-label="translate?.musicNext"
        @click="nextSong"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>
    </div>

    <!-- mini 圆盘模式：整盘即播放/暂停大按钮——真实 button 覆盖盘面，键盘可达；
         只盖住圆盘本身，下方丝带标题条（top > 100%）不在其内 -->
    <button
      v-if="isMini"
      type="button"
      class="music-banner__toggle"
      :aria-label="playing ? translate?.musicPause : translate?.musicPlay"
      @click="togglePlay"
    ></button>

    <!-- 进度条贴卡片底边通栏：点击跳转 + 按住拖动 -->
    <div
      ref="barRef"
      class="music-banner__bar css-cursor-hover-enabled"
      role="slider"
      :aria-label="translate?.musicProgress"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(percent)"
      @pointerdown="onBarPointerDown"
      @pointermove="onBarPointerMove"
      @pointerup="onBarPointerUp"
      @pointercancel="onBarPointerUp"
    >
      <div class="music-banner__bar-fill" :style="{ width: percent + '%' }"></div>
    </div>
  </div>
</template>

<style scoped>
.music-banner {
  position: absolute;
  left: calc(clamp(50px, 3.125vw, 100vw) + var(--safe-left));
  bottom: calc(clamp(180px, 11.25vw, 100vw) + var(--safe-bottom));
  width: clamp(300px, 18.75vw, 100vw);
  aspect-ratio: 446 / 158;
  border-radius: clamp(8px, 0.5vw, 100vw);
  /* 不用 overflow:hidden（角标要探出上边缘）；圆角裁剪由封面图 border-radius: inherit 承担 */
  /* 无封面（或封面加载失败）时的兜底：与弹窗同一底纹语言 */
  background: #f0f0f0 var(--deco1) no-repeat right;
  background-size: contain;
  opacity: 0.9;
  z-index: 2;
  filter: drop-shadow(0 clamp(3px, 0.1875vw, 100vw) clamp(3px, 0.1875vw, 100vw) #0003);
  transition: transform 0.3s;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
}

.music-banner:active {
  transform: scale(0.95);
}

.music-banner.is-hidden {
  display: none !important;
}

/* 封面满铺（圆角随卡片——普通模式圆角、mini 圆盘模式自动变圆形） */
.music-banner__cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

/* 底部暗渐变条（无白色面板，内容直接压图——游戏海报的排版方式） */
.music-banner__mask {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 55%;
  background: linear-gradient(
    180deg,
    rgba(0, 20, 40, 0) 0%,
    rgba(0, 20, 40, 0.28) 45%,
    rgba(0, 20, 40, 0.62) 100%
  );
  /* 底角随卡片圆角（卡片已不再 overflow:hidden） */
  border-bottom-left-radius: inherit;
  border-bottom-right-radius: inherit;
}

/* 红色描边立体字角标（仿游戏 EVENT! 标签：白字红描边，一半探出卡片上边缘） */
.music-banner__tag {
  position: absolute;
  top: 0;
  left: clamp(16px, 1vw, 100vw);
  transform: translateY(-50%) skew(-10deg);
  color: #fff;
  /* 描边画在文字填充下层，保持白色字芯完整 */
  -webkit-text-stroke: clamp(2px, 0.15vw, 100vw) #e72264;
  paint-order: stroke fill;
  font-weight: bold;
  font-size: clamp(20px, 1.25vw, 100vw);
  letter-spacing: 0.5px;
  line-height: 1.2;
  /* 底部一层深色实体偏移 = 立体厚度，再加一层柔和投影 */
  filter: drop-shadow(0 clamp(1.5px, 0.1vw, 100vw) 0 #b81a4e)
    drop-shadow(0 clamp(2px, 0.125vw, 100vw) clamp(3px, 0.1875vw, 100vw) rgba(0, 0, 0, 0.35));
}

.music-banner__info {
  position: absolute;
  left: clamp(12px, 0.75vw, 100vw);
  right: clamp(12px, 0.75vw, 100vw);
  /* 给底边通栏进度条留位 */
  bottom: clamp(16px, 1vw, 100vw);
  display: flex;
  flex-direction: column;
  gap: clamp(2px, 0.125vw, 100vw);
}

.music-banner__name {
  color: #fff;
  font-weight: bold;
  font-size: clamp(20px, 1.25vw, 100vw);
  text-shadow: 0 1px clamp(3px, 0.1875vw, 100vw) rgba(0, 0, 0, 0.55);
  width: 100%;
  /* 行高给足字形空间（overflow:hidden 裁纵向边缘的修复），截断由跑马灯接管 */
  line-height: 1.3;
  overflow: hidden;
}

.music-banner__artist {
  color: rgba(255, 255, 255, 0.85);
  font-size: clamp(15px, 0.9375vw, 100vw);
  text-shadow: 0 1px clamp(2px, 0.125vw, 100vw) rgba(0, 0, 0, 0.5);
  width: 100%;
  line-height: 1.2;
  overflow: hidden;
}

/* 跑马灯：文本超宽时渲染双副本（[文本][gap][文本][gap]），
   inner 平移 -50% 恰好走完一份副本，首尾相接无缝循环；
   首尾各留 12% 时长停顿，便于阅读开头 */
.music-banner__marquee {
  display: inline-flex;
  white-space: nowrap;
}

.music-banner__marquee.is-active {
  animation: music-banner-marquee var(--marquee-duration, 8s) linear infinite;
}

/* 悬停时暂停滚动，方便看清全文 */
.music-banner__marquee.is-active:hover {
  animation-play-state: paused;
}

.music-banner__text {
  flex-shrink: 0;
}

/* 两份副本之间的间隔（宽度须与脚本里的 MARQUEE_GAP_PX 一致） */
.music-banner__gap {
  flex-shrink: 0;
  width: 48px;
}

@keyframes music-banner-marquee {
  0%,
  12% {
    transform: translateX(0);
  }
  88%,
  100% {
    transform: translateX(-50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .music-banner__marquee.is-active {
    animation: none;
  }
}

/* 播放/暂停与下一首：半透黑底白图标圆钮（压在海报上） */
.music-banner__actions {
  position: absolute;
  top: clamp(10px, 0.625vw, 100vw);
  right: clamp(10px, 0.625vw, 100vw);
  display: flex;
  gap: clamp(8px, 0.5vw, 100vw);
}

.music-banner__btn {
  appearance: none;
  border: none;
  padding: 0;
  font: inherit;
  width: clamp(30px, 1.875vw, 100vw);
  height: clamp(30px, 1.875vw, 100vw);
  border-radius: 50%;
  background: rgba(0, 30, 60, 0.45);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  transition:
    background-color 0.3s,
    transform 0.1s;
}

.music-banner__btn:hover {
  background: rgba(0, 30, 60, 0.65);
}

.music-banner__btn:active {
  transform: scale(0.9);
}

.music-banner__btn svg {
  width: 55%;
  height: 55%;
}

/* 桌面端：按钮 hover 卡片才显现（海报本体无按钮的游戏感）；
   键盘聚焦到按钮时同样显现（focus-within 兜底可发现性）；
   触屏（hover: none）常驻显示 */
@media (hover: hover) and (pointer: fine) {
  .music-banner__actions {
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 0.2s,
      visibility 0.2s;
  }

  .music-banner:hover .music-banner__actions,
  .music-banner:focus-within .music-banner__actions {
    opacity: 1;
    visibility: visible;
  }
}

/* 进度条：卡片底边（左右留出与文字区一致的间距）；上下 padding 撑大点击热区；
   touch-action:none 让拖动不被浏览器滚动抢走 */
.music-banner__bar {
  position: absolute;
  left: clamp(6px, 0.375vw, 100vw);
  right: clamp(6px, 0.375vw, 100vw);
  bottom: 0;
  padding: clamp(6px, 0.375vw, 100vw) 0;
  touch-action: none;
}

.music-banner__bar::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: clamp(4px, 0.25vw, 100vw);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
}

.music-banner__bar-fill {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  height: clamp(4px, 0.25vw, 100vw);
  border-radius: 999px;
  background: #89d5fd;
}

/* mini 圆盘的整盘播放按钮：透明覆盖盘面（不含探出盘外的丝带标题条），
   焦点环走全局 button:focus-visible；按下缩放反馈由根元素 :active 承担（:active 沿祖先链生效） */
.music-banner__toggle {
  appearance: none;
  border: none;
  padding: 0;
  font: inherit;
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: 50%;
  background: none;
}

/* mini 圆盘模式（显示 ICP 备案号时 / 窄屏）：整个圆盘即播放按钮，播放中缓慢旋转 */
.music-banner.is-mini {
  left: unset;
  bottom: unset;
  right: calc(clamp(20px, 1.25vw, 100vw) + var(--safe-right));
  top: calc(clamp(192px, 12vw, 100vw) + var(--safe-top));
  width: clamp(120px, 7.5vw, 100vw);
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid #fff;
}

.music-banner.is-mini .music-banner__mask,
.music-banner.is-mini .music-banner__tag,
.music-banner.is-mini .music-banner__actions,
.music-banner.is-mini .music-banner__bar {
  display: none;
}

/* 圆盘下方的丝带标题条（仿游戏活动挂件：比圆盘略宽、底部与圆盘少量重叠） */
.music-banner.is-mini .music-banner__info {
  top: calc(100% - clamp(12px, 0.75vw, 100vw));
  left: 50%;
  right: auto;
  bottom: auto;
  transform: translateX(-50%);
  width: clamp(120px, 7.5vw, 100vw);
  padding: clamp(4px, 0.25vw, 100vw) clamp(10px, 0.625vw, 100vw);
  background: rgba(0, 30, 60, 0.75);
  backdrop-filter: blur(4px);
  border-radius: clamp(6px, 0.375vw, 100vw);
  text-align: center;
  gap: 0;
  filter: drop-shadow(0 clamp(2px, 0.125vw, 100vw) clamp(3px, 0.1875vw, 100vw) #0004);
}

.music-banner.is-mini .music-banner__name {
  font-size: clamp(16px, 1vw, 100vw);
  text-align: center;
}

/* mini 丝带只显示歌名（艺术家隐藏，把空间留给歌名跑马灯） */
.music-banner.is-mini .music-banner__artist {
  font-size: clamp(12px, 0.75vw, 100vw);
  text-align: center;
}

.music-banner.is-mini .music-banner__cover {
  animation: music-banner-spin 12s linear infinite;
  animation-play-state: paused;
}

.music-banner.is-mini.is-playing .music-banner__cover {
  animation-play-state: running;
}

@keyframes music-banner-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .music-banner.is-mini .music-banner__cover {
    animation: none;
  }
}

@media screen and (max-width: 375px) {
  .music-banner.is-mini {
    width: 96px;
  }
}
</style>
