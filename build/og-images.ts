import fs from 'node:fs'
import path from 'node:path'

import { load } from 'js-yaml'
import sharp from 'sharp'
import type { Plugin } from 'vite'

/** Open Graph 推荐尺寸（约 1.91:1） */
export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

const OG_HOME_FILE = 'og-home.jpg'
const OG_BIO_FILE = 'og-bio.jpg'

/** README 主截图（中文界面）；16:9 cover 裁到 1200×630 */
export const OG_HOME_SHOT = path.join('shots', 'zh', 'pic1.png')
export const OG_BIO_SHOT = path.join('shots', 'zh', 'pic2.png')

/** _config.yaml 的 og 字段：OG 源图路径（相对仓库根目录），可覆盖默认 shots/zh/ */
export interface OgShots {
  home?: string
  bio?: string
}

/** 解析 OG 源图路径：优先 _config.yaml 的 og.home / og.bio，缺省回退 shots/zh/ */
export function resolveOgShots(og?: OgShots): { home: string; bio: string } {
  return {
    home: og?.home?.trim() || OG_HOME_SHOT,
    bio: og?.bio?.trim() || OG_BIO_SHOT
  }
}

/** 用户配置的仓库相对路径 → 绝对路径（统一分隔符） */
function resolveShot(root: string, rel: string): string {
  return path.join(root, ...rel.split('/'))
}

const JPEG = { quality: 82, mozjpeg: true } as const

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

async function renderOgJpeg(absSrc: string): Promise<Buffer> {
  return sharp(absSrc)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'centre' })
    .jpeg(JPEG)
    .toBuffer()
}

function readBioLabel(root: string): string {
  try {
    const locale = load(
      fs.readFileSync(path.join(root, 'src', 'locales', 'en-US.yaml'), 'utf8')
    ) as { translate?: { bio?: string } }
    if (locale.translate?.bio) return locale.translate.bio
  } catch {
    /* 缺语言包时用英文兜底，与 _config.yaml 默认语言一致 */
  }
  return 'Biography'
}

function patchBioHtml(html: string, bioTitle: string, siteUrl: string): string {
  let out = html.replaceAll(OG_HOME_FILE, OG_BIO_FILE)
  const safeTitle = escapeHtmlAttr(bioTitle)
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`)
  out = out.replace(
    /(property="og:title" content=")[^"]*"/,
    `$1${safeTitle}"`
  )
  out = out.replace(
    /(name="twitter:title" content=")[^"]*"/,
    `$1${safeTitle}"`
  )
  if (siteUrl) {
    const homeUrl = `${siteUrl}/`
    const bioUrl = `${siteUrl}/bio`
    out = out.replace(
      `property="og:url" content="${homeUrl}"`,
      `property="og:url" content="${bioUrl}"`
    )
    out = out.replace(
      `rel="canonical" href="${homeUrl}"`,
      `rel="canonical" href="${bioUrl}"`
    )
  }
  return out
}

type OgCache = { home: Buffer | null; bio: Buffer | null }

function createOgMiddleware(root: string, cache: OgCache, shots: { home: string; bio: string }) {
  return async (
    req: { url?: string },
    res: { setHeader: (k: string, v: string) => void; end: (b: Buffer) => void },
    next: () => void
  ) => {
    const url = req.url?.split('?')[0]
    const kind = url === `/${OG_HOME_FILE}` ? 'home' : url === `/${OG_BIO_FILE}` ? 'bio' : null
    if (!kind) {
      next()
      return
    }
    try {
      if (!cache[kind]) {
        cache[kind] = await renderOgJpeg(resolveShot(root, shots[kind]))
      }
      res.setHeader('Content-Type', 'image/jpeg')
      res.setHeader('Cache-Control', 'no-cache')
      res.end(cache[kind] as Buffer)
    } catch {
      next()
    }
  }
}

/** 构建产物：两张 OG JPEG + 带独立 meta 的 bio/index.html */
export async function writeOgBuildArtifacts(
  root: string,
  outDir: string,
  siteUrl: string,
  og?: OgShots
): Promise<void> {
  const shots = resolveOgShots(og)
  const homeBuf = await renderOgJpeg(resolveShot(root, shots.home))
  const bioBuf = await renderOgJpeg(resolveShot(root, shots.bio))
  await fs.promises.writeFile(path.join(outDir, OG_HOME_FILE), homeBuf)
  await fs.promises.writeFile(path.join(outDir, OG_BIO_FILE), bioBuf)

  const indexPath = path.join(outDir, 'index.html')
  const html = await fs.promises.readFile(indexPath, 'utf8')
  const titleMatch = html.match(/<title>([^<]*)<\/title>/)
  const homeTitle = titleMatch?.[1] ?? 'Fish Archive'
  const bioTitle = `${readBioLabel(root)} - ${homeTitle}`
  const bioDir = path.join(outDir, 'bio')
  await fs.promises.mkdir(bioDir, { recursive: true })
  await fs.promises.writeFile(
    path.join(bioDir, 'index.html'),
    patchBioHtml(html, bioTitle, siteUrl),
    'utf8'
  )
}

/** 用 shots 封面裁切生成 og-home.jpg / og-bio.jpg，并写出 bio/index.html 供爬虫读独立卡片 */
export function ogImagesPlugin(siteUrl: string, og?: OgShots): Plugin {
  let root = process.cwd()
  let outDir = path.resolve('dist')
  let isBuild = false
  const cache: OgCache = { home: null, bio: null }
  const shots = resolveOgShots(og)

  return {
    name: 'vite-plugin-og-images',
    configResolved(config) {
      root = config.root
      outDir = path.resolve(config.root, config.build.outDir)
      isBuild = config.command === 'build'
    },
    configureServer(server) {
      server.middlewares.use(createOgMiddleware(root, cache, shots))
    },
    async closeBundle() {
      if (!isBuild) return
      await writeOgBuildArtifacts(root, outDir, siteUrl, og)
    }
  }
}
