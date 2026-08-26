import { fileURLToPath, URL } from 'node:url'

import { load } from 'js-yaml'
import fs from 'fs'
const config = load(fs.readFileSync('_config.yaml', 'utf8'))

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import viteCompression from 'vite-plugin-compression'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { VitePWA } from 'vite-plugin-pwa'
import { createHtmlPlugin } from 'vite-plugin-html'
import Font from 'vite-plugin-font'
import yaml from '@rollup/plugin-yaml'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    assetsInlineLimit: 0,
    minify: 'esbuild',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          const pkg = id.toString().split('node_modules/')[1].split('/')[0]

          // Vue 框架核心
          if (['vue', 'vue-router', '@vue'].includes(pkg)) return 'vue-core'
          // PIXI 渲染引擎与 Spine 骨骼动画
          if (
            ['pixi.js', '@pixi', '@esotericsoftware', 'eventemitter3', 'earcut', 'ismobilejs'].includes(pkg)
          )
            return 'pixi'
          // Arco 组件库及其内部依赖
          if (
            ['@arco-design', 'dayjs', 'number-precision', 'b-tween', 'b-validate',
             'compute-scroll-into-view', 'scroll-into-view-if-needed', 'resize-observer-polyfill'].includes(pkg)
          )
            return 'arco'
          // 音视频播放
          if (['aplayer', 'axios', 'howler'].includes(pkg)) return 'media'
          // 其余第三方依赖合并为一个 vendor chunk，避免按包拆出过碎的文件
          return 'vendor'
        }
      }
    }
  },
  plugins: [
    vue(),
    vueJsx(),
    Font.vite({
      css: {
        fontFamily: 'Resource Han Rounded CN'
      }
    }),
    createHtmlPlugin({
      inject: {
        data: {
          title: config.title,
          favicon: config.favicon,
          author: config.author,
          themeColor: config.manifest.theme_color,
          description: config.description,
          keywords: config.keywords
        }
      }
    }),
    ViteImageOptimizer({
      png: {
        quality: 85,
      },
      jpeg: {
        quality: 85,
      },
      jpg: {
        quality: 85,
      },
      webp: {
        quality: 85,
      },
      svg: {
        multipass: true,
        plugins: [
          {
            name: 'preset-default',
            params: {
              overrides: {
                removeViewBox: false,
              },
            },
          },
        ],
      },
    }),
    VitePWA({
      mode: 'production',
      base: '/',
      registerType: 'prompt',
      injectRegister: 'auto',
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ba-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: config.manifest
    }),
    viteCompression({
      threshold: 10240 // the unit is Bytes
    }),
    yaml()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
