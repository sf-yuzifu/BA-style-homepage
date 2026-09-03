import path from 'node:path'

import { marked, Renderer } from 'marked'
import type { Tokens } from 'marked'
import type { Plugin } from 'vite'

/** 仅编译仓库根目录 bio/{locale}.md，例如 bio/zh-CN.md */
function isProjectBioMd(id: string, root: string): boolean {
  const file = id.split('?')[0]
  if (path.extname(file).toLowerCase() !== '.md') return false
  const rel = path.relative(path.resolve(root, 'bio'), path.resolve(file))
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel) && path.dirname(rel) === '.'
}

/**
 * Bio 正文里的外链（http/https）一律新标签页打开并切断 opener；
 * 站内相对路径 / 锚点 / mailto 等保持默认渲染。
 * 在默认渲染结果上注入属性，保留 marked 原有的 href 清理与 title 转义。
 */
class BioRenderer extends Renderer {
  override link(token: Tokens.Link): string {
    const html = super.link(token)
    if (!/^https?:\/\//i.test(token.href)) return html
    return html.replace('<a ', '<a target="_blank" rel="noopener noreferrer" ')
  }
}

const bioRenderer = new BioRenderer()

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
        .parse(code, { async: false, gfm: true, renderer: bioRenderer })
        .replace(/<!--[\s\S]*?-->/g, '')
        .trim()
      return {
        code: `export default ${JSON.stringify(html)}`,
        map: null
      }
    }
  }
}
