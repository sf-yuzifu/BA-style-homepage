/** 转场闪光视频（原文件名拼写保留） */
export const TRANSITION_WEBM = '/transfrom.webm'

export type TransitionMedia = { kind: 'video'; src: typeof TRANSITION_WEBM }

function probeCanPlay(mime: string): boolean {
  const video = document.createElement('video')
  const result = video.canPlayType(mime)
  return result === 'probably' || result === 'maybe'
}

/** Safari（含 iOS）；VP9 / WebP 透明高光在此均易花屏 */
export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/i.test(ua)
}

/**
 * 转场闪光：仅非 Safari 且支持 WebM 时返回 WebM。
 * Safari 与不支持 WebM 的环境返回 null → 跳过闪光，直接拉幕布（幕布本身是完整转场）。
 */
export function getTransitionMedia(): TransitionMedia | null {
  if (isSafari()) return null
  const webmOk =
    probeCanPlay('video/webm; codecs="vp9"') || probeCanPlay('video/webm; codecs="vp8"')
  if (webmOk) return { kind: 'video', src: TRANSITION_WEBM }
  return null
}

export function canUseTransitionFlash(): boolean {
  return getTransitionMedia() !== null
}
