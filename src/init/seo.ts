import { watch } from 'vue'
import type { RouteLocationNormalized } from 'vue-router'

import { useConfig } from '@/composables/useConfig'
import type { AppConfig, LocaleCode } from '@/types/config'
import router from '@/router'

const JSON_LD_ID = 'site-jsonld-person'
const OG_LOCALE_ALTERNATE_SELECTOR = 'meta[property="og:locale:alternate"]'

const LOCALE_TO_OG: Record<LocaleCode, string> = {
  'zh-CN': 'zh_CN',
  'zh-TW': 'zh_TW',
  'en-US': 'en_US',
  'ja-JP': 'ja_JP'
}

const SUPPORTED_LOCALES = Object.keys(LOCALE_TO_OG) as LocaleCode[]

export function localeToOgLocale(locale: string): string {
  return LOCALE_TO_OG[locale as LocaleCode] ?? locale.replace('-', '_')
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setJsonLd(id: string, data: Record<string, unknown>) {
  let script = document.getElementById(id) as HTMLScriptElement | null
  if (!script) {
    script = document.createElement('script')
    script.id = id
    script.type = 'application/ld+json'
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(data)
}

function pageTitle(config: AppConfig, route: RouteLocationNormalized): string {
  const baseTitle = config.title || '个人主页'
  const key = route.meta?.titleKey as string | undefined
  const translated = key ? config.translate?.[key] : ''
  const subTitle = typeof translated === 'string' ? translated : ''
  return subTitle ? `${subTitle} - ${baseTitle}` : baseTitle
}

function pageUrl(baseUrl: string, route: RouteLocationNormalized): string {
  if (!baseUrl) return ''
  const path = route.path
  if (path === '/' || path === '') return `${baseUrl}/`
  return `${baseUrl}${path.replace(/\/$/, '')}`
}

function updateOgLocaleAlternates(activeLocale: string) {
  document.querySelectorAll(OG_LOCALE_ALTERNATE_SELECTOR).forEach((el) => el.remove())
  for (const code of SUPPORTED_LOCALES) {
    if (code === activeLocale) continue
    const meta = document.createElement('meta')
    meta.setAttribute('property', 'og:locale:alternate')
    meta.setAttribute('content', LOCALE_TO_OG[code])
    document.head.appendChild(meta)
  }
}

function applySeo(config: AppConfig, locale: string, route: RouteLocationNormalized) {
  const description = config.description || ''
  const keywords = config.keywords || ''
  const title = pageTitle(config, route)
  const ogLocale = localeToOgLocale(locale)
  const baseUrl = (config.url || '').replace(/\/+$/, '')
  const pageAbsoluteUrl = pageUrl(baseUrl, route)
  const ogImage = baseUrl ? `${baseUrl}/og-home.jpg` : '/og-home.jpg'
  const isBio = route.name === 'Bio'
  const ogImageForPage = isBio && baseUrl ? `${baseUrl}/og-bio.jpg` : ogImage

  if (description) setMeta('name', 'description', description)
  if (keywords) setMeta('name', 'keywords', keywords)

  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:locale', ogLocale)
  setMeta('property', 'og:image', ogImageForPage)
  setMeta('name', 'twitter:title', title)
  setMeta('name', 'twitter:description', description)
  setMeta('name', 'twitter:image', ogImageForPage)

  if (pageAbsoluteUrl) {
    setMeta('property', 'og:url', pageAbsoluteUrl)
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = pageAbsoluteUrl
  }

  updateOgLocaleAlternates(locale)

  const person: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: config.author || config.title || '个人主页'
  }
  if (description) person.description = description
  if (baseUrl) {
    person.url = `${baseUrl}/`
    person.image = ogImage
  } else if (config.favicon) {
    person.image = config.favicon
  }
  // sameAs：联系方式链接，帮助搜索引擎关联同名社交账号（dock 是项目链接，不入 sameAs）
  const sameAs = (config.contact ?? [])
    .map((item) => item.href)
    .filter((href): href is string => typeof href === 'string' && /^https?:\/\//i.test(href))
  if (sameAs.length > 0) person.sameAs = sameAs
  setJsonLd(JSON_LD_ID, person)
}

/** 随语言与路由同步 description / OG / JSON-LD Person */
export function initSiteSeo() {
  const { configs, locale } = useConfig()

  const refresh = () => {
    const config = configs.value
    if (!config) return
    applySeo(config, locale.value, router.currentRoute.value)
  }

  watch([configs, locale], refresh)
  watch(() => router.currentRoute.value, refresh)
}
