<script setup lang="ts">
import { computed, ref, onUnmounted, watch } from 'vue'
import { useReducedMotion } from '@/composables/useReducedMotion'
import { useSettings } from '@/composables/useSettings'
import { live2dReady } from '@/init/live2d'

const { prefersReducedMotion } = useReducedMotion()
const { clickEffect } = useSettings()

// 点击特效推迟到加载屏结束后再初始化（live2dReady 按设计总会 resolve，含失败降级），
// 避免在加载关键路径上额外解析 574KB chunk 并创建第二个 WebGL 上下文
const appReady = ref(false)
live2dReady.then(() => {
  appReady.value = true
})

// 蔚蓝档案点击特效（全平台保留；系统「减少动效」或设置面板关闭时不加载）
const enabled = computed(() => appReady.value && !prefersReducedMotion.value && clickEffect.value)
let fx: { destroy: () => void } | null = null

watch(
  enabled,
  async (on) => {
    if (!on) {
      fx?.destroy()
      fx = null
      return
    }
    if (fx) return
    try {
      const { BAClickFX } = await import('ba-click-fx')
      if (!enabled.value) return
      fx = new BAClickFX()
    } catch (error) {
      console.error('Failed to init click effect (WebGL may be unavailable)', error)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  fx?.destroy()
  fx = null
})
</script>

<template>
  <span hidden aria-hidden="true" />
</template>

<style>
/* 自定义光标仅用于桌面细指针；触屏恢复系统光标（与 Toolbox 的 hover 判断一致） */
@media (hover: hover) and (pointer: fine) {
  /* 蔚蓝档案光标主题（https://github.com/makipom/BlueArchive-Cursors，MIT License） */
  html {
    cursor: url('/cursors/normal.cur'), auto;
  }

  /* 可交互元素使用链接光标，子元素默认继承。
     注意：cursor 的继承会被任何直接声明覆盖（如 Arco / APlayer 组件自带的 cursor:pointer），
     因此第三方组件内部的可交互元素必须在此显式列出并用 !important 覆盖；
     其中 APlayer 的 .aplayer-bar-wrap / .aplayer-volume-wrap 自身就带 !important（优先级 0-4-0），
     需要 #aplayer 前缀（1-x-0）才能压过 */
  a,
  button,
  input[type='range'],
  .css-cursor-hover-enabled,
  .l2d-hover,
  .arco-modal-close-btn,
  .arco-icon-hover,
  #aplayer .aplayer-button,
  #aplayer .aplayer-button *,
  #aplayer .aplayer-pic,
  #aplayer .aplayer-icon,
  #aplayer .aplayer-miniswitcher,
  #aplayer .aplayer-list li,
  #aplayer .aplayer-list li *,
  #aplayer .aplayer-bar-wrap,
  #aplayer .aplayer-bar-wrap *,
  #aplayer .aplayer-volume-wrap,
  #aplayer .aplayer-volume-wrap * {
    cursor: url('/cursors/link.cur'), pointer !important;
  }

  /* APlayer 的歌名/歌词文本区显式声明了 cursor:default，同样压回自定义普通光标 */
  #aplayer .aplayer-music,
  #aplayer .aplayer-lrc,
  #aplayer .aplayer-lrc * {
    cursor: url('/cursors/normal.cur'), default !important;
  }
}
</style>
