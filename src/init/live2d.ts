import * as PIXI from 'pixi.js'
import { useConfig } from '@/composables/useConfig'
import { retryAsync } from '@/utils/retry'

// Live2D 资源加载完成的共享 Promise（替代 window.l2d_complete 全局标记）
let resolveLive2DReady!: () => void
export const live2dReady = new Promise<void>((resolve) => {
  resolveLive2DReady = resolve
})

// 重试后仍加载失败的角色 path（降级进大厅时由 useLoading 给出用户可见提示）
const failedLobbyPaths: string[] = []
export const getFailedLobbyPaths = (): readonly string[] => failedLobbyPaths

// 逐角色加载完成的共享 Promise（加载屏进度条按角色粒度推进）：
// 懒创建 deferred，使 useResourceLoader 无需关心 initLive2D 的启动时序；
// 无论成败都在 finally 中推进——失败降级（计入完成）语义与 resourceLoader 的 error 兜底一致
const lobbySettlers: Array<{ promise: Promise<void>; resolve: () => void }> = []

const lobbySettler = (index: number) => {
  let entry = lobbySettlers[index]
  if (!entry) {
    let resolve!: () => void
    const promise = new Promise<void>((r) => {
      resolve = r
    })
    entry = { promise, resolve }
    lobbySettlers[index] = entry
  }
  return entry
}

export const getLobbySettled = (index: number): Promise<void> => lobbySettler(index).promise

/** 标记单个角色加载完成（成败都调用，进度条按角色粒度推进） */
const settleLobby = (index: number) => lobbySettler(index).resolve()

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

        // 加载资源（失败自动重试 3 次；PIXI 加载失败会清掉缓存的 rejected Promise，重试会真实重新请求）
        await retryAsync(() => PIXI.Assets.load([skeletonAlias, atlasAlias]))

        console.log(`Live2D资源加载完成: ${lobby.path} (别名: ${skeletonAlias}, ${atlasAlias})`)
      } catch (error) {
        // 重试后仍失败：记录该角色并继续加载其他角色，最终降级进大厅
        console.error(`Live2D资源重试后仍加载失败: ${lobby.path}`, error)
        failedLobbyPaths.push(lobby.path)
      } finally {
        // 逐角色回报完成事件（成败都推进加载屏进度条）
        settleLobby(index)
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
