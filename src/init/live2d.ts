import * as PIXI from 'pixi.js'
import { useConfig } from '@/composables/useConfig'

// Live2D 资源加载完成的共享 Promise（替代 window.l2d_complete 全局标记）
let resolveLive2DReady!: () => void
export const live2dReady = new Promise<void>((resolve) => {
  resolveLive2DReady = resolve
})

export async function initLive2D(): Promise<boolean> {
  try {
    const { waitForConfig } = useConfig()

    // 等待配置加载完成
    const config = await waitForConfig()

    if (!config) {
      console.warn('配置对象为空，跳过Live2D初始化')
      resolveLive2DReady()
      return false
    }

    if (!config.memorialLobbies || !Array.isArray(config.memorialLobbies)) {
      console.warn('memorialLobbies配置无效，跳过Live2D初始化:', config.memorialLobbies)
      resolveLive2DReady()
      return false
    }

    // 异步加载所有Live2D资源，使用索引避免竞态条件
    const loadPromises = config.memorialLobbies.map(async (lobby, index) => {
      try {
        // 使用索引生成唯一的资源别名，避免覆盖
        // 注意：别名格式必须与 Background.vue 中实际使用的保持一致（skeleton_${id} / atlas_${id}），
        // 否则预加载不会被 Spine.from 命中，同一资源会被重复下载/解析/上传 GPU 且副本永久驻留内存
        const skeletonAlias = `skeleton_${index}`
        const atlasAlias = `atlas_${index}`

        // 添加资源到PIXI资源管理器
        PIXI.Assets.add({ alias: skeletonAlias, src: lobby.path + lobby.skel })
        PIXI.Assets.add({ alias: atlasAlias, src: lobby.path + lobby.atlas })

        // 加载资源
        await PIXI.Assets.load([skeletonAlias, atlasAlias])

        console.log(`Live2D资源加载完成: ${lobby.path} (别名: ${skeletonAlias}, ${atlasAlias})`)
      } catch (error) {
        console.error(`Live2D资源加载失败: ${lobby.path}`, error)
        // 即使单个资源加载失败，也继续加载其他资源
      }
    })

    // 等待所有资源加载完成
    await Promise.allSettled(loadPromises)

    // 标记Live2D加载完成
    resolveLive2DReady()
    console.log('Live2D资源加载完成')

    return true
  } catch (error) {
    console.error('Live2D资源加载失败:', error)
    resolveLive2DReady() // 即使失败也标记完成，避免无限加载
    return false
  }
}
