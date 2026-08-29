<script setup lang="ts">
import { ref, computed } from 'vue'
import Footer from '@/components/Footer.vue'
import Level from '@/components/Level.vue'
import Toolbox from '@/components/Toolbox.vue'
import Contact from '@/components/Contact.vue'
import Task from '@/components/Task.vue'
import Background from '@/components/Background.vue'
import MusicBanner from '@/components/MusicBanner.vue'
import { useResponsive } from '@/composables/useResponsive'
import { useConfig } from '@/composables/useConfig'
import ICPBanner from '@/components/ICPBanner.vue'

// 状态管理
const l2dOnly = ref(true)
const canSkipit = ref(true)

// 使用composables
const { changeDirection } = useResponsive()
const { configs } = useConfig()
const ifICP = computed(() => configs.value?.ICP || '')
const bannerDirection = computed(() => (ifICP.value ? 'right' : changeDirection.value))
const ICPDirection = computed(() => {
  if (ifICP.value) {
    if (changeDirection.value == 'left') {
      return 'left'
    }
    return 'down'
  }
  return ''
})

// 方法
const switchL2D = () => {
  l2dOnly.value = !l2dOnly.value
}

const canSkip = (value: boolean) => {
  canSkipit.value = value
}
</script>

<template>
  <!-- 背景 -->
  <div id="background" class="app-background"></div>

  <!-- 主要内容 -->
  <main class="app-main">
    <Suspense>
      <Background :l2dOnly="l2dOnly" @update:changeL2D="l2dOnly = $event" @canskip="canSkip" />
    </Suspense>

    <!-- 等级部分 -->
    <transition name="up">
      <Level v-if="!l2dOnly" />
    </transition>

    <!-- 工具箱 -->
    <Toolbox :l2dOnly="l2dOnly" :canskip="canSkipit" @switch="switchL2D" />

    <!-- 联系方式 -->
    <transition name="left">
      <Contact v-if="!l2dOnly" />
    </transition>

    <!-- ICP -->
    <transition :name="ICPDirection">
      <ICPBanner v-if="!l2dOnly && ifICP" />
    </transition>

    <!-- 任务 -->
    <Task :l2dOnly="l2dOnly" />

    <!-- 横幅 -->
    <transition :name="bannerDirection">
      <MusicBanner v-show="!l2dOnly" />
    </transition>

    <!-- 页脚 -->
    <transition name="down">
      <Footer v-if="!l2dOnly" />
    </transition>
  </main>
</template>

<style scoped>
/* 导入样式文件 */
@import '@/assets/app.css';

/* 主要内容区域 */
main {
  display: flex;
  flex-direction: column;
}
</style>
