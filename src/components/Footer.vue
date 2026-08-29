<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { useIconFont } from '@/composables/useIconFont'
const { configs } = useConfig()

const currentConfig = computed(() => configs.value)
const ifICP = computed(() => configs.value?.ICP || '')

const { IconFont } = useIconFont()

const dockSites = computed(() => {
  if (!currentConfig.value || !currentConfig.value.dock) return []
  return currentConfig.value.dock
})

const addZero = (time: number) => {
  return time < 10 ? '0' + time : time
}

const time = ref(addZero(new Date().getHours()) + ':' + addZero(new Date().getMinutes()))

const timeTimer = setInterval(() => {
  time.value = addZero(new Date().getHours()) + ':' + addZero(new Date().getMinutes())
}, 1000)

onUnmounted(() => {
  clearInterval(timeTimer)
})
</script>

<template>
  <div class="footer" :class="{ 'icp-mode': ifICP }">
    <div class="project-box">
      <a
        v-for="site in dockSites"
        :key="site.name"
        :href="site.href"
        class="project css-cursor-hover-enabled"
      >
        <img v-if="site.imgSrc" :src="site.imgSrc" alt="" />
        <icon-font v-if="site.iconfont" :type="site.iconfont" />
        <span>{{ site.name }}</span>
      </a>
    </div>
    <div class="time">
      <img src="/deco.png" alt="" />
      <span>{{ time }}</span>
    </div>
    <div class="divide"></div>
  </div>
</template>

<style scoped>
.footer {
  width: calc(100% - clamp(80px, 5vw, 100vw));
  height: clamp(60px, 3.75vw, 100vw);
  background: #e8f3ffee;
  position: absolute;
  bottom: clamp(25px, 1.5625vw, 100vw);
  transform: skew(-20deg);
  align-self: center;
  border-radius: clamp(8px, 0.5vw, 100vw);
  display: inline-flex;
  justify-content: center;
  filter: drop-shadow(0px 0px clamp(6px, 0.375vw, 100vw) #0003);
  transition: all 0.3s;
  align-items: flex-end;
  z-index: 2;
}

.footer::after {
  content: '';
  width: calc(100% - clamp(360px, 22.5vw, 100vw));
  height: 100%;
  background: #ffffffdd;
  position: absolute;
  transform: skew(50deg);
  border-radius: clamp(4px, 0.25vw, 100vw);
  z-index: -1;
  transition: all 0.3s;
}

.project-box {
  width: calc(100% - clamp(120px, 7.5vw, 100vw));
  height: calc(100% + clamp(20px, 1.25vw, 100vw) + clamp(24px, 1.5vw, 100vw));
  transform: skew(20deg);
  position: absolute;
  left: clamp(20px, 1.25vw, 100vw);
  display: inline-flex;
  align-items: flex-end;
  overflow: auto;
}

.project-box::-webkit-scrollbar {
  display: none;
}

.time {
  transform: skew(20deg);
  position: absolute;
  right: calc(clamp(220px, 13.75vw, 100vw) + clamp(20px, 1.25vw, 100vw));
  height: 94%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  font-size: clamp(18px, 1.125vw, 100vw);
  flex-direction: column;
}

.time img {
  height: clamp(12px, 0.75vw, 100vw);
  user-select: none;
  -webkit-user-drag: none;
}

.time span {
  color: #525f72;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.divide {
  width: clamp(2px, 0.125vw, 100vw);
  height: 60%;
  background-color: #abb3c4;
  position: absolute;
  right: calc(clamp(220px, 13.75vw, 100vw) - clamp(1px, 0.0625vw, 100vw));
  bottom: 20%;
  transform: skew(20deg);
}

.project {
  height: max-content;
  width: fit-content;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
  bottom: clamp(15px, 0.9375vw, 100vw);
  margin: 0 0 0 5%;
  transition: transform 0.05s;
}

.project:active {
  transform: scale(0.9);
}

.project span {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  margin: clamp(5px, 0.3125vw, 100vw) 0 0;
  color: #003153;
  font-size: clamp(16px, 1vw, 100vw);
  word-break: keep-all;
}

.arco-icon {
  font-size: clamp(64px, 4vw, 100vw);
}

.project img {
  width: clamp(64px, 4vw, 100vw);
  height: clamp(64px, 4vw, 100vw);
  user-select: none;
  -webkit-user-drag: none;
}

@media screen and (max-height: 630px) {
  .time {
    right: calc(clamp(160px, 10vw, 100vw) + clamp(20px, 1.25vw, 100vw));
  }

  .divide {
    right: calc(clamp(160px, 10vw, 100vw) - clamp(1px, 0.0625vw, 100vw));
  }
}

@media screen and (max-width: 1120px) {
  .time {
    right: 40px;
  }

  .divide {
    display: none;
  }
}

@media screen and (max-width: 830px) {
  .project-box {
    width: 100%;
    justify-content: space-evenly;
    left: 0;
  }

  .time {
    display: none;
  }

  .project {
    margin: 0;
  }

  .project span {
    display: none;
  }
}

@media screen and (max-width: 600px) {
  .project img {
    width: 48px;
    height: 48px;
  }

  .footer::after {
    width: calc(100% - 120px);
  }
}

@media screen and (max-width: 495px) {
  .project {
    bottom: 0;
  }

  .project-box {
    transform: skew(0deg);
    align-items: center;
  }

  .footer {
    transform: skew(0deg);
    width: calc(100% - 40px);
    height: 80px;
    align-items: center;
  }

  .footer::after {
    transform: skew(0deg);
    display: none;
  }
}

/* ICP 模式下的特殊样式 */
@media screen and (max-width: 495px) {
  .footer.icp-mode {
    width: 100%;
    border-radius: 0;
    bottom: 50px;
    filter: unset;
    height: 60px;
    padding-top: 6px;
  }
}
</style>
