import { computed } from 'vue'

import { useConfig } from '@/composables/useConfig'

const ORIGINAL_AUTHOR_KEYWORDS = ['小鱼', 'ゆづふ', 'yuzifu', 'Yuzifu', 'sf-yuzifu'] as const

export const isOriginalAuthorName = (author: string | undefined): boolean => {
  if (!author) return false
  return ORIGINAL_AUTHOR_KEYWORDS.some((keyword) =>
    author.toLowerCase().includes(keyword.toLowerCase())
  )
}

/** 关于页版权：原创作者不显示 Made by，fork 站点保留署名 */
export function useAboutCopyright() {
  const { configs } = useConfig()

  const isOriginalAuthor = computed(() => isOriginalAuthorName(configs.value?.author))
  const copyrightYear = computed(() => new Date().getFullYear())
  const authorName = computed(() => configs.value?.author ?? '')
  const isReady = computed(() => Boolean(configs.value?.author && configs.value?.translate))

  return {
    isOriginalAuthor,
    copyrightYear,
    authorName,
    isReady
  }
}
