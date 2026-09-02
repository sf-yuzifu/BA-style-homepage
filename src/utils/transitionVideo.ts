/** 转场闪光视频（原文件名拼写保留） */
export const TRANSITION_WEBM = '/transfrom.webm'
/** Safari / iOS：HEVC + alpha（.mov）；须在 WebM 之前列出，避免 Safari 误选 VP9 透明轨 */
export const TRANSITION_MOV = '/transfrom.mov'

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
