<script setup lang="ts">
import { computed } from 'vue'
import { navigateWithCurtain } from '@/init/links'
import { IconArrowLeft } from '@arco-design/web-vue/es/icon'

import { useConfig } from '@/composables/useConfig'
import { useIconFont } from '@/composables/useIconFont'
import WalletItem from '@/components/WalletItem.vue'

defineProps({
  title: {
    type: String,
    default: ''
  }
})

const { configs } = useConfig()
const currentConfig = computed(() => configs.value)

const { IconFont } = useIconFont()

const goBack = () => {
  navigateWithCurtain('/')
}
</script>

<template>
  <div class="header">
    <button
      type="button"
      class="back-button css-cursor-hover-enabled"
      :aria-label="currentConfig?.translate?.backToLobby"
      @click="goBack"
    >
      <icon-arrow-left class="back-icon" />
    </button>

    <div class="page-title">
      <p>{{ title }}</p>
    </div>

    <div class="toolbox">
      <!-- 钱包条目：.item class 透传到 WalletItem 根节点，hover 触发区与原 .item 一致 -->
      <WalletItem kind="ap" variant="strip" class="item" />

      <a-divider direction="vertical" class="divider"></a-divider>

      <WalletItem kind="gold" variant="strip" class="item" />

      <a-divider direction="vertical" class="divider"></a-divider>

      <WalletItem kind="pyroxene" variant="strip" class="item" />

      <a-divider direction="vertical" class="divider"></a-divider>

      <button
        type="button"
        class="home css-cursor-hover-enabled"
        :aria-label="currentConfig?.translate?.backToLobby"
        @click="goBack"
      >
        <icon-font type="icon-home" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.header {
  width: calc(100% - 2 * clamp(32px, 2vw, 100vw) - var(--safe-left) - var(--safe-right));
  height: clamp(58px, 3.625vw, 100vw);
  box-shadow: 0px clamp(2px, 0.125vw, 100vw) clamp(8px, 0.5vw, 100vw) clamp(2px, 0.125vw, 100vw)
    rgba(0, 0, 0, 0.3);
  padding: var(--safe-top) calc(clamp(32px, 2vw, 100vw) + var(--safe-right)) 0
    calc(clamp(32px, 2vw, 100vw) + var(--safe-left));
  background-color: white;
  background-image: var(--deco2);
  background-repeat: no-repeat;
  background-position: left;
  background-size: contain;
  display: flex;
}

.back-button {
  /* 原生 button 的 UA 样式重置：视觉保持与 div 时代一致 */
  appearance: none;
  border: none;
  padding: 0;
  font: inherit;
  height: calc(78 / 56 * 100%);
  margin-top: clamp(8px, 0.5vw, 100vw);
  box-shadow: 0px clamp(2px, 0.125vw, 100vw) clamp(4px, 0.25vw, 100vw) clamp(2px, 0.125vw, 100vw)
    rgba(0, 0, 0, 0.3);
  aspect-ratio: 1;
  background-color: #003153;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: transform 0.1s;
}

.back-button:active {
  transform: scale(0.9);
}

.page-title {
  width: auto;
  display: flex;
  justify-content: center;
  align-items: end;
  padding: 0 clamp(2px, 0.125vw, 100vw) 0 clamp(16px, 1vw, 100vw);
  font-size: clamp(36px, 2.25vw, 100vw);
  font-weight: bold;
  line-height: 133%;
  border-bottom: clamp(6px, 0.375vw, 100vw) solid #ffe433;
  color: #003153;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.back-icon {
  font-size: clamp(58px, 3.625vw, 100vw);
  stroke-linecap: round;
  stroke-linejoin: round;
  color: #fff;
  stroke-width: 4;
}

.toolbox {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: center;
}

.item {
  /* 条目内容（图标/数值/tooltip）样式已收敛进 WalletItem.vue 的 strip 变体；
     此处只留头栏布局：撑满高度、居中、加粗、条间距 */
  height: 100%;
  justify-content: center;
  font-weight: bold;
  margin: 0 clamp(8px, 0.5vw, 100vw);
}

.home {
  /* 原生 button 的 UA 样式重置：视觉保持与 div 时代一致 */
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  margin: 0 0 0 clamp(8px, 0.5vw, 100vw);
  color: #003153;
  font-size: clamp(42px, 2.625vw, 100vw);
  display: flex;
  justify-content: center;
  align-items: center;
  transition: transform 0.1s;
}

.home:active {
  transform: scale(0.9);
}

.divider {
  transform: skew(-10deg);
  height: 50%;
  margin: 0 clamp(4px, 0.75vw, 100vw);
  border-left-width: clamp(2px, 0.125vw, 100vw);
}

@media screen and (max-width: 1088px) {
  .toolbox .item,
  .divider {
    display: none;
  }
}

@media screen and (max-width: 425px) {
  .home {
    display: none;
  }
}
</style>
