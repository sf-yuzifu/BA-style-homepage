/** _config.yaml + locales 合并后的站点配置类型 */

export type LocaleCode = 'zh-CN' | 'zh-TW' | 'en-US' | 'ja-JP'

export interface ManifestIcon {
  src: string
  sizes: string
  purpose?: string
}

export interface ManifestConfig {
  name: string
  short_name: string
  description: string
  theme_color: string
  start_url: string
  id: string
  icons: ManifestIcon[]
}

export interface DockItem {
  name: string
  href?: string
  imgSrc?: string
  iconfont?: string
}

export interface ContactItem {
  name: string
  href?: string
  imgSrc?: string
  iconfont?: string
}

export interface TaskConfig {
  name: string
  href?: string
}

export interface BannerConfig {
  musicID: number[]
}

export interface ICPConfig {
  title: string
}

export interface DialogueDisplay {
  x: string | number
  y: string | number
  position: 'left' | 'right' | string
}

/** 视线跟随；false 禁用 */
export interface GazeConfig {
  bone?: string
  /** 对称范围简写（骨架单位） */
  range?: number
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
  smoothTime?: number
}

/** 摸头；false 禁用 */
export interface PatConfig {
  bone?: string
  range?: number
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
  smoothTime?: number
}

/** 捏脸/特殊骨拖拽单项配置 */
export interface DragBoneConfig {
  bone: string
  radius?: number
  range?: number
  smoothTime?: number
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
  /** 命中判定锚点骨名（面部家族骨常用） */
  anchor?: string
  /** HandFollow 等带动画链的拖拽 */
  clips?: {
    start: string
    chain: string
    end: string
  }
}

export interface InteractionsConfig {
  gaze?: GazeConfig | false
  pat?: PatConfig | false
  /** false 禁用，数组覆盖自动探测 */
  dragBones?: DragBoneConfig[] | false
}

export interface MemorialLobby {
  name: string
  path: string
  skel: string
  atlas: string
  /** 语音 key → 当前语言文案 */
  voice?: Record<string, string>
  offset?: number
  dialogueDisplay?: DialogueDisplay
  interactions?: InteractionsConfig
}

export interface BioStudent {
  name: string
  path: string
  skel: string
  atlas: string
}

export interface BioBth {
  name: string
  path: string
}

export interface BioConfig {
  student?: BioStudent[]
  bth?: BioBth[]
}

/** 翻译文案；已知键为可选 string，另支持 bioContent 数组与任意扩展键 */
export interface TranslateConfig {
  about?: string
  projectWebsite?: string
  info?: string
  ifSkip?: string
  update?: string
  ok?: string
  cancel?: string
  bio?: string
  bioTitle?: string
  bioContent?: string[]
  prevPage?: string
  nextPage?: string
  walletApBattery?: string
  walletApRecover?: string
  walletGold?: string
  walletPyroxene?: string
  [key: string]: string | string[] | undefined
}

export interface AppConfig {
  title?: string
  description?: string
  favicon?: string
  author?: string
  keywords?: string
  url?: string
  ICP?: string
  gongan?: string
  icp?: ICPConfig
  iconfont?: string
  manifest?: ManifestConfig
  level?: number
  exp?: number
  nextExp?: number
  gold?: number
  pyroxene?: number
  dock?: DockItem[]
  contact?: ContactItem[]
  task?: TaskConfig
  banner?: BannerConfig
  memorialLobbies?: MemorialLobby[]
  bio?: BioConfig
  translate?: TranslateConfig
}

/** Compatibility aliases for parallel migrations / older call sites */
export type BoneOffsetConfig = GazeConfig & PatConfig & Partial<Pick<DragBoneConfig, 'radius' | 'anchor' | 'clips' | 'bone'>>
export type BoneInteractionConfig = BoneOffsetConfig
export type BoneFollowConfig = BoneOffsetConfig
export type BoneRangeConfig = BoneOffsetConfig
export type BoneDragRangeConfig = PatConfig
export type DragBoneItemConfig = DragBoneConfig
export type DragBoneConfigItem = DragBoneConfig
export type DragBoneClipConfig = NonNullable<DragBoneConfig['clips']>
export type DragBoneClips = DragBoneClipConfig
export type LobbyInteractions = InteractionsConfig
export type TranslateStrings = TranslateConfig
export type BioCard = BioBth
