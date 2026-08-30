import * as PIXI from 'pixi.js'
import { isWebGLSupported } from '@pixi/utils'

/**
 * 创建 PIXI 应用；WebGL 不可用或上下文创建失败时返回 null，由调用方降级为静态背景。
 * PIXI 7 无 Canvas 渲染器，`autoDetectRenderer` 会抛 "Unable to auto-detect a suitable renderer."
 */
export function tryCreatePixiApp(
  options?: ConstructorParameters<typeof PIXI.Application>[0]
): PIXI.Application | null {
  try {
    if (!isWebGLSupported()) {
      console.error('WebGL is not available; Live2D will use a static background')
      return null
    }

    const app = new PIXI.Application(options)
    if (!app.view || !app.renderer) {
      app.destroy(true)
      console.error('PIXI renderer failed to initialize; Live2D will use a static background')
      return null
    }
    return app
  } catch (error) {
    console.error(
      'Failed to create PIXI application; Live2D will use a static background',
      error
    )
    return null
  }
}
