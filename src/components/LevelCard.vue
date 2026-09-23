<script setup lang="ts">
import { computed } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { useStrokeWidth } from '@/composables/useStrokeWidth'
import { navigateWithCurtain } from '@/init/links'

/**
 * 等级/经验卡片：大厅（lobby）与简介页（bio）共用。
 * - lobby：原生 button，点击幕帘跳转 /bio；渐变底 + 右侧斜切尾巴；
 *   窄屏（≤495px）收成 Lv 方块，hover 展开数值
 * - bio：静态展示 div；半透明平底，整卡 skewX(-10deg)、容器反斜校正；
 *   窄屏（≤768px，随轮播断点）改为流内相对定位
 */
const props = defineProps<{
  variant: 'lobby' | 'bio'
}>()

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

const { strokeWidth } = useStrokeWidth()

const isLobby = computed(() => props.variant === 'lobby')

const goToBio = () => {
  if (!isLobby.value) return
  navigateWithCurtain('/bio')
}
</script>

<template>
  <!-- 大厅变体是原生 button：Enter/Space 激活交由浏览器原生行为，无需手动键盘监听；
       简介页变体是纯展示 div（无 aria-label、不进 Tab 序） -->
  <component
    :is="isLobby ? 'button' : 'div'"
    :type="isLobby ? 'button' : undefined"
    class="level-box"
    :class="`level-box--${props.variant}`"
    :data-tour="isLobby ? 'level' : undefined"
    :aria-label="isLobby ? currentConfig?.translate?.bio : undefined"
    @click="goToBio"
  >
    <div class="container">
      <div class="level" :class="{ 'css-cursor-hover-enabled': isLobby }">
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
  </component>
</template>

<style scoped>
/* ===== 共用骨架与内容 ===== */

.level-box {
  height: clamp(96px, calc(6 * var(--u)), 100vw);
  position: absolute;
  border-radius: clamp(8px, calc(0.5 * var(--u)), 100vw);
  display: flex;
  z-index: 2;
}

.container {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin: auto 0 auto clamp(26px, calc(1.625 * var(--u)), 100vw);
  width: 100%;
  height: calc(100% - clamp(26px, calc(1.625 * var(--u)), 100vw));
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
  font-size: clamp(42px, calc(2.625 * var(--u)), 100vw);
  font-weight: medium;
  transform: skewX(-10deg);
}

.container .name {
  color: #fff;
  font-size: clamp(24px, calc(1.5 * var(--u)), 100vw);
  font-weight: medium;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.container .level span {
  color: #ffe433;
  font-size: clamp(24px, calc(1.5 * var(--u)), 100vw);
  font-weight: medium;
  transform: skewX(-10deg);
}

.right {
  align-self: flex-start;
  margin: 0 clamp(20px, calc(1.25 * var(--u)), 100vw);
  display: flex;
  flex-direction: column;
  width: 100%;
  justify-content: space-between;
  height: 100%;
}

.right p {
  font-size: clamp(20px, calc(1.25 * var(--u)), 100vw);
  font-weight: medium;
}

/* ===== 大厅变体（可点击卡片） ===== */

.level-box--lobby {
  /* 原生 button 的 UA 样式重置：视觉保持与 div 时代一致 */
  appearance: none;
  border: none;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  width: clamp(300px, calc(18.75 * var(--u)), 100vw);
  background: linear-gradient(120deg, #003153, #2265bb 15%, #003153 70%, #003153);
  left: var(--safe-left);
  top: calc(clamp(40px, calc(2.5 * var(--u)), 100vw) + var(--safe-top));
  filter: drop-shadow(
    0 clamp(3px, calc(0.1875 * var(--u)), 100vw) clamp(3px, calc(0.1875 * var(--u)), 100vw) black
  );
}

/* 右侧探出的斜切尾巴 */
.level-box--lobby:before {
  content: '';
  position: absolute;
  top: 0;
  right: clamp(-20px, calc(-1.25 * var(--u)), 100vw);
  bottom: 0;
  width: clamp(60px, calc(3.75 * var(--u)), 100vw);
  border-radius: clamp(8px, calc(0.5 * var(--u)), 100vw);
  background: #003153;
  transform: skewX(-10deg);
  z-index: -1;
}

@media screen and (max-width: 495px) {
  .level-box--lobby .right {
    display: none;
  }

  .level-box--lobby .name {
    word-break: keep-all;
  }

  .level-box--lobby:hover {
    width: calc(100% - 60px);
  }

  .level-box--lobby:hover .right {
    display: flex;
  }

  .level-box--lobby {
    width: 100px;
    transition: all 0.3s;
    z-index: 10;
    left: 30px;
    transform: skewX(-10deg);
    border-radius: 8px;
  }

  .level-box--lobby:before {
    display: none;
  }

  .level-box--lobby .container {
    transform: skewX(10deg);
    margin: auto 26px;
  }
}

/* ===== 简介页变体（静态展示） ===== */

.level-box--bio {
  width: 40%;
  background: #003153dd;
  bottom: calc(clamp(40px, calc(2.5 * var(--u)), 100vw) + var(--safe-bottom));
  transform: skewX(-10deg);
}

/* 整卡倾斜，容器反斜校正保持内容水平 */
.level-box--bio .container {
  transform: skewX(10deg);
}

@media screen and (max-width: 768px) {
  .level-box--bio {
    width: 80%;
    position: relative;
    /* relative 时 bottom 会把元素顶上去；安全区已从容器高度扣除，勿再叠一层 */
    bottom: clamp(40px, calc(2.5 * var(--u)), 100vw);
  }
}
</style>
