<script setup>
import { Spine } from '@esotericsoftware/spine-pixi-v7'
import * as PIXI from 'pixi.js'
import { Modal } from '@arco-design/web-vue'
import { useConfig } from '@/composables/useConfig'
const { configs, locale } = useConfig()
const emit = defineEmits(['canskip', 'update:changeL2D'])
import { Howl } from 'howler'
import { ref, computed, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

const props = defineProps(['l2dOnly'])

let animation,
  id = 0
const canSkip = ref(true)
let soundList = []
let voiceEpoch = 0 // 语音会话代际：stopAllVoices 清理时递增，异步错误回调据此识别过期会话
let animationReady = false // 动画初始化状态
let talking = false,
  talkIndex = 1
let modalRef
let originalOffsetPercent = 70 // 默认值，等待配置加载后更新

// 长按相关变量
const LONG_PRESS_THRESHOLD = 500 // 长按阈值（毫秒）
let longPressTimer = null
let isLongPress = false
let patTimer = null // 摸头随机动作定时器
let canvasRetryTimer = null // canvas添加重试定时器
let isComponentUnmounted = false // 组件卸载标记，用于停止重试

// 骨骼交互检测半径
const BONE_HIT_RADIUS = 100 // 悬停/点击/摸头的命中半径
const BONE_HIT_FALLBACK_RADIUS = 60 // 点击未命中骨骼时的宽松重试半径

// 摸头期间随机动作的间隔范围（毫秒）：5~15 秒
const PAT_RANDOM_MIN_DELAY = 5000
const PAT_RANDOM_DELAY_SPAN = 10000

// 脸部（头部）骨骼名单：摸头判定与骨骼状态保存/恢复共用
const FACE_BONE_NAMES = [
  'Head_Rot',
  'face',
  'Neck_01',
  'R_Eyebrows_default',
  'L_Eyebrows_default',
  'R_eye_default_1',
  'L_eye_default_1',
  'nose',
  'mouth_1'
]

const dialogue = ref('')
const showDialogue = ref(false)
const ifPetting = ref(false)
const currentConfig = computed(() => configs.value)

// 直接使用eval解析分数表达式
const parseFraction = (fractionString) => {
  return eval(fractionString)
}

const updateDialoguePosition = () => {
  if (
    currentConfig.value &&
    currentConfig.value.memorialLobbies &&
    currentConfig.value.memorialLobbies[id]
  ) {
    const lobby = currentConfig.value.memorialLobbies[id]
    dialogueDisplay.value.x =
      parseFraction(lobby.dialogueDisplay.x) * document.documentElement.clientWidth
    dialogueDisplay.value.y =
      parseFraction(lobby.dialogueDisplay.y) * document.documentElement.clientHeight
  }
}

// 窗口尺寸变化时更新对话框位置（在 onMounted/onUnmounted 中注册与移除）
const handleWindowResize = () => {
  // 画布布局缓存随窗口尺寸失效
  cachedViewRect = null
  updateDialoguePosition()
}

const dialogueDisplay = ref({
  x: 0,
  y: 0,
  position: 'left'
})

const l2d = new PIXI.Application({
  width: 2560,
  height: 1440,
  backgroundAlpha: 0
})

// 不参与交互的骨骼（根骨骼/椅子/背景/灯光）
const isNonInteractiveBone = (boneName) =>
  boneName === 'root' ||
  boneName.startsWith('chair') ||
  boneName.startsWith('Back_') ||
  boneName.startsWith('Light')

// 将 client 坐标按 canvas 缩放/偏移换算为 Live2D 世界坐标
const clientToWorld = (clientX, clientY, rect) => {
  const scaleX = rect.width / l2d.screen.width
  const scaleY = rect.height / l2d.screen.height
  return {
    x: (clientX - rect.left) / scaleX - animation.x,
    y: (clientY - rect.top) / scaleY - animation.y
  }
}

// 安全地将canvas添加到background div中的函数
const addCanvasToBackground = () => {
  // 组件已卸载或PIXI视图已销毁时，停止重试
  if (isComponentUnmounted || !l2d.view) return

  try {
    // 查找background元素
    const backgroundElement = document.querySelector('#background')
    if (backgroundElement) {
      // 检查canvas是否已经在background中
      if (!l2d.view.parentNode || l2d.view.parentNode !== backgroundElement) {
        // 先移除canvas从当前父节点（如果有的话）
        if (l2d.view.parentNode) {
          l2d.view.parentNode.removeChild(l2d.view)
        }
        // 将canvas添加到background div
        backgroundElement.appendChild(l2d.view)

        // 设置canvas样式和id
        l2d.view.id = 'l2d-canvas'
        l2d.view.style.position = 'relative'
        l2d.view.style.pointerEvents = 'auto'
        l2d.view.style.zIndex = '1' // 提高canvas的z-index，使其可以接收点击事件
      }
    } else {
      // 如果找不到background元素，延迟重试
      canvasRetryTimer = setTimeout(addCanvasToBackground, 100)
    }
  } catch (error) {
    // 发生错误时也延迟重试
    canvasRetryTimer = setTimeout(addCanvasToBackground, 100)
  }
}

// 组件挂载后尝试添加canvas
onMounted(() => {
  addCanvasToBackground()
  window.addEventListener('resize', handleWindowResize)
})

// 路由离开前停止语音和清理
onBeforeRouteLeave((to, from, next) => {
  stopAllVoiceAndCleanup()
  next()
})

const changeL2D = (value) => {
  emit('update:changeL2D', value)
}

const onEvent = (entry, event) => {
  if (event.stringValue === '') {
    return
  }

  if (
    !currentConfig.value ||
    !currentConfig.value.memorialLobbies ||
    !currentConfig.value.memorialLobbies[id]
  ) {
    return
  }

  const lobby = currentConfig.value.memorialLobbies[id]
  const voiceSource = lobby?.voice

  if (!voiceSource || !voiceSource[event.stringValue]) {
    // 如果没有语音配置，静默处理
    return
  }

  const dialogueText = voiceSource[event.stringValue]
  dialogue.value = dialogueText
  showDialogue.value = true

  // 播放语音
  const jpPath = lobby.path + 'ja-JP/' + event.stringValue + '.ogg'
  let voicePath = jpPath

  if (locale.value === 'zh-CN') {
    // 只有简体中文优先尝试使用中文语音
    voicePath = lobby.path + 'zh-CN/' + event.stringValue + '.ogg'
  }

  // 语音会话代际：stopAllVoices 清理时递增。
  // onloaderror/onplayerror 是异步回调（且构造阶段可能同步触发，回调内不能引用 voice 自身——TDZ），
  // 若回调触发前已清理（路由离开/切换角色），代际已变，必须放弃降级，
  // 否则会在 /bio 等其他页面响起本页角色的语音
  const epoch = voiceEpoch

  let voice = new Howl({
    src: [voicePath],
    volume: 0.3,
    onloaderror: () => {
      // 如果加载失败且当前尝试的是中文语音，则降级到日文语音
      if (voicePath !== jpPath) {
        playFallbackVoice(jpPath, epoch)
      }
    },
    onplayerror: () => {
      // 播放错误尝试降级
      if (voicePath !== jpPath) {
        playFallbackVoice(jpPath, epoch)
      }
    },
    onend: () => releaseVoice(voice)
  })

  voice.play()
  soundList.push(voice)
}

// 中文语音失败时降级创建日文语音（代际不一致说明组件已清理，直接放弃）
const playFallbackVoice = (jpPath, epoch) => {
  if (epoch !== voiceEpoch) return

  const fallbackVoice = new Howl({
    src: [jpPath],
    volume: 0.3,
    onend: () => releaseVoice(fallbackVoice)
  })
  fallbackVoice.play()
  soundList.push(fallbackVoice)
}

// 停止并释放所有语音资源
const stopAllVoices = () => {
  // 先递增代际，使遍历期间/之后触发的任何异步错误回调识别会话已过期，放弃创建降级语音
  voiceEpoch++
  for (const sound of soundList) {
    sound.stop()
    sound.unload()
  }
  soundList = []
}

// 单条语音播放完毕后自动释放（含解码后的 PCM 缓冲），避免长时间互动后 soundList 只进不出、内存单调增长
const releaseVoice = (target) => {
  target.unload()
  soundList = soundList.filter((s) => s !== target)
}

// 注册资源别名（若已被 init/live2d.js 预加载注册则跳过，避免重复 add 触发 resolver 覆盖警告）
const addAssetAlias = (alias, src) => {
  if (!PIXI.Assets.resolver.hasKey(alias)) {
    PIXI.Assets.add({ alias, src })
  }
}

// 串行化 setL2D 调用：进行中的调用未完成时复用同一 Promise，
// 防止首次加载时 watch(immediate) 与 onActivated 并发触发导致的双重初始化
// （两个 Spine 实例同上屏，先完成的实例丢失引用但永久留在 stage 上，
//  切换角色卸载资源后，孤儿实例仍持有已销毁贴图，渲染时报 alphaMode 空指针），
// 同时防止切换途中重复点击造成的资源竞争
let setL2DInFlight = null
const setL2D = (num) => {
  if (setL2DInFlight) return setL2DInFlight
  setL2DInFlight = doSetL2D(num).finally(() => {
    setL2DInFlight = null
  })
  return setL2DInFlight
}

const doSetL2D = async (num) => {
  // 确保canvas已经添加到background div
  addCanvasToBackground()

  if (!currentConfig.value || !currentConfig.value.memorialLobbies) {
    return
  }

  canSkip.value = true
  emit('canskip', true)
  talking = false
  talkIndex = 1
  // 重置骨骼状态缓存，解决角色切换时摸头错位问题
  originalBoneStates.value = {}
  stopAllVoices()
  // 销毁旧角色动画实例（资源保留在缓存中不卸载：
  // 全部角色在加载屏阶段已由 init/live2d.js 预加载，数量有限、占用有界，
  // 保留缓存（含 skeletonCache / 贴图 / GPU 纹理）让来回切换完全无缝；
  // 卸载反而会使切回时重新下载/解码/上传 GPU，出现约 1s 卡顿）
  if (animation) {
    l2d.stage.removeChild(animation)
    animation.destroy()
    animation = null
  }

  const lobbies = currentConfig.value.memorialLobbies

  switch (num) {
    case '-':
      id = id === 0 ? lobbies.length - 1 : id - 1
      break
    case '+':
      id = id === lobbies.length - 1 ? 0 : id + 1
      break
    default:
      id = num
  }

  if (id < 0 || id >= lobbies.length) {
    return
  }

  const lobby = lobbies[id]

  // 检查必需的属性
  if (!lobby.path || !lobby.skel || !lobby.atlas) {
    return
  }

  dialogueDisplay.value.x =
    parseFraction(lobby.dialogueDisplay.x) * document.documentElement.clientWidth
  dialogueDisplay.value.y =
    parseFraction(lobby.dialogueDisplay.y) * document.documentElement.clientHeight
  dialogueDisplay.value.position = lobby.dialogueDisplay.position

  try {
    // 使用配置文件中定义的实际资源路径
    const skeletonPath = lobby.path + lobby.skel
    const atlasPath = lobby.path + lobby.atlas

    // 先预加载资源（别名与 init/live2d.js 的预加载保持一致，可直接命中其缓存）
    const skeletonAlias = `skeleton_${id}`
    const atlasAlias = `atlas_${id}`

    addAssetAlias(skeletonAlias, skeletonPath)
    addAssetAlias(atlasAlias, atlasPath)
    await PIXI.Assets.load([skeletonAlias, atlasAlias])

    // 然后创建动画
    animation = Spine.from(skeletonAlias, atlasAlias)
    if (animation) {
      animation.state.setAnimation(1, 'Dummy', true)
      animation.state.setAnimation(2, 'Dummy', true)
      animation.state.setAnimation(3, 'Dummy', true)
      animation.state.setAnimation(4, 'Dummy', true)
      l2d.stage.addChild(animation)
    } else {
      return
    }
  } catch (error) {
    return
  }
  animation.scale.set(0.85)
  animation.state.setAnimation(0, 'Idle_01', true)
  animation.state.timeScale = 1
  animation.autoUpdate = true
  animation.y = 1440
  animation.x = 2560 / 2

  originalOffsetPercent = (parseFloat(lobby.offset) || 0.7) * 100
  l2d.view.style.transform = `translateX(calc((50% - ${originalOffsetPercent} * 1%) * (1 - min(1, 100vw / 1200px))))`
  // 角色偏移改变，画布布局缓存失效
  cachedViewRect = null

  let startIdle = 'Start_Idle_01'
  showDialogue.value = false
  if (!animation.state.data.skeletonData.findAnimation('Start_Idle_01')) startIdle = 'Start_idle_01'
  animation.state.addListener({
    event: onEvent
  })
  if (animation && animation.state && animation.state.data.skeletonData.findAnimation(startIdle)) {
    changeL2D(true)
    animation.state.setAnimation(0, startIdle, false)
    const currentTrack = animation.state.getCurrent(0)
    if (
      currentTrack &&
      currentTrack.animation &&
      currentTrack.animation.name !== 'Idle_01' &&
      animation.state.data.skeletonData.findAnimation('Idle_01')
    ) {
      animation.state.addAnimation(0, 'Idle_01', true)
    }
    let listener = {
      complete: (entry) => {
        if (entry.trackIndex === 0 && entry.animation.name !== 'Idle_01') {
          changeL2D(false)
          animation.state.listeners = []
          animation.state.addListener({
            event: onEvent
          })
          canSkip.value = false
          emit('canskip', false)
          if (modalRef) {
            modalRef.close()
          }
        }
      }
    }
    animation.state.addListener(listener)
  } else {
    changeL2D(false)
    if (animation && animation.state) {
      const currentTrack = animation.state.getCurrent(0)
      if (
        currentTrack &&
        currentTrack.animation &&
        currentTrack.animation.name !== 'Idle_01' &&
        animation.state.data.skeletonData.findAnimation('Idle_01')
      ) {
        animation.state.setAnimation(0, 'Idle_01', true)
        animation.state.listeners = []
        animation.state.addListener({
          event: onEvent
        })
        canSkip.value = false
        emit('canskip', false)
        if (modalRef) {
          modalRef.close()
        }
      }
    }
  }

  // 标记动画初始化完成
  animationReady = true

  // 直接在l2d.view上添加事件监听，因为现在canvas有了正确的层级
  addEventListenersToCanvas()
}

// 鼠标离开canvas时的处理函数（独立命名以便正确移除监听）
const handleMouseLeave = (event) => {
  handleMouseUp(event)
  handleMouseLeaveCanvas()
}

// 在canvas上添加事件监听
const addEventListenersToCanvas = () => {
  if (l2d.view) {
    // 移除可能存在的旧监听
    removeEventListenersFromCanvas()

    // 添加事件监听
    l2d.view.addEventListener('mousedown', handleMouseDown)
    l2d.view.addEventListener('mouseup', handleMouseUp)
    l2d.view.addEventListener('mouseleave', handleMouseLeave)
    // touch 处理器均不调用 preventDefault，声明 passive 消除 scroll-blocking 警告
    l2d.view.addEventListener('touchstart', handleTouchStart, { passive: true })
    l2d.view.addEventListener('touchmove', handleTouchMove, { passive: true })
    l2d.view.addEventListener('touchend', handleTouchEnd)
    l2d.view.addEventListener('touchcancel', handleTouchEnd)

    // 添加鼠标移动事件监听用于骨骼悬停检测
    l2d.view.addEventListener('mousemove', handleBoneHover)
  }
}

// 移除canvas上的事件监听
const removeEventListenersFromCanvas = () => {
  if (l2d.view) {
    l2d.view.removeEventListener('mousedown', handleMouseDown)
    l2d.view.removeEventListener('mouseup', handleMouseUp)
    l2d.view.removeEventListener('mouseleave', handleMouseLeave)
    l2d.view.removeEventListener('touchstart', handleTouchStart)
    l2d.view.removeEventListener('touchmove', handleTouchMove)
    l2d.view.removeEventListener('touchend', handleTouchEnd)
    l2d.view.removeEventListener('touchcancel', handleTouchEnd)
    l2d.view.removeEventListener('mousemove', handleBoneHover)
  }
}

// 骨骼悬停检测：rAF 节流 + 布局缓存 + 状态变化才写 DOM
// （原实现每次 mousemove 都对全骨骼做距离计算、getBoundingClientRect 强制同步布局，
//   并无条件 classList.add/remove，是长帧与 violation 警告的来源之一）
let hoverRafId = null
let lastHoverEvent = null
let cachedViewRect = null
let isL2dHovering = false

const handleBoneHover = (event) => {
  lastHoverEvent = event
  if (hoverRafId !== null) return
  hoverRafId = requestAnimationFrame(() => {
    hoverRafId = null
    if (lastHoverEvent) {
      processBoneHover(lastHoverEvent)
    }
  })
}

const processBoneHover = (event) => {
  if (!animation || !animation.skeleton || !animationReady) {
    return
  }

  // 获取鼠标位置（rect 在窗口尺寸/角色偏移变化时失效重建）
  if (!cachedViewRect) {
    cachedViewRect = l2d.view.getBoundingClientRect()
  }

  // 计算实际的世界坐标
  const { x: worldX, y: worldY } = clientToWorld(event.clientX, event.clientY, cachedViewRect)

  // 检测是否悬停在可交互骨骼上
  let isHovering = false
  const skeleton = animation.skeleton

  for (let i = skeleton.bones.length - 1; i >= 0; i--) {
    const bone = skeleton.bones[i]
    if (isNonInteractiveBone(bone.data.name)) {
      continue // 跳过不需要交互的骨骼
    }

    const boneX = bone.worldX
    const boneY = bone.worldY
    const distance = Math.sqrt((worldX - boneX) ** 2 + (worldY - boneY) ** 2)

    if (distance < BONE_HIT_RADIUS) {
      isHovering = true
      break
    }
  }

  // 更新光标状态（仅在悬停状态变化时写 classList）
  if (isHovering !== isL2dHovering) {
    isL2dHovering = isHovering
    if (isHovering) {
      l2d.view.classList.add('l2d-hover')
    } else {
      l2d.view.classList.remove('l2d-hover')
    }
  }

  // 如果正在摸头状态，让头部骨骼跟随鼠标移动
  if (ifPetting.value && isLongPress) {
    handleHeadBoneFollow(event)
  }
}

// 清理语音和对话框
const clearVoiceAndDialogue = () => {
  // 停止所有语音
  stopAllVoices()
  // 隐藏对话框
  showDialogue.value = false
  dialogue.value = ''
  // 关闭可能打开的Modal
  if (modalRef) {
    modalRef.close()
    modalRef = null
  }
}

// 停止所有语音和清理的通用函数
const stopAllVoiceAndCleanup = () => {
  clearVoiceAndDialogue()
  // 彻底清除动画实例，阻止所有事件
  if (animation) {
    if (animation.state) {
      animation.state.listeners = []
    }
    l2d.stage.removeChild(animation)
    animation.destroy()
    animation = null
  }
  // 重置交互状态
  talking = false
  talkIndex = 1
  ifPetting.value = false
  isLongPress = false
  animationReady = false
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  if (patTimer) {
    clearTimeout(patTimer)
    patTimer = null
  }
}

// 标记是否是首次加载
let isFirstLoad = true

// 组件重新激活时的处理
onActivated(() => {
  // 先恢复 PIXI 渲染循环（动画仍在时的常规返回场景立即恢复渲染；
  // 下面的 setL2D/loadL2DSkipIdle 为异步且带并发守卫，不受其完成时机影响）
  l2d.ticker.start()
  // 重新添加canvas到DOM
  addCanvasToBackground()
  // 如果动画被销毁了，重新加载
  if (!animation && currentConfig.value?.memorialLobbies) {
    if (isFirstLoad) {
      // 首次加载，播放初始动画
      setL2D(id)
      isFirstLoad = false
    } else {
      // 路由返回，跳过初始动画
      loadL2DSkipIdle(id)
    }
  }
  // 重置 talking 状态
  talking = false
  talkIndex = 1
})

// keep-alive 缓存（路由离开）期间停止 PIXI 渲染循环，避免不可见 canvas 空转耗电耗 GPU
onDeactivated(() => {
  l2d.ticker.stop()
})

// 加载Live2D并跳过初始动画
const loadL2DSkipIdle = async (num) => {
  // 确保canvas已经添加到background div
  addCanvasToBackground()

  if (!currentConfig.value || !currentConfig.value.memorialLobbies) {
    return
  }

  canSkip.value = false
  emit('canskip', false)
  talking = false
  talkIndex = 1
  // 重置骨骼状态缓存
  originalBoneStates.value = {}
  stopAllVoices()

  const lobbies = currentConfig.value.memorialLobbies

  if (num < 0 || num >= lobbies.length) {
    return
  }

  const lobby = lobbies[num]

  // 检查必需的属性
  if (!lobby.path || !lobby.skel || !lobby.atlas) {
    return
  }

  dialogueDisplay.value.x =
    parseFraction(lobby.dialogueDisplay.x) * document.documentElement.clientWidth
  dialogueDisplay.value.y =
    parseFraction(lobby.dialogueDisplay.y) * document.documentElement.clientHeight
  dialogueDisplay.value.position = lobby.dialogueDisplay.position

  try {
    // 使用配置文件中定义的实际资源路径
    const skeletonPath = lobby.path + lobby.skel
    const atlasPath = lobby.path + lobby.atlas

    // 先预加载资源（别名与 init/live2d.js 的预加载保持一致，可直接命中其缓存）
    const skeletonAlias = `skeleton_${num}`
    const atlasAlias = `atlas_${num}`

    addAssetAlias(skeletonAlias, skeletonPath)
    addAssetAlias(atlasAlias, atlasPath)
    await PIXI.Assets.load([skeletonAlias, atlasAlias])

    // 然后创建动画
    animation = Spine.from(skeletonAlias, atlasAlias)
    if (animation) {
      animation.state.setAnimation(1, 'Dummy', true)
      animation.state.setAnimation(2, 'Dummy', true)
      animation.state.setAnimation(3, 'Dummy', true)
      animation.state.setAnimation(4, 'Dummy', true)
      l2d.stage.addChild(animation)
    } else {
      return
    }
  } catch (error) {
    return
  }
  animation.scale.set(0.85)
  // 直接播放Idle_01，跳过Start_Idle
  animation.state.setAnimation(0, 'Idle_01', true)
  animation.state.timeScale = 1
  animation.autoUpdate = true
  animation.y = 1440
  animation.x = 2560 / 2

  originalOffsetPercent = (parseFloat(lobby.offset) || 0.7) * 100
  l2d.view.style.transform = `translateX(calc((50% - ${originalOffsetPercent} * 1%) * (1 - min(1, 100vw / 1200px))))`
  // 角色偏移改变，画布布局缓存失效
  cachedViewRect = null

  showDialogue.value = false
  // 添加事件监听器
  animation.state.addListener({
    event: onEvent
  })

  // 标记动画初始化完成
  animationReady = true

  // 直接在l2d.view上添加事件监听
  addEventListenersToCanvas()
}

// 组件卸载时清理资源
onUnmounted(() => {
  // 标记组件已卸载，并取消可能存在的canvas重试定时器
  isComponentUnmounted = true
  if (canvasRetryTimer) {
    clearTimeout(canvasRetryTimer)
    canvasRetryTimer = null
  }
  // 取消挂起的悬停检测帧
  if (hoverRafId !== null) {
    cancelAnimationFrame(hoverRafId)
    hoverRafId = null
  }

  // 移除事件监听
  removeEventListenersFromCanvas()
  window.removeEventListener('resize', handleWindowResize)

  // 销毁PIXI应用（destroy(true) 会自动将canvas从DOM中移除）
  if (l2d) {
    l2d.destroy(true)
  }
})

const skipStartIdle = () => {
  // 已有确认框打开时忽略重复触发，避免连点叠加多个 Modal
  if (modalRef) return

  // 检查动画是否已正确初始化
  if (!animation || !animation.state || !animationReady) {
    changeL2D(false)
    return
  }

  try {
    // 检查当前动画状态和可用的动画
    const currentTrack = animation.state.getCurrent(0)
    if (!currentTrack || !currentTrack.animation) {
      changeL2D(false)
      return
    }

    if (
      currentTrack.animation.name !== 'Idle_01' &&
      animation.state.data.skeletonData.findAnimation('Idle_01')
    ) {
      if (!currentConfig.value || !currentConfig.value.translate) {
        changeL2D(false)
        return
      }

      modalRef = Modal.open({
        title: currentConfig.value.translate.info,
        content: currentConfig.value.translate.ifSkip,
        okText: currentConfig.value.translate.ok,
        cancelText: currentConfig.value.translate.cancel,
        onOk: () => {
          changeL2D(false)
          stopAllVoices()

          // 再次检查动画状态
          if (animation && animation.state) {
            animation.state.setAnimation(1, 'Dummy', true)
            animation.state.setAnimation(2, 'Dummy', true)
            animation.state.setAnimation(3, 'Dummy', true)
            animation.state.setAnimation(4, 'Dummy', true)
            animation.state.setAnimation(0, 'Idle_01', true)
            animation.state.listeners = []
            animation.state.addListener({
              event: onEvent
            })
          }

          canSkip.value = false
          emit('canskip', false)
        },
        // 任意关闭路径（确定/取消/遮罩/ESC/程序化 close）都会触发，释放引用以允许再次打开
        onClose: () => {
          modalRef = null
        }
      })
    }
  } catch (error) {
    changeL2D(false)
  }
}

// 骨骼点击交互处理
const handleBoneClick = (event) => {
  if (!event) return

  // 检查动画是否可以交互，添加摸头状态检查
  // 允许在摸头结束阶段（isLongPress为false）进行交互
  if (
    !animation ||
    !animation.state ||
    !animationReady ||
    talking ||
    (ifPetting.value && isLongPress)
  ) {
    return
  }

  const currentTrack = animation.state.getCurrent(0)
  if (!currentTrack || !currentTrack.animation) {
    return
  }
  if (currentTrack.animation.name.toLowerCase().startsWith('start_idle')) {
    return
  }

  // 计算实际的世界坐标
  const { x: worldX, y: worldY } = clientToWorld(
    event.clientX,
    event.clientY,
    l2d.view.getBoundingClientRect()
  )

  // 检测点击的骨骼
  const hitBones = []
  const skeleton = animation.skeleton

  // 遍历所有骨骼，找到被点击的骨骼
  for (let i = skeleton.bones.length - 1; i >= 0; i--) {
    const bone = skeleton.bones[i]
    if (isNonInteractiveBone(bone.data.name)) {
      continue // 跳过不需要交互的骨骼
    }

    const boneX = bone.worldX
    const boneY = bone.worldY
    const distance = Math.sqrt((worldX - boneX) ** 2 + (worldY - boneY) ** 2)

    if (distance < BONE_HIT_RADIUS) {
      hitBones.push({ name: bone.data.name, distance: distance })
    }
  }

  // 只有检测到骨骼才触发互动
  if (hitBones.length > 0) {
    // 按距离排序，取最近的骨骼
    hitBones.sort((a, b) => a.distance - b.distance)
    const clickedBone = hitBones[0].name
    triggerInteractionByBone(clickedBone)
  } else {
    // 使用更宽松的检测半径重新检测
    for (let i = skeleton.bones.length - 1; i >= 0; i--) {
      const bone = skeleton.bones[i]
      if (isNonInteractiveBone(bone.data.name)) {
        continue
      }

      const boneX = bone.worldX
      const boneY = bone.worldY
      const distance = Math.sqrt((worldX - boneX) ** 2 + (worldY - boneY) ** 2)

      if (distance < BONE_HIT_FALLBACK_RADIUS) {
        triggerInteractionByBone(bone.data.name)
        break
      }
    }
  }
}

// 根据骨骼触发互动
const triggerInteractionByBone = () => {
  // 点击身体任意部位都触发对话
  playTalkAnimation()
}

// 长按检测相关函数
const startLongPressTimer = (event) => {
  // 重置状态
  isLongPress = false

  // 启动长按计时器
  longPressTimer = setTimeout(() => {
    isLongPress = true

    if (!animation || !animation.skeleton || !animationReady) {
      return
    }

    // 计算世界坐标，检查是否点击到脸部骨骼
    const { x: worldX, y: worldY } = clientToWorld(
      event.clientX,
      event.clientY,
      l2d.view.getBoundingClientRect()
    )

    if (checkFaceBoneClick(worldX, worldY)) {
      playPatAnimation()
    }
  }, LONG_PRESS_THRESHOLD)
}

const cancelLongPressTimer = (event) => {
  if (!event) return

  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null

    // 如果不是长按，则处理为点击事件
    if (!isLongPress) {
      handleBoneClick(event)
    } else {
      // 如果是长按结束，检查是否需要结束抚摸动画
      if (ifPetting.value && animation && animation.skeleton && animationReady) {
        // 清除随机动作定时器
        if (patTimer) {
          clearTimeout(patTimer)
          patTimer = null
        }

        // 先添加结束动画，不立即设置ifPetting为false
        if (animation.state.data.skeletonData.findAnimation('PatEnd_01_A')) {
          animation.state.setAnimation(1, 'PatEnd_01_A', false)._mixDuration = 0.3
          animation.state.setAnimation(2, 'PatEnd_01_M', false)._mixDuration = 0.3
        } else {
          animation.state.setAnimation(1, 'PatEnd_01_M', false)._mixDuration = 0.3
        }
        animation.state.addAnimation(1, 'Dummy', true)._mixDuration = 0.3
        animation.state.addAnimation(2, 'Dummy', true)._mixDuration = 0.3
        // 恢复所有头部骨骼到原始状态
        restoreAllHeadBones()

        // 为摸头结束动画添加监听器，确保动画完成后才重置状态
        let patEndListener = {
          complete: (entry) => {
            // 确保只处理摸头结束动画的完成事件
            if (entry.trackIndex === 1 && entry.animation.name === 'PatEnd_01_M') {
              ifPetting.value = false
              // 移除该监听器以避免冲突
              animation.state.listeners = animation.state.listeners.filter(
                (l) => l !== patEndListener
              )
            }
          }
        }

        // 添加监听器
        animation.state.addListener(patEndListener)
      }
    }

    // 重置状态
    isLongPress = false
  }
}

// 鼠标事件处理
const handleMouseDown = (event) => {
  startLongPressTimer(event)
}

const handleMouseUp = (event) => {
  cancelLongPressTimer(event)
}

// 处理鼠标离开canvas事件
const handleMouseLeaveCanvas = () => {
  // 确保鼠标离开canvas时恢复光标状态
  isL2dHovering = false
  if (l2d.view) {
    l2d.view.classList.remove('l2d-hover')
  }
}

// 触摸事件处理
const handleTouchStart = (event) => {
  if (event.touches.length > 0) {
    const touchEvent = event.touches[0]
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touchEvent.clientX,
      clientY: touchEvent.clientY
    })
    startLongPressTimer(mouseEvent)
  }
}

// 处理触摸移动事件，确保长按过程中移动也能保持长按状态
const handleTouchMove = (event) => {
  // 如果正在摸头状态，让头部骨骼跟随鼠标移动
  if (ifPetting.value && isLongPress && animation && animation.skeleton && animationReady) {
    if (event.touches.length > 0) {
      const touchEvent = event.touches[0]
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touchEvent.clientX,
        clientY: touchEvent.clientY
      })
      handleHeadBoneFollow(mouseEvent)
    }
  }
}

const handleTouchEnd = (event) => {
  if (event.changedTouches.length > 0) {
    const touchEvent = event.changedTouches[0]
    const mouseEvent = new MouseEvent('mouseup', {
      clientX: touchEvent.clientX,
      clientY: touchEvent.clientY
    })
    cancelLongPressTimer(mouseEvent)
  }
}

// 精确检测是否点击到脸部骨骼
const checkFaceBoneClick = (x, y) => {
  if (!animation || !animation.skeleton) {
    return false
  }

  const skeleton = animation.skeleton

  // 遍历所有骨骼，检查是否点击到脸部骨骼
  for (let i = skeleton.bones.length - 1; i >= 0; i--) {
    const bone = skeleton.bones[i]

    // 只检查脸部相关骨骼
    if (!FACE_BONE_NAMES.includes(bone.data.name)) {
      continue
    }

    const boneX = bone.worldX
    const boneY = bone.worldY
    const distance = Math.sqrt((x - boneX) ** 2 + (y - boneY) ** 2)

    if (distance < BONE_HIT_RADIUS) {
      return true
    }
  }

  return false
}

// 播放对话动画，添加摸头状态检查
const playTalkAnimation = () => {
  // 如果正在摸头
  if (ifPetting.value) {
    // 如果正在长按（真正的摸头中），则忽略点击
    if (isLongPress) {
      return
    }
    // 否则（摸头结束动画中），允许打断，重置状态
    ifPetting.value = false
  }
  if (
    animation.state.data.skeletonData.findAnimation('Talk_0' + talkIndex + '_A_CN') &&
    locale.value.startsWith('zh')
  ) {
    animation.state.addAnimation(1, 'Talk_0' + talkIndex + '_A_CN')._mixDuration = 0.3
    animation.state.addAnimation(2, 'Talk_0' + talkIndex + '_M_CN')._mixDuration = 0.3
  } else {
    animation.state.addAnimation(1, 'Talk_0' + talkIndex + '_A')._mixDuration = 0.3
    animation.state.addAnimation(2, 'Talk_0' + talkIndex + '_M')._mixDuration = 0.3
  }
  animation.state.addAnimation(1, 'Dummy', true)._mixDuration = 0.3
  animation.state.addAnimation(2, 'Dummy', true)._mixDuration = 0.3

  let listener = {
    complete: (entry) => {
      if (
        entry.trackIndex === 1 &&
        entry.animation.name !== 'Dummy' &&
        entry.animation.name.startsWith('Talk_')
      ) {
        // 只移除当前对话动画的监听器，保留其他监听器
        animation.state.listeners = animation.state.listeners.filter((l) => l !== listener)
        // 确保始终保留event监听器
        if (!animation.state.listeners.some((l) => l.event === onEvent)) {
          animation.state.addListener({
            event: onEvent
          })
        }
        talking = false
        showDialogue.value = false
      }
    }
  }

  animation.state.addListener(listener)
  talkIndex++
  if (!animation.state.data.skeletonData.findAnimation('Talk_0' + talkIndex + '_A')) {
    talkIndex = 1
  }
  talking = true
}

// 播放抚摸动画，添加对话状态检查
const playPatAnimation = () => {
  // 如果正在对话，则不播放摸头动画
  if (talking) {
    return
  }
  if (animation.state.data.skeletonData.findAnimation('Pat_02_M')) {
    animation.state.addAnimation(1, 'Pat_01_M', false)._mixDuration = 0.3
    // 启动随机动作定时器
    startPatRandomLoop()
  } else {
    animation.state.addAnimation(1, 'Pat_01_A', true)._mixDuration = 0.3
    animation.state.addAnimation(2, 'Pat_01_M', true)._mixDuration = 0.3
  }
  ifPetting.value = true
}

// 摸头期间随机播放 Pat_02_M
const startPatRandomLoop = () => {
  if (patTimer) clearTimeout(patTimer)

  // 随机时间 5-15秒 (平均10秒)
  const delay = PAT_RANDOM_MIN_DELAY + Math.random() * PAT_RANDOM_DELAY_SPAN

  patTimer = setTimeout(() => {
    if (ifPetting.value && animation && animation.state && animationReady) {
      try {
        // 使用 setAnimation 来打断当前的循环并重新开始播放
        animation.state.setAnimation(1, 'Pat_02_M', true)._mixDuration = 0.3
      } catch (e) {
        console.error('随机播放Pat_02_M失败:', e)
      }
      // 递归调用，继续下一次随机播放
      startPatRandomLoop()
    }
  }, delay)
}

// 保存原始骨骼状态，用于摸完头后恢复
const originalBoneStates = ref({})

// 头部骨骼跟随鼠标移动的处理函数
const handleHeadBoneFollow = (event) => {
  if (!animation || !animation.skeleton || !animationReady) {
    return
  }

  // 计算实际的世界坐标X（主要关注左右移动）
  const { x: worldX } = clientToWorld(
    event.clientX,
    event.clientY,
    l2d.view.getBoundingClientRect()
  )

  // 获取头部旋转骨骼
  const headBone = animation.skeleton.findBone('Head_Rot')
  if (!headBone) {
    return
  }

  // 如果是第一次调用，保存原始骨骼状态
  if (Object.keys(originalBoneStates.value).length === 0) {
    saveOriginalBoneStates()
  }

  const headCenterX = headBone.worldX

  // 计算左右偏移量，主要实现左右摆动效果
  // 增加X轴的影响，减少Y轴的影响
  const offsetX = (headCenterX - worldX) * 0.004 // 反转符号修复方向问题，减小缩放因子，使效果更轻微

  // 限制最大旋转角度，避免过度变形
  const maxRotation = 2 // 限制最大旋转角度（弧度）
  const clampedRotation = Math.max(-maxRotation, Math.min(maxRotation, offsetX))

  // 只应用旋转效果到头部旋转骨骼，实现左右摆动
  const skeleton = animation.skeleton
  for (let i = skeleton.bones.length - 1; i >= 0; i--) {
    const bone = skeleton.bones[i]

    // 只对头部旋转骨骼应用跟随效果
    if (bone.data.name === 'Head_Rot') {
      // 重置到原始位置，然后应用新的旋转
      restoreBoneToOriginal(bone)
      bone.rotation += clampedRotation
    }
  }

  // 更新骨架以应用变化，添加错误处理防止physics undefined错误
  try {
    skeleton.updateWorldTransform()
  } catch (error) {
    // 静默处理physics undefined错误，通常在动画对象已被销毁时发生
  }
}

// 保存原始骨骼状态
const saveOriginalBoneStates = () => {
  if (!animation || !animation.skeleton) {
    return
  }

  const skeleton = animation.skeleton

  // 保存每个头部骨骼的原始状态
  FACE_BONE_NAMES.forEach((boneName) => {
    const bone = skeleton.findBone(boneName)
    if (bone) {
      originalBoneStates.value[boneName] = {
        x: bone.x,
        y: bone.y,
        rotation: bone.rotation,
        scaleX: bone.scaleX,
        scaleY: bone.scaleY
      }
    }
  })
}

// 将骨骼恢复到原始状态
const restoreBoneToOriginal = (bone) => {
  const originalState = originalBoneStates.value[bone.data.name]
  if (originalState) {
    bone.x = originalState.x
    bone.y = originalState.y
    bone.rotation = originalState.rotation
    bone.scaleX = originalState.scaleX
    bone.scaleY = originalState.scaleY
  }
}

// 恢复所有头部骨骼到原始状态
const restoreAllHeadBones = () => {
  if (!animation || !animation.skeleton) {
    return
  }

  const skeleton = animation.skeleton

  // 遍历并恢复每个保存的骨骼状态
  for (const [boneName, originalState] of Object.entries(originalBoneStates.value)) {
    const bone = skeleton.findBone(boneName)
    if (bone) {
      bone.x = originalState.x
      bone.y = originalState.y
      bone.rotation = originalState.rotation
      bone.scaleX = originalState.scaleX
      bone.scaleY = originalState.scaleY
    }
  }

  // 更新骨架以应用变化
  try {
    skeleton.updateWorldTransform()
  } catch (error) {
    // 静默处理physics undefined错误，通常在动画对象已被销毁时发生
  }

  // 清空保存的状态
  originalBoneStates.value = {}
}

// 等待配置加载完成后初始化Live2D
const initLive2DWhenReady = () => {
  if (currentConfig.value && currentConfig.value.memorialLobbies) {
    setL2D(id)
  }
}

// 监听配置变化
watch(
  currentConfig,
  (newConfig) => {
    if (newConfig && newConfig.memorialLobbies && newConfig.memorialLobbies.length > 0) {
      initLive2DWhenReady()
    }
  },
  { immediate: true }
)
</script>

<template>
  <div id="change" v-if="!props.l2dOnly">
    <img
      class="css-cursor-hover-enabled"
      role="button"
      tabindex="0"
      :aria-label="currentConfig?.translate?.prevPage"
      @click="setL2D('-')"
      @keydown.enter.prevent="setL2D('-')"
      @keydown.space.prevent="setL2D('-')"
      src="/l2d/arrow.png"
      alt=""
    />
    <img
      class="css-cursor-hover-enabled"
      role="button"
      tabindex="0"
      :aria-label="currentConfig?.translate?.nextPage"
      @click="setL2D('+')"
      @keydown.enter.prevent="setL2D('+')"
      @keydown.space.prevent="setL2D('+')"
      src="/l2d/arrow.png"
      alt=""
    />
  </div>
  <div
    v-if="props.l2dOnly && canSkip"
    style="position: fixed; width: 100%; height: 100%; z-index: 2"
    role="button"
    tabindex="0"
    :aria-label="currentConfig?.translate?.skipIntro"
    @click="skipStartIdle()"
    @keydown.enter.prevent="skipStartIdle()"
    @keydown.space.prevent="skipStartIdle()"
  ></div>
  <a-trigger
    v-if="showDialogue"
    :popup-visible="showDialogue"
    :popup-translate="[dialogueDisplay.x, dialogueDisplay.y]"
    :position="dialogueDisplay.position"
    :show-arrow="true"
  >
    <div class="interaction"></div>
    <template #content>
      <div class="dialogue">
        {{ dialogue }}
      </div>
    </template>
  </a-trigger>
</template>

<style scoped>
.dialogue {
  padding: clamp(30px, 1.875vw, 100vw) clamp(20px, 1.25vw, 100vw);
  max-width: clamp(280px, 17.5vw, 100vw);
  width: calc(40vw - clamp(20px, 1.25vw, 100vw));
  font-size: clamp(24px, 1.5vw, 100vw);
  background-color: #f0f0f0dd;
  border-radius: clamp(10px, 0.625vw, 100vw);
  box-shadow: 0 clamp(2px, 0.125vw, 100vw) clamp(8px, 0.5vw, 100vw) 0 rgba(0, 0, 0, 0.15);
  z-index: 1000;
  position: relative;
}

/* 确保a-trigger组件及其弹出内容有足够高的层级 */
:deep(.arco-trigger-popup) {
  z-index: 1000 !important;
}

#change {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.interaction {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: auto;
  width: 66%;
  height: 100%;
  cursor: pointer;
  user-select: none;
  -webkit-user-drag: none;
  opacity: 0;
  pointer-events: none;
}

img {
  width: clamp(32px, 2vw, 100vw);
  height: auto;
  animation: move 2s ease-in-out infinite;
  z-index: 1000;
}

img:last-child {
  transform: rotate(180deg);
  animation: moveReverse 2s ease-in-out infinite;
}

@keyframes move {
  0% {
    transform: translateX(clamp(10px, 0.625vw, 100vw));
  }
  50% {
    transform: translateX(clamp(30px, 1.875vw, 100vw));
  }
  100% {
    transform: translateX(clamp(10px, 0.625vw, 100vw));
  }
}

@keyframes moveReverse {
  0% {
    transform: rotate(180deg) translateX(clamp(10px, 0.625vw, 100vw));
  }
  50% {
    transform: rotate(180deg) translateX(clamp(30px, 1.875vw, 100vw));
  }
  100% {
    transform: rotate(180deg) translateX(clamp(10px, 0.625vw, 100vw));
  }
}
</style>
