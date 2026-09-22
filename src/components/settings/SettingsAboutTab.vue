<script setup lang="ts">
import { computed } from 'vue'
import { useAboutCopyright } from '@/composables/useAboutCopyright'
import { useConfig } from '@/composables/useConfig'

const { configs } = useConfig()
const { isOriginalAuthor, copyrightYear, authorName, isReady: aboutReady } = useAboutCopyright()

const t = computed(() => configs.value?.translate ?? {})
const buildInfo = __BUILD_INFO__

const projectTitle = computed(
  () => configs.value?.manifest?.name || configs.value?.title || 'Fish Archive'
)
const projectDescription = computed(
  () => configs.value?.manifest?.description || configs.value?.description || ''
)
const projectIcon = computed(() => configs.value?.favicon || '/favicon144.png')
const repoUrl = 'https://github.com/sf-yuzifu/BA-style-homepage'
</script>

<template>
  <section v-if="aboutReady" class="row about-panel">
    <div class="about-hero">
      <img class="about-logo" :src="projectIcon" alt="" />
      <h2 class="about-title">
        <a
          class="about-title-link css-cursor-hover-enabled"
          :href="repoUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ projectTitle }}
        </a>
      </h2>
      <p v-if="projectDescription" class="about-tagline">{{ projectDescription }}</p>
    </div>
    <footer class="about-footer">
      <p class="about-copyright">© {{ copyrightYear }} {{ authorName }}</p>
      <p v-if="!isOriginalAuthor" class="about-made-by">Made by 小鱼yuzifu</p>
      <p class="about-build">
        {{ t.buildVersion || 'Build' }}
        <a
          v-if="buildInfo.commitUrl"
          class="about-build-link css-cursor-hover-enabled"
          :href="buildInfo.commitUrl"
          target="_blank"
          rel="noopener noreferrer"
          >{{ buildInfo.shortHash }}</a
        >
        <span v-else>{{ buildInfo.shortHash }}</span>
        <span> · {{ buildInfo.buildTime }}</span>
      </p>
    </footer>
  </section>
</template>

<style scoped>
.about-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: clamp(24px, 1.5vw, 100vw);
  border-bottom: none;
}

.about-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(12px, 0.75vw, 100vw);
  max-width: clamp(420px, 26.25vw, 100vw);
}

.about-logo {
  width: clamp(72px, 4.5vw, 100vw);
  height: clamp(72px, 4.5vw, 100vw);
  border-radius: clamp(16px, 1vw, 100vw);
}

.about-title {
  margin: 0;
  font-size: clamp(28px, 1.75vw, 100vw);
  font-weight: bold;
  line-height: 1.2;
}

.about-title-link {
  color: #003153;
  text-decoration: none;
  transition: color 0.2s;
}

.about-title-link:hover {
  color: #4ec3f5;
}

.about-tagline {
  margin: 0;
  font-size: clamp(15px, 0.9375vw, 100vw);
  color: #6b7f8d;
  line-height: 1.7;
}

.about-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(6px, 0.375vw, 100vw);
  width: min(100%, clamp(360px, 22.5vw, 100vw));
  padding-top: clamp(16px, 1vw, 100vw);
  border-top: clamp(1px, 0.0625vw, 100vw) dashed #c9d8e2;
  font-size: clamp(14px, 0.875vw, 100vw);
  color: #6b7f8d;
  line-height: 1.6;
}

.about-copyright,
.about-made-by,
.about-build {
  margin: 0;
}

.about-build-link {
  color: inherit;
  text-decoration: none;
  transition: color 0.2s;
}

.about-build-link:hover {
  color: #4ec3f5;
}
</style>
