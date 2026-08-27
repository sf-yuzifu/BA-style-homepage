// 语言映射配置
const LANGUAGE_MAP = {
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
  dock: [],
  contact: [],
  memorialLobbies: [],
  banner: {
    musicID: []
  }
}

/**
 * 自动检测浏览器语言
 * @param {Object} supportedLanguages - 支持的语言列表
 * @returns {string} 检测到的语言代码
 */
export function detectBrowserLanguage(supportedLanguages) {
  const browserLang = navigator.language || navigator.userLanguage

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
export function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    return DEFAULT_CONFIG
  }

  try {
    return {
      ...DEFAULT_CONFIG,
      ...config,

      // 确保数字字段安全
      level: Number(config.level) || DEFAULT_CONFIG.level,
      exp: Number(config.exp) || DEFAULT_CONFIG.exp,
      nextExp: Number(config.nextExp) || DEFAULT_CONFIG.nextExp,

      // 确保数组字段安全
      dock: Array.isArray(config.dock) ? config.dock : DEFAULT_CONFIG.dock,
      contact: Array.isArray(config.contact) ? config.contact : DEFAULT_CONFIG.contact,
      memorialLobbies: Array.isArray(config.memorialLobbies)
        ? config.memorialLobbies.map((lobby, index) => {
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
              }
            }
          })
        : DEFAULT_CONFIG.memorialLobbies,

      // 确保banner配置安全
      banner: {
        ...DEFAULT_CONFIG.banner,
        ...config.banner,
        musicID: Array.isArray(config.banner?.musicID)
          ? config.banner.musicID.map((id) => Number(id) || 0)
          : DEFAULT_CONFIG.banner.musicID
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
export function createConfigLoader(localeConfigs) {
  const loaders = {}

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
    async getConfig(locale) {
      const loader = loaders[locale]
      if (!loader) {
        console.warn(`不支持的语言: ${locale}`)
        return DEFAULT_CONFIG
      }
      return await loader()
    },

    getSupportedLocales() {
      return Object.keys(localeConfigs)
    }
  }
}
