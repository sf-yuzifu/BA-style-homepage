<script setup lang="ts">
import { computed } from 'vue'
import { useWallet } from '@/composables/useWallet'

type WalletKind = 'ap' | 'gold' | 'pyroxene'

/**
 * 钱包条目（图标 + 数值 + 机制说明 tooltip）：大厅工具箱与 Bio 头栏共用。
 * 数值直接取自 useWallet 单例，调用方只需指定 kind。
 *
 * 两个变体（布局壳由父级 class 透传提供，此处只管内容）：
 * - card（大厅 .toolbox 斜切卡片）：内容 skew(10deg) 反倾斜，tooltip 向上展开
 * - strip（Bio 头栏 .item 条目）：平直排版，tooltip 向下展开
 *
 * tooltip 显隐触发区 = 组件根元素；父级 class 透传合并到根上，
 * 因此 hover 区域与原实现（整张卡片 / 整个条目）一致。
 */
const props = defineProps<{
  kind: WalletKind
  variant: 'card' | 'strip'
}>()

const { ap, maxAp, gold, pyroxene, apTooltip, goldTooltip, pyroxeneTooltip } = useWallet()

const icons: Record<WalletKind, string> = {
  ap: '/img/ap.png',
  gold: '/img/gold.png',
  pyroxene: '/img/pyroxene.png'
}

const texts: Record<WalletKind, () => string> = {
  ap: () => `${ap.value}/${maxAp.value}`,
  gold: () => gold.value.toLocaleString(),
  pyroxene: () => pyroxene.value.toLocaleString()
}

const tips: Record<WalletKind, () => string> = {
  ap: () => apTooltip.value,
  gold: () => goldTooltip.value,
  pyroxene: () => pyroxeneTooltip.value
}

const item = computed(() => ({
  icon: icons[props.kind],
  text: texts[props.kind](),
  tip: tips[props.kind]()
}))
</script>

<template>
  <div class="wallet-item" :class="`wallet-item--${props.variant}`">
    <img class="wallet-item-icon" :src="item.icon" alt="" />
    <span class="wallet-item-text">{{ item.text }}</span>
    <!-- 数值说明 tooltip：悬停显示 -->
    <div class="wallet-tip" :class="`wallet-tip--${props.variant === 'card' ? 'up' : 'down'}`">
      {{ item.tip }}
    </div>
  </div>
</template>

<style scoped>
.wallet-item {
  /* tooltip 定位锚点；flex 布局与父壳（卡片/条目）原有一致 */
  position: relative;
  display: flex;
  align-items: center;
  color: #003153;
}

.wallet-item-icon {
  height: 70%;
  user-select: none;
  -webkit-user-drag: none;
}

/* font-size 挂在文本节点而非根节点：大厅卡片壳的 `font: inherit` 优先级更高，
   放根节点会被压回继承值（原实现就挂在 .toolbox span 上） */
.wallet-item-text {
  font-size: clamp(26px, calc(1.625 * var(--u)), 100vw);
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.wallet-tip {
  position: absolute;
  left: 50%;
  padding: clamp(6px, calc(0.375 * var(--u)), 100vw) clamp(12px, calc(0.75 * var(--u)), 100vw);
  background: #fff;
  color: #003153;
  font-size: clamp(18px, calc(1.125 * var(--u)), 100vw);
  border-radius: clamp(6px, calc(0.375 * var(--u)), 100vw);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  z-index: 3;
}

.wallet-item:hover .wallet-tip {
  opacity: 1;
}

/* 向上展开（大厅卡片：上方有空间），阴影用 filter（原 Toolbox 写法） */
.wallet-tip--up {
  bottom: calc(100% + clamp(8px, calc(0.5 * var(--u)), 100vw));
  transform: translateX(-50%);
  filter: drop-shadow(
    0px clamp(2px, calc(0.125 * var(--u)), 100vw) clamp(4px, calc(0.25 * var(--u)), 100vw) #0003
  );
}

/* 向下展开（Bio 头栏贴页顶），阴影用 box-shadow（原 Header 写法） */
.wallet-tip--down {
  top: calc(100% + clamp(8px, calc(0.5 * var(--u)), 100vw));
  transform: translateX(-50%);
  box-shadow: 0 clamp(2px, calc(0.125 * var(--u)), 100vw) clamp(8px, calc(0.5 * var(--u)), 100vw) 0
    rgba(0, 0, 0, 0.15);
}

/* ---- card 变体：父壳 skew(-10deg)，内容反倾斜回正；卡片内边距 ---- */

.wallet-item--card .wallet-item-icon {
  transform: skew(10deg);
  margin: 0 clamp(8px, calc(0.5 * var(--u)), 100vw) 0 clamp(10px, calc(0.625 * var(--u)), 100vw);
}

.wallet-item--card .wallet-item-text {
  transform: skew(10deg);
}

.wallet-item--card .wallet-tip {
  transform: translateX(-50%) skew(10deg);
}

/* ---- strip 变体：头栏条间距 ---- */

.wallet-item--strip .wallet-item-icon {
  margin: 0 clamp(4px, calc(0.25 * var(--u)), 100vw) 0 0;
}

.wallet-item--strip .wallet-item-text {
  margin: 0 clamp(8px, calc(0.5 * var(--u)), 100vw);
}
</style>
