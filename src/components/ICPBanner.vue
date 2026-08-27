<script setup>
import { computed } from 'vue'
import { useConfig } from '@/composables/useConfig'

// 使用配置系统
const { configs } = useConfig()
const ifICP = computed(() => configs.value?.ICP || '')
const ifGongan = computed(() => configs.value?.gongan || '')
const icpTitle = computed(() => configs.value?.icp?.title || '备案信息')
</script>

<template>
  <div id="icp-container">
    <img class="icp-bg" src="/img/bannerBG.png" alt="" />
    <img class="banner" src="/img/banner.png" alt="" />
    <div v-if="ifICP || ifGongan" class="icp-content">
      <span class="title" :data-text="icpTitle">{{ icpTitle }}</span>
      <div class="icp-links">
        <a
          v-if="ifICP"
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          class="icp-link"
          :data-text="ifICP"
        >
          {{ ifICP }}
        </a>
        <a
          v-if="ifGongan"
          href="https://beian.mps.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          class="gongan-link"
          :data-text="ifGongan"
        >
          {{ ifGongan }}
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
#icp-container {
  position: absolute;
  left: clamp(50px, 3.125vw, 100vw);
  bottom: clamp(180px, 11.25vw, 100vw);
  width: clamp(300px, 18.75vw, 100vw);
  aspect-ratio: 446 / 158;
  opacity: 0.9;
  z-index: 2;
  transition: transform 0.3s;
  background-size: cover;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 0 clamp(2px, 0.125vw, 100vw) clamp(2px, 0.125vw, 100vw) rgb(0, 0, 0, 0.5);
}

#icp-container:active {
  transform: scale(0.95);
}

.icp-bg {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  top: 0;
  left: 0;
}

.icp-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: clamp(4px, 0.25vw, 100vw) clamp(8px, 0.5vw, 100vw);
  height: calc(100% - clamp(8px, 0.5vw, 100vw));
  z-index: 2;
}

.banner {
  width: auto;
  height: 100%;
  position: relative;
  bottom: calc(0px - clamp(12px, 0.75vw, 100vw));
  left: 0;
}

.icp-link,
.gongan-link,
.title {
  color: #fff;
  text-decoration: none;
  font-size: clamp(16px, 1vw, 100vw);
  display: flex;
  align-items: flex-start;
  transition: color 0.3s;
  font-weight: bold;
}

.icp-links {
  display: flex;
  flex-direction: column;
  gap: clamp(4px, 0.25vw, 100vw);
}

.title {
  font-size: clamp(22px, 1.375vw, 100vw);
}

.icp-link::before,
.gongan-link::before,
.title::before {
  content: attr(data-text);
  position: absolute;
  color: transparent;
  font-weight: bold;
  -webkit-text-stroke: clamp(4px, 0.25vw, 100vw) #00aeec;
  z-index: -1;
}

.icp-link:hover,
.gongan-link:hover {
  color: #0066cc;
}

@media screen and (max-width: 600px) {
  #icp-container {
    width: 40vw;
    aspect-ratio: unset;
  }

  .banner {
    display: none;
  }
}

@media screen and (max-width: 495px) {
  #icp-container {
    display: flex;
    left: 0;
    width: 100%;
    height: 50px;
    bottom: 0;
    box-shadow: unset;
    background: #e8f3ffee;
    opacity: 1;
    z-index: 10;
  }

  .icp-bg {
    display: none;
  }

  .icp-link::before,
  .gongan-link::before,
  .title::before {
    content: attr(data-text);
    display: none;
  }

  .title {
    display: none;
  }

  .icp-content {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    padding: 0;
    height: 100%;
    width: 100%;
  }

  .icp-links {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    height: 100%;
  }

  .icp-link,
  .gongan-link,
  .title {
    color: #003153;
  }
}
</style>
