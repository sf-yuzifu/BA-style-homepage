import { Howl } from 'howler'
import type {
  AnimationState,
  AnimationStateListener,
  Event,
  TrackEntry
} from '@esotericsoftware/spine-core'
import type { SpineInteractionContext } from './types'
import { TRACK_M, TRACK_A, hasAnimation, queueDummyPair } from './useSpineTracks'

/**
 * 对话播放器：Talk_XX_M/A 双轨动画 + spine "talk" 事件驱动语音与对话气泡。
 * 语音/字幕行为与原版一致：事件 stringValue 作为语音 key，按当前语言选 zh-CN/ja-JP 音源，
 * 一句一播（不做分组连播）。
 *
 * @param {object} ctx 共享上下文（由 Background.vue 创建）
 * @param {() => object|null} ctx.getSpine 当前 Spine 实例
 * @param {() => object|null} ctx.getLobby 当前角色配置（含 voice 映射与资源路径）
 * @param {() => string} ctx.getLocale 当前语言
 * @param {Ref<string>} ctx.dialogue 对话文本
 * @param {Ref<boolean>} ctx.showDialogue 对话气泡显隐
 * @param {{talking: Ref<boolean>, ifPetting: Ref<boolean>}} ctx.flags 交互状态（跨模块共享）
 * @param {() => boolean} ctx.isIdleMode 轨道 0 是否处于 Idle_01（可交互状态）
 * @param {() => object} ctx.getPat 摸头模块（talk 可打断摸头结束阶段）
 */
export function useTalkPlayer(ctx: SpineInteractionContext) {
  const talking = ctx.flags.talking
  let talkIndex = 1
  let soundList: Howl[] = []
  // 语音会话代际：stopAllVoices 清理时递增，异步错误回调据此识别过期会话
  let voiceEpoch = 0

  /** spine 事件回调（注册到 AnimationState 的 event 监听） */
  const handleEvent = (_entry: TrackEntry, event: Event) => {
    const voiceKey = event.stringValue
    if (!voiceKey) return

    const lobby = ctx.getLobby()
    if (!lobby) return
    const voiceSource = lobby.voice
    if (!voiceSource || !voiceSource[voiceKey]) {
      // 没有语音配置，静默处理
      return
    }

    ctx.dialogue.value = voiceSource[voiceKey]
    ctx.showDialogue.value = true

    // 播放语音
    const jpPath = lobby.path + 'ja-JP/' + voiceKey + '.mp3'
    let voicePath = jpPath
    if (ctx.getLocale() === 'zh-CN') {
      // 只有简体中文优先尝试使用中文语音
      voicePath = lobby.path + 'zh-CN/' + voiceKey + '.mp3'
    }

    // onloaderror/onplayerror 是异步回调（且构造阶段可能同步触发，回调内不能引用 voice 自身——TDZ），
    // 若回调触发前已清理（路由离开/切换角色），代际已变，必须放弃降级，
    // 否则会在 /bio 等其他页面响起本页角色的语音
    const epoch = voiceEpoch

    const voice = new Howl({
      src: [voicePath],
      volume: 0.3,
      onloaderror: () => {
        // 如果加载失败且当前尝试的是中文语音，则降级到日文语音
        if (voicePath !== jpPath) playFallbackVoice(jpPath, epoch)
      },
      onplayerror: () => {
        if (voicePath !== jpPath) playFallbackVoice(jpPath, epoch)
      },
      onend: () => releaseVoice(voice)
    })

    voice.play()
    soundList.push(voice)
  }

  // 中文语音失败时降级创建日文语音（代际不一致说明组件已清理，直接放弃）
  const playFallbackVoice = (jpPath: string, epoch: number) => {
    if (epoch !== voiceEpoch) return

    const fallbackVoice = new Howl({
      src: [jpPath],
      volume: 0.3,
      onend: () => releaseVoice(fallbackVoice)
    })
    fallbackVoice.play()
    soundList.push(fallbackVoice)
  }

  /** 停止并释放所有语音资源 */
  const stopAllVoices = () => {
    // 先递增代际，使遍历期间/之后触发的任何异步错误回调识别会话已过期，放弃创建降级语音
    voiceEpoch++
    for (const sound of soundList) {
      sound.stop()
      sound.unload()
    }
    soundList = []
  }

  // 单条语音播放完毕后自动释放（含解码后的 PCM 缓冲），避免长时间互动后 soundList 只进不出
  const releaseVoice = (target: Howl) => {
    target.unload()
    soundList = soundList.filter((s) => s !== target)
  }

  /** 清理语音和对话气泡 */
  const clearVoiceAndDialogue = () => {
    stopAllVoices()
    ctx.showDialogue.value = false
    ctx.dialogue.value = ''
  }

  /** 注册 spine event 监听（轨道监听器被整体重置后由 Background 重新调用） */
  const attachEventListener = (state: AnimationState) => {
    state.addListener({ event: handleEvent })
  }

  /** 确保 event 监听存在（对话动画完成等只清自身监听器的场景下兜底） */
  const ensureEventListener = (state: AnimationState) => {
    if (!state.listeners.some((l) => l.event === handleEvent)) {
      attachEventListener(state)
    }
  }

  /** 播放对话动画（带摸头状态检查：摸头中忽略，摸头结束阶段允许打断） */
  const playTalk = () => {
    const spine = ctx.getSpine()
    if (!spine?.state || !ctx.isIdleMode() || talking.value) return

    // 摸头结束阶段（已松手、PatEnd 播放中）允许打断；仍在按住摸头则忽略
    const pat = ctx.getPat?.()
    if (pat?.isEngaged()) {
      if (pat.isActive()) return
      pat.interrupt()
    }

    const useCN =
      ctx.getLocale().startsWith('zh') && hasAnimation(spine, 'Talk_0' + talkIndex + '_A_CN')
    const suffix = useCN ? '_CN' : ''
    if (!hasAnimation(spine, 'Talk_0' + talkIndex + '_M' + suffix)) return

    spine.state.addAnimation(TRACK_M, 'Talk_0' + talkIndex + '_M' + suffix).mixDuration = 0.3
    spine.state.addAnimation(TRACK_A, 'Talk_0' + talkIndex + '_A' + suffix).mixDuration = 0.3
    queueDummyPair(spine, 0.3)

    const listener: AnimationStateListener = {
      complete: (entry) => {
        if (entry.trackIndex === TRACK_M && entry.animation!.name.startsWith('Talk_')) {
          // 只移除当前对话动画的监听器，保留其他监听器
          spine.state.listeners = spine.state.listeners.filter((l) => l !== listener)
          ensureEventListener(spine.state)
          talking.value = false
          ctx.showDialogue.value = false
        }
      }
    }
    spine.state.addListener(listener)

    talkIndex++
    if (!hasAnimation(spine, 'Talk_0' + talkIndex + '_M')) {
      talkIndex = 1
    }
    talking.value = true
  }

  /** 重置对话状态（切换角色/路由返回时） */
  const reset = () => {
    talking.value = false
    talkIndex = 1
  }

  return {
    talking,
    playTalk,
    handleEvent,
    attachEventListener,
    ensureEventListener,
    stopAllVoices,
    clearVoiceAndDialogue,
    reset
  }
}
