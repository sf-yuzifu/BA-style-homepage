import { ref, computed, watch } from 'vue'
import baseConfig from '/_config.yaml'
import { detectBrowserLanguage, createConfigLoader } from './configUtils'

// 深度合并配置对象
function deepMerge(base, override) {
  if (typeof base !== 'object' || base === null) return override
  if (typeof override !== 'object' || override === null) return override

  const result = { ...base }

  for (const key in override) {
    if (key in result && typeof result[key] === 'object' && typeof override[key] === 'object') {
      // 特别处理数组类型的合并（memorialLobbies等）
      if (Array.isArray(result[key]) && Array.isArray(override[key])) {
        // 对于数组，按照索引进行对象合并
        result[key] = result[key].map((baseItem, index) => {
          const overrideItem = override[key][index]
          if (overrideItem && typeof overrideItem === 'object') {
            return deepMerge(baseItem, overrideItem)
          }
          return baseItem
        })

        // 如果翻译数组比基础数组长，添加新的项目
        if (override[key].length > result[key].length) {
          for (let i = result[key].length; i < override[key].length; i++) {
            result[key].push(override[key][i])
          }
        }
      } else {
        result[key] = deepMerge(result[key], override[key])
      }
    } else {
      result[key] = override[key]
    }
  }

  return result
}

// 特殊处理YAML数组索引语法的合并（如 memorialLobbies[0]: voice: ...）
function mergeArraysWithIndexOverrides(baseArray, translations) {
  if (!Array.isArray(baseArray)) {
    return baseArray
  }

  const result = [...baseArray]
  // 合并数组元素
  for (let i = 0; i < baseArray.length; i++) {
    const indexKey = `memorialLobbies[${i}]`
    if (translations[indexKey]) {
      result[i] = deepMerge(result[i], translations[indexKey])
    }
  }

  if (Array.isArray(translations.memorialLobbies)) {
    for (let i = 0; i < Math.min(translations.memorialLobbies.length, result.length); i++) {
      if (typeof translations.memorialLobbies[i] === 'object') {
        result[i] = deepMerge(result[i], translations.memorialLobbies[i])
      }
    }
  }

  return result
}

// 创建完整的配置（基础配置 + 翻译）
function createLocaleConfig(base, translations) {
  if (!translations || typeof translations !== 'object') {
    return base
  }

  // 首先进行基础合并
  const result = deepMerge(base, translations)

  // 特别处理 memorialLobbies 的数组合并
  if (Array.isArray(base.memorialLobbies) && translations) {
    result.memorialLobbies = mergeArraysWithIndexOverrides(base.memorialLobbies, translations)
  }

  return result
}

// 语言包动态加载：各语言拆为独立 chunk，仅按需加载当前语言，
// 其余语言的翻译（含全部 voice 文案）不再打进主 chunk
// 每个 loader 记忆化合并结果（Promise 缓存），重复切换语言时无需重新加载与合并
const createLocaleLoader = (importFn) => {
  let cached = null
  return () => {
    if (!cached) {
      cached = importFn().then((m) => createLocaleConfig(baseConfig, m.default))
    }
    return cached
  }
}

// 支持的语言配置
const localeConfigs = {
  'zh-CN': createLocaleLoader(() => import('../locales/zh-CN.yaml')),
  'zh-TW': createLocaleLoader(() => import('../locales/zh-TW.yaml')),
  'en-US': createLocaleLoader(() => import('../locales/en-US.yaml')),
  'ja-JP': createLocaleLoader(() => import('../locales/ja-JP.yaml'))
}

// 创建配置加载器
const configLoader = createConfigLoader(localeConfigs)

// 全局状态（单例模式）
let globalCurrentLocale = ref('en-US')
let globalCurrentConfig = ref(null)
let globalIsLoading = ref(false)
let globalIsInitialized = ref(false)
let globalIsInitializing = ref(false)
// 配置加载代际：每次发起新加载递增，仅最新一代的结果允许写入全局配置。
// 修复语言切换竞态：旧实现在加载中直接 return 丢弃新语言请求，
// 导致 locale 已是新语言、配置仍是旧语言（在途旧请求完成后覆盖）
let configLoadToken = 0

export function useConfig() {
  // 初始化语言（只在第一次执行）
  const initLocale = () => {
    if (globalIsInitialized.value) return // 防止重复初始化

    try {
      const detectedLang = detectBrowserLanguage(configLoader.getSupportedLocales())
      globalCurrentLocale.value = detectedLang
      globalIsInitialized.value = true
      // 同步页面语言标记，利于SEO与无障碍
      document.documentElement.lang = detectedLang

      console.log('语言检测完成:', {
        最终语言: detectedLang,
        浏览器语言: navigator.language || navigator.userLanguage,
        支持语言: configLoader.getSupportedLocales()
      })
    } catch (error) {
      console.error('语言检测失败:', error)
      globalCurrentLocale.value = 'en-US' // 备用语言
      globalIsInitialized.value = true
    }
  }

  // 加载配置（语言切换等新请求会取代在途请求：旧请求结果按代际丢弃，不再直接 return 丢弃新请求）
  const loadConfig = async () => {
    const token = ++configLoadToken

    globalIsLoading.value = true
    globalIsInitializing.value = true
    try {
      const config = await configLoader.getConfig(globalCurrentLocale.value)
      if (token !== configLoadToken) return // 已有更新的加载请求，丢弃过期结果
      globalCurrentConfig.value = config
    } catch (error) {
      if (token !== configLoadToken) return
      console.error('加载配置失败:', error)
      // 使用默认配置
      globalCurrentConfig.value = {
        level: 1,
        exp: 0,
        nextExp: 0,
        dock: [],
        contact: [],
        memorialLobbies: [],
        banner: { musicID: [] },
        title: '个人主页',
        translate: {
          info: '更新提示',
          update: '检测到新版本，是否立即更新？',
          ok: '立即更新',
          cancel: '稍后更新'
        }
      }
    } finally {
      // 仅最新一代负责复位加载标记，过期一代不得误清新请求的状态
      if (token === configLoadToken) {
        globalIsLoading.value = false
        globalIsInitializing.value = false
      }
    }
  }

  // 异步初始化配置（只在第一次调用时执行）
  const initializeConfig = async () => {
    if (globalIsInitialized.value) return // 已初始化，直接返回

    initLocale()
    await loadConfig()
  }

  // 确保只执行一次初始化
  if (!globalIsInitialized.value && !globalIsInitializing.value) {
    initializeConfig()
  }

  // 响应式配置对象
  const configs = computed(() => globalCurrentConfig.value)

  // 等待配置加载完成
  const waitForConfig = () => {
    return new Promise((resolve, reject) => {
      if (!globalIsLoading.value && globalCurrentConfig.value) {
        resolve(globalCurrentConfig.value)
        return
      }

      const unwatch = watch([globalIsLoading, globalCurrentConfig], ([loading, config]) => {
        if (!loading && config) {
          unwatch()
          resolve(config)
        }
      })

      // 超时处理
      setTimeout(() => {
        unwatch()
        if (globalCurrentConfig.value) {
          resolve(globalCurrentConfig.value)
        } else {
          reject(new Error('配置加载超时'))
        }
      }, 10000) // 10秒超时
    })
  }

  // 手动切换语言
  const setLocale = (locale) => {
    if (configLoader.getSupportedLocales().includes(locale)) {
      globalCurrentLocale.value = locale
      // 同步页面语言标记
      document.documentElement.lang = locale
      loadConfig()
      console.log('语言已切换为:', locale)
    } else {
      console.warn(`不支持的语言: ${locale}`)
    }
  }

  // 获取当前语言
  const getCurrentLocale = () => {
    return globalCurrentLocale.value
  }

  return {
    // 响应式配置对象
    configs,
    // 当前语言
    currentLocale: globalCurrentLocale,
    // 当前语言（兼容旧版本）
    locale: globalCurrentLocale,
    // 加载状态
    isLoading: globalIsLoading,
    // 支持的语言列表
    availableLocales: configLoader.getSupportedLocales(),
    // 方法
    setLocale,
    getCurrentLocale,
    reloadConfig: loadConfig,
    waitForConfig
  }
}
