<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useConfig } from '@/composables/useConfig'
import SettingsAboutTab from '@/components/settings/SettingsAboutTab.vue'
import SettingsAudioTab from '@/components/settings/SettingsAudioTab.vue'
import SettingsLanguageTab from '@/components/settings/SettingsLanguageTab.vue'
import SettingsPresentationTab from '@/components/settings/SettingsPresentationTab.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { configs } = useConfig()

const t = computed(() => configs.value?.translate ?? {})

type TabKey = 'audio' | 'presentation' | 'language' | 'about'
const activeTab = ref<TabKey>('audio')

const tabs = computed<Array<{ key: TabKey; label: string }>>(() => [
  { key: 'audio', label: t.value.settingsAudio || 'Volume' },
  { key: 'presentation', label: t.value.settingsPresentation || 'Presentation' },
  { key: 'language', label: t.value.settingsLanguage || 'Language' },
  { key: 'about', label: t.value.about || 'About' }
])

const close = () => {
  emit('update:visible', false)
}

const selectTab = (key: TabKey) => {
  activeTab.value = key
}

// 窄屏（≤767px）时 Tab 变横向排列：aria-orientation 随之切换，方向键两组都收
const tabsMedia = window.matchMedia('(max-width: 767px)')
const tabsHorizontal = ref(tabsMedia.matches)
const onTabsMediaChange = (e: MediaQueryListEvent) => {
  tabsHorizontal.value = e.matches
}

onMounted(() => {
  tabsMedia.addEventListener('change', onTabsMediaChange)
})

onUnmounted(() => {
  tabsMedia.removeEventListener('change', onTabsMediaChange)
})

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
      <nav
        class="tabs scroll-hidden"
        role="tablist"
        :aria-orientation="tabsHorizontal ? 'horizontal' : 'vertical'"
        :aria-label="t.settings || 'Settings'"
      >
        <template v-for="(tab, index) in tabs" :key="tab.key">
          <!-- 原生 button：Enter/Space 激活交由浏览器原生行为；
               方向键切换见 moveTab——纵向 ↑/↓、横向 ←/→，两组都收避免布局切换后失灵 -->
          <button
            type="button"
            class="tab css-cursor-hover-enabled"
            :class="{ active: tab.key === activeTab }"
            role="tab"
            :aria-selected="tab.key === activeTab"
            @click="selectTab(tab.key)"
            @keydown.up.prevent="moveTab(-1)"
            @keydown.down.prevent="moveTab(1)"
            @keydown.left.prevent="moveTab(-1)"
            @keydown.right.prevent="moveTab(1)"
          >
            {{ tab.label }}
          </button>
          <span v-if="index < tabs.length - 1" class="tab-divider" aria-hidden="true"></span>
        </template>
        <span class="deco" aria-hidden="true"></span>
      </nav>

      <!-- 各 Tab 页是独立子组件（settings/ 目录），共享下方 .settings 命名空间的面板排版样式 -->
      <div class="panel scroll-hidden" role="tabpanel">
        <SettingsAudioTab v-if="activeTab === 'audio'" />
        <SettingsPresentationTab v-else-if="activeTab === 'presentation'" />
        <SettingsLanguageTab v-else-if="activeTab === 'language'" />
        <SettingsAboutTab v-else-if="activeTab === 'about'" />
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
  /* 原生 button 的 UA 样式重置：视觉保持与 span 时代一致（背景由 hover/active 态给） */
  appearance: none;
  background: none;
  font-family: inherit;
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

/* about 页是子组件根节点（带父组件 scope 标识），:has 仍命中 */
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

/* 各 Tab 子组件共享的面板排版语言（.row/.row-title/.row-desc），命名空间隔离不外泄 */
.settings .row {
  border-bottom: clamp(6px, 0.375vw, 100vw) solid rgb(238, 238, 238);
  padding: clamp(12px, 0.75vw, 100vw);
  text-align: left;
}

.settings .row:last-child {
  border-bottom: none;
}

/* 游戏内小标题：左侧一道蓝色竖条 */
.settings .row-title {
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

.settings .row-title::before {
  content: '';
  flex: none;
  position: relative;
  top: clamp(1px, 0.0625vw, 100vw);
  width: clamp(3px, 0.1875vw, 100vw);
  height: clamp(18px, 1.125vw, 100vw);
  background: #4ec3f5;
  border-radius: clamp(2px, 0.125vw, 100vw);
}

.settings .row-desc {
  margin: clamp(8px, 0.5vw, 100vw) 0;
  font-size: clamp(14px, 0.875vw, 100vw);
  color: #6b7f8d;
  line-height: 1.6;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.settings .row-desc:empty {
  display: none;
}
</style>
