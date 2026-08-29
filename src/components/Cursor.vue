<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { BAClickFX } from 'ba-click-fx'

// 蔚蓝档案点击特效与光标拖尾实例
let fx: BAClickFX | null = null

onMounted(() => {
  // 默认全屏挂载覆盖层，WebGL2 渲染，自动监听点击特效与拖拽拖尾
  fx = new BAClickFX()
})

onUnmounted(() => {
  fx?.destroy()
  fx = null
})
</script>

<style>
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
</style>
