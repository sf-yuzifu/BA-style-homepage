<script setup lang="ts">
import { computed } from 'vue'
import { useConfig, type LocalePreference } from '@/composables/useConfig'
import SettingRadio from '@/components/SettingRadio.vue'

const { configs, localePreference, setLocalePreference } = useConfig()

const t = computed(() => configs.value?.translate ?? {})

const languageOptions = computed(() => [
  { value: 'auto', label: t.value.settingsLanguageAuto || 'Follow browser' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en-US', label: 'English' },
  { value: 'ja-JP', label: '日本語' }
])

const languageSwitch = computed({
  get: () => localePreference.value,
  set: (value: string) => {
    setLocalePreference(value as LocalePreference)
  }
})
</script>

<template>
  <section class="row">
    <h3 class="row-title">{{ t.settingsLanguage || 'Language' }}</h3>
    <p class="row-desc">{{ t.settingsLanguageDesc }}</p>
    <SettingRadio
      v-model="languageSwitch"
      class="language-radio"
      :options="languageOptions"
      :label="t.settingsLanguage"
    />
  </section>
</template>

<style scoped>
.language-radio :deep(.radio-group) {
  grid-template-columns: repeat(2, 1fr);
}
</style>
