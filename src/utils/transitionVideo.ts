/** 转场变体：亮色（Arona 蓝）/ 暗色（PLANA 紫），每次任务转场随机抽取 */
export type TransitionVariant = 'arona' | 'plana'

interface TransitionSet {
  /** Safari / iOS：HEVC + alpha（.mov）；须在 WebM 之前列出，避免 Safari 误选 VP9 透明轨 */
  mov: string
  webm: string
  /** 幕布舞台背景图 */
  curtainBg: string
}

/** 两套转场资源（视频文件名拼写沿用历史 transfrom） */
export const TRANSITION_SETS: Record<TransitionVariant, TransitionSet> = {
  arona: {
    mov: '/transfrom.mov',
    webm: '/transfrom.webm',
    curtainBg: '/shitim/Event_Main_Stage_Bg.png'
  },
  plana: {
    mov: '/transfrom_plana.mov',
    webm: '/transfrom_plana.webm',
    curtainBg: '/shitim/Event_Main_Stage_Bg_Purple.png'
  }
}

/** 任务转场抽签：1/2 概率抽中 PLANA；rng 可注入便于测试 */
export function drawTransitionVariant(rng: () => number = Math.random): TransitionVariant {
  return rng() < 0.5 ? 'plana' : 'arona'
}

function probeCanPlay(mime: string): boolean {
  const video = document.createElement('video')
  const result = video.canPlayType(mime)
  return result === 'probably' || result === 'maybe'
}

/** 双轨：<source> 先 MOV 后 WebM，由浏览器自选 */
export function canPlayTransitionVideo(): boolean {
  const hevcOk =
    probeCanPlay('video/quicktime; codecs="hvc1"') || probeCanPlay('video/mp4; codecs="hvc1"')
  const webmOk =
    probeCanPlay('video/webm; codecs="vp9"') || probeCanPlay('video/webm; codecs="vp8"')
  return hevcOk || webmOk
}
