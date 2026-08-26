<script setup>
import { Spine } from '@esotericsoftware/spine-pixi-v7'
import * as PIXI from 'pixi.js'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useConfig } from '@/composables/useConfig'

const { configs } = useConfig()

// 从配置中获取bio角色的Live2D配置
const bioConfig = computed(() => {
  if (
    !configs.value?.bio ||
    !Array.isArray(configs.value.bio.student) ||
    configs.value.bio.student.length === 0
  ) {
    return null
  }
  // 使用第一个bio角色配置
  return configs.value.bio.student[0]
})

const l2dContainer = ref(null)
let app = null
let spine = null

onMounted(async () => {
  if (!l2dContainer.value) return

  // 等待配置加载
  const config = bioConfig.value
  if (!config) {
    console.warn('未找到bio Live2D配置')
    return
  }

  // 创建 PIXI 应用，初始大小设为容器大小
  const containerWidth = 2560
  const containerHeight = 1440

  app = new PIXI.Application({
    width: containerWidth,
    height: containerHeight,
    backgroundAlpha: 0,
    antialias: true
  })

  l2dContainer.value.appendChild(app.view)

  try {
    // 从配置构建资源路径
    const basePath = config.path
    const skelFile = config.skel
    const atlasFile = config.atlas
    const pngFile = skelFile.replace('.skel', '.png')

    // 添加资源
    const skeletonAlias = `skeleton_${config.name}`
    const atlasAlias = `atlas_${config.name}`
    const pngAlias = `png_${config.name}`

    PIXI.Assets.add({ alias: skeletonAlias, src: basePath + skelFile })
    PIXI.Assets.add({ alias: atlasAlias, src: basePath + atlasFile })
    PIXI.Assets.add({ alias: pngAlias, src: basePath + pngFile })

    // 加载资源
    await PIXI.Assets.load([skeletonAlias, atlasAlias, pngAlias])

    // 创建 Spine 实例
    spine = Spine.from({
      skeleton: skeletonAlias,
      atlas: atlasAlias
    })

    // 添加到舞台
    app.stage.addChild(spine)

    // 等待一帧让 spine 初始化完成
    app.ticker.addOnce(() => {
      if (!spine) return

      // 获取 spine 的边界框
      const bounds = spine.getBounds()
      const spineWidth = bounds.width
      const spineHeight = bounds.height

      spine.width = spineWidth
      spine.height = spineHeight

      // 设置缩放
      spine.scale.set(0.85) // 稍微留一点边距

      // 居中显示
      spine.x = containerWidth / 2
      spine.y = containerHeight

      // 播放默认动画
      if (spine.state) {
        spine.state.setAnimation(0, 'Idle_01', true)
      }
    })
  } catch (error) {
    console.error('Live2D 加载失败:', error)
  }
})

// 清理函数 - 放在 setup 顶层
onUnmounted(() => {
  if (spine) {
    spine.destroy()
  }
  if (app) {
    app.destroy(true, { children: true, texture: true, baseTexture: true })
  }
})
</script>

<template>
  <div ref="l2dContainer" class="live2d-container"></div>
</template>

<style scoped>
.live2d-container {
  width: max-content;
  height: 100dvh;
  position: absolute;
  justify-content: center;
  display: flex;
  overflow: hidden;
  z-index: -1;
  bottom: 0;
}

.live2d-container :deep(canvas) {
  display: block;
}
</style>
