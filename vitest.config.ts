import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// 独立 Vitest 配置：刻意不加载 vite.config.ts 的重型插件栈（PWA/字体子集/OG 图等）。
// 测试约定：src/**/__tests__/*.test.ts（与 tsconfig.app.json 的排除约定一致，
// 测试不参与应用构建的 typecheck，由 vitest 自身转译运行）。
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/*.test.ts']
  }
})
