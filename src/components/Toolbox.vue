<script setup lang="ts">
import { IconApps } from '@arco-design/web-vue/es/icon'
import { ref, computed, onMounted, onUnmounted } from 'vue'

import { useConfig } from '@/composables/useConfig'
import { useWallet } from '@/composables/useWallet'
import Settings from '@/components/Settings.vue'

const { configs } = useConfig()
const { ap, maxAp, gold, pyroxene, apTooltip, goldTooltip, pyroxeneTooltip } = useWallet()

const emit = defineEmits<{
  switch: []
}>()
const props = defineProps<{
  l2dOnly?: boolean
  canskip?: boolean
  /** WebGL 不可用时没有回忆大厅可观赏，隐藏展开/收起按钮 */
  l2dUnavailable?: boolean
}>()

const currentConfig = computed(() => configs.value)
const img = ref('/img/max.png')
const showMin = ref(false)
const showSettings = ref(false)
// 触屏设备（hover: none）状态
const hoverMedia = window.matchMedia('(hover: none)')
const hover = ref(hoverMedia.matches)

const change = () => {
  if (!props.canskip) {
    img.value = img.value === '/img/min.png' ? '/img/max.png' : '/img/min.png'
    emit('switch')
  }
}

const openSettings = () => {
  showSettings.value = true
}

// body 级点击：L2D 全屏观赏模式下切换工具箱显隐
const handleBodyClick = (e: MouseEvent) => {
  // 弹窗经 teleport 挂到 body，其内部点击会冒泡到这里，不应牵动工具箱显隐
  if (e.target instanceof Element && e.target.closest('.arco-modal-container')) return

  if (props.l2dOnly && hover.value) {
    showMin.value = !showMin.value
  } else {
    showMin.value = true
  }
}

// 触屏状态变化时更新
const handleHoverChange = (e: MediaQueryListEvent) => {
  hover.value = e.matches
}

onMounted(() => {
  document.body.addEventListener('click', handleBodyClick)
  hoverMedia.addEventListener('change', handleHoverChange)
})

onUnmounted(() => {
  document.body.removeEventListener('click', handleBodyClick)
  hoverMedia.removeEventListener('change', handleHoverChange)
})
</script>

<template>
  <div class="toolbox-box">
    <div class="toolbox" :class="{ 'toolbox-l2d': props.l2dOnly }">
      <img src="/img/ap.png" alt="" />
      <span>{{ ap + '/' + maxAp }}</span>
      <div class="wallet-tip">{{ apTooltip }}</div>
    </div>
    <div class="toolbox" :class="{ 'toolbox-l2d': props.l2dOnly }">
      <img src="/img/gold.png" alt="" />
      <span>{{ gold.toLocaleString() }}</span>
      <div class="wallet-tip">{{ goldTooltip }}</div>
    </div>
    <div class="toolbox" :class="{ 'toolbox-l2d': props.l2dOnly }">
      <img src="/img/pyroxene.png" alt="" />
      <span>{{ pyroxene.toLocaleString() }}</span>
      <div class="wallet-tip">{{ pyroxeneTooltip }}</div>
    </div>
    <a
      class="settings toolbox"
      :class="{ 'toolbox-l2d': props.l2dOnly }"
      role="button"
      tabindex="0"
      :aria-label="currentConfig?.translate?.settings"
      @click="openSettings"
      @keydown.enter.prevent="openSettings"
      @keydown.space.prevent="openSettings"
    >
      <icon-apps class="css-cursor-hover-enabled" />
    </a>
    <a
      v-if="!props.l2dUnavailable"
      id="change"
      class="l2d toolbox"
      :class="{ 'toolbox-l2d': props.l2dOnly, canHover: !hover && !props.canskip }"
      role="button"
      tabindex="0"
      @click="change"
      @keydown.enter.prevent="change"
      @keydown.space.prevent="change"
      :style="{
        transition:
          'transform 0.3s ' +
          (!props.l2dOnly ? 'ease-out' : 'ease-in') +
          ',opacity 0.6s,visibility 0.6s',
        opacity: (!props.l2dOnly || (showMin && hover)) && !props.canskip ? 1 : 0,
        // canskip（开场动画）期间彻底禁用交互：不吞掉下方跳过遮罩的点击、不是 tab 停靠点
        // 注意不能对 l2dOnly 桌面端的透明状态禁用——那里依赖 :hover 显现按钮（.canHover:hover）
        pointerEvents: props.canskip ? ('none' as const) : undefined,
        visibility: props.canskip ? ('hidden' as const) : undefined
      }"
    >
      <img alt="" :src="img" />
    </a>
    <Settings v-model:visible="showSettings" />
  </div>
</template>

<style scoped>
.toolbox-box {
  position: absolute;
  right: calc(clamp(20px, 1.25vw, 100vw) + var(--safe-right));
  top: calc(clamp(40px, 2.5vw, 100vw) + var(--safe-top));
  display: inline-flex;
  z-index: 2;
}

.toolbox-box .toolbox {
  position: relative;
  min-width: 220px;
  min-height: 56px;
  width: 13.75vw;
  aspect-ratio: 220 / 56;
  background: #fffd;
  color: #003153;
  margin: 0 clamp(10px, 0.625vw, 100vw);
  transform: translateY(0) skew(-10deg);
  border-radius: clamp(6px, 0.375vw, 100vw);
  filter: drop-shadow(0px 0px clamp(3px, 0.1875vw, 100vw) #0003);
  transition:
    background-color 0.3s,
    transform 0.3s;
  display: flex;
  align-items: center;
}

/* 数值说明 tooltip：悬停显示（skew(10deg) 用于抵消父盒子的倾斜） */
.wallet-tip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + clamp(8px, 0.5vw, 100vw));
  transform: translateX(-50%) skew(10deg);
  padding: clamp(6px, 0.375vw, 100vw) clamp(12px, 0.75vw, 100vw);
  background: #fff;
  color: #003153;
  font-size: clamp(18px, 1.125vw, 100vw);
  border-radius: clamp(6px, 0.375vw, 100vw);
  filter: drop-shadow(0px clamp(2px, 0.125vw, 100vw) clamp(4px, 0.25vw, 100vw) #0003);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  z-index: 3;
}

.toolbox:hover .wallet-tip {
  opacity: 1;
}

.toolbox img {
  height: 70%;
  transform: skew(10deg);
  margin: 0 clamp(8px, 0.5vw, 100vw) 0 clamp(10px, 0.625vw, 100vw);
  user-select: none;
  -webkit-user-drag: none;
}

.toolbox span {
  font-size: clamp(26px, 1.625vw, 100vw);
  transform: skew(10deg);
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.toolbox-box .toolbox.settings,
.toolbox-box .toolbox.l2d {
  min-width: 80px;
  min-height: 56px;
  width: 5vw;
  aspect-ratio: 80 / 56;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.toolbox-box .toolbox.l2d {
  position: absolute;
  right: 0;
  top: clamp(76px, 4.75vw, 100vw);
  overflow: hidden;
  transform: translateY(0) skew(-10deg);
}

.toolbox.l2d img {
  filter: drop-shadow(-100vw 0px 0px #003153);
  transform: translateX(100vw);
  height: 2vw;
  min-height: 32px;
}

.toolbox-box .toolbox:hover {
  background: #fffe;
}

/* :active 只缩放、不改 translateY。减少动效下过渡近乎瞬时，
   若按下时跳回 translateY(0)，按钮会离开指针，mouseup/click 落空，无法退出全屏。 */
.toolbox-box .toolbox.settings:active,
.toolbox-box .toolbox.l2d:active {
  transform: translateY(0) skew(-10deg) scale(0.9);
}

.arco-icon {
  font-size: clamp(32px, 2vw, 100vw);
  transform: skew(10deg);
}

@media screen and (max-width: 1199px) {
  .toolbox:not(.settings) {
    display: none;
  }
}

@media screen and (max-width: 1600px) {
  .toolbox.toolbox-l2d {
    transform: translateY(-300px) skew(-10deg);
  }
  .toolbox.l2d.toolbox-l2d {
    transform: translateY(-76px) skew(-10deg);
  }
  .toolbox-box .toolbox.l2d.toolbox-l2d:active {
    transform: translateY(-76px) skew(-10deg) scale(0.9);
  }
}

@media screen and (min-width: 1601px) {
  .toolbox.toolbox-l2d {
    transform: translateY(-18.75vw) skew(-10deg);
  }
  .toolbox.l2d.toolbox-l2d {
    transform: translateY(-4.75vw) skew(-10deg);
  }
  .toolbox-box .toolbox.l2d.toolbox-l2d:active {
    transform: translateY(-4.75vw) skew(-10deg) scale(0.9);
  }
}

.toolbox-box .toolbox.l2d.canHover:hover {
  opacity: 1 !important;
}
</style>
