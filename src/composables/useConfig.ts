import { ref, computed, watch, type Ref } from 'vue'
import baseConfig from '/_config.yaml'
import type { AppConfig, LocaleCode, MemorialLobby } from '@/types/config'
import { detectBrowserLanguage, createConfigLoader } from './configUtils'

/** 设置里的语言偏好：`auto` 跟随浏览器，否则固定为某一语言包 */
export type LocalePreference = 'auto' | LocaleCode

const LOCALE_STORAGE_KEY = 'fa-locale'
const SUPPORTED_LOCALES: LocaleCode[] = ['zh-CN', 'zh-TW', 'en-US', 'ja-JP']

const isLocaleCode = (value: string): value is LocaleCode =>
  SUPPORTED_LOCALES.includes(value as LocaleCode)

const parseLocalePreference = (raw: string | null): LocalePreference => {
  if (!raw || raw === 'auto') return 'auto'
  if (isLocaleCode(raw)) return raw
  return 'auto'
}

const readLocalePreference = (): LocalePreference => {
  try {
    return parseLocalePreference(localStorage.getItem(LOCALE_STORAGE_KEY))
  } catch {
    /* 隐私模式等场景可能不可写 */
  }
  return 'auto'
}

const persistLocalePreference = (pref: LocalePreference) => {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, pref)
  } catch {
    /* 忽略持久化失败 */
  }
}

// 深度合并配置对象
function deepMerge<T>(base: T, override: unknown): T {
  if (typeof base !== 'object' || base === null) return override as T
  if (typeof override !== 'object' || override === null) return override as T

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  const overrideObj = override as Record<string, unknown>

  for (const key in overrideObj) {
    if (key in result && typeof result[key] === 'object' && typeof overrideObj[key] === 'object') {
      // 特别处理数组类型的合并（memorialLobbies等）
      if (Array.isArray(result[key]) && Array.isArray(overrideObj[key])) {
        // 对于数组，按照索引进行对象合并
        const baseArr = result[key] as unknown[]
        const overrideArr = overrideObj[key] as unknown[]
        result[key] = baseArr.map((baseItem, index) => {
          const overrideItem = overrideArr[index]
          if (overrideItem && typeof overrideItem === 'object') {
            return deepMerge(baseItem, overrideItem)
          }
          return baseItem
        })

        // 如果翻译数组比基础数组长，添加新的项目
        if (overrideArr.length > (result[key] as unknown[]).length) {
          for (let i = (result[key] as unknown[]).length; i < overrideArr.length; i++) {
            ;(result[key] as unknown[]).push(overrideArr[i])
          }
        }
      } else {
        result[key] = deepMerge(result[key], overrideObj[key])
      }
    } else {
      result[key] = overrideObj[key]
    }
  }

  return result as T
}

// 特殊处理YAML数组索引语法的合并（如 memorialLobbies[0]: voice: ...）
function mergeArraysWithIndexOverrides(
  baseArray: MemorialLobby[],
  translations: Record<string, unknown>
): MemorialLobby[] {
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
function createLocaleConfig(base: AppConfig, translations: unknown): AppConfig {
  if (!translations || typeof translations !== 'object') {
    return base
  }

  const translationsObj = translations as Record<string, unknown>

  // 首先进行基础合并
  const result = deepMerge(base, translationsObj)

  // 特别处理 memorialLobbies 的数组合并
  if (Array.isArray(base.memorialLobbies) && translationsObj) {
    result.memorialLobbies = mergeArraysWithIndexOverrides(base.memorialLobbies, translationsObj)
  }

  return result
}

// 语言包动态加载：各语言拆为独立 chunk，仅按需加载当前语言，
// 其余语言的翻译（含全部 voice 文案）不再打进主 chunk
// 每个 loader 记忆化合并结果（Promise 缓存），重复切换语言时无需重新加载与合并
const createLocaleLoader = (importFn: () => Promise<{ default: AppConfig }>) => {
  let cached: Promise<AppConfig> | null = null
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
const globalCurrentLocale = ref('en-US')
const globalLocalePreference = ref<LocalePreference>('auto')
const globalCurrentConfig: Ref<AppConfig | null> = ref(null)
const globalIsLoading = ref(false)
const globalIsInitialized = ref(false)
const globalIsInitializing = ref(false)
// 配置加载代际：每次发起新加载递增，仅最新一代的结果允许写入全局配置。
// 修复语言切换竞态：旧实现在加载中直接 return 丢弃新语言请求，
// 导致 locale 已是新语言、配置仍是旧语言（在途旧请求完成后覆盖）
let configLoadToken = 0
/** 语言切换触发的配置重载：跳过一次 Start_Idle，保持当前 HUD / 待机姿态 */
let localeChangePending = false
let localeStorageSyncRegistered = false

export function markLocaleChangePending() {
  localeChangePending = true
}

export function consumeLocaleChangePending(): boolean {
  if (!localeChangePending) return false
  localeChangePending = false
  return true
}

const resolveActiveLocale = (pref: LocalePreference): string => {
  if (pref !== 'auto') return pref
  return detectBrowserLanguage(configLoader.getSupportedLocales())
}

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

const syncLocaleFromStorage = (raw: string | null) => {
  const preference = parseLocalePreference(raw)
  const locale = resolveActiveLocale(preference)
  if (preference === globalLocalePreference.value && locale === globalCurrentLocale.value) return

  globalLocalePreference.value = preference
  markLocaleChangePending()
  globalCurrentLocale.value = locale
  document.documentElement.lang = locale
  loadConfig()
}

const registerLocaleStorageSync = () => {
  if (localeStorageSyncRegistered) return
  localeStorageSyncRegistered = true
  window.addEventListener('storage', (event) => {
    if (event.key !== LOCALE_STORAGE_KEY) return
    syncLocaleFromStorage(event.newValue)
  })
}

export function useConfig() {
  // 初始化语言（只在第一次执行）
  const initLocale = () => {
    if (globalIsInitialized.value) return // 防止重复初始化

    try {
      const preference = readLocalePreference()
      globalLocalePreference.value = preference
      const detectedLang = resolveActiveLocale(preference)
      globalCurrentLocale.value = detectedLang
      globalIsInitialized.value = true
      registerLocaleStorageSync()
      // 同步页面语言标记，利于SEO与无障碍
      document.documentElement.lang = detectedLang

      console.log('语言检测完成:', {
        偏好: preference,
        最终语言: detectedLang,
        浏览器语言: navigator.language || navigator.userLanguage,
        支持语言: configLoader.getSupportedLocales()
      })
    } catch (error) {
      console.error('语言检测失败:', error)
      globalCurrentLocale.value = 'en-US' // 备用语言
      globalIsInitialized.value = true
      registerLocaleStorageSync()
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
  } else {
    registerLocaleStorageSync()
  }

  // 响应式配置对象
  const configs = computed(() => globalCurrentConfig.value)

  // 等待配置加载完成
  const waitForConfig = (): Promise<AppConfig> => {
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

  const setLocalePreference = (preference: LocalePreference) => {
    if (preference !== 'auto' && !configLoader.getSupportedLocales().includes(preference)) {
      console.warn(`不支持的语言: ${preference}`)
      return
    }
    globalLocalePreference.value = preference
    persistLocalePreference(preference)
    markLocaleChangePending()
    const locale = resolveActiveLocale(preference)
    globalCurrentLocale.value = locale
    document.documentElement.lang = locale
    loadConfig()
    console.log('语言偏好已更新:', { preference, locale })
  }

  // 手动切换语言（等同设置里选定具体语言包）
  const setLocale = (locale: string) => {
    if (isLocaleCode(locale)) {
      setLocalePreference(locale)
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
    localePreference: globalLocalePreference,
    // 当前语言（兼容旧版本）
    locale: globalCurrentLocale,
    // 加载状态
    isLoading: globalIsLoading,
    // 支持的语言列表
    availableLocales: configLoader.getSupportedLocales(),
    // 方法
    setLocale,
    setLocalePreference,
    getCurrentLocale,
    reloadConfig: loadConfig,
    waitForConfig
  }
}
