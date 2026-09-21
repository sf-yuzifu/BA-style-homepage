import { fileURLToPath, URL } from 'node:url'

import { load } from 'js-yaml'
import fs from 'fs'

import { defineConfig, loadEnv, type PluginOption, type UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { compression } from 'vite-plugin-compression2'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { VitePWA } from 'vite-plugin-pwa'
import type { ManifestOptions } from 'vite-plugin-pwa'
import { createHtmlPlugin } from 'vite-plugin-html'
import Font from 'vite-plugin-font'
import yaml from '@rollup/plugin-yaml'
import { l2dWebpPlugin } from './build/vite-plugin-l2d-webp.ts'
import { createPublicWebpPlugins } from './build/vite-plugin-public-webp.ts'
import { configValidatePlugin } from './build/validate-config.ts'
import { configEnvSubstitutePlugin, substituteEnv } from './build/env-substitute.ts'
import { bioMarkdownPlugin } from './build/bio-markdown.ts'
import {
  ogImagesPlugin,
  PWA_SHOT_BIO_FILE,
  PWA_SHOT_HOME_FILE,
  PWA_SHOT_HEIGHT,
  PWA_SHOT_WIDTH
} from './build/og-images.ts'

type FontViteOptions = Parameters<typeof Font.vite>[0]

interface BuildConfig {
  title?: string
  favicon?: string
  author?: string
  description?: string
  keywords?: string
  url?: string
  iconfont?: string
  manifest?: Partial<ManifestOptions>
  banner?: {
    musicID?: number[]
    music?: {
      netease?: number[]
      neteasePlaylist?: number[]
      tencent?: unknown[]
      kugou?: unknown[]
      kuwo?: unknown[]
      local?: unknown[]
    }
  }
  /** 社交分享卡片（OG 图）源图，缺省 shots/zh/pic1.png / pic2.png */
  og?: {
    home?: string
    bio?: string
  }
}

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }): Promise<UserConfig> => {
  // 环境变量（.env* 文件 + process.env，后者优先——Vercel / EdgeOne Pages 等平台控制台变量同此来源），
  // 供 _config.yaml 的 ${VAR} 占位符注入
  const env = loadEnv(mode, process.cwd(), '')

  const { value: config, missing: missingEnvVars } = substituteEnv(
    load(fs.readFileSync('_config.yaml', 'utf8')) as BuildConfig,
    env
  )
  if (missingEnvVars.length > 0) {
    console.warn(
      `\n[_config.yaml] 以下环境变量未设置，对应字段已按空值处理：${[...new Set(missingEnvVars)].join(', ')}\n`
    )
  }

  const siteUrl = (config.url || '').replace(/\/+$/, '')

  // iconfont 为远程地址（http(s):// 或协议相对 //）时取其 origin 供 preconnect；
  // 默认本地 /js/iconfont.js 为 ''，index.html 据此跳过无效的第三方预热
  const iconfontOrigin = (() => {
    const m = (config.iconfont?.trim() || '').match(/^(?:https?:)?\/\/([^/]+)/)
    return m ? `https://${m[1]}` : ''
  })()

  // 按 _config.yaml 实际配置的音源注入对应 API 的 preconnect（local 直链无需预热；
  // 网易含旧字段 musicID——运行时会并入 netease 一起进随机池）
  const musicApiOrigins = (() => {
    const music = config.banner?.music
    const hasNetease =
      (config.banner?.musicID?.length ?? 0) > 0 ||
      (music?.netease?.length ?? 0) > 0 ||
      (music?.neteasePlaylist?.length ?? 0) > 0
    const origins = new Set<string>()
    if (hasNetease) origins.add('https://api.injahow.cn')
    if (music?.tencent?.length) {
      origins.add('https://c.y.qq.com')
      origins.add('https://u.y.qq.com')
    }
    if (music?.kugou?.length) origins.add('https://m.kugou.com')
    if (music?.kuwo?.length) {
      origins.add('https://search.kuwo.cn')
      origins.add('https://antiserver.kuwo.cn')
    }
    return [...origins]
  })()

  // PWA manifest 缺省补齐：display 默认 standalone（安装后独立窗口而非浏览器标签页）；
  // screenshots 缺省引用构建期由 og-images 同源生成的 1280×720 截图（Chrome 富安装对话框用），
  // fork 在 _config.yaml manifest.screenshots 自定义时覆盖（图片须放 public/，构建会校验存在性）
  const pwaManifest: Partial<ManifestOptions> = {
    display: 'standalone',
    ...config.manifest,
    screenshots: config.manifest?.screenshots ?? [
      {
        src: `/${PWA_SHOT_HOME_FILE}`,
        sizes: `${PWA_SHOT_WIDTH}x${PWA_SHOT_HEIGHT}`,
        type: 'image/jpeg',
        form_factor: 'wide'
      },
      {
        src: `/${PWA_SHOT_BIO_FILE}`,
        sizes: `${PWA_SHOT_WIDTH}x${PWA_SHOT_HEIGHT}`,
        type: 'image/jpeg',
        form_factor: 'wide'
      }
    ]
  }

  // public/ 图片构建期转 WebP：vite 插件（JS/配置字符串改写 + 产物写出）
  // 与 PostCSS 伴侣（CSS url() 改写）共享同一份替换表
  const { vitePlugin: publicWebpVite, postcssPlugin: publicWebpCss } = createPublicWebpPlugins()

  const plugins: PluginOption[] = [
    configValidatePlugin(),
    bioMarkdownPlugin(),
    vue(),
    Font.vite({
      css: {
        fontFamily: 'Resource Han Rounded CN'
      }
    } as FontViteOptions),
    createHtmlPlugin({
      inject: {
        data: {
          title: config.title,
          favicon: config.favicon,
          author: config.author,
          themeColor: config.manifest?.theme_color,
          description: config.description,
          keywords: config.keywords,
          // 远程 iconfont 的 origin（本地内置时为 ''，模板据此跳过 preconnect）
          iconfontOrigin,
          // 实际配置到的音源 API origin 列表（模板循环输出 preconnect + dns-prefetch）
          musicApiOrigins,
          // 站点规范地址（去除尾部斜杠），供 og:image/og:url/canonical 拼绝对 URL
          siteUrl,
          ogImage: siteUrl ? `${siteUrl}/og-home.jpg` : '/og-home.jpg'
        }
      }
    }),
    ViteImageOptimizer({
      png: {
        quality: 85
      },
      jpeg: {
        quality: 85
      },
      jpg: {
        quality: 85
      },
      webp: {
        quality: 85
      },
      svg: {
        multipass: true,
        plugins: [
          {
            name: 'preset-default',
            params: {
              overrides: {
                removeViewBox: false
              }
            }
          }
        ]
      }
    }),
    VitePWA({
      mode: 'production',
      base: '/',
      registerType: 'prompt',
      injectRegister: 'auto',
      workbox: {
        // SPA 导航回退（navigateFallback 默认为 index.html）不拦截静态资源直链：
        // URL 带文件扩展名时不返回 index.html，直接走网络，避免图片/媒体/CSS 直链被回退成首页
        navigateFallbackDenylist: [/\.[a-zA-Z0-9]{1,10}(\?.*)?$/],
        runtimeCaching: [
          // 动态接口（音乐信息等）：网络优先，超时或失败时回退缓存，最长保留 1 天
          {
            urlPattern: /^https:\/\/api\.injahow\.cn\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'music-api-cache',
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 32,
                maxAgeSeconds: 60 * 60 * 24
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // 第三方静态资源 CDN（iconfont）：缓存优先，内容基本不变
          {
            urlPattern: /^https:\/\/at\.alicdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Live2D 图集索引/骨骼数据（.atlas/.skel）：网络优先
          // 文件名固定但内容会随部署更新（如贴图页 PNG→WebP 后 atlas 改写引用），
          // CacheFirst 会让老访客长期吃旧 atlas → 引用已删除的贴图 → 解码失败
          {
            urlPattern: /^https?:\/\/[^/]+\/l2d\/[^/?#]+\.(?:atlas|skel)$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'l2d-meta-cache',
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // 静态资源（Live2D 贴图/语音、图片、视频、字体）：缓存优先
          // 只匹配本站资源目录与根目录文件，避免拦截第三方站点的同名资源
          // 注意：带查询串的请求（如网易云音频流）不匹配此规则，直接走网络
          // cacheName 带版本号：旧 static-assets-cache 中经 CacheFirst 缓存的
          // 陈旧 atlas/贴图随改名作废，强制新 SW 首次回源
          {
            urlPattern:
              /^https?:\/\/[^/]+\/(?:(?:assets|img|l2d|shitim|cursors)\/[^?#]+|[^/?#]+)\.(?:png|jpe?g|webp|gif|svg|mp3|mp4|webm|mov|woff2?|cur)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets-cache-v2',
              expiration: {
                maxEntries: 256,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: pwaManifest
    }),
    // WebP 转换须在 compression 之前注册：closeBundle 按注册顺序执行，
    // 先转 WebP/改写 atlas 再 gzip，保证 .gz 与最终产物一致
    // （否则 gzip_static 类主机会优先吐出改写前的旧 atlas.gz）
    l2dWebpPlugin(),
    compression({
      threshold: 10240 // the unit is Bytes
    }),
    // _config.yaml 的 ${VAR} 占位符替换（enforce 'pre'，先于 yaml() 执行），
    // 使打进 bundle 的运行时配置与上方构建期读取的值一致
    configEnvSubstitutePlugin(env),
    yaml(),
    // 在 yaml 之后注册：transform 才能覆盖配置模块里的图片路径（名片/联系图标等）
    publicWebpVite,
    ogImagesPlugin(siteUrl, config.og)
  ]

  if (mode === 'analyze') {
    const { visualizer } = await import('rollup-plugin-visualizer')
    plugins.push(
      visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
        open: false
      })
    )
  }

  return {
    // CSS 侧 WebP 引用改写（rolldown-vite 的原生 CSS 管线绕过 JS transform，
    // 必须走 PostCSS 才能在内容 hash 前改写 url()）
    css: {
      postcss: {
        plugins: [publicWebpCss]
      }
    },
    // 生产环境剔除调试输出（保留 console.error 以便线上排障）
    esbuild: {
      drop: ['debugger'],
      pure: ['console.log', 'console.info', 'console.warn']
    },
    build: {
      assetsInlineLimit: 0,
      minify: 'esbuild',
      // PIXI 8 渲染引擎分包后约 730KB（gzip ~212KB），阈值随之放宽
      chunkSizeWarningLimit: 800,
    // Vite 8 底层为 rolldown：rollupOptions 已弃用（manualChunks 静默失效），
    // 分包走 rolldownOptions.output.codeSplitting（groups 按 priority 降序匹配）
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
              // BA 点击特效（桌面按需动态 import，独立 chunk）
              { name: 'click-fx', test: /[\\/]node_modules[\\/]ba-click-fx[\\/]/, priority: 20 },
              // Vue 框架核心
              {
                name: 'vue-core',
                test: /[\\/]node_modules[\\/](?:vue|vue-router|@vue)[\\/]/,
                priority: 15
              },
              // PIXI 渲染引擎与 Spine 骨骼动画
              {
                name: 'pixi',
                test: /[\\/]node_modules[\\/](?:pixi\.js|@pixi|@esotericsoftware|eventemitter3|earcut|ismobilejs)[\\/]/,
                priority: 14
              },
              // Arco 组件库及其内部依赖
              {
                name: 'arco',
                test: /[\\/]node_modules[\\/](?:@arco-design|dayjs|number-precision|b-tween|b-validate|compute-scroll-into-view|scroll-into-view-if-needed|resize-observer-polyfill)[\\/]/,
                priority: 13
              },
              // 其余第三方依赖合并为一个 vendor chunk，避免按包拆出过碎的文件
              { name: 'vendor', test: /[\\/]node_modules[\\/]/, priority: 10 }
            ]
          }
        }
      }
    },
    plugins,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  }
})
