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
  <div class="contact-box">
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
  left: clamp(20px, 1.25vw, 100vw);
  top: clamp(186px, 11.625vw, 100vw);
  display: grid;
  grid-template-columns: repeat(2, clamp(130px, 8.125vw, 100vw));
  grid-gap: clamp(20px, 1.25vw, 100vw);
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
  bottom: clamp(15px, 0.9375vw, 100vw);
  margin: 0 clamp(20px, 1.25vw, 100vw);
  transition: transform 0.05s;
}

.contact span {
  margin: clamp(5px, 0.3125vw, 100vw) 0 0;
  font-size: clamp(20px, 1.25vw, 100vw);
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
  -webkit-text-stroke: clamp(2px, 0.125vw, 100vw) #fff;
  z-index: -1;
}

.arco-icon {
  font-size: clamp(48px, 3vw, 100vw);
  filter: drop-shadow(0px 0px clamp(4px, 0.25vw, 100vw) #fff6);
}

.contact img {
  height: clamp(48px, 3vw, 100vw);
  filter: drop-shadow(0px 0px clamp(4px, 0.25vw, 100vw) #fff6);
}

.contact:active {
  transform: scale(0.9);
}

@media screen and (max-width: 495px) {
  .contact-box {
    grid-template-columns: repeat(2, 100px);
    grid-gap: 20px;
  }
}

@media screen and (max-width: 375px) {
  .contact-box {
    grid-template-columns: repeat(2, 75px);
    grid-gap: 15px;
  }
}
</style>
