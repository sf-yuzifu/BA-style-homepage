/**
 * 以编程方式执行 vite build，完成后强制退出进程。
 *
 * 背景：cn-font-split（vite-plugin-font 的字体子集化）走 Node FFI（koffi），
 * 首次无缓存构建后 FFI 资源未正确释放，Node 事件循环被挂住、进程不会自然退出
 * ——CI（ubuntu 全新环境）上表现为「构建成功但步骤永不结束」，本地有字体缓存时不复现。
 * 上游问题（未修复）：https://github.com/KonghaYao/cn-font-split/issues/215
 *
 * build() resolve 时所有产物（含 closeBundle 钩子的 OG 图 / WebP / PWA）均已写出，
 * 强制退出无副作用。上游修复后可改回 "vite build"。
 *
 * 用法：jiti build/build.ts [mode]   （mode 缺省 production，analyze 传 analyze）
 */
import { build } from 'vite'

const mode = process.argv[2]

try {
  await build(mode ? { mode } : {})
} catch (error) {
  console.error(error)
  process.exit(1)
}
process.exit(0)
