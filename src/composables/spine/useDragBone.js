import { createSmoothDamp2 } from './smoothDamp'
import { findBoneByCandidates } from './boneDetect'

/**
 * SpineDragIK 的 Web 等价原语（参考 Shittim_Canvas 的 SpineDragIK.cs）：
 * 按压捕获起点 → 拖拽期间骨骼跟随指针（父级局部空间内钳制范围）→ 松开后 SmoothDamp 平滑回弹。
 *
 * 骨骼覆写发生在 Spine.beforeUpdateWorldTransforms 钩子中（动画 state.apply 之后、
 * 物理/IK 结算之前），与 Unity 版 SkeletonUtilityBone override 模式的时序等价，
 * 因此即使骨骼被当前动画 key 住，拖拽也能稳定生效。
 *
 * 坐标钳制在骨骼父级的局部空间进行（bone.worldToParent 换算），与原游戏一致。
 */
export class DragBoneController {
  /**
   * @param {object} options
   * @param {string} [options.boneName] 显式指定骨骼名（配置覆盖时优先）
   * @param {string[]} [options.boneCandidates] 自动探测候选骨名（按顺序取第一个存在的）
   * @param {number} [options.minOffsetX] 相对基准位置的 X 最小偏移（非对称钳制，官方数值即非对称）
   * @param {number} [options.maxOffsetX] X 最大偏移
   * @param {number} [options.minOffsetY] Y 最小偏移
   * @param {number] [options.maxOffsetY] Y 最大偏移
   * @param {number} [options.rangeX] 简易对称范围（minOffset/maxOffset 未指定时使用）
   * @param {number} [options.rangeY] 缺省同 rangeX
   * @param {number} [options.smoothTime] 按压跟随平滑时间（秒）
   * @param {number} [options.releaseSmoothRatio] 回弹平滑时间倍率（原游戏为 0.3）
   * @param {() => void} [onReturnEnd] 回弹完全结束后的回调
   */
  constructor(options = {}, onReturnEnd = null) {
    this.boneName = options.boneName ?? null
    this.boneCandidates = options.boneCandidates ?? []
    const rangeX = options.rangeX ?? 60
    const rangeY = options.rangeY ?? rangeX
    this.minOffsetX = options.minOffsetX ?? -rangeX
    this.maxOffsetX = options.maxOffsetX ?? rangeX
    this.minOffsetY = options.minOffsetY ?? -rangeY
    this.maxOffsetY = options.maxOffsetY ?? rangeY
    this.smoothTime = options.smoothTime ?? 0.12
    this.releaseSmoothRatio = options.releaseSmoothRatio ?? 0.3
    this.onReturnEnd = onReturnEnd

    this.spine = null
    this.bone = null
    this.origLocal = { x: 0, y: 0 }
    this.pressStart = { x: 0, y: 0 }
    this.destLocal = { x: 0, y: 0 }
    this.active = false // 按压拖拽中
    this.engaged = false // 需要逐帧更新（拖拽中或回弹中）
    this.current = null // 自维护的平滑位置（避免与被 key 住的动画值打架）
    this.damp = createSmoothDamp2(this.smoothTime)
  }

  /** 绑定到新的 Spine 实例（切换角色时调用）；骨骼不存在则返回 false（该交互自动禁用） */
  attach(spine) {
    this.detach()
    const bone = this.boneName
      ? spine.skeleton.findBone(this.boneName)
      : findBoneByCandidates(spine.skeleton, this.boneCandidates)
    if (!bone || !bone.parent) return false
    this.spine = spine
    this.bone = bone
    // 以 setup pose 为基准位置（等价 Unity 版 OrigLocalPos 的预制体初始值）
    this.origLocal = { x: bone.data.x, y: bone.data.y }
    return true
  }

  /** 骨骼当前绑定的名字（attach 失败为 null），供调试/日志 */
  get boundBoneName() {
    return this.bone?.data?.name ?? null
  }

  /** 按压开始（世界坐标） */
  press(worldX, worldY) {
    if (!this.bone || !this.bone.parent) return false
    this.active = true
    this.engaged = true
    // 记录按压起点（骨骼父级局部坐标），后续拖拽按差值偏移，与原游戏算法一致
    const start = this.bone.worldToParent({ x: worldX, y: worldY })
    this.pressStart = { x: start.x, y: start.y }
    this.destLocal = { x: this.origLocal.x, y: this.origLocal.y }
    this.current = null // 首帧从动画当前值起步，避免跳变
    this.damp.reset()
    return true
  }

  /** 拖拽移动（世界坐标） */
  move(worldX, worldY) {
    if (!this.active || !this.bone || !this.bone.parent) return
    const cur = this.bone.worldToParent({ x: worldX, y: worldY })
    this.destLocal = {
      x: clamp(
        this.origLocal.x + (cur.x - this.pressStart.x),
        this.origLocal.x + this.minOffsetX,
        this.origLocal.x + this.maxOffsetX
      ),
      y: clamp(
        this.origLocal.y + (cur.y - this.pressStart.y),
        this.origLocal.y + this.minOffsetY,
        this.origLocal.y + this.maxOffsetY
      )
    }
  }

  /** 松开：进入回弹阶段（平滑返回基准位置） */
  release() {
    this.active = false
  }

  /** 立即脱离（切换角色/离开路由时），不做回弹 */
  detach() {
    this.spine = null
    this.bone = null
    this.active = false
    this.engaged = false
    this.current = null
  }

  /** 是否正在按压拖拽 */
  isActive() {
    return this.active
  }

  /** 是否仍占用骨骼（拖拽中或回弹中） */
  isEngaged() {
    return this.engaged
  }

  /**
   * 逐帧更新（由 Spine.beforeUpdateWorldTransforms 调用）
   * @param {number} dt 秒
   */
  update(dt) {
    if (!this.engaged || !this.bone) return

    const target = this.active ? this.destLocal : this.origLocal
    const st = this.active ? this.smoothTime : this.smoothTime * this.releaseSmoothRatio

    // 首帧从动画当前值起步（骨骼可能被 Idle 动画 key 住），之后自维护平滑位置
    const cx = this.current ? this.current.x : this.bone.x
    const cy = this.current ? this.current.y : this.bone.y
    const next = this.damp.update(cx, cy, target.x, target.y, dt, st)
    this.current = next
    this.bone.x = next.x
    this.bone.y = next.y

    // 回弹到位后脱手，骨骼交还动画驱动
    if (!this.active) {
      const done =
        Math.abs(next.x - this.origLocal.x) < 0.01 && Math.abs(next.y - this.origLocal.y) < 0.01
      if (done) {
        this.bone.x = this.origLocal.x
        this.bone.y = this.origLocal.y
        this.engaged = false
        this.current = null
        this.onReturnEnd?.()
      }
    }
  }
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
