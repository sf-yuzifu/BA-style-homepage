import { computed } from 'vue'
import { Icon } from '@arco-design/web-vue'
import { useConfig } from './useConfig'

// IconFont 组件与已注入 URL 的模块级缓存：
// Icon.addFromIconFontCn 每次调用都会向 document 注入一个 <script>，
// 经 URL 判重缓存后，整个应用生命周期内同一 URL 只注入一次
// （Header/Footer/Contact 共享，语言切换导致 computed 重算也不会重复注入）
let cachedUrl = ''
let cachedIconFont = null

export function useIconFont() {
  const { configs } = useConfig()

  const IconFont = computed(() => {
    const url = configs.value?.iconfont || ''
    if (!url) return null
    if (url !== cachedUrl) {
      cachedUrl = url
      cachedIconFont = Icon.addFromIconFontCn({ src: url })
    }
    return cachedIconFont
  })

  return { IconFont }
}
