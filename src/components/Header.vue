<script setup>
import { computed } from 'vue'
import { navigateWithCurtain } from '@/init/links.js'
import { IconArrowLeft } from '@arco-design/web-vue/es/icon'

import { useConfig } from '@/composables/useConfig'
import { useAp } from '@/composables/useAp'
import { useIconFont } from '@/composables/useIconFont'

const props = defineProps({
  title: {
    type: String,
    default: ''
  }
})

const { configs } = useConfig()
const { ap, maxAp } = useAp()

const currentConfig = computed(() => configs.value)

const { IconFont } = useIconFont()

// Gold 和 Pyroxene 从配置读取
const gold = computed(() => {
  if (!currentConfig.value || currentConfig.value.gold === undefined) return 0
  return currentConfig.value.gold
})

const pyroxene = computed(() => {
  if (!currentConfig.value || currentConfig.value.pyroxene === undefined) return 0
  return currentConfig.value.pyroxene
})

const goBack = () => {
  navigateWithCurtain('/')
}
</script>

<template>
  <div class="header">
    <div
      class="back-button css-cursor-hover-enabled"
      role="button"
      tabindex="0"
      @click="goBack"
      @keydown.enter.prevent="goBack"
      @keydown.space.prevent="goBack"
    >
      <icon-arrow-left class="back-icon" />
    </div>

    <div class="page-title">
      <p>{{ title }}</p>
    </div>

    <div class="toolbox">
      <div class="item">
        <img src="/img/ap.png" alt="" />
        <p style="white-space: nowrap">{{ ap + '/' + maxAp }}</p>
      </div>

      <a-divider direction="vertical" class="divider"></a-divider>

      <div class="item">
        <img src="/img/gold.png" alt="" />
        <p>{{ gold.toLocaleString() }}</p>
      </div>

      <a-divider direction="vertical" class="divider"></a-divider>

      <div class="item">
        <img src="/img/pyroxene.png" alt="" />
        <p>{{ pyroxene.toLocaleString() }}</p>
      </div>

      <a-divider direction="vertical" class="divider"></a-divider>

      <div
        class="home css-cursor-hover-enabled"
        role="button"
        tabindex="0"
        @click="goBack"
        @keydown.enter.prevent="goBack"
        @keydown.space.prevent="goBack"
      >
        <icon-font type="icon-home" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.header {
  width: calc(100% - 2 * clamp(32px, 2vw, 100vw));
  height: clamp(58px, 3.625vw, 100vw);
  box-shadow: 0px clamp(2px, 0.125vw, 100vw) clamp(8px, 0.5vw, 100vw) clamp(2px, 0.125vw, 100vw)
    rgba(0, 0, 0, 0.3);
  padding: 0 clamp(32px, 2vw, 100vw);
  background-color: white;
  background-image: var(--deco2);
  background-repeat: no-repeat;
  background-position: left;
  background-size: contain;
  display: flex;
}

.back-button {
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
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #003153;
  font-weight: bold;
  margin: 0 clamp(8px, 0.5vw, 100vw);
  font-size: clamp(26px, 1.625vw, 100vw);
}

.item p {
  margin: 0 clamp(8px, 0.5vw, 100vw);
}

.item img {
  height: 70%;
  margin: 0 clamp(4px, 0.25vw, 100vw) 0 0;
  user-select: none;
  -webkit-user-drag: none;
}

.home {
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
