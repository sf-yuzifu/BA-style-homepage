<script setup lang="ts">
import { IconApps } from '@arco-design/web-vue/es/icon'
import { ref, computed, onMounted, onUnmounted } from 'vue'

import { useConfig } from '@/composables/useConfig'
import Settings from '@/components/Settings.vue'
import WalletItem from '@/components/WalletItem.vue'

const { configs } = useConfig()

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
    <!-- 钱包条目：.toolbox 卡片壳 class 透传到 WalletItem 根节点，hover 触发区仍是整张卡片 -->
    <WalletItem
      kind="ap"
      variant="card"
      class="toolbox"
      data-tour="wallet"
      :class="{ 'toolbox-l2d': props.l2dOnly }"
    />
    <WalletItem
      kind="gold"
      variant="card"
      class="toolbox"
      data-tour="wallet"
      :class="{ 'toolbox-l2d': props.l2dOnly }"
    />
    <WalletItem
      kind="pyroxene"
      variant="card"
      class="toolbox"
      data-tour="wallet"
      :class="{ 'toolbox-l2d': props.l2dOnly }"
    />
    <button
      type="button"
      class="settings toolbox"
      data-tour="settings"
      :class="{ 'toolbox-l2d': props.l2dOnly }"
      :aria-label="currentConfig?.translate?.settings"
      @click="openSettings"
    >
      <icon-apps class="css-cursor-hover-enabled" />
    </button>
    <button
      v-if="!props.l2dUnavailable"
      id="change"
      type="button"
      class="l2d toolbox"
      data-tour="l2d-toggle"
      :class="{ 'toolbox-l2d': props.l2dOnly, canHover: !hover && !props.canskip }"
      :aria-label="
        props.l2dOnly ? currentConfig?.translate?.l2dCollapse : currentConfig?.translate?.l2dExpand
      "
      @click="change"
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
    </button>
    <Settings v-model:visible="showSettings" />
  </div>
</template>

<style scoped>
.toolbox-box {
  position: absolute;
  right: calc(clamp(20px, calc(1.25 * var(--u)), 100vw) + var(--safe-right));
  top: calc(clamp(40px, calc(2.5 * var(--u)), 100vw) + var(--safe-top));
  display: inline-flex;
  z-index: 2;
}

.toolbox-box .toolbox {
  /* 原生 button 的 UA 样式重置：视觉保持与 a/div 时代一致 */
  appearance: none;
  border: none;
  padding: 0;
  font: inherit;
  position: relative;
  min-width: 220px;
  min-height: 56px;
  width: calc(13.75 * var(--u));
  aspect-ratio: 220 / 56;
  background: #fffd;
  color: #003153;
  margin: 0 clamp(10px, calc(0.625 * var(--u)), 100vw);
  transform: translateY(0) skew(-10deg);
  border-radius: clamp(6px, calc(0.375 * var(--u)), 100vw);
  filter: drop-shadow(0px 0px clamp(3px, calc(0.1875 * var(--u)), 100vw) #0003);
  transition:
    background-color 0.3s,
    transform 0.3s;
  display: flex;
  align-items: center;
}

/* 数值说明 tooltip 与图标/数值样式已收敛进 WalletItem.vue（含 skew 反倾斜与展开方向） */

.toolbox-box .toolbox.settings,
.toolbox-box .toolbox.l2d {
  min-width: 80px;
  min-height: 56px;
  width: calc(5 * var(--u));
  aspect-ratio: 80 / 56;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.toolbox-box .toolbox.l2d {
  position: absolute;
  right: 0;
  top: clamp(76px, calc(4.75 * var(--u)), 100vw);
  overflow: hidden;
  transform: translateY(0) skew(-10deg);
}

.toolbox.l2d img {
  filter: drop-shadow(-100vw 0px 0px #003153);
  transform: translateX(100vw);
  height: calc(2 * var(--u));
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
  font-size: clamp(32px, calc(2 * var(--u)), 100vw);
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
    transform: translateY(calc(-18.75 * var(--u))) skew(-10deg);
  }
  .toolbox.l2d.toolbox-l2d {
    transform: translateY(calc(-4.75 * var(--u))) skew(-10deg);
  }
  .toolbox-box .toolbox.l2d.toolbox-l2d:active {
    transform: translateY(calc(-4.75 * var(--u))) skew(-10deg) scale(0.9);
  }
}

.toolbox-box .toolbox.l2d.canHover:hover {
  opacity: 1 !important;
}
</style>
