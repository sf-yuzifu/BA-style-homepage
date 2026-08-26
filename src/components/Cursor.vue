<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const posX = ref(0)
const posY = ref(0)

// Canvas相关变量
const canvas = ref(null)
let ctx = null
let animationId = null
const effects = []

// 响应式配置
function getEffectConfig() {
  const viewportWidth = window.innerWidth
  const baseWidth = 1600
  const scale = viewportWidth / baseWidth

  return {
    radius: 25 * Math.max(1, scale),
    duration: 800,
    sizeMin: 8 * Math.max(1, scale),
    sizeMax: 12 * Math.max(1, scale),
    speedMin: 30 * Math.max(1, scale),
    speedMax: 40 * Math.max(1, scale),
    delayMax: 200,
    shadowBlur: 10 * Math.max(1, scale),
    tailShadowBlur: 8 * Math.max(1, scale),
    innerShadowBlur: 20 * Math.max(1, scale),
    offset: 8 * Math.max(1, scale),
    outerRadiusOffset: 8 * Math.max(1, scale),
    radiusGrowth: 6 * Math.max(1, scale)
  }
}

// 光标移动相关
function showMousePosition(event) {
  // 使用page坐标而不是client坐标，以避免导航栏等影响
  posX.value = event.pageX
  posY.value = event.pageY

  // 显示光标
  const cursorInner = document.querySelector('#cursor .inner')
  if (cursorInner) {
    cursorInner.style.opacity = 1
  }
}

const handleBodyMouseLeave = () => {
  const cursorInner = document.querySelector('#cursor .inner')
  if (cursorInner) cursorInner.style.opacity = 0
}

const handleBodyMouseEnter = () => {
  const cursorInner = document.querySelector('#cursor .inner')
  if (cursorInner) cursorInner.style.opacity = 1
}

const handleBodyMouseOver = (event) => {
  const target = event.target
  // 空值保护：目标可能不是元素节点，或处于 DOM 顶层（parentElement 为 null）
  if (!target || !target.tagName || !target.classList) return

  const parent = target.parentElement
  const grandParent = parent?.parentElement

  if (
    target.tagName === 'A' ||
    target.tagName === 'BUTTON' ||
    target.classList.contains('css-cursor-hover-enabled') ||
    target.classList.contains('aplayer-button') ||
    parent?.classList.contains('css-cursor-hover-enabled') ||
    parent?.classList.contains('aplayer-button') ||
    grandParent?.classList.contains('css-cursor-hover-enabled') ||
    grandParent?.classList.contains('aplayer-button')
  ) {
    document.querySelector('#cursor')?.classList.add('hover')
  } else {
    document.querySelector('#cursor')?.classList.remove('hover')
  }
}

// 点击效果类
class ClickEffect {
  constructor(x, y) {
    const config = getEffectConfig()

    this.x = x
    this.y = y
    this.startTime = Date.now()
    this.duration = config.duration
    this.rotation1 = Math.random() * Math.PI * 2
    this.rotation2 = Math.random() * Math.PI * 2
    this.radius = config.radius

    this.triangles = []
    this.createTriangles(config)
  }

  createTriangles(config) {
    const triangleCount = 3 + Math.floor(Math.random() * 4)

    for (let i = 0; i < triangleCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const delay = Math.random() * config.delayMax

      this.triangles.push({
        angle: angle,
        delay: delay,
        size: config.sizeMin + Math.random() * config.sizeMax,
        speed: config.speedMin + Math.random() * config.speedMax,
        color: Math.random() > 0.5 ? '#77deff' : '#ffffff',
        rotationSpeed: (Math.random() - 0.5) * 0.1
      })
    }
  }

  draw(ctx, currentTime) {
    const config = getEffectConfig()
    const elapsed = currentTime - this.startTime
    const progress = Math.min(elapsed / this.duration, 1)

    ctx.save()
    ctx.translate(this.x, this.y)

    const scale = 1 + progress * 0.3
    const alpha = Math.pow(1 - progress, 1.5)
    const currentRadius = this.radius + config.outerRadiusOffset + progress * config.radiusGrowth

    ctx.globalAlpha = alpha
    ctx.scale(scale, scale)

    this.drawOuterCircle(ctx, alpha, currentRadius, config)
    this.drawArcTails(ctx, progress, currentRadius, config)
    this.drawTriangles(ctx, elapsed, config)

    ctx.restore()

    return progress < 1
  }

  drawOuterCircle(ctx, alpha, currentRadius, config) {
    const centerRadius = currentRadius + config.outerRadiusOffset

    ctx.beginPath()
    ctx.arc(0, 0, centerRadius, 0, Math.PI * 2)

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, centerRadius)
    gradient.addColorStop(0, `rgba(195, 235, 255, ${alpha * 0.8})`)
    gradient.addColorStop(0.7, `rgba(195, 235, 255, ${alpha * 0.4})`)
    gradient.addColorStop(1, `rgba(195, 235, 255, 0)`)

    ctx.fillStyle = gradient
    ctx.shadowColor = '#c3ebff'
    ctx.shadowBlur = config.shadowBlur
    ctx.fill()
    ctx.shadowBlur = 0
  }

  drawArcTails(ctx, progress, currentRadius, config) {
    if (progress < 0.3) return

    const tailProgress = (progress - 0.3) / 0.7

    ctx.save()
    ctx.globalAlpha = Math.max(0, 1 - progress * 1.2)

    const tail1Angle = this.rotation1 - tailProgress * 2
    const tail2Angle = this.rotation2 + Math.PI - tailProgress * 2

    for (let i = 0; i < 8; i++) {
      const offset = i * config.offset
      const alpha = (1 - progress) * (1 - i * 0.12)

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.strokeStyle = '#77deff'
      ctx.lineWidth = Math.max(1, 3 - i * 0.3)
      ctx.lineCap = 'round'

      ctx.shadowColor = '#77deff'
      ctx.shadowBlur = config.tailShadowBlur - i

      const startAngle = tail1Angle - (offset * Math.PI) / 180
      const endAngle = tail1Angle + Math.PI * 0.6 - (offset * Math.PI) / 180
      ctx.beginPath()
      ctx.arc(0, 0, currentRadius, startAngle, endAngle)
      ctx.stroke()

      ctx.restore()
    }

    for (let i = 0; i < 8; i++) {
      const offset = i * config.offset
      const alpha = (1 - progress) * (1 - i * 0.12)

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = Math.max(1, 3 - i * 0.3)
      ctx.lineCap = 'round'

      ctx.shadowColor = '#ffffff'
      ctx.shadowBlur = config.tailShadowBlur - i

      const startAngle = tail2Angle - (offset * Math.PI) / 180
      const endAngle = tail2Angle + Math.PI * 0.4 - (offset * Math.PI) / 180
      ctx.beginPath()
      ctx.arc(0, 0, currentRadius, startAngle, endAngle)
      ctx.stroke()

      ctx.restore()
    }

    ctx.restore()
  }

  drawTriangles(ctx, elapsed, config) {
    this.triangles.forEach((triangle) => {
      const triangleProgress = Math.max(
        0,
        (elapsed - triangle.delay) / (this.duration - triangle.delay)
      )

      if (triangleProgress <= 0 || triangleProgress >= 1) return

      const distance = triangle.speed * triangleProgress
      const size = triangle.size * (1 - triangleProgress * 0.8)
      const brightness = Math.sin(triangleProgress * Math.PI * 6) * 0.4 + 0.8

      ctx.save()
      ctx.translate(
        Math.cos(triangle.angle) * (this.radius + distance),
        Math.sin(triangle.angle) * (this.radius + distance)
      )

      ctx.rotate(triangle.angle + (elapsed * triangle.rotationSpeed) / 1000)

      ctx.globalAlpha = 1 - triangleProgress

      ctx.fillStyle = triangle.color
      ctx.shadowColor = triangle.color
      ctx.shadowBlur = config.shadowBlur

      ctx.beginPath()
      ctx.moveTo(0, -size)
      ctx.lineTo(size * 0.866, size * 0.5)
      ctx.lineTo(-size * 0.866, size * 0.5)
      ctx.closePath()
      ctx.fill()

      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = triangle.color
      ctx.globalAlpha = brightness * 0.3
      ctx.shadowBlur = config.innerShadowBlur
      ctx.shadowColor = triangle.color
      ctx.beginPath()
      ctx.moveTo(0, -size * 0.8)
      ctx.lineTo(size * 0.693, size * 0.4)
      ctx.lineTo(-size * 0.693, size * 0.4)
      ctx.closePath()
      ctx.fill()

      ctx.restore()
    })
  }
}

// Canvas相关函数
function initCanvas() {
  if (!canvas.value) return

  const width = window.innerWidth
  const height = window.innerHeight

  // 设置Canvas的实际像素尺寸
  canvas.value.width = width
  canvas.value.height = height

  ctx = canvas.value.getContext('2d')
  // 重置变换矩阵，然后应用设备像素比缩放
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

function animate() {
  if (!ctx) return

  const currentTime = Date.now()

  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i]
    if (!effect.draw(ctx, currentTime)) {
      effects.splice(i, 1)
    }
  }

  if (effects.length > 0 || animationId) {
    animationId = requestAnimationFrame(animate)
  } else {
    animationId = null
  }
}

function handleClickEvent(event) {
  const rect = canvas.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  effects.push(new ClickEffect(x, y))

  if (!animationId) {
    animationId = requestAnimationFrame(animate)
  }
}

function handleResize() {
  initCanvas()

  // 在窗口大小变化时清理正在进行的动画
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  // 清理所有效果，重新开始动画循环
  effects.length = 0
}

onMounted(() => {
  // 延迟初始化，确保DOM元素已经渲染
  setTimeout(() => {
    initCanvas()
  }, 0)

  window.addEventListener('resize', handleResize)
  document.addEventListener('click', handleClickEvent, { passive: true })
  document.addEventListener('mousemove', showMousePosition, false)
  document.body.addEventListener('mouseleave', handleBodyMouseLeave)
  document.body.addEventListener('mouseenter', handleBodyMouseEnter)
  document.body.addEventListener('mouseover', handleBodyMouseOver)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('click', handleClickEvent)
  document.removeEventListener('mousemove', showMousePosition)
  document.body.removeEventListener('mouseleave', handleBodyMouseLeave)
  document.body.removeEventListener('mouseenter', handleBodyMouseEnter)
  document.body.removeEventListener('mouseover', handleBodyMouseOver)
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})
</script>

<template>
  <div
    id="cursor"
    class="cursor"
    :style="{
      transform: `translate(${posX}px, ${posY}px)`
    }"
  >
    <div class="inner"></div>
  </div>
  <canvas ref="canvas" class="click-canvas"></canvas>
</template>

<style>
* {
  cursor: none !important;
}
</style>

<style scoped>
@media (hover: none) {
  #cursor {
    display: none;
  }
}

.click-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100dvh;
  pointer-events: none;
  z-index: 9998;
}
#cursor {
  pointer-events: none;
  z-index: 9999;
  position: fixed;
  top: 0;
  left: 0;
}

#cursor::after {
  content: '';
  opacity: 0;
  transition: all 0.3s ease;
  background: url(data:image/png;base64,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)
    no-repeat;
  background-size: 100%;
  width: clamp(21.8666666672px, 1.3666666667vw, 100vw);
  height: clamp(23.4666666672px, 1.4666666667vw, 100vw);
  display: inline-block;
  position: absolute;
  top: 0;
  left: 0;
  z-index: -1;
  transform: translate(-50%, -30%);
}

#cursor.hover::after {
  opacity: 1;
}

#cursor .inner {
  background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAA0CAMAAAAkAzG8AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAH4UExURQAAAERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERBKK+kREREREREREREJHTRKK+hKK+hKK+hSH8y9hjxeD5z9KVBOJ9xKK+RaF7TtRZhKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hKK+hx81hKK+hKK+hKK+hOJ9hKK+hKK+hOJ+BKK+hWG8RKK+RKK+hOI9ht92BWG8SJzvhWG8ChrqRKK+RKJ+RmA4BaE6xKK+hOI9ReD5zlTbB94yxmA4C1klx56zxOJ+BmA4CJzvxWG7yZtsCRwuBKK+TVafBaF7RSI9Bt92BKJ+RaF7Bp/3SxlmxOI9iRxuCB2xhiB4x94yjRbfx160RSH8hSI9BOJ+Bt+2xmB4ilppR170xKK+heD6UNGSRKK+hSH8hKK+iNyvStnnxWG8RKK+hOJ+BKJ+RKK+iZusRKK+hKK+hKK+hKK+qpmISoAAACndFJOUwAFBicoBAMpAQIlJiQJBx0MFg0KIB8XIw4hCCIbERoSEBMLFR4ZD/4UHBgrAez00z+mLO34uTH8Q4EiA7YQC3LyJvvvo7AqV9bb34gvSXkNzAhPqR3R6egTRI9/vPkE37J8Sbi9vUDngshex0z385OzPeKeMm2PQnLukF++UVj8N7zYf/W0jUXmWWWZazhzzdrthphLefqtJljK/UoWnzHHcc8K7fisJJDomAAAAsBJREFUSMeN1mW/okAUB2BBcEBFQBQLxPZe796u7e7u7u7u7u7u3p2vuUNdQAH3vH5+Z45/z4wGAmbt3b6ue9eGwP/UjjpEVd+4ta2kdkKjNq9vI2lyj2nhwsX+Emd6xizsmedtaTLLyVssC+uLJnm1JbPxYnUbtNfkKR5tca6YT+x2WLhgrntbRq4mwqecFk5f6dYW48psKnirycL6hHEuI8TFZJg4CFtqzrIWG0s3EmHQ12rh/BmtVkQWHHXBs5a0zMCjGUCvi4WjSx1DU+izVaIEOA5da9VUhy0VUQ7gmLuFayba8xUUCdnzHhZ2j7dwiJHzuSC44mXhzGmWzdaqmQg4XffEcPYKR2gE2Odt4fLVztAO+Vi49oQZRAeLQuv3s/DtByOIYicK4qWvhaPfjKWUUBAP/S38qwdRyKMg7rWxv/Ugao1EBHQN+ds/tg0Gz/3tT+3D4fr2DPvbH/bQHvnS778oY3vU0N74yE9fv2CUsT1qaA+86cfPfBynbdvzxEvef/o+KRrWuJ7ghas88mqEiFZ4zrDG9jxzo8PnABHJSYqgz2teuXet8uYlgGiKFdPZEGVeOTWIu83ywv4BQATDOVaUBYw2nzRFDeKxU17rv67KVFLiCwKutx3bntcOeuAwkpFogm0U0wxm0kAoVquq2zNoyZNn1EGjGbbaUSjFSJoKNF25s6a8fXFEGzSZ52XO1lR/rnk1iIEb+nN6p089PpWQRCXO4Lamtu0BXZt6hwYvXwWEdnyjWBNiTmltj1lI5ir5coHLOo433x4tCEOqg0q8jI4P0VTA5cHWroYm0aCdopIWcNJF6t+clIsQhJqomlOtFHOXyKK15NlMNByOZjwHtX6NhAIvVZJJNs8rHoNajTEmrZRFviynBc/jx37AsZjAxeMc005qOETiOI6RIYpq/8+Eomia9oP/AK7EX+nw5yRhAAAAAElFTkSuQmCC);
  box-shadow: initial !important;
  border-radius: initial !important;
  background-size: 100% !important;
  width: clamp(22.9333333328px, 1.4333333333vw, 100vw) !important;
  height: clamp(27.7333333328px, 1.7333333333vw, 100vw) !important;
  display: inline-block !important;
  transition: all 0.3s ease;
  transform: translate(-5.3333333328px) !important;
  opacity: 0;
}

@media screen and (min-width: 1600px) {
  #cursor .inner {
    transform: translate(-0.3333333333vw) !important;
  }
}
</style>
