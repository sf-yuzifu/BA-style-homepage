import path from 'node:path'

import { marked } from 'marked'
import type { Plugin } from 'vite'

/** 仅编译仓库根目录 bio/{locale}.md，例如 bio/zh-CN.md */
function isProjectBioMd(id: string, root: string): boolean {
  const file = id.split('?')[0]
  if (path.extname(file).toLowerCase() !== '.md') return false
  const rel = path.relative(path.resolve(root, 'bio'), path.resolve(file))
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel) && path.dirname(rel) === '.'
}

/** 将 bio/{locale}.md 编译为 HTML 字符串模块；缺语言时由页面回退到 en-US */
export function bioMarkdownPlugin(): Plugin {
  let root = process.cwd()
  return {
    name: 'vite-plugin-bio-markdown',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
    },
    transform(code, id) {
      if (!isProjectBioMd(id, root)) return
      const html = marked
        .parse(code, { async: false, gfm: true })
        .replace(/<!--[\s\S]*?-->/g, '')
        .trim()
      return {
        code: `export default ${JSON.stringify(html)}`,
        map: null
      }
    }
  }
}
