<script setup lang="ts">
import { computed } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { useGuide } from '@/composables/useGuide'
import { useReducedMotion } from '@/composables/useReducedMotion'
import { useSettings } from '@/composables/useSettings'
import SettingRadio from '@/components/SettingRadio.vue'

const { configs } = useConfig()
const { prefersReducedMotion } = useReducedMotion()
const { introMode, clickEffect, lobbyArrowKeys } = useSettings()
const { requestStart } = useGuide()

const t = computed(() => configs.value?.translate ?? {})

const onOffOptions = computed(() => [
  { value: 'on', label: t.value.settingsOn || 'On' },
  { value: 'off', label: t.value.settingsOff || 'Off' }
])

const introOptions = computed(() => [
  { value: 'always', label: t.value.settingsIntroAlways || 'Every visit' },
  { value: 'once', label: t.value.settingsIntroOnce || 'First visit only' }
])

const boolToSwitch = (value: boolean) => (value ? 'on' : 'off')

const clickEffectSwitch = computed({
  get: () => boolToSwitch(clickEffect.value),
  set: (value: string) => {
    clickEffect.value = value === 'on'
  }
})

const lobbyArrowKeysSwitch = computed({
  get: () => boolToSwitch(lobbyArrowKeys.value),
  set: (value: string) => {
    lobbyArrowKeys.value = value === 'on'
  }
})

const introSwitch = computed({
  get: () => introMode.value,
  set: (value: string) => {
    introMode.value = value === 'always' ? 'always' : 'once'
  }
})
</script>

<template>
  <p v-if="prefersReducedMotion" class="notice">
    {{ t.settingsReducedMotion }}
  </p>

  <section class="row">
    <h3 class="row-title">{{ t.settingsIntro || 'Opening cutscene' }}</h3>
    <p class="row-desc">{{ t.settingsIntroDesc }}</p>
    <SettingRadio
      v-model="introSwitch"
      :options="introOptions"
      :label="t.settingsIntro"
      :disabled="prefersReducedMotion"
    />
  </section>

  <section class="row">
    <h3 class="row-title">{{ t.settingsClickFx || 'Click effect' }}</h3>
    <p class="row-desc">{{ t.settingsClickFxDesc }}</p>
    <SettingRadio
      v-model="clickEffectSwitch"
      :options="onOffOptions"
      :label="t.settingsClickFx"
      :disabled="prefersReducedMotion"
    />
  </section>

  <section class="row">
    <h3 class="row-title">{{ t.settingsLobbyArrowKeys || 'Arrow keys' }}</h3>
    <p class="row-desc">{{ t.settingsLobbyArrowKeysDesc }}</p>
    <SettingRadio
      v-model="lobbyArrowKeysSwitch"
      :options="onOffOptions"
      :label="t.settingsLobbyArrowKeys"
    />
  </section>

  <section class="row">
    <h3 class="row-title">{{ t.guideReplay || 'Site guide' }}</h3>
    <p class="row-desc">{{ t.guideReplayDesc }}</p>
    <button type="button" class="guide-replay css-cursor-hover-enabled" @click="requestStart()">
      {{ t.guideReplayAction || 'Replay guide' }}
    </button>
  </section>
</template>

<style scoped>
.notice {
  margin-bottom: clamp(16px, calc(1 * var(--u)), 100vw);
  padding: clamp(10px, calc(0.625 * var(--u)), 100vw) clamp(12px, calc(0.75 * var(--u)), 100vw);
  font-size: clamp(14px, calc(0.875 * var(--u)), 100vw);
  color: #003153;
  background: #e8f6fd;
  border-radius: clamp(4px, calc(0.25 * var(--u)), 100vw);
  text-align: left;
  line-height: 1.6;
}

.guide-replay {
  appearance: none;
  border: none;
  padding: clamp(6px, calc(0.375 * var(--u)), 100vw) clamp(16px, calc(1 * var(--u)), 100vw);
  font: inherit;
  font-size: clamp(14px, calc(0.875 * var(--u)), 100vw);
  font-weight: bold;
  color: #003153;
  background: #e8f6fd;
  border-radius: clamp(4px, calc(0.25 * var(--u)), 100vw);
  cursor: pointer;
}

.guide-replay:hover {
  background: #d3effc;
}
</style>
