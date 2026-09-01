<script setup lang="ts">
import { computed, ref } from 'vue'
import { IconMuteFill, IconSoundFill } from '@arco-design/web-vue/es/icon'
import { useAboutCopyright } from '@/composables/useAboutCopyright'
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
const { isOriginalAuthor, copyrightYear, authorName, isReady: aboutReady } = useAboutCopyright()
const { prefersReducedMotion } = useReducedMotion()
const { voiceMuted, voiceVolume, bgmMuted, bgmVolume, introMode, clickEffect } = useSettings()

const t = computed(() => configs.value?.translate ?? {})

type TabKey = 'audio' | 'presentation' | 'about'
const activeTab = ref<TabKey>('audio')

const tabs = computed<Array<{ key: TabKey; label: string }>>(() => [
  { key: 'audio', label: t.value.settingsAudio || 'Volume' },
  { key: 'presentation', label: t.value.settingsPresentation || 'Presentation' },
  { key: 'about', label: t.value.about || 'About' }
])

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

const introSwitch = computed({
  get: () => introMode.value,
  set: (value: string) => {
    introMode.value = value === 'always' ? 'always' : 'once'
  }
})

type VolumeKey = 'voice' | 'bgm'

// 一行一条音轨，与游戏「音量」页一致：名称 + 滑块 + 静音勾选
const volumeRows = computed(() => [
  {
    key: 'voice' as VolumeKey,
    label: t.value.settingsVoice || 'Voice',
    percent: Math.round(voiceVolume.value * 100),
    muted: voiceMuted.value
  },
  {
    key: 'bgm' as VolumeKey,
    label: t.value.settingsBgm || 'BGM',
    percent: Math.round(bgmVolume.value * 100),
    muted: bgmMuted.value
  }
])

const onVolumeInput = (target: VolumeKey, event: Event) => {
  const value = Number((event.target as HTMLInputElement).value) / 100
  if (!Number.isFinite(value)) return
  if (target === 'voice') {
    voiceVolume.value = value
  } else {
    bgmVolume.value = value
  }
}

const toggleMute = (target: VolumeKey) => {
  if (target === 'voice') {
    voiceMuted.value = !voiceMuted.value
  } else {
    bgmMuted.value = !bgmMuted.value
  }
}

const projectTitle = computed(
  () => configs.value?.manifest?.name || configs.value?.title || 'Fish Archive'
)
const projectDescription = computed(
  () => configs.value?.manifest?.description || configs.value?.description || ''
)
const projectIcon = computed(() => configs.value?.favicon || '/favicon144.png')
const repoUrl = 'https://github.com/sf-yuzifu/homepage'

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
      <nav class="tabs scroll-hidden" role="tablist" :aria-label="t.settings || 'Settings'">
        <template v-for="(tab, index) in tabs" :key="tab.key">
          <span
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
          <span v-if="index < tabs.length - 1" class="tab-divider" aria-hidden="true"></span>
        </template>
        <span class="deco" aria-hidden="true"></span>
      </nav>

      <div class="panel scroll-hidden" role="tabpanel">
        <template v-if="activeTab === 'audio'">
          <section class="row">
            <div v-for="row in volumeRows" :key="row.key" class="volume-row">
              <span class="volume-name">{{ row.label }}</span>
              <icon-mute-fill class="volume-icon" />
              <input
                class="volume-slider css-cursor-hover-enabled"
                type="range"
                min="0"
                max="100"
                step="1"
                :value="row.percent"
                :disabled="row.muted"
                :aria-label="row.label"
                :style="{ '--fill': (row.muted ? 0 : row.percent) + '%' }"
                @input="onVolumeInput(row.key, $event)"
              />
              <icon-sound-fill class="volume-icon" />
              <span class="volume-mute">
                <span class="mute-text">{{ t.settingsMute || 'Mute' }}</span>
                <span
                  class="checkbox css-cursor-hover-enabled"
                  :class="{ checked: row.muted }"
                  role="checkbox"
                  tabindex="0"
                  :aria-checked="row.muted"
                  :aria-label="row.label + ' ' + (t.settingsMute || 'Mute')"
                  @click="toggleMute(row.key)"
                  @keydown.enter.prevent="toggleMute(row.key)"
                  @keydown.space.prevent="toggleMute(row.key)"
                ></span>
              </span>
            </div>
          </section>
        </template>

        <template v-else-if="activeTab === 'presentation'">
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

        <template v-else-if="activeTab === 'about'">
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
            </footer>
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
  filter: drop-shadow(0px clamp(2px, 0.125vw, 100vw) clamp(2px, 0.125vw, 100vw) #6b7f8d);
}

.deco {
  position: absolute;
  bottom: clamp(8px, 0.5vw, 100vw);
  left: clamp(8px, 0.5vw, 100vw);
  width: 40%;
  aspect-ratio: 98 / 19;
  background-color: #4ec3f5;
  pointer-events: none;
  -webkit-mask-image: url('/deco.png');
  mask-image: url('/deco.png');
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.tabs {
  position: relative;
  flex: none;
  width: 20%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: rgb(205, 232, 253);
}

.tab {
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
  border-top: unset;
  border-bottom: unset;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.tab-divider {
  flex: none;
  align-self: center;
  width: 90%;
  height: clamp(2px, 0.125vw, 100vw);
  background-color: #6b7f8d66;
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
  border: clamp(6px, 0.375vw, 100vw) solid rgb(238, 238, 238);
}

.panel:has(.about-panel) {
  display: flex;
  flex-direction: column;
}

/* 可滚动但不显示滚动条 */
.scroll-hidden {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.scroll-hidden::-webkit-scrollbar {
  display: none;
}

.row {
  border-bottom: clamp(6px, 0.375vw, 100vw) solid rgb(238, 238, 238);
  padding: clamp(12px, 0.75vw, 100vw);
  text-align: left;
}

.row:last-child {
  border-bottom: none;
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
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
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

.divider {
  height: clamp(6px, 0.375vw, 100vw);
  width: 100%;
  background: #c9d8e2;
}

.row-desc {
  margin: clamp(8px, 0.5vw, 100vw) 0;
  font-size: clamp(14px, 0.875vw, 100vw);
  color: #6b7f8d;
  line-height: 1.6;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
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
.about-link {
  margin: 0;
}

.about-link a {
  color: #4ec3f5;
  text-decoration: none;
}

.about-link a:hover {
  text-decoration: underline;
}

/* 音量页：一行一条音轨 */
.volume-row {
  display: flex;
  align-items: center;
  gap: clamp(10px, 0.625vw, 100vw);
  padding: clamp(14px, 0.875vw, 100vw) 0;
}

.volume-row:first-child {
  padding-top: 0;
}

.volume-row:not(:last-child) {
  border-bottom: clamp(1px, 0.0625vw, 100vw) dashed #c9d8e2;
}

.volume-name {
  flex: none;
  display: flex;
  align-items: center;
  gap: clamp(8px, 0.5vw, 100vw);
  width: clamp(104px, 6.5vw, 100vw);
  font-size: clamp(18px, 1.125vw, 100vw);
  color: #003153;
  font-weight: bold;
  line-height: 1;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.volume-name::before {
  content: '';
  flex: none;
  position: relative;
  width: clamp(3px, 0.1875vw, 100vw);
  height: clamp(18px, 1.125vw, 100vw);
  top: clamp(1px, 0.0625vw, 100vw);
  background: #4ec3f5;
  border-radius: clamp(2px, 0.125vw, 100vw);
}

.volume-icon {
  flex: none;
  font-size: clamp(22px, 1.375vw, 100vw);
  color: #4ec3f5;
}

/* 已填充部分随 --fill 走，游戏里滑轨也是左蓝右灰 */
.volume-slider {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  min-width: 0;
  height: clamp(8px, 0.5vw, 100vw);
  border-radius: clamp(4px, 0.25vw, 100vw);
  background: linear-gradient(to right, #4ec3f5 var(--fill, 0%), #dfe6ea var(--fill, 0%));
  outline-offset: clamp(4px, 0.25vw, 100vw);
}

.volume-slider::-moz-range-track {
  background: transparent;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  box-sizing: border-box;
  width: clamp(18px, 1.125vw, 100vw);
  height: clamp(18px, 1.125vw, 100vw);
  border-radius: 50%;
  background: #fff;
  border: clamp(3px, 0.1875vw, 100vw) solid #4ec3f5;
}

.volume-slider::-moz-range-thumb {
  box-sizing: border-box;
  width: clamp(18px, 1.125vw, 100vw);
  height: clamp(18px, 1.125vw, 100vw);
  border-radius: 50%;
  background: #fff;
  border: clamp(3px, 0.1875vw, 100vw) solid #4ec3f5;
}

.volume-slider:disabled {
  background: #eef1f3;
}

.volume-slider:disabled::-webkit-slider-thumb {
  border-color: #c9d8e2;
}

.volume-slider:disabled::-moz-range-thumb {
  border-color: #c9d8e2;
}

.volume-mute {
  flex: none;
  display: flex;
  align-items: center;
  gap: clamp(8px, 0.5vw, 100vw);
}

.mute-text {
  font-size: clamp(16px, 1vw, 100vw);
  color: #003153;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.checkbox {
  position: relative;
  flex: none;
  box-sizing: border-box;
  width: clamp(24px, 1.5vw, 100vw);
  height: clamp(24px, 1.5vw, 100vw);
  background: #fff;
  border: clamp(2px, 0.125vw, 100vw) solid #b6c7d2;
  border-radius: clamp(3px, 0.1875vw, 100vw);
  transition:
    border-color 0.2s,
    transform 0.1s;
}

.checkbox:hover,
.checkbox.checked {
  border-color: #4ec3f5;
}

.checkbox:active {
  transform: scale(0.9);
}

.checkbox.checked::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 46%;
  width: 32%;
  height: 58%;
  border: solid #4ec3f5;
  border-width: 0 clamp(2px, 0.125vw, 100vw) clamp(2px, 0.125vw, 100vw) 0;
  transform: translate(-50%, -50%) rotate(45deg);
}

@media screen and (max-width: 767px) {
  .settings {
    flex-direction: column;
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

  .tab-divider {
    width: clamp(2px, 0.125vw, 100vw);
    height: 80%;
  }

  /* 窄屏保住「一条音轨一行」：让出喇叭图标与「静音」二字 */
  .volume-icon,
  .mute-text {
    display: none;
  }

  .volume-name {
    width: clamp(72px, 4.5vw, 100vw);
    font-size: clamp(16px, 1vw, 100vw);
  }

  .deco {
    display: none;
  }
}
</style>

<style>
/* 设置面板需要比 index.css 里通用弹窗更宽、更紧凑的内边距 */
.settings-modal.arco-modal {
  width: min(92vw, clamp(800px, 50vw, 100vw)) !important;
  height: min(92vh, clamp(432px, 27vw, 100vw)) !important;
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
