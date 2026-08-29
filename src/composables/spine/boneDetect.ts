import type { Bone, Skeleton } from '@esotericsoftware/spine-core'

// 骨骼自动探测：骨名与交互归属已经官方资源包（AssetStudio 解包 SpineDragIK 组件）证实：
//   摸头 HairPatIK → Touch_Point（Head_Rot 的子骨，头部跟随目标点）
//   视线 EyeIK    → Touch_Eye（Head_Rot 的子骨，视线注视目标点）
//   手部 HandFollowIK → HandFollow（aris 专有）
// 按候选名单在骨架中实地查找（findBone），找不到的交互自动降级为不可用，
// 也允许在 _config.yaml 的 memorialLobbies[i].interactions 中显式指定骨名覆盖。

// 视线跟随目标骨（原游戏 prefab 中 EyeIK 物体的 SpineDragIK 拖拽目标）
// aris/kei/hina 均有 Touch_Eye（子骨 Touch_Eye_Key 为兜底）
export const GAZE_BONE_CANDIDATES = ['Touch_Eye', 'Touch_Eye_Key']

// 摸头跟随骨（原游戏 prefab 中 HairPatIK 物体的拖拽目标——注意不是 Head_Rot，
// 拖 Head_Rot 会整头位移导致"掉头"，Touch_Point 才是 IK 目标点）
export const PAT_BONE_CANDIDATES = ['Touch_Point', 'Touch_Point_key', 'Touch_Point_Key']

// 手部跟随骨（aris 专有：HandFollowIK）
export const HAND_FOLLOW_BONE_CANDIDATES = ['HandFollow']

// 头部区域判定（摸头长按命中用）：head/face/eye/nose/mouth/neck 均视为头部区域，
// 大小写不敏感以兼容 kei 的 Face、aris 的 R_eye_default_1 等命名差异
const HEAD_REGION_PATTERN = /^(head_rot|face|neck_01|.*eyebrow.*|.*eye.*|nose|mouth.*)$/i

// 可拖拽骨骼（捏脸/特殊部位）自动探测规则：
//   - Face_IK / Neck_IK（大小写兼容 aris 的 Neck_ik）：脸/颈的 IK 目标骨，拖拽即捏脸
//   - breast_* 系特殊骨（aris，对应原游戏 SpecialSpine.json 的动态骨）
// 注意实测：kei 字符串表中的 Face_IK_Touch 等带后缀名并非真实骨骼，真实骨名即 Face_IK/Neck_IK
const DRAG_BONE_PATTERNS = [/^(Face|Neck)_IK$/i, /^breast_\d/i]

// 不参与交互的骨骼（根骨骼/椅子/背景/灯光/交互目标骨自身）
const NON_INTERACTIVE_PATTERN = /^(root$|chair|Back_|Light|Touch_)/i

/** 按候选名单顺序查找第一个存在的骨骼 */
export function findBoneByCandidates(skeleton: Skeleton, candidates: string[]): Bone | null {
  for (const name of candidates) {
    const bone = skeleton.findBone(name)
    if (bone) return bone
  }
  return null
}

/** 是否为头部区域骨骼 */
export function isHeadRegionBone(boneName: string): boolean {
  return HEAD_REGION_PATTERN.test(boneName)
}

/** 是否不参与交互的骨骼（悬停/点按判定中跳过） */
export function isNonInteractiveBone(boneName: string): boolean {
  return NON_INTERACTIVE_PATTERN.test(boneName)
}

/** 自动探测骨架中的可拖拽骨骼 */
export function detectDragBones(skeleton: Skeleton): Bone[] {
  return skeleton.bones.filter((bone) => DRAG_BONE_PATTERNS.some((p) => p.test(bone.data.name)))
}

/**
 * 世界坐标命中检测：找出所有距指针在 radius 内的可交互骨骼
 * @returns 按距离升序
 */
export function hitTestBones(
  skeleton: Skeleton,
  worldX: number,
  worldY: number,
  radius: number
): Array<{ bone: Bone; distance: number }> {
  const hits: Array<{ bone: Bone; distance: number }> = []
  for (let i = skeleton.bones.length - 1; i >= 0; i--) {
    const bone = skeleton.bones[i]
    if (isNonInteractiveBone(bone.data.name)) continue
    const distance = Math.sqrt((worldX - bone.worldX) ** 2 + (worldY - bone.worldY) ** 2)
    if (distance < radius) {
      hits.push({ bone, distance })
    }
  }
  hits.sort((a, b) => a.distance - b.distance)
  return hits
}

/** 头部区域命中检测（摸头长按用） */
export function hitTestHeadRegion(
  skeleton: Skeleton,
  worldX: number,
  worldY: number,
  radius: number
): boolean {
  for (let i = skeleton.bones.length - 1; i >= 0; i--) {
    const bone = skeleton.bones[i]
    if (!isHeadRegionBone(bone.data.name)) continue
    const distance = Math.sqrt((worldX - bone.worldX) ** 2 + (worldY - bone.worldY) ** 2)
    if (distance < radius) return true
  }
  return false
}
