<script setup lang="ts">
import { computed } from 'vue'
import { useConfig } from '@/composables/useConfig'

// 使用配置系统
const { configs } = useConfig()
const ifICP = computed(() => configs.value?.ICP || '')
const ifGongan = computed(() => configs.value?.gongan || '')
const icpTitle = computed(() => configs.value?.icp?.title || '备案信息')
</script>

<template>
  <!-- id 保留给 init/links.ts 的幕布跳转排除钩子；样式走 BEM class -->
  <div id="icp-container" class="icp-banner" data-tour="icp">
    <img class="icp-banner__bg" src="/img/bannerBG.png" alt="" draggable="false" />
    <img class="icp-banner__ribbon" src="/img/banner.png" alt="" draggable="false" />
    <div v-if="ifICP || ifGongan" class="icp-banner__content">
      <span class="icp-banner__title">{{ icpTitle }}</span>
      <div class="icp-banner__links">
        <a
          v-if="ifICP"
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          class="icp-banner__link"
        >
          {{ ifICP }}
        </a>
        <a
          v-if="ifGongan"
          href="https://beian.mps.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          class="icp-banner__link"
        >
          {{ ifGongan }}
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 与 MusicBanner 同构的「游戏大厅海报卡」质感：圆角卡片 + drop-shadow 投影 */
.icp-banner {
  position: absolute;
  left: calc(clamp(50px, 3.125vw, 100vw) + var(--safe-left));
  bottom: calc(clamp(180px, 11.25vw, 100vw) + var(--safe-bottom));
  width: clamp(300px, 18.75vw, 100vw);
  aspect-ratio: 446 / 158;
  opacity: 0.9;
  z-index: 2;
  transition: transform 0.3s;
  border-radius: clamp(8px, 0.5vw, 100vw);
  /* 不用 overflow:hidden（丝带 banner.png 要探出下边缘）；圆角裁剪由底图 border-radius: inherit 承担 */
  /* drop-shadow 随圆角/透明轮廓投影（box-shadow 只认盒模型矩形） */
  filter: drop-shadow(0 clamp(3px, 0.1875vw, 100vw) clamp(3px, 0.1875vw, 100vw) #0003);
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
}

.icp-banner:active {
  transform: scale(0.95);
}

/* 底图满铺（圆角随卡片） */
.icp-banner__bg {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  top: 0;
  left: 0;
  border-radius: inherit;
}

.icp-banner__content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: clamp(4px, 0.25vw, 100vw) clamp(8px, 0.5vw, 100vw);
  height: calc(100% - clamp(8px, 0.5vw, 100vw));
  z-index: 2;
}

/* 丝带挂图：探出卡片下边缘（故根节点不裁剪） */
.icp-banner__ribbon {
  width: auto;
  height: 100%;
  position: relative;
  bottom: calc(0px - clamp(12px, 0.75vw, 100vw));
  left: 0;
}

.icp-banner__title,
.icp-banner__link {
  color: #fff;
  text-decoration: none;
  font-size: clamp(16px, 1vw, 100vw);
  display: flex;
  align-items: flex-start;
  transition: color 0.3s;
  font-weight: bold;
  /* 描边画在文字填充下层，保持白色字芯完整（替代旧 ::before data-text 垫底技法） */
  -webkit-text-stroke: clamp(4px, 0.25vw, 100vw) #00aeec;
  paint-order: stroke fill;
}

.icp-banner__links {
  display: flex;
  flex-direction: column;
  gap: clamp(4px, 0.25vw, 100vw);
}

/* 标题立体字（对齐 MusicBanner 的 EVENT! 角标）：底部一层深色实体偏移 = 立体厚度，再加一层柔和投影 */
.icp-banner__title {
  font-size: clamp(22px, 1.375vw, 100vw);
  filter: drop-shadow(0 clamp(1.5px, 0.1vw, 100vw) 0 #008bbd)
    drop-shadow(0 clamp(2px, 0.125vw, 100vw) clamp(3px, 0.1875vw, 100vw) rgba(0, 0, 0, 0.35));
}

/* 链接走柔和 text-shadow 保可读性（厚度留给标题，链接保持轻量） */
.icp-banner__link {
  text-shadow: 0 1px clamp(3px, 0.1875vw, 100vw) rgba(0, 0, 0, 0.55);
}

.icp-banner__link:hover {
  color: #0066cc;
}

@media screen and (max-width: 600px) {
  .icp-banner {
    width: 40vw;
    aspect-ratio: unset;
  }

  .icp-banner__ribbon {
    display: none;
  }
}

/* 窄屏合规底栏：布局不变，仅降级质感（浅底深字 → 去描边/立体/投影） */
@media screen and (max-width: 495px) {
  .icp-banner {
    display: flex;
    left: 0;
    width: 100%;
    height: 50px;
    bottom: 0;
    padding-bottom: var(--safe-bottom);
    border-radius: 0;
    filter: none;
    background: #e8f3ffee;
    opacity: 1;
    z-index: 10;
  }

  .icp-banner__bg {
    display: none;
  }

  .icp-banner__title {
    display: none;
  }

  .icp-banner__content {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    padding: 0;
    height: 100%;
    width: 100%;
  }

  .icp-banner__links {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    height: 100%;
  }

  .icp-banner__title,
  .icp-banner__link {
    color: #003153;
    -webkit-text-stroke-width: 0;
    filter: none;
    text-shadow: none;
  }

  .icp-banner:active {
    transform: scale(1);
  }
}
</style>
