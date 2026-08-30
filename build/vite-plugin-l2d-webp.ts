import fs from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'
import type { Plugin } from 'vite'

/** Spine atlas 图集页头：整行仅为 `filename.png` */
const ATLAS_PAGE_PNG = /^(\S+\.png)$/i

const WEBP_QUALITY = 85

async function collectAtlasFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectAtlasFiles(fullPath)))
    } else if (entry.isFile() && entry.name.endsWith('.atlas')) {
      files.push(fullPath)
    }
  }

  return files
}

function parseAtlasPagePngs(atlasContent: string): string[] {
  const pages: string[] = []

  for (const line of atlasContent.split(/\r?\n/)) {
    const match = line.match(ATLAS_PAGE_PNG)
    if (match) pages.push(match[1])
  }

  return pages
}

function replaceAtlasPageName(content: string, pngName: string, webpName: string): string {
  return content
    .split(/\r?\n/)
    .map((line) => (line === pngName ? webpName : line))
    .join('\n')
}

async function removeFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch {
    /* 文件不存在时忽略 */
  }
}

/**
 * 生产构建：将 dist/l2d 内 atlas 引用的 PNG 页贴图转为 WebP，并改写 .atlas 引用。
 * 仅在 WebP 体积更小时替换，开发环境不运行（保留 public/ 原始 PNG）。
 */
export function l2dWebpPlugin(): Plugin {
  return {
    name: 'vite-plugin-l2d-webp',
    apply: 'build',
    async closeBundle() {
      const distL2d = path.resolve('dist/l2d')

      try {
        await fs.access(distL2d)
      } catch {
        return
      }

      const atlasFiles = await collectAtlasFiles(distL2d)
      let converted = 0
      let savedBytes = 0

      for (const atlasPath of atlasFiles) {
        let atlasContent = await fs.readFile(atlasPath, 'utf8')
        const atlasDir = path.dirname(atlasPath)
        let atlasChanged = false

        for (const pngName of parseAtlasPagePngs(atlasContent)) {
          const pngPath = path.join(atlasDir, pngName)
          const webpName = pngName.replace(/\.png$/i, '.webp')
          const webpPath = path.join(atlasDir, webpName)

          let pngSize = 0
          try {
            pngSize = (await fs.stat(pngPath)).size
          } catch {
            continue
          }

          const webpBuffer = await sharp(pngPath)
            .webp({ quality: WEBP_QUALITY, effort: 4 })
            .toBuffer()

          if (webpBuffer.length >= pngSize) continue

          await fs.writeFile(webpPath, webpBuffer)
          await fs.unlink(pngPath)
          await removeFileIfExists(`${pngPath}.gz`)

          atlasContent = replaceAtlasPageName(atlasContent, pngName, webpName)
          atlasChanged = true
          converted++
          savedBytes += pngSize - webpBuffer.length
        }

        if (atlasChanged) {
          await fs.writeFile(atlasPath, atlasContent)
        }
      }

      if (converted > 0) {
        console.log(
          `[l2d-webp] ${converted} atlas page(s) → WebP, saved ~${(savedBytes / 1024 / 1024).toFixed(2)} MB`
        )
      }
    }
  }
}
