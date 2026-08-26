import './assets/index.css'
// 按需引入使用到的 Arco 组件样式（css.js 会自动带上基础样式）
import '@arco-design/web-vue/es/button/style/css.js'
import '@arco-design/web-vue/es/divider/style/css.js'
import '@arco-design/web-vue/es/progress/style/css.js'
import '@arco-design/web-vue/es/trigger/style/css.js'
import '@arco-design/web-vue/es/modal/style/css.js'

import { initApp } from '@/init/app'
import { initPWA } from '@/init/pwa'
import { initLinkHandler } from '@/init/links'
import { useConfig } from '@/composables/useConfig'
import { useAp } from '@/composables/useAp'

// 初始化应用
initApp()

// 初始化PWA
initPWA()

// 初始化链接处理器
initLinkHandler()

// 启动初始化流程
async function startApp() {
  try {
    // 初始化配置并设置页面标题
    const { configs, waitForConfig } = useConfig()

    // 等待配置加载完成
    await waitForConfig()

    // 设置页面标题
    const config = configs.value
    if (config && config.title) {
      document.title = config.title
    } else {
      document.title = '个人主页'
    }

    // 初始化 AP
    const { initAp } = useAp()
    initAp()

    console.log('main.js 初始化完成，等待useLoading管理')

    // 注意：不再在这里加载字体和Live2D，让useLoading来处理
    // 这样可以确保加载顺序正确
  } catch (error) {
    console.error('应用初始化失败:', error)
    // 设置默认标题
    document.title = '个人主页'
  }
}

// 启动应用
startApp()
