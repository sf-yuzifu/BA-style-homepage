<script setup lang="ts">
import { computed } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { useIconFont } from '@/composables/useIconFont'
const { configs } = useConfig()

const currentConfig = computed(() => configs.value)

const { IconFont } = useIconFont()

const contacts = computed(() => {
  if (!currentConfig.value || !currentConfig.value.contact) return []
  return currentConfig.value.contact
})
</script>

<template>
  <div class="contact-box" data-tour="contact">
    <a
      v-for="contact in contacts"
      :key="contact.name"
      :href="contact.href"
      class="contact css-cursor-hover-enabled"
    >
      <img v-if="contact.imgSrc" :src="contact.imgSrc" alt="" />
      <icon-font v-if="contact.iconfont" :type="contact.iconfont" />
      <span :data-text="contact.name">{{ contact.name }}</span>
    </a>
  </div>
</template>

<style scoped>
.contact-box {
  position: absolute;
  left: calc(clamp(20px, calc(1.25 * var(--u)), 100vw) + var(--safe-left));
  top: calc(clamp(186px, calc(11.625 * var(--u)), 100vw) + var(--safe-top));
  display: grid;
  grid-template-columns: repeat(2, clamp(130px, calc(8.125 * var(--u)), 100vw));
  grid-gap: clamp(20px, calc(1.25 * var(--u)), 100vw);
  height: auto;
  z-index: 2;
  justify-items: center;
}

.contact {
  height: max-content;
  width: fit-content;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
  bottom: clamp(15px, calc(0.9375 * var(--u)), 100vw);
  margin: 0 clamp(20px, calc(1.25 * var(--u)), 100vw);
  transition: transform 0.05s;
}

.contact span {
  margin: clamp(5px, calc(0.3125 * var(--u)), 100vw) 0 0;
  font-size: clamp(20px, calc(1.25 * var(--u)), 100vw);
  color: #003153;
  font-weight: bold;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.contact span::before {
  content: attr(data-text);
  position: absolute;
  left: 0;
  color: transparent;
  -webkit-text-stroke: clamp(2px, calc(0.125 * var(--u)), 100vw) #fff;
  z-index: -1;
}

.arco-icon {
  font-size: clamp(48px, calc(3 * var(--u)), 100vw);
  filter: drop-shadow(0px 0px clamp(4px, calc(0.25 * var(--u)), 100vw) #fff6);
}

.contact img {
  height: clamp(48px, calc(3 * var(--u)), 100vw);
  filter: drop-shadow(0px 0px clamp(4px, calc(0.25 * var(--u)), 100vw) #fff6);
}

.contact:active {
  transform: scale(0.9);
}

/* ---- 极小/短窗紧凑档（≤495px 移动档 ∪ max-height:768px 矮窗档）----
   响应式原则：优先保留可读尺寸（图标仅 48→42），靠降 top/间距下限与藏序（P5-P8）腾空间，
   而非把元素等比缩没。top 下限 148px = LevelCard 底缘（≈136px）+ 间隙 */
@media screen and (max-width: 495px), screen and (max-height: 768px) {
  .contact-box {
    top: calc(clamp(148px, calc(11.625 * var(--u)), 100vw) + var(--safe-top));
    grid-template-columns: repeat(2, clamp(80px, calc(8.125 * var(--u)), 100vw));
    grid-gap: clamp(6px, calc(1.25 * var(--u)), 100vw);
  }

  .contact {
    bottom: clamp(8px, calc(0.9375 * var(--u)), 100vw);
    margin: 0 clamp(4px, calc(1.25 * var(--u)), 100vw);
  }

  .contact span {
    margin: clamp(3px, calc(0.3125 * var(--u)), 100vw) 0 0;
    font-size: clamp(16px, calc(1.25 * var(--u)), 100vw);
  }

  .arco-icon {
    font-size: clamp(42px, calc(3 * var(--u)), 100vw);
  }

  .contact img {
    height: clamp(42px, calc(3 * var(--u)), 100vw);
  }
}

/* P6 藏序第二：极窄/极矮先弃文字标签（图标本体可辨识） */
@media screen and (max-width: 330px), screen and (max-height: 540px) {
  .contact span {
    display: none;
  }
}

/* P8 整块藏序第二：Music（≤300px/440px）之后轮到联系，Task（≤260px/370px）最后弃 */
@media screen and (max-width: 280px), screen and (max-height: 380px) {
  .contact-box {
    display: none;
  }
}
</style>
