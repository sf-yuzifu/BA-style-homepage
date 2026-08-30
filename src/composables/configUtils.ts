import type { AppConfig, LocaleCode, MemorialLobby } from '@/types/config'

// 语言映射配置
const LANGUAGE_MAP: Record<string, LocaleCode> = {
  zh: 'zh-CN',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'zh-HK': 'zh-TW',
  en: 'en-US',
  'en-US': 'en-US',
  'en-GB': 'en-US',
  ja: 'ja-JP',
  'ja-JP': 'ja-JP'
}

// 默认配置值
const DEFAULT_CONFIG = {
  level: 1,
  exp: 0,
  nextExp: 0,
  dock: [] as AppConfig['dock'],
  contact: [] as AppConfig['contact'],
  memorialLobbies: [] as NonNullable<AppConfig['memorialLobbies']>,
  banner: {
    musicID: [] as number[]
  }
} as AppConfig

export type LocaleConfigSource =
  AppConfig | Promise<AppConfig> | (() => AppConfig | Promise<AppConfig>)

/**
 * 自动检测浏览器语言
 * @param {Object} supportedLanguages - 支持的语言列表
 * @returns {string} 检测到的语言代码
 */
export function detectBrowserLanguage(supportedLanguages: string[]): LocaleCode | string {
  const browserLang = navigator.language || navigator.userLanguage || ''

  // 精确匹配
  if (LANGUAGE_MAP[browserLang] && supportedLanguages.includes(LANGUAGE_MAP[browserLang])) {
    return LANGUAGE_MAP[browserLang]
  }

  // 前缀匹配
  const prefix = browserLang.split('-')[0]
  if (LANGUAGE_MAP[prefix] && supportedLanguages.includes(LANGUAGE_MAP[prefix])) {
    return LANGUAGE_MAP[prefix]
  }

  // 默认返回英语
  return 'en-US'
}

/**
 * 验证和清理配置数据
 * @param {Object} config - 原始配置
 * @returns {Object} 验证后的安全配置
 */
export function validateConfig(config: unknown): AppConfig {
  if (!config || typeof config !== 'object') {
    return DEFAULT_CONFIG
  }

  const raw = config as Partial<AppConfig>

  try {
    return {
      ...DEFAULT_CONFIG,
      ...raw,

      // 确保数字字段安全
      level: Number(raw.level) || DEFAULT_CONFIG.level,
      exp: Number(raw.exp) || DEFAULT_CONFIG.exp,
      nextExp: Number(raw.nextExp) || DEFAULT_CONFIG.nextExp,

      // 确保数组字段安全
      dock: Array.isArray(raw.dock) ? raw.dock : DEFAULT_CONFIG.dock,
      contact: Array.isArray(raw.contact) ? raw.contact : DEFAULT_CONFIG.contact,
      memorialLobbies: Array.isArray(raw.memorialLobbies)
        ? raw.memorialLobbies.map((lobby: Partial<MemorialLobby>, index: number) => {
            // 确保每个纪念大厅配置都有必需的属性
            return {
              name: lobby.name || `角色${index}`,
              path: lobby.path || '/l2d/',
              skel: lobby.skel || 'default.skel',
              atlas: lobby.atlas || 'default.atlas',
              voice: lobby.voice || {},
              offset: lobby.offset ?? 0.5,
              dialogueDisplay: lobby.dialogueDisplay || {
                x: 0,
                y: 0,
                position: 'left'
              },
              // 交互动效配置（gaze/pat/dragBones，全部可选，缺省自动探测骨骼）
              interactions:
                lobby.interactions && typeof lobby.interactions === 'object'
                  ? lobby.interactions
                  : {}
            }
          })
        : DEFAULT_CONFIG.memorialLobbies,

      // 确保banner配置安全
      banner: {
        ...DEFAULT_CONFIG.banner,
        ...raw.banner,
        musicID: Array.isArray(raw.banner?.musicID)
          ? raw.banner.musicID.map((id) => Number(id) || 0)
          : (DEFAULT_CONFIG.banner?.musicID ?? [])
      }
    }
  } catch (error) {
    console.error('配置验证失败:', error)
    return DEFAULT_CONFIG
  }
}

/**
 * 创建语言配置加载器
 * @param {Object} localeConfigs - 各语言配置文件
 * @returns {Object} 配置加载器方法
 */
export function createConfigLoader(localeConfigs: Record<string, LocaleConfigSource>) {
  const loaders: Record<string, () => Promise<AppConfig>> = {}

  // 预加载所有语言配置
  for (const [locale, config] of Object.entries(localeConfigs)) {
    loaders[locale] = async () => {
      try {
        // 支持三种配置形式：静态对象 / Promise / 动态加载函数（() => import(...)）
        const loadedConfig = await Promise.resolve(typeof config === 'function' ? config() : config)
        return validateConfig(loadedConfig)
      } catch (error) {
        console.error(`加载语言配置失败 [${locale}]:`, error)
        return DEFAULT_CONFIG
      }
    }
  }

  return {
    async getConfig(locale: string): Promise<AppConfig> {
      const loader = loaders[locale]
      if (!loader) {
        console.warn(`不支持的语言: ${locale}`)
        return DEFAULT_CONFIG
      }
      return await loader()
    },

    getSupportedLocales(): string[] {
      return Object.keys(localeConfigs)
    }
  }
}
