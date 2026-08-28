<script setup>
import { Spine } from '@esotericsoftware/spine-pixi-v7'
import * as PIXI from 'pixi.js'
import { Modal } from '@arco-design/web-vue'
import { useConfig } from '@/composables/useConfig'
const { configs, locale } = useConfig()
const emit = defineEmits(['canskip', 'update:changeL2D'])
import { ref, computed, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useTalkPlayer } from '@/composables/spine/useTalkPlayer'
import { useGazeFollow } from '@/composables/spine/useGazeFollow'
import { useHeadPat } from '@/composables/spine/useHeadPat'
import { useBoneDrag } from '@/composables/spine/useBoneDrag'
import { useRandomClips } from '@/composables/spine/useRandomClips'
import { initTracks } from '@/composables/spine/useSpineTracks'
import { hitTestBones, hitTestHeadRegion, isHeadRegionBone } from '@/composables/spine/boneDetect'

const props = defineProps(['l2dOnly'])

let animation = null
let id = 0
const canSkip = ref(true)
let animationReady = false // 动画初始化状态
let modalRef = null
let originalOffsetPercent = 70 // 默认值，等待配置加载后更新
// 当前已加载角色的资源标识（path+skel|atlas）：语言切换只换翻译/语音文案时，
// config 对象整体替换但角色资源未变，据此跳过整只重载，避免重播 Start_Idle
let loadedL2DKey = null
let canvasRetryTimer = null // canvas添加重试定时器
let isComponentUnmounted = false // 组件卸载标记，用于停止重试

// 骨骼交互检测半径（spine 骨架世界坐标，见 clientToWorld）
const BONE_HIT_RADIUS = 100 // 悬停/点按/摸头的命中半径
// 点按未命中骨骼时的宽松重试半径——必须大于 BONE_HIT_RADIUS 才可能命中新结果
const BONE_HIT_FALLBACK_RADIUS = 160
// 指针会话：区分点按与拖拽的位移阈值（client 像素）
const DRAG_START_THRESHOLD = 12
// 长按阈值（毫秒）：静止按住头部区域触发摸头
const LONG_PRESS_THRESHOLD = 500

const dialogue = ref('')
const showDialogue = ref(false)
const currentConfig = computed(() => configs.value)

// 直接使用eval解析分数表达式
const parseFraction = (fractionString) => {
  return eval(fractionString)
}

// 解析角色横向偏移：offset: 0 是合法配置值（贴左边缘），不能用 || 判 falsy 吞掉；
// 仅当解析失败（undefined/非法字符串 → NaN）时才回退默认值
const parseOffset = (offset, fallback = 0.7) => {
  const parsed = parseFloat(offset)
  return Number.isNaN(parsed) ? fallback : parsed
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

// 将 client 坐标换算为 spine 骨架世界坐标（骨骼 worldX/worldY 所在空间）：
// 先按 canvas 缩放/偏移换算到 stage，再减去 Spine 容器位置并除以容器缩放（0.85）。
// 旧实现漏除容器缩放，导致离容器原点越远的骨骼命中/跟随误差越大（最远约 15%）
const clientToWorld = (clientX, clientY, rect) => {
  if (!animation) return { x: 0, y: 0 }
  const scaleX = rect.width / l2d.screen.width
  const scaleY = rect.height / l2d.screen.height
  return {
    x: ((clientX - rect.left) / scaleX - animation.x) / animation.scale.x,
    y: ((clientY - rect.top) / scaleY - animation.y) / animation.scale.y
  }
}

// ===== 交互共享上下文（spine 各交互模块通过它访问当前实例与彼此） =====
const ctx = {
  getSpine: () => animation,
  getLobby: () => currentConfig.value?.memorialLobbies?.[id],
  getLocale: () => locale.value,
  isReady: () => animationReady,
  // 仅轨道 0 处于 Idle_01 时允许交互（原游戏的 is_Idle_Mode 门控）
  isIdleMode: () => animation?.state?.getCurrent(0)?.animation?.name === 'Idle_01',
  dialogue,
  showDialogue,
  flags: { talking: ref(false), ifPetting: ref(false) },
  getPat: () => pat,
  getGaze: () => gaze,
  getBoneDrag: () => boneDrag
}
const talkPlayer = useTalkPlayer(ctx)
const gaze = useGazeFollow(ctx)
const pat = useHeadPat(ctx)
const boneDrag = useBoneDrag(ctx)
const randomClips = useRandomClips(ctx)

// 每帧骨骼覆写入口：动画应用之后、物理/IK 结算之前（spine-pixi 的 beforeUpdateWorldTransforms，
// 与 Unity 版 SkeletonUtilityBone override 模式时序等价）
const handleBeforeUpdateWorldTransforms = () => {
  const dt = PIXI.Ticker.shared.deltaMS / 1000
  gaze.update(dt)
  pat.update(dt)
  boneDrag.update(dt)
}

// 绑定交互动效到新的 Spine 实例（创建后调用）
const attachInteractions = (spine) => {
  spine.beforeUpdateWorldTransforms = handleBeforeUpdateWorldTransforms
  gaze.attach(spine)
  pat.attach(spine)
  boneDrag.attach(spine)
  // 启动随机小动作调度（眨眼 10~15s / Idle_01_R 60~70s）
  randomClips.start()
}

// 从旧 Spine 实例解绑（销毁前调用）
const detachInteractions = () => {
  gaze.detach()
  pat.detach()
  boneDrag.detach()
  randomClips.stop()
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
  // 窗口失焦（如切到别的窗口）时让进行中的交互正常收尾，避免会话悬挂
  window.addEventListener('blur', cancelPressSession)
})

// 路由离开前停止语音和清理
onBeforeRouteLeave((to, from, next) => {
  stopAllVoiceAndCleanup()
  next()
})

const changeL2D = (value) => {
  emit('update:changeL2D', value)
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

  const lobbies = currentConfig.value.memorialLobbies

  // 先解析目标 id 并完成全部校验：通过前不触碰旧角色与任何交互状态，
  // 否则传入非法 id/配置时旧角色已销毁、新角色不加载，页面只剩空 canvas
  let newId
  switch (num) {
    case '-':
      newId = id === 0 ? lobbies.length - 1 : id - 1
      break
    case '+':
      newId = id === lobbies.length - 1 ? 0 : id + 1
      break
    default:
      newId = num
  }

  if (newId < 0 || newId >= lobbies.length) {
    return
  }

  const lobby = lobbies[newId]

  // 检查必需的属性
  if (!lobby.path || !lobby.skel || !lobby.atlas) {
    return
  }

  // 校验全部通过，提交切换
  id = newId

  canSkip.value = true
  emit('canskip', true)
  talkPlayer.reset()
  // 取消可能悬着的指针会话（旧实例随即销毁，交互模块随 detach 复位）
  cancelPressSession()
  talkPlayer.stopAllVoices()
  // 销毁旧角色动画实例（资源保留在缓存中不卸载：
  // 全部角色在加载屏阶段已由 init/live2d.js 预加载，数量有限、占用有界，
  // 保留缓存（含 skeletonCache / 贴图 / GPU 纹理）让来回切换完全无缝；
  // 卸载反而会使切回时重新下载/解码/上传 GPU，出现约 1s 卡顿）
  if (animation) {
    detachInteractions()
    l2d.stage.removeChild(animation)
    animation.destroy()
    animation = null
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
      // 初始化辅助轨道：1=Idle_01_R（场景副动画，缺失时 Dummy 占位）、2/3=交互 M/A
      initTracks(animation)
      l2d.stage.addChild(animation)
      // 记录已加载角色的资源标识，供语言切换时判重（资源未变则跳过重载）
      loadedL2DKey = skeletonPath + '|' + atlasPath
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

  // 绑定视线跟随/摸头/捏脸等交互动效
  attachInteractions(animation)

  originalOffsetPercent = parseOffset(lobby.offset) * 100
  l2d.view.style.transform = `translateX(calc((50% - ${originalOffsetPercent} * 1%) * (1 - min(1, 100vw / 1200px))))`
  // 角色偏移改变，画布布局缓存失效
  cachedViewRect = null

  let startIdle = 'Start_Idle_01'
  showDialogue.value = false
  if (!animation.state.data.skeletonData.findAnimation('Start_Idle_01')) startIdle = 'Start_idle_01'
  talkPlayer.attachEventListener(animation.state)
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
          talkPlayer.attachEventListener(animation.state)
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
        talkPlayer.attachEventListener(animation.state)
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

// ===== 指针会话状态机（与原游戏交互逻辑一致） =====
//   快速点按身体 = 对话（Talk）
//   按住拖动 = 命中特殊骨骼则捏脸拖拽，否则视线跟随（EyeIK）
//   静止长按头部 = 摸头（HairPatIK），摸头中移动 = 头部跟随手指
let pressSession = null

const onPressDown = (event) => {
  if (!animation || !animationReady || !ctx.isIdleMode()) return
  const world = clientToWorld(event.clientX, event.clientY, l2d.view.getBoundingClientRect())
  const session = {
    sx: event.clientX,
    sy: event.clientY,
    world,
    moved: false,
    longPressed: false,
    kind: null, // null | 'pat' | 'drag' | 'gaze'
    // 按下点预探测可拖拽骨骼（拖动阈值通过后立即生效）
    dragTarget: boneDrag.probe(world.x, world.y),
    longPressTimer: null
  }
  session.longPressTimer = setTimeout(() => {
    if (pressSession !== session || session.moved) return
    session.longPressed = true
    // 静止长按命中头部区域 → 摸头
    if (
      pat.canStart() &&
      animation?.skeleton &&
      hitTestHeadRegion(animation.skeleton, world.x, world.y, BONE_HIT_RADIUS)
    ) {
      session.kind = 'pat'
      pat.start(world.x, world.y)
    }
  }, LONG_PRESS_THRESHOLD)
  pressSession = session
  // 会话期间在 window 上跟踪移动/抬起：掠过其他 UI 元素或移出 canvas 不中断交互
  // （canvas 的 mouseleave 只在无会话时做悬停清理）
  window.addEventListener('mousemove', onPressMove)
  window.addEventListener('mouseup', onPressUp)
}

const onPressMove = (event) => {
  const session = pressSession
  if (!session || !animation) return
  // 复用悬停路径的画布布局缓存（窗口尺寸/角色偏移变化时失效重建）
  if (!cachedViewRect) cachedViewRect = l2d.view.getBoundingClientRect()
  const world = clientToWorld(event.clientX, event.clientY, cachedViewRect)

  // 摸头中直接跟随（不受拖拽阈值限制）
  if (session.kind === 'pat') {
    pat.move(world.x, world.y)
    return
  }

  if (!session.moved) {
    const dist = Math.hypot(event.clientX - session.sx, event.clientY - session.sy)
    if (dist < DRAG_START_THRESHOLD) return
    session.moved = true
    clearTimeout(session.longPressTimer)
    // 拖动开始：优先捏脸/特殊骨骼，否则视线跟随
    if (
      session.dragTarget &&
      boneDrag.start(session.dragTarget, session.world.x, session.world.y)
    ) {
      session.kind = 'drag'
    } else if (gaze.start(session.world.x, session.world.y)) {
      session.kind = 'gaze'
    } else {
      return
    }
  }

  if (session.kind === 'drag') boneDrag.move(world.x, world.y)
  else if (session.kind === 'gaze') gaze.move(world.x, world.y)
}

const onPressUp = (event) => {
  const session = pressSession
  if (!session) return
  pressSession = null
  clearTimeout(session.longPressTimer)
  window.removeEventListener('mousemove', onPressMove)
  window.removeEventListener('mouseup', onPressUp)

  if (session.kind === 'pat') {
    pat.end()
    return
  }
  if (session.kind === 'drag') {
    boneDrag.end()
    return
  }
  if (session.kind === 'gaze') {
    gaze.end()
    return
  }
  // 长按过不触发对话（与旧行为一致）
  if (session.longPressed) return
  // 快速点按 → 对话
  if (event) handleTap(event)
}

// 取消悬着的指针会话（切换角色/路由离开/窗口失焦时），各交互模块由 detach/end 复位
const cancelPressSession = () => {
  if (!pressSession) return
  const kind = pressSession.kind
  clearTimeout(pressSession.longPressTimer)
  pressSession = null
  window.removeEventListener('mousemove', onPressMove)
  window.removeEventListener('mouseup', onPressUp)
  // 失焦等异常路径下让进行中的交互正常收尾
  if (kind === 'pat') pat.end()
  else if (kind === 'drag') boneDrag.end()
  else if (kind === 'gaze') gaze.end()
}

// 点按对话：命中骨骼（半径 100）→ 宽松半径（160）兜底
const handleTap = (event) => {
  if (
    !animation ||
    !animation.state ||
    !animationReady ||
    ctx.flags.talking.value ||
    !ctx.isIdleMode()
  ) {
    return
  }
  // 摸头按住中不触发（结束阶段的打断由 playTalk 内部处理）
  if (pat.isEngaged() && pat.isActive()) return

  const world = clientToWorld(event.clientX, event.clientY, l2d.view.getBoundingClientRect())
  if (hitTestBones(animation.skeleton, world.x, world.y, BONE_HIT_RADIUS).length > 0) {
    talkPlayer.playTalk()
    return
  }
  if (hitTestBones(animation.skeleton, world.x, world.y, BONE_HIT_FALLBACK_RADIUS).length > 0) {
    talkPlayer.playTalk()
  }
}

// 在canvas上添加事件监听
const addEventListenersToCanvas = () => {
  if (l2d.view) {
    // 移除可能存在的旧监听
    removeEventListenersFromCanvas()

    // 添加事件监听
    l2d.view.addEventListener('mousedown', onPressDown)
    l2d.view.addEventListener('mouseup', onPressUp)
    l2d.view.addEventListener('mouseleave', handleMouseLeave)
    // 统一 mousemove：按压中走状态机，未按压走悬停检测
    l2d.view.addEventListener('mousemove', handleMouseMove)
    // touch 处理器均不调用 preventDefault，声明 passive 消除 scroll-blocking 警告
    l2d.view.addEventListener('touchstart', handleTouchStart, { passive: true })
    l2d.view.addEventListener('touchmove', handleTouchMove, { passive: true })
    l2d.view.addEventListener('touchend', handleTouchEnd)
    l2d.view.addEventListener('touchcancel', handleTouchEnd)
  }
}

// 移除canvas上的事件监听
const removeEventListenersFromCanvas = () => {
  if (l2d.view) {
    l2d.view.removeEventListener('mousedown', onPressDown)
    l2d.view.removeEventListener('mouseup', onPressUp)
    l2d.view.removeEventListener('mouseleave', handleMouseLeave)
    l2d.view.removeEventListener('mousemove', handleMouseMove)
    l2d.view.removeEventListener('touchstart', handleTouchStart)
    l2d.view.removeEventListener('touchmove', handleTouchMove)
    l2d.view.removeEventListener('touchend', handleTouchEnd)
    l2d.view.removeEventListener('touchcancel', handleTouchEnd)
  }
}

// 鼠标移动：按压会话期间由 window 监听驱动（此处不再重复处理），未按压做悬停检测
const handleMouseMove = (event) => {
  if (!pressSession) handleBoneHover(event)
}

// 鼠标离开canvas时的处理函数（独立命名以便正确移除监听）：
// 有按压会话时不结束交互（由 window mouseup 收尾），仅做悬停光标清理
const handleMouseLeave = () => {
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
    onPressDown(mouseEvent)
  }
}

// 处理触摸移动事件
const handleTouchMove = (event) => {
  if (pressSession && event.touches.length > 0) {
    const touchEvent = event.touches[0]
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touchEvent.clientX,
      clientY: touchEvent.clientY
    })
    onPressMove(mouseEvent)
  }
}

const handleTouchEnd = (event) => {
  if (event.changedTouches.length > 0) {
    const touchEvent = event.changedTouches[0]
    const mouseEvent = new MouseEvent('mouseup', {
      clientX: touchEvent.clientX,
      clientY: touchEvent.clientY
    })
    onPressUp(mouseEvent)
  }
}

// 骨骼悬停检测：rAF 节流 + 布局缓存 + 状态变化才写 DOM
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

  // 检测是否悬停在可交互骨骼上（内部已排除 root/chair/背景/灯光/交互目标骨）
  const isHovering = hitTestBones(animation.skeleton, worldX, worldY, BONE_HIT_RADIUS).length > 0

  // 更新光标状态（仅在悬停状态变化时写 classList）
  if (isHovering !== isL2dHovering) {
    isL2dHovering = isHovering
    if (isHovering) {
      l2d.view.classList.add('l2d-hover')
    } else {
      l2d.view.classList.remove('l2d-hover')
    }
  }
}

// 停止所有语音和清理
const stopAllVoiceAndCleanup = () => {
  // 清理语音和对话气泡
  talkPlayer.clearVoiceAndDialogue()
  // 关闭可能打开的Modal
  if (modalRef) {
    modalRef.close()
    modalRef = null
  }
  cancelPressSession()
  detachInteractions()
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
  talkPlayer.reset()
  animationReady = false
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
  talkPlayer.reset()
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
  talkPlayer.reset()
  cancelPressSession()
  talkPlayer.stopAllVoices()

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
      initTracks(animation)
      l2d.stage.addChild(animation)
      // 记录已加载角色的资源标识，供语言切换时判重（资源未变则跳过重载）
      loadedL2DKey = skeletonPath + '|' + atlasPath
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

  // 绑定交互动效
  attachInteractions(animation)

  originalOffsetPercent = parseOffset(lobby.offset) * 100
  l2d.view.style.transform = `translateX(calc((50% - ${originalOffsetPercent} * 1%) * (1 - min(1, 100vw / 1200px))))`
  // 角色偏移改变，画布布局缓存失效
  cachedViewRect = null

  showDialogue.value = false
  // 添加事件监听器
  talkPlayer.attachEventListener(animation.state)

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

  cancelPressSession()
  detachInteractions()

  // 移除事件监听
  removeEventListenersFromCanvas()
  window.removeEventListener('resize', handleWindowResize)
  window.removeEventListener('blur', cancelPressSession)

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
          talkPlayer.stopAllVoices()

          // 再次检查动画状态
          if (animation && animation.state) {
            animation.state.setAnimation(0, 'Idle_01', true)
            initTracks(animation)
            animation.state.listeners = []
            talkPlayer.attachEventListener(animation.state)
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

// 等待配置加载完成后初始化Live2D
const initLive2DWhenReady = () => {
  if (!currentConfig.value || !currentConfig.value.memorialLobbies) {
    return
  }

  // 语言切换只替换翻译/语音文案，若当前角色的 skel/atlas 资源未变且实例存活，
  // 跳过整只重载（避免重播 Start_Idle）；语音语言在 onEvent 播放时按 locale 实时选择，无需重载
  const lobby = currentConfig.value.memorialLobbies[id]
  const key = lobby && lobby.path ? lobby.path + lobby.skel + '|' + lobby.atlas : null
  if (animation && key && key === loadedL2DKey) {
    return
  }

  setL2D(id)
}

// 开发环境调试句柄：暴露交互状态与骨骼屏幕坐标，供无头浏览器 E2E 测试与调参
// （生产构建中 import.meta.env.DEV 恒为 false，整块会被 treeshake 移除，不进产物）
if (import.meta.env.DEV) {
  window.__l2dDebug = {
    getState: () => ({
      ready: animationReady,
      idle: ctx.isIdleMode(),
      talking: ctx.flags.talking.value,
      petting: ctx.flags.ifPetting.value,
      gazing: gaze.isActive(),
      dragging: boneDrag.isActive(),
      gazeBone: gaze.boneName(),
      pat: pat.debugInfo(),
      dragBones: boneDrag.targetNames(),
      // 轨道当前动画名（验证随机小动作/眨眼调度）
      tracks: animation?.state
        ? [0, 1, 2, 3, 4].map((t) => animation.state.getCurrent(t)?.animation?.name ?? null)
        : [],
      character: animation?.skeleton?.data?.name ?? null
    }),
    // 骨骼世界坐标 → 页面 client 坐标（clientToWorld 的逆运算）
    boneClientPos: (name) => {
      if (!animation || !l2d.view) return null
      const bone = animation.skeleton.findBone(name)
      if (!bone) return null
      const rect = l2d.view.getBoundingClientRect()
      const scaleX = rect.width / l2d.screen.width
      const scaleY = rect.height / l2d.screen.height
      return {
        x: (bone.worldX * animation.scale.x + animation.x) * scaleX + rect.left,
        y: (bone.worldY * animation.scale.y + animation.y) * scaleY + rect.top
      }
    },
    // 头部区域代表点（取第一个头部区域骨骼）
    headClientPos: () => {
      if (!animation || !l2d.view) return null
      const bone = animation.skeleton.bones.find((b) => isHeadRegionBone(b.data.name))
      return bone ? window.__l2dDebug.boneClientPos(bone.data.name) : null
    },
    // 切换角色（供多角色用例）
    switchCharacter: (index) => setL2D(index),
    // 按正则列出骨骼名（供骨名探测调试）
    listBones: (pattern) => {
      if (!animation) return []
      const re = new RegExp(pattern, 'i')
      return animation.skeleton.bones.filter((b) => re.test(b.data.name)).map((b) => b.data.name)
    }
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
