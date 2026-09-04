import { computed, type Component } from 'vue'
import { Icon } from '@arco-design/web-vue'
import { useConfig } from './useConfig'

type IconFontComponent = ReturnType<typeof Icon.addFromIconFontCn> | Component

/** 仓库内置 iconfont JS，fork 无需依赖作者阿里 CDN 项目 */
export const DEFAULT_ICONFONT_SRC = '/js/iconfont.js'

// IconFont 组件与已注入 URL 的模块级缓存：
// Icon.addFromIconFontCn 每次调用都会向 document 注入一个 <script>（以 data-namespace 标记 src），
// 经 URL 判重缓存后，整个应用生命周期内同一 URL 只注入一次
// （Header/Footer/Contact 共享，语言切换导致 computed 重算也不会重复注入）
let cachedUrl = ''
let cachedIconFont: IconFontComponent | null = null

export function useIconFont() {
  const { configs } = useConfig()

  const iconFontSrc = computed(() => configs.value?.iconfont?.trim() || DEFAULT_ICONFONT_SRC)

  const IconFont = computed(() => {
    const url = iconFontSrc.value
    if (url !== cachedUrl) {
      // 换 URL 时摘掉上一个 <script>，避免旧 iconfont 残留。
      // 已加载的 symbol 雪碧图驻留 DOM，摘除 script 不影响已渲染图标；
      // arco 内部 scriptUrlCache 不会因摘除而重注入，切回旧 URL 时图标仍可用
      if (cachedUrl) {
        document.querySelector(`script[data-namespace="${CSS.escape(cachedUrl)}"]`)?.remove()
      }
      cachedUrl = url
      cachedIconFont = Icon.addFromIconFontCn({ src: url }) as IconFontComponent
    }
    return cachedIconFont
  })

  return { IconFont, iconFontSrc }
}
