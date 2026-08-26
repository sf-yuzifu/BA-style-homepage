<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { navigateWithCurtain } from '@/init/links.js'

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

const goToBio = () => {
  navigateWithCurtain('/bio')
}
</script>

<template>
  <div
    class="level-box"
    role="button"
    tabindex="0"
    @click="goToBio"
    @keydown.enter.prevent="goToBio"
    @keydown.space.prevent="goToBio"
  >
    <div class="container">
      <div class="level css-cursor-hover-enabled">
        <span>Lv.</span>
        <p>{{ level }}</p>
      </div>
      <div class="right">
        <span class="name">{{ author }}</span>
        <div>
          <a-progress
            :percent="exp / nextExp"
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
</template>

<style scoped>
.level-box {
  width: clamp(300px, 18.75vw, 100vw);
  height: clamp(96px, 6vw, 100vw);
  background: linear-gradient(120deg, #003153, #2265bb 15%, #003153 70%, #003153);
  position: absolute;
  left: 0;
  top: clamp(40px, 2.5vw, 100vw);
  border-radius: clamp(8px, 0.5vw, 100vw);
  filter: drop-shadow(0 clamp(3px, 0.1875vw, 100vw) clamp(3px, 0.1875vw, 100vw) black);
  display: flex;
  z-index: 2;
}

.level-box:before {
  content: '';
  position: absolute;
  top: 0;
  right: clamp(-20px, -1.25vw, 100vw);
  bottom: 0;
  width: clamp(60px, 3.75vw, 100vw);
  border-radius: clamp(8px, 0.5vw, 100vw);
  background: #003153;
  transform: skewX(-10deg);
  z-index: -1;
}

.level-box .container {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin: auto 0 auto clamp(26px, 1.625vw, 100vw);
  width: 100%;
  height: calc(100% - clamp(26px, 1.625vw, 100vw));
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
}

@media screen and (max-width: 495px) {
  .right {
    display: none;
  }

  .name {
    word-break: keep-all;
  }

  .level-box:hover {
    width: calc(100% - 60px);
  }

  .level-box:hover .right {
    display: flex;
  }

  .level-box {
    width: 100px;
    transition: all 0.3s;
    z-index: 10;
    left: 30px;
    transform: skewX(-10deg);
    border-radius: 8px;
  }

  .level-box:before {
    display: none;
  }

  .level-box .container {
    transform: skewX(10deg);
    margin: auto 26px;
  }
}
</style>
