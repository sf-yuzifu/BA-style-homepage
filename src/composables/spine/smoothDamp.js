// Unity Vector3.SmoothDamp 的 2D 等价实现（临界阻尼弹簧，帧率无关）。
// 视线跟随/摸头/捏脸的骨骼拖拽全部以此平滑——这是原游戏 SpineDragIK 手感的关键，
// 直接 lerp 或瞬移会导致动作生硬、回弹跳变。

// 单轴 SmoothDamp（与 UnityEngine.Vector3.SmoothDamp 逐分量算法一致）
const smoothDampAxis = (current, target, velocity, smoothTime, maxSpeed, deltaTime) => {
  smoothTime = Math.max(0.0001, smoothTime)
  const omega = 2 / smoothTime
  const x = omega * deltaTime
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  let change = current - target
  const originalTo = target

  // 限制最大变化速度
  const maxChange = maxSpeed * smoothTime
  change = Math.min(maxChange, Math.max(-maxChange, change))
  target = current - change

  const temp = (velocity + omega * change) * deltaTime
  velocity = (velocity - omega * temp) * exp
  let output = target + (change + temp) * exp

  // 防止过冲
  if (originalTo - current > 0 === output > originalTo) {
    output = originalTo
    velocity = deltaTime > 0 ? (output - originalTo) / deltaTime : 0
  }
  return { value: output, velocity }
}

/**
 * 创建一个 2D SmoothDamp 器
 * @param {number} smoothTime 平滑时间（秒），越小跟随越快
 * @param {number} maxSpeed 最大速度
 */
export function createSmoothDamp2(smoothTime, maxSpeed = Infinity) {
  let vx = 0
  let vy = 0
  return {
    reset() {
      vx = 0
      vy = 0
    },
    /**
     * 推进一帧
     * @returns {{x: number, y: number}} 平滑后的新位置
     */
    update(cx, cy, tx, ty, deltaTime, smoothTimeOverride) {
      const st = smoothTimeOverride ?? smoothTime
      const rx = smoothDampAxis(cx, tx, vx, st, maxSpeed, deltaTime)
      vx = rx.velocity
      const ry = smoothDampAxis(cy, ty, vy, st, maxSpeed, deltaTime)
      vy = ry.velocity
      return { x: rx.value, y: ry.value }
    }
  }
}
