import type { DialogueDisplay, MemorialLobby } from '@/types/config'

export type DialogueSide = 'left' | 'right'
export type DialogueMode = 'auto' | 'manual'

const parseFraction = (value: string | number | undefined): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0

  const expression = String(value).replace(/\s+/g, '')
  const terms = expression.match(/[+-]?[^+-]+/g)
  if (!terms || terms.join('') !== expression) return 0

  return terms.reduce((sum, term) => {
    const sign = term.startsWith('-') ? -1 : 1
    const unsigned = term.replace(/^[+-]/, '')
    const parts = unsigned.split('/')
    if (parts.length > 2) return sum
    const numerator = Number(parts[0])
    const denominator = parts.length === 2 ? Number(parts[1]) : 1
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return sum
    }
    return sum + sign * (numerator / denominator)
  }, 0)
}

/** 未配 x/y 或显式 mode:auto → 自动跟嘴；mode:manual 或同时配 x+y → 手动 */
export function resolveDialogueMode(display?: DialogueDisplay): DialogueMode {
  if (!display) return 'auto'
  if (display.mode === 'manual') return 'manual'
  if (display.mode === 'auto') return 'auto'
  if (display.x !== undefined && display.y !== undefined) return 'manual'
  return 'auto'
}

export function resolveDialogueOffsets(display?: DialogueDisplay): { x: number; y: number } {
  return {
    x: display?.offsetX ?? 0,
    y: display?.offsetY ?? -32
  }
}

/** manual：fraction×视口，相对屏幕中心锚点（兼容旧 a-trigger + translate） */
export function resolveManualTranslate(display?: DialogueDisplay): { x: number; y: number } {
  const w = document.documentElement.clientWidth
  const h = document.documentElement.clientHeight
  return {
    x: parseFraction(display?.x) * w,
    y: parseFraction(display?.y) * h
  }
}

export function resolveConfiguredSide(display?: DialogueDisplay): DialogueSide | 'auto' {
  const side = display?.side ?? display?.position
  if (side === 'left' || side === 'right') return side
  return 'auto'
}

/** auto：嘴在屏幕左半边 → 气泡在右（不挡脸） */
export function resolveAutoSide(anchorClientX: number, lobby?: MemorialLobby): DialogueSide {
  const vw = document.documentElement.clientWidth
  if (anchorClientX < vw * 0.5) return 'right'
  if (anchorClientX > vw * 0.5) return 'left'
  const offset = lobby?.offset ?? 0.5
  return offset <= 0.5 ? 'right' : 'left'
}

/** WebGL 不可用或无骨骼时的静态锚点 */
export function fallbackAnchorClientPoint(
  canvas: HTMLCanvasElement,
  lobby?: MemorialLobby
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const offset = lobby?.offset ?? 0.5
  return {
    x: rect.left + rect.width * offset,
    y: rect.top + rect.height * 0.38
  }
}
