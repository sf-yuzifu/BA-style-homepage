<script setup lang="ts">
import { computed } from 'vue'
import { IconMuteFill, IconSoundFill } from '@arco-design/web-vue/es/icon'
import { useConfig } from '@/composables/useConfig'
import { useSettings } from '@/composables/useSettings'

const { configs } = useConfig()
const { voiceMuted, voiceVolume, bgmMuted, bgmVolume } = useSettings()

const t = computed(() => configs.value?.translate ?? {})

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
</script>

<template>
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

<style scoped>
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
  /* 窄屏保住「一条音轨一行」：让出喇叭图标与「静音」二字 */
  .volume-icon,
  .mute-text {
    display: none;
  }

  .volume-name {
    width: clamp(72px, 4.5vw, 100vw);
    font-size: clamp(16px, 1vw, 100vw);
  }
}
</style>
