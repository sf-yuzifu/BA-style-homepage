import fs from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'
import type { Plugin } from 'vite'
import type { Plugin as PostcssPlugin, Declaration } from 'postcss'

const IMAGE_EXT = /\.(png|jpe?g)$/i
const WEBP_QUALITY = 85

/**
 * 不参与转换的 public/ 相对路径：
 * - favicon*.png：PWA manifest 图标与 HTML 引用，保持 PNG 兼容性
 * - l2d/：Spine 图集页由 vite-plugin-l2d-webp 专属处理（改写 .atlas 引用）
 * - cursors/：.cur 光标，非光栅优化对象
 */
const EXCLUDE = /^(?:favicon\d+\.png|l2d\/|cursors\/)/i

/** 递归收集 public/ 下的 png/jpg/jpeg（返回 public 相对路径，正斜杠） */
async function collectImages(dir: string, base = ''): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...(await collectImages(path.join(dir, entry.name), rel)))
    } else if (entry.isFile() && IMAGE_EXT.test(entry.name)) {
      files.push(rel)
    }
  }
  return files
}

/**
 * 生产构建：把 public/ 的光栅图在产物侧追加 WebP 副本，并把引用改写为 WebP。
 * public/ 原始文件不动；dist 中保留原图兜底（PWA 预缓存清单不受影响）。
 *
 * 设计要点：
 * - 引用改写必须发生在内容 hash 计算之前。JS 侧走 transform（模块编译期）；
 *   CSS 侧不能走 transform——rolldown-vite 的原生 CSS 管线绕过 JS 钩子，
 *   因此 CSS 改写经 PostCSS 伴侣插件（vite 的 CSS 处理必经 PostCSS，且在 hash 前）；
 * - 模板里的 <img src="/..."> 会被 plugin-vue 编译成 ES import；改写后的 .webp
 *   路径在 public/ 不存在——以虚拟模块兜住解析，默认导出 URL 字符串
 *   （与 vite 对 public 资产 import 的语义一致）；
 * - 仅 WebP 比源图更小时才转换（对比基准是 public/ 源图；极少数经
 *   image-optimizer 深度压缩的 PNG 可能比 WebP 略小，量纲 KB 级，可忽略）；
 * - 仅构建期生效，开发环境继续用原始 PNG（零开发期风险）。
 */
export function createPublicWebpPlugins(): { vitePlugin: Plugin; postcssPlugin: PostcssPlugin } {
  /** 源引用路径（/img/x.png）→ WebP 引用路径（/img/x.webp） */
  const replacements = new Map<string, string>()
  /** 待写出的 WebP：dist 相对路径 → 内容 */
  const outputs = new Map<string, Buffer>()
  /** 全部 WebP 引用路径（/img/x.webp），供 resolveId 识别 */
  const webpUrls = new Set<string>()
  let savedBytes = 0

  const VIRTUAL_PREFIX = '\0public-webp:'

  const replaceInCode = (code: string): string | null => {
    if (replacements.size === 0) return null
    if (!code.includes('.png') && !code.includes('.jpg') && !code.includes('.jpeg')) return null
    let out = code
    for (const [from, to] of replacements) {
      if (out.includes(from)) out = out.split(from).join(to)
    }
    return out === code ? null : out
  }

  const vitePlugin: Plugin = {
    name: 'vite-plugin-public-webp',
    apply: 'build',

    async buildStart() {
      const publicDir = path.resolve('public')
      const images = await collectImages(publicDir)

      await Promise.all(
        images.map(async (rel) => {
          if (EXCLUDE.test(rel)) return
          const source = await fs.readFile(path.join(publicDir, rel))
          const webp = await sharp(source).webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer()
          if (webp.length >= source.length) return
          const webpRel = rel.replace(IMAGE_EXT, '.webp')
          replacements.set(`/${rel}`, `/${webpRel}`)
          webpUrls.add(`/${webpRel}`)
          outputs.set(webpRel, webp)
          savedBytes += source.length - webp.length
        })
      )
    },

    // 在 yaml/bio-markdown 等插件之后注册（见 vite.config.ts），确保它们产出的
    // JS 模块里的配置图片路径（名片图、联系图标等）也被改写
    transform(code) {
      const out = replaceInCode(code)
      return out === null ? null : { code: out, map: null }
    },

    resolveId(id) {
      if (webpUrls.has(id)) return VIRTUAL_PREFIX + id
      return null
    },

    load(id) {
      if (id.startsWith(VIRTUAL_PREFIX)) {
        return `export default ${JSON.stringify(id.slice(VIRTUAL_PREFIX.length))}`
      }
      return null
    },

    async closeBundle() {
      if (outputs.size === 0) return
      const distDir = path.resolve('dist')
      for (const [rel, buf] of outputs) {
        const target = path.join(distDir, rel)
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.writeFile(target, buf)
      }
      console.log(
        `[public-webp] ${outputs.size} image(s) → WebP, saved ~${(savedBytes / 1024 / 1024).toFixed(2)} MB`
      )
    }
  }

  // CSS 侧伴侣：在 PostCSS 阶段改写 url()（hash 计算之前；Declaration 在 CSS
  // 模块处理时才执行，晚于 vite 插件的 buildStart，replacements 已就绪）
  const postcssPlugin: PostcssPlugin = {
    postcssPlugin: 'postcss-public-webp',
    Declaration(decl: Declaration) {
      const out = replaceInCode(decl.value)
      if (out !== null) decl.value = out
    }
  }

  return { vitePlugin, postcssPlugin }
}
