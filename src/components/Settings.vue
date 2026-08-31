<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConfig } from '@/composables/useConfig'
import { useReducedMotion } from '@/composables/useReducedMotion'
import { useSettings } from '@/composables/useSettings'
import SettingRadio from '@/components/SettingRadio.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { configs } = useConfig()
const { prefersReducedMotion } = useReducedMotion()
const { voiceMuted, voiceVolume, bgmMuted, bgmVolume, introMode, clickEffect } = useSettings()

const t = computed(() => configs.value?.translate ?? {})

type TabKey = 'audio' | 'presentation'
const activeTab = ref<TabKey>('audio')

const tabs = computed<Array<{ key: TabKey; label: string }>>(() => [
  { key: 'audio', label: t.value.settingsAudio || 'Volume' },
  { key: 'presentation', label: t.value.settingsPresentation || 'Presentation' }
])

const onOffOptions = computed(() => [
  { value: 'on', label: t.value.settingsOn || 'On' },
  { value: 'off', label: t.value.settingsOff || 'Off' }
])

const introOptions = computed(() => [
  { value: 'always', label: t.value.settingsIntroAlways || 'Every visit' },
  { value: 'once', label: t.value.settingsIntroOnce || 'First visit only' }
])

// 面板上呈现的是「开启/关闭」，内部存的是 muted，这里做一层反转
const boolToSwitch = (value: boolean) => (value ? 'on' : 'off')

const voiceSwitch = computed({
  get: () => boolToSwitch(!voiceMuted.value),
  set: (value: string) => {
    voiceMuted.value = value === 'off'
  }
})

const bgmSwitch = computed({
  get: () => boolToSwitch(!bgmMuted.value),
  set: (value: string) => {
    bgmMuted.value = value === 'off'
  }
})

const clickEffectSwitch = computed({
  get: () => boolToSwitch(clickEffect.value),
  set: (value: string) => {
    clickEffect.value = value === 'on'
  }
})

const introSwitch = computed({
  get: () => introMode.value,
  set: (value: string) => {
    introMode.value = value === 'always' ? 'always' : 'once'
  }
})

const voicePercent = computed(() => Math.round(voiceVolume.value * 100))
const bgmPercent = computed(() => Math.round(bgmVolume.value * 100))

const onVolumeInput = (target: 'voice' | 'bgm', event: Event) => {
  const value = Number((event.target as HTMLInputElement).value) / 100
  if (!Number.isFinite(value)) return
  if (target === 'voice') {
    voiceVolume.value = value
  } else {
    bgmVolume.value = value
  }
}

const close = () => {
  emit('update:visible', false)
}

const selectTab = (key: TabKey) => {
  activeTab.value = key
}

const moveTab = (step: number) => {
  const list = tabs.value
  const index = list.findIndex((tab) => tab.key === activeTab.value)
  if (index < 0) return
  activeTab.value = list[(index + step + list.length) % list.length].key
}
</script>

<template>
  <a-modal
    :visible="props.visible"
    modal-class="settings-modal"
    :footer="false"
    :mask-closable="true"
    :esc-to-close="true"
    unmount-on-close
    @cancel="close"
  >
    <template #title>{{ t.settings || 'Settings' }}</template>

    <div class="settings">
      <nav class="tabs" role="tablist" :aria-label="t.settings || 'Settings'">
        <span
          v-for="tab in tabs"
          :key="tab.key"
          class="tab css-cursor-hover-enabled"
          :class="{ active: tab.key === activeTab }"
          role="tab"
          tabindex="0"
          :aria-selected="tab.key === activeTab"
          @click="selectTab(tab.key)"
          @keydown.enter.prevent="selectTab(tab.key)"
          @keydown.space.prevent="selectTab(tab.key)"
          @keydown.up.prevent="moveTab(-1)"
          @keydown.down.prevent="moveTab(1)"
        >
          {{ tab.label }}
        </span>
      </nav>

      <div class="panel" role="tabpanel">
        <template v-if="activeTab === 'audio'">
          <section class="row">
            <h3 class="row-title">{{ t.settingsVoice || 'Character voice' }}</h3>
            <p class="row-desc">{{ t.settingsVoiceDesc }}</p>
            <SettingRadio v-model="voiceSwitch" :options="onOffOptions" :label="t.settingsVoice" />
            <div class="slider" :class="{ disabled: voiceMuted }">
              <span class="slider-label">{{ t.settingsVolume || 'Volume' }}</span>
              <input
                class="slider-input css-cursor-hover-enabled"
                type="range"
                min="0"
                max="100"
                step="1"
                :value="voicePercent"
                :disabled="voiceMuted"
                :aria-label="t.settingsVolume || 'Volume'"
                @input="onVolumeInput('voice', $event)"
              />
              <span class="slider-value">{{ voicePercent }}%</span>
            </div>
          </section>

          <section class="row">
            <h3 class="row-title">{{ t.settingsBgm || 'Background music' }}</h3>
            <p class="row-desc">{{ t.settingsBgmDesc }}</p>
            <SettingRadio v-model="bgmSwitch" :options="onOffOptions" :label="t.settingsBgm" />
            <div class="slider" :class="{ disabled: bgmMuted }">
              <span class="slider-label">{{ t.settingsVolume || 'Volume' }}</span>
              <input
                class="slider-input css-cursor-hover-enabled"
                type="range"
                min="0"
                max="100"
                step="1"
                :value="bgmPercent"
                :disabled="bgmMuted"
                :aria-label="t.settingsVolume || 'Volume'"
                @input="onVolumeInput('bgm', $event)"
              />
              <span class="slider-value">{{ bgmPercent }}%</span>
            </div>
          </section>
        </template>

        <template v-else>
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
        </template>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.settings {
  display: flex;
  align-items: stretch;
  height: calc(100% - clamp(4px, 0.25vw, 100vw));
  background-color: #fff;
  border-radius: clamp(4px, 0.25vw, 100vw);
  border: clamp(2px, 0.125vw, 100vw) solid #6b7f8d66;
  filter: drop-shadow(0px 2px clamp(2px, 0.125vw, 100vw) #6b7f8d);
}

.tabs {
  flex: none;
  width: 20%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: rgb(205, 232, 253);
}

.tab {
  position: relative;
  padding: clamp(12px, 0.75vw, 100vw) clamp(10px, 0.625vw, 100vw);
  font-size: clamp(20px, 1.25vw, 100vw);
  color: #003153;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  white-space: nowrap;
  transition:
    background-color 0.2s,
    transform 0.1s;
  font-weight: bold;
  border: clamp(2px, 0.125vw, 100vw) solid rgb(205, 232, 253);
  border-bottom: unset;
}

.tab:not(:last-child)::after {
  content: '';
  display: flex;
  width: 90%;
  height: clamp(2px, 0.125vw, 100vw);
  background-color: #6b7f8d66;
  position: absolute;
  bottom: 0;
}

.tab:hover {
  background: rgb(185, 212, 233);
}

.tab.active {
  background: #fff;
  color: #000;
}

.tab:active {
  transform: scale(0.95);
}

.panel {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  margin: clamp(6px, 0.375vw, 100vw);
  padding: clamp(6px, 0.375vw, 100vw);
  border: clamp(6px, 0.375vw, 100vw) solid rgb(238, 238, 238);
}

.row {
  /*border-bottom: clamp(6px, 0.375vw, 100vw) solid rgb(238, 238, 238);*/
  margin: clamp(6px, 0.375vw, 100vw);
  text-align: left;
}

.row:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

/* 游戏内小标题：左侧一道蓝色竖条 */
.row-title {
  display: flex;
  align-items: center;
  gap: clamp(8px, 0.5vw, 100vw);
  font-size: clamp(18px, 1.125vw, 100vw);
  color: #003153;
  font-weight: bold;
  border-bottom: clamp(1px, 0.0625vw, 100vw) dashed #c9d8e2;
  line-height: 1;
  padding-top: 0;
  padding-bottom: clamp(12px, 0.75vw, 100vw);
}

.row:not(:first-child) .row-title {
  padding-top: clamp(6px, 0.375vw, 100vw);
}

.row-title::before {
  content: '';
  flex: none;
  position: relative;
  top: clamp(1px, 0.0625vw, 100vw);
  width: clamp(3px, 0.1875vw, 100vw);
  height: clamp(18px, 1.125vw, 100vw);
  background: #4ec3f5;
  border-radius: clamp(2px, 0.125vw, 100vw);
}

.row-desc {
  margin: clamp(8px, 0.5vw, 100vw) 0 clamp(12px, 0.75vw, 100vw);
  font-size: clamp(14px, 0.875vw, 100vw);
  color: #6b7f8d;
  line-height: 1.6;
}

.row-desc:empty {
  display: none;
}

.notice {
  margin-bottom: clamp(16px, 1vw, 100vw);
  padding: clamp(10px, 0.625vw, 100vw) clamp(12px, 0.75vw, 100vw);
  font-size: clamp(14px, 0.875vw, 100vw);
  color: #003153;
  background: #e8f6fd;
  border-radius: clamp(4px, 0.25vw, 100vw);
  text-align: left;
  line-height: 1.6;
}

.slider {
  display: flex;
  align-items: center;
  gap: clamp(10px, 0.625vw, 100vw);
  margin-top: clamp(14px, 0.875vw, 100vw);
}

.slider.disabled {
  opacity: 0.45;
}

.slider-label,
.slider-value {
  flex: none;
  font-size: clamp(14px, 0.875vw, 100vw);
  color: #003153;
}

.slider-value {
  min-width: clamp(44px, 2.75vw, 100vw);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.slider-input {
  flex: 1;
  min-width: 0;
  height: clamp(18px, 1.125vw, 100vw);
  accent-color: #4ec3f5;
}

@media screen and (max-width: 767px) {
  .settings {
    flex-direction: column;
    height: min(60dvh, 420px);
    gap: clamp(12px, 0.75vw, 100vw);
  }

  .tabs {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .tab {
    flex: 1;
  }

  .tab + .tab::before {
    position: absolute;
    left: 0;
    top: 50%;
    width: 2px;
    height: 80%;
    margin: 0;
    transform: translateY(-50%);
  }
}
</style>

<style>
/* 设置面板需要比 index.css 里通用弹窗更宽、更紧凑的内边距 */
.settings-modal.arco-modal {
  width: min(92vw, clamp(1136px, 71vw, 100vw)) !important;
  height: min(92vh, clamp(604px, 37.75vw, 100vw)) !important;
}

.settings-modal .arco-modal-body,
.settings-modal > :last-child.arco-modal-body {
  padding: clamp(16px, 1vw, 100vw) !important;
  max-width: none;
  font-size: clamp(16px, 1vw, 100vw) !important;
  text-align: left !important;
  height: calc(100% - clamp(48px, 3vw, 100vw) - clamp(32px, 2vw, 100vw));
}
</style>
