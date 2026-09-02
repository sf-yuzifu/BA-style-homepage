import fs from 'node:fs'
import path from 'node:path'

import { load } from 'js-yaml'
import { z } from 'zod'
import type { Plugin } from 'vite'

const LOCALES = ['zh-CN', 'zh-TW', 'en-US', 'ja-JP'] as const
const LOBBY_INDEX_KEY = /^memorialLobbies\[(\d+)\]$/

const nonEmpty = z.string().min(1, '不能为空')

const manifestIconSchema = z.strictObject({
  src: nonEmpty,
  sizes: nonEmpty,
  purpose: z.string().optional()
})

const manifestSchema = z.strictObject({
  name: nonEmpty,
  short_name: nonEmpty,
  description: z.string().optional(),
  theme_color: nonEmpty,
  start_url: nonEmpty,
  id: nonEmpty,
  icons: z.array(manifestIconSchema).min(1, '至少需要一个图标')
})

const dockItemSchema = z.strictObject({
  name: nonEmpty,
  href: z.string().optional(),
  imgSrc: z.string().optional(),
  iconfont: z.string().optional()
})

const contactItemSchema = z.strictObject({
  name: nonEmpty,
  href: z.string().optional(),
  imgSrc: z.string().optional(),
  iconfont: z.string().optional()
})

const dialogueDisplaySchema = z.strictObject({
  mode: z.enum(['auto', 'manual']).optional(),
  bone: z.string().optional(),
  offsetX: z.number().optional(),
  offsetY: z.number().optional(),
  side: z.enum(['auto', 'left', 'right']).optional(),
  x: z.union([z.number(), nonEmpty]).optional(),
  y: z.union([z.number(), nonEmpty]).optional(),
  position: z.enum(['left', 'right']).optional()
})

const boneRangeSchema = z.strictObject({
  bone: z.string().optional(),
  range: z.number().optional(),
  minX: z.number().optional(),
  maxX: z.number().optional(),
  minY: z.number().optional(),
  maxY: z.number().optional(),
  smoothTime: z.number().optional()
})

const dragBoneSchema = z.strictObject({
  bone: nonEmpty,
  radius: z.number().optional(),
  range: z.number().optional(),
  smoothTime: z.number().optional(),
  minX: z.number().optional(),
  maxX: z.number().optional(),
  minY: z.number().optional(),
  maxY: z.number().optional(),
  anchor: z.string().optional(),
  clips: z
    .strictObject({
      start: nonEmpty,
      chain: nonEmpty,
      end: nonEmpty
    })
    .optional()
})

const interactionsSchema = z.strictObject({
  gaze: z.union([z.literal(false), boneRangeSchema]).optional(),
  pat: z.union([z.literal(false), boneRangeSchema]).optional(),
  dragBones: z.union([z.literal(false), z.array(dragBoneSchema)]).optional()
})

const memorialLobbySchema = z.strictObject({
  name: nonEmpty,
  path: nonEmpty,
  skel: nonEmpty,
  atlas: nonEmpty,
  voice: z.record(z.string(), z.string()).optional(),
  offset: z.number().optional(),
  dialogueDisplay: dialogueDisplaySchema.optional(),
  interactions: interactionsSchema.optional()
})

const bioStudentSchema = z.strictObject({
  name: nonEmpty,
  path: nonEmpty,
  skel: nonEmpty,
  atlas: nonEmpty
})

const bioBtnSchema = z.strictObject({
  name: nonEmpty,
  path: nonEmpty
})

const bioConfigSchema = z
  .strictObject({
    student: z.array(bioStudentSchema).optional(),
    btn: z.array(bioBtnSchema).optional(),
    bth: z.array(bioBtnSchema).optional()
  })
  .transform(({ student, btn, bth }) => ({
    student,
    btn: btn ?? bth
  }))

const siteConfigSchema = z.strictObject({
  title: nonEmpty,
  description: z.string().optional(),
  favicon: nonEmpty,
  author: nonEmpty,
  keywords: z.string().optional(),
  url: z.string().optional(),
  ICP: z.string().optional(),
  gongan: z.string().optional(),
  iconfont: z.string().optional(),
  manifest: manifestSchema.optional(),
  level: z.number().optional(),
  exp: z.number().optional(),
  nextExp: z.number().optional(),
  gold: z.number().optional(),
  pyroxene: z.number().optional(),
  dock: z.array(dockItemSchema).optional(),
  contact: z.array(contactItemSchema).optional(),
  task: z
    .strictObject({
      name: nonEmpty,
      href: z.string().optional()
    })
    .optional(),
  banner: z
    .strictObject({
      musicID: z.array(z.number()).optional()
    })
    .optional(),
  memorialLobbies: z.array(memorialLobbySchema).optional(),
  bio: bioConfigSchema.optional()
})

const localeOverlaySchema = z.strictObject({
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.string().optional(),
  author: z.string().optional(),
  favicon: z.string().optional(),
  iconfont: z.string().optional(),
  url: z.string().optional(),
  ICP: z.string().optional(),
  gongan: z.string().optional(),
  manifest: z
    .strictObject({
      name: z.string().optional(),
      short_name: z.string().optional(),
      description: z.string().optional(),
      theme_color: z.string().optional(),
      start_url: z.string().optional(),
      id: z.string().optional(),
      icons: z.array(manifestIconSchema).optional()
    })
    .optional(),
  level: z.number().optional(),
  exp: z.number().optional(),
  nextExp: z.number().optional(),
  gold: z.number().optional(),
  pyroxene: z.number().optional(),
  dock: z.array(dockItemSchema.partial()).optional(),
  contact: z.array(contactItemSchema.partial()).optional(),
  task: z
    .strictObject({
      name: z.string().optional(),
      href: z.string().optional()
    })
    .optional(),
  banner: z
    .strictObject({
      musicID: z.array(z.number()).optional()
    })
    .optional(),
  memorialLobbies: z.array(memorialLobbySchema.partial()).optional(),
  icp: z
    .strictObject({
      title: z.string().optional()
    })
    .optional(),
  translate: z.record(z.string(), z.string()).optional(),
  bio: z
    .strictObject({
      student: z.array(bioStudentSchema.partial()).optional(),
      btn: z.array(bioBtnSchema.partial()).optional(),
      bth: z.array(bioBtnSchema.partial()).optional()
    })
    .optional()
})

const lobbyIndexOverlaySchema = z.strictObject({
  name: z.string().optional(),
  path: z.string().optional(),
  skel: z.string().optional(),
  atlas: z.string().optional(),
  voice: z.record(z.string(), z.string()).optional(),
  offset: z.number().optional(),
  dialogueDisplay: dialogueDisplaySchema.optional(),
  interactions: interactionsSchema.optional()
})

function formatPath(issuePath: PropertyKey[]): string {
  if (issuePath.length === 0) return '(root)'
  return issuePath.reduce<string>((acc, key) => {
    if (typeof key === 'number') return `${acc}[${key}]`
    return acc ? `${acc}.${String(key)}` : String(key)
  }, '')
}

function formatIssue(file: string, issue: z.core.$ZodIssue, prefix = ''): string {
  const loc = [prefix, formatPath(issue.path)].filter((p) => p && p !== '(root)').join('.')
  let message = issue.message
  if (issue.code === 'unrecognized_keys' && 'keys' in issue) {
    const keys = issue.keys.map((k) => `'${k}'`).join(', ')
    message = `未知字段 ${keys}（可能是拼写错误）`
  }
  return `  ${file} → ${loc || '(root)'}: ${message}`
}

function collectZodIssues(file: string, error: z.ZodError, prefix = ''): string[] {
  return error.issues.map((issue) => formatIssue(file, issue, prefix))
}

function loadYaml(filePath: string): unknown {
  const text = fs.readFileSync(filePath, 'utf8')
  return load(text)
}

function publicFile(root: string, urlPath: string): string {
  return path.join(root, 'public', urlPath.replace(/^\//, '').replace(/\//g, path.sep))
}

function checkPublicFile(root: string, urlPath: string, label: string): string | null {
  if (!urlPath || /^https?:\/\//i.test(urlPath) || urlPath.startsWith('data:')) return null
  const abs = publicFile(root, urlPath)
  if (!fs.existsSync(abs)) {
    return `  ${label}: 找不到文件 public/${urlPath.replace(/^\//, '')}`
  }
  return null
}

function checkLobbyAssets(
  root: string,
  file: string,
  field: string,
  lobby: { path?: string; skel?: string; atlas?: string }
): string[] {
  const errors: string[] = []
  const { path: lobbyPath, skel, atlas } = lobby
  if (lobbyPath && !lobbyPath.endsWith('/')) {
    errors.push(
      `  ${file} → ${field}.path: 应以 '/' 结尾（当前会与 skel/atlas 文件名直接拼接）`
    )
  }
  if (lobbyPath && skel) {
    const miss = checkPublicFile(root, lobbyPath + skel, `${file} → ${field}.skel`)
    if (miss) errors.push(miss)
  }
  if (lobbyPath && atlas) {
    const miss = checkPublicFile(root, lobbyPath + atlas, `${file} → ${field}.atlas`)
    if (miss) errors.push(miss)
  }
  return errors
}

export function validateProjectConfig(root: string): string[] {
  const errors: string[] = []
  const configPath = path.join(root, '_config.yaml')

  if (!fs.existsSync(configPath)) {
    return [`  _config.yaml: 文件不存在`]
  }

  const bioDir = path.join(root, 'bio')
  if (!fs.existsSync(bioDir) || !fs.statSync(bioDir).isDirectory()) {
    errors.push('  bio/: 目录不存在（请创建 bio/{locale}.md，例如 bio/en-US.md）')
  } else {
    const bioFiles = fs.readdirSync(bioDir).filter((name) => name.toLowerCase().endsWith('.md'))
    if (bioFiles.length === 0) {
      errors.push('  bio/: 至少需要一个 .md 文件（缺语言时回退到 en-US）')
    }
  }

  for (const rel of [
    'shots/zh/pic1.png',
    'shots/zh/pic2.png',
    'public/img/loading/bg.png',
    'public/img/loading/avatar1.png',
    'public/img/loading/avatar2.png',
    'public/img/loading/avatar3.png',
    'public/img/loading/avatar4.png',
    'public/js/iconfont.js',
    'public/transfrom.webm'
  ]) {
    if (!fs.existsSync(path.join(root, rel))) {
      const hint = rel.startsWith('shots/')
        ? '社交分享卡片用 sharp 从此裁切'
        : '加载屏本地素材，勿改回 Yostar CDN'
      errors.push(`  ${rel.replaceAll('\\', '/')}: 找不到文件（${hint}）`)
    }
  }

  let raw: unknown
  try {
    raw = loadYaml(configPath)
  } catch (error) {
    errors.push(
      `  _config.yaml: YAML 解析失败 — ${error instanceof Error ? error.message : String(error)}`
    )
    return errors
  }

  const parsed = siteConfigSchema.safeParse(raw)
  if (!parsed.success) {
    errors.push(...collectZodIssues('_config.yaml', parsed.error))
  }

  const config = parsed.success ? parsed.data : ((raw as Record<string, unknown>) ?? {})
  const lobbies = Array.isArray(config.memorialLobbies) ? config.memorialLobbies : []

  if (parsed.success) {
    const faviconMiss = checkPublicFile(root, parsed.data.favicon, '_config.yaml → favicon')
    if (faviconMiss) errors.push(faviconMiss)

    for (const icon of parsed.data.manifest?.icons ?? []) {
      const miss = checkPublicFile(root, icon.src, `_config.yaml → manifest.icons src=${icon.src}`)
      if (miss) errors.push(miss)
    }

    parsed.data.dock?.forEach((item, i) => {
      if (!item.imgSrc) return
      const miss = checkPublicFile(root, item.imgSrc, `_config.yaml → dock[${i}].imgSrc`)
      if (miss) errors.push(miss)
    })

    lobbies.forEach((lobby, i) => {
      errors.push(...checkLobbyAssets(root, '_config.yaml', `memorialLobbies[${i}]`, lobby))
    })

    parsed.data.bio?.student?.forEach((student, i) => {
      errors.push(...checkLobbyAssets(root, '_config.yaml', `bio.student[${i}]`, student))
    })

    parsed.data.bio?.btn?.forEach((card, i) => {
      const miss = checkPublicFile(root, card.path, `_config.yaml → bio.btn[${i}].path`)
      if (miss) errors.push(miss)
    })
  }

  const lobbyCount = lobbies.length

  for (const locale of LOCALES) {
    const rel = `src/locales/${locale}.yaml`
    const localePath = path.join(root, rel)
    if (!fs.existsSync(localePath)) {
      errors.push(`  ${rel}: 文件不存在`)
      continue
    }

    let localeRaw: unknown
    try {
      localeRaw = loadYaml(localePath)
    } catch (error) {
      errors.push(
        `  ${rel}: YAML 解析失败 — ${error instanceof Error ? error.message : String(error)}`
      )
      continue
    }

    if (!localeRaw || typeof localeRaw !== 'object' || Array.isArray(localeRaw)) {
      errors.push(`  ${rel}: 必须是对象`)
      continue
    }

    const overlay: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(localeRaw as Record<string, unknown>)) {
      const match = key.match(LOBBY_INDEX_KEY)
      if (match) {
        const index = Number(match[1])
        if (index >= lobbyCount) {
          errors.push(
            `  ${rel} → ${key}: 索引超出 _config.yaml 中 memorialLobbies 长度（${lobbyCount}）`
          )
        }
        const overlayResult = lobbyIndexOverlaySchema.safeParse(value)
        if (!overlayResult.success) {
          errors.push(...collectZodIssues(rel, overlayResult.error, key))
        }
      } else {
        overlay[key] = value
      }
    }

    const localeResult = localeOverlaySchema.safeParse(overlay)
    if (!localeResult.success) {
      errors.push(...collectZodIssues(rel, localeResult.error))
    }
  }

  return errors
}

export function assertProjectConfig(root: string): void {
  const errors = validateProjectConfig(root)
  if (errors.length === 0) return

  throw new Error(
    `\n配置校验失败，构建已中止。请修正以下问题后重试：\n\n${errors.join('\n')}\n`
  )
}

/** 启动 / 构建时校验 _config.yaml、语言包与 bio/ 简介，字段拼写错误直接失败 */
export function configValidatePlugin(): Plugin {
  return {
    name: 'vite-plugin-config-validate',
    configResolved(config) {
      assertProjectConfig(config.root)
    }
  }
}
