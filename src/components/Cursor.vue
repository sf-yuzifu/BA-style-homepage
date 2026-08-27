<script setup>
import { onMounted, onUnmounted } from 'vue'
import { BAClickFX } from 'ba-click-fx'

// 蔚蓝档案点击特效与光标拖尾实例
let fx = null

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

/* 可交互元素使用链接光标，子元素默认继承 */
a,
button,
.css-cursor-hover-enabled,
.aplayer-button,
.aplayer-button *,
.l2d-hover {
  cursor: url('/cursors/link.cur'), pointer !important;
}
</style>
