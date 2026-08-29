import { ref, computed } from 'vue'
import { useConfig } from './useConfig'

interface WalletPersistedState {
  ap?: number
  apSettleAt?: number
  gold?: number
  dwellSeconds?: number
  pyroxene?: number
  signInDays?: number
  lastSignIn?: string
}

// 钱包状态（模块级单例：Toolbox 与 Header 共享同一份数据）
const apLocal = ref(0) // 时间恢复模型的体力值（电池模式下不使用）
const gold = ref(0)
const pyroxene = ref(0)
const batteryLevel = ref<number | null>(null) // 设备电量 0-1；null 表示不支持 Battery API，走时间恢复模型
const dwellSeconds = ref(0) // 累计停留秒数（信用点 tooltip 展示用）
const signInDays = ref(0) // 连续签到天数（青辉石 tooltip 展示用）

const STORAGE_KEY = 'fa-wallet'
const AP_RECOVER_MS = 6 * 60 * 1000 // 体力恢复间隔（与 BA 一致：每 6 分钟回复 1 点）
const GOLD_PER_SECOND = 6 // 信用点积累速率（陪伴时长，每秒 +6）
const SIGNIN_REWARD = 40 // 每日首次访问签到奖励（BA 每日任务同款 40 青辉石）
const SAVE_INTERVAL_TICKS = 5 // 每 5 个 tick（5 秒）持久化一次

let apSettleAt = Date.now() // 时间恢复模型的上次结算时间
let lastSignIn = '' // 上次签到日期（本地时区 YYYY-MM-DD）
let tickCount = 0
let initialized = false

// localStorage 在隐私模式等场景可能不可用，静默降级为仅本次会话生效
const loadState = (): WalletPersistedState => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) as string) || {}
  } catch {
    return {}
  }
}

const saveState = () => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ap: apLocal.value,
        apSettleAt,
        gold: gold.value,
        dwellSeconds: dwellSeconds.value,
        pyroxene: pyroxene.value,
        signInDays: signInDays.value,
        lastSignIn
      })
    )
  } catch {
    /* 忽略持久化失败 */
  }
}

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// 每日首次访问签到：+40 青辉石；连续天数跨日累计、断签重置
const checkSignIn = () => {
  const today = localDate()
  if (lastSignIn === today) return
  const yesterday = localDate(new Date(Date.now() - 24 * 60 * 60 * 1000))
  signInDays.value = lastSignIn === yesterday ? signInDays.value + 1 : 1
  pyroxene.value += SIGNIN_REWARD
  lastSignIn = today
}

// 体力时间恢复模型（Battery API 不可用时的降级方案）：
// 每 6 分钟回复 1 点，结算时间持久化，离线期间也会补算
const settleAp = (maxApValue: number) => {
  if (batteryLevel.value !== null) return
  const now = Date.now()
  const recovered = Math.floor((now - apSettleAt) / AP_RECOVER_MS)
  if (recovered <= 0) return
  apLocal.value = Math.min(maxApValue, apLocal.value + recovered)
  // 回满后直接对齐当前时间，不积攒溢出的恢复进度
  apSettleAt = apLocal.value >= maxApValue ? now : apSettleAt + recovered * AP_RECOVER_MS
}

export function useWallet() {
  const { configs } = useConfig()

  const maxAp = computed(() => {
    if (!configs.value || !configs.value.level) return 60
    return 60 + configs.value.level * 2
  })

  // 电池模式下体力 = 电量百分比 × 上限；否则使用时间恢复模型的本地值
  const ap = computed(() =>
    batteryLevel.value !== null ? Math.round(batteryLevel.value * maxAp.value) : apLocal.value
  )

  // 初始化钱包（需在配置加载完成后调用，main.ts 已保证顺序；应用生命周期内只执行一次）
  const initWallet = () => {
    if (initialized) return
    initialized = true

    const state = loadState()

    // 信用点与青辉石：首次运行以 _config.yaml 的配置值为初始值，之后由本地累计接管
    gold.value = state.gold ?? configs.value?.gold ?? 0
    pyroxene.value = state.pyroxene ?? configs.value?.pyroxene ?? 0
    dwellSeconds.value = state.dwellSeconds ?? 0
    signInDays.value = state.signInDays ?? 0
    lastSignIn = state.lastSignIn ?? ''
    // 体力：首次运行满体力；电池模式接入后会被电量直接取代
    apLocal.value = state.ap ?? maxAp.value
    apSettleAt = state.apSettleAt ?? Date.now()

    checkSignIn()

    // 优先使用 Battery API（仅 Chromium 系支持）：体力 = 设备电量
    if (typeof navigator.getBattery === 'function') {
      navigator
        .getBattery()
        .then((b) => {
          batteryLevel.value = b.level
          b.addEventListener('levelchange', () => {
            batteryLevel.value = b.level
          })
        })
        .catch(() => {
          batteryLevel.value = null // 获取失败，保持时间恢复模型
        })
    }
    settleAp(maxAp.value)

    // 统一心跳 tick（应用生命周期内常驻，与原 initAp 一致不做清理）
    setInterval(() => {
      // 仅在页面可见时累计陪伴时长与信用点
      if (document.visibilityState === 'visible') {
        dwellSeconds.value++
        gold.value += GOLD_PER_SECOND
      }
      settleAp(maxAp.value)
      checkSignIn() // 挂机跨午夜时自动补签次日
      tickCount++
      if (tickCount % SAVE_INTERVAL_TICKS === 0) saveState()
    }, 1000)

    window.addEventListener('pagehide', saveState)
  }

  // tooltip 文案（i18n，占位符在此替换）
  const apTooltip = computed(() => {
    const t = configs.value?.translate
    if (batteryLevel.value !== null) {
      return (t?.walletApBattery || 'Battery sync: {percent}%').replace(
        '{percent}',
        String(Math.round(batteryLevel.value * 100))
      )
    }
    return t?.walletApRecover || 'Recovers 1 AP every 6 minutes'
  })

  const goldTooltip = computed(() => {
    const t = configs.value?.translate
    const hours = (dwellSeconds.value / 3600).toFixed(1)
    return (t?.walletGold || '{hours} hours spent together').replace('{hours}', hours)
  })

  const pyroxeneTooltip = computed(() => {
    const t = configs.value?.translate
    return (t?.walletPyroxene || 'Daily sign-in streak: {days}').replace(
      '{days}',
      String(signInDays.value)
    )
  })

  return {
    ap,
    maxAp,
    gold,
    pyroxene,
    apTooltip,
    goldTooltip,
    pyroxeneTooltip,
    initWallet
  }
}
