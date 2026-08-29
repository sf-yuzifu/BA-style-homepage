import { computed, type Component } from 'vue'
import { Icon } from '@arco-design/web-vue'
import { useConfig } from './useConfig'

type IconFontComponent = ReturnType<typeof Icon.addFromIconFontCn> | Component

// IconFont 组件与已注入 URL 的模块级缓存：
// Icon.addFromIconFontCn 每次调用都会向 document 注入一个 <script>，
// 经 URL 判重缓存后，整个应用生命周期内同一 URL 只注入一次
// （Header/Footer/Contact 共享，语言切换导致 computed 重算也不会重复注入）
let cachedUrl = ''
let cachedIconFont: IconFontComponent | null = null

export function useIconFont() {
  const { configs } = useConfig()

  const IconFont = computed(() => {
    const url = configs.value?.iconfont || ''
    if (!url) return null
    if (url !== cachedUrl) {
      cachedUrl = url
      cachedIconFont = Icon.addFromIconFontCn({ src: url }) as IconFontComponent
    }
    return cachedIconFont
  })

  return { IconFont }
}
