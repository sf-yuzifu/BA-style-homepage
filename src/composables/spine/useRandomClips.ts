import type { SpineInteractionContext } from './types'
import { TRACK_BLINK, TRACK_IDLE_RANDOM, hasAnimation } from './useSpineTracks'

// 随机播放间隔（毫秒）——数值来自官方 SpineClip 资产的 RandomDelayMin/Max 字段：
//   Eye_Close_01（眨眼）：10~15 秒，轨道 3，IntroMix/OutroMix = 0
//   Idle_01_R（随机小动作）：60~70 秒，轨道 4，IntroMix/OutroMix = 0.3
const BLINK_MIN_DELAY = 10000
const BLINK_DELAY_SPAN = 5000
const IDLE_RANDOM_MIN_DELAY = 60000
const IDLE_RANDOM_DELAY_SPAN = 10000

/**
 * 随机小动作调度器（原游戏 SpineBase 的 MaskedRandomTiming 播放逻辑）：
 * 角色在 Idle 待机时每 10~15 秒随机眨眼一次、每 60~70 秒随机做一次小动作，
 * 让角色"活起来"。仅在完全空闲（未对话/未交互）时播放，避免与交互动画叠混。
 *
 * @param {object} ctx 共享上下文（见 Background.vue）
 */
export function useRandomClips(ctx: SpineInteractionContext) {
  let blinkTimer: ReturnType<typeof setTimeout> | null = null
  let idleRandomTimer: ReturnType<typeof setTimeout> | null = null

  // 仅待机且无任何交互进行时播放（对话/摸头/视线/拖拽期间动画由交互轨道负责）
  const canPlay = () =>
    ctx.isIdleMode() &&
    ctx.isReady() &&
    !ctx.flags.talking.value &&
    !ctx.flags.ifPetting.value &&
    !(ctx.getGaze()?.isEngaged() ?? false) &&
    !(ctx.getBoneDrag()?.isActive() ?? false)

  // 播完后回 Dummy 占位（AddAnimation 的 delay<=0 表示紧接当前播完）
  const playOnce = (track: number, name: string, mix: number) => {
    const spine = ctx.getSpine()
    if (!spine?.state || !hasAnimation(spine, name)) return
    spine.state.setAnimation(track, name, false).mixDuration = mix
    if (hasAnimation(spine, 'Dummy')) {
      spine.state.addAnimation(track, 'Dummy', true).mixDuration = mix
    }
  }

  const scheduleBlink = () => {
    stopBlink()
    blinkTimer = setTimeout(
      () => {
        if (canPlay()) playOnce(TRACK_BLINK, 'Eye_Close_01', 0)
        scheduleBlink()
      },
      BLINK_MIN_DELAY + Math.random() * BLINK_DELAY_SPAN
    )
  }

  const scheduleIdleRandom = () => {
    stopIdleRandom()
    idleRandomTimer = setTimeout(
      () => {
        if (canPlay()) playOnce(TRACK_IDLE_RANDOM, 'Idle_01_R', 0.3)
        scheduleIdleRandom()
      },
      IDLE_RANDOM_MIN_DELAY + Math.random() * IDLE_RANDOM_DELAY_SPAN
    )
  }

  const stopBlink = () => {
    if (blinkTimer) {
      clearTimeout(blinkTimer)
      blinkTimer = null
    }
  }

  const stopIdleRandom = () => {
    if (idleRandomTimer) {
      clearTimeout(idleRandomTimer)
      idleRandomTimer = null
    }
  }

  /** 角色加载/切换后启动调度（动画缺失的角色自动跳过对应调度） */
  const start = () => {
    stop()
    const spine = ctx.getSpine()
    if (!spine) return
    if (hasAnimation(spine, 'Eye_Close_01')) scheduleBlink()
    if (hasAnimation(spine, 'Idle_01_R')) scheduleIdleRandom()
  }

  const stop = () => {
    stopBlink()
    stopIdleRandom()
  }

  return { start, stop }
}
