import { createApp } from 'vue'
// 按需引入使用到的 Arco 组件，避免全量注册产生过大 chunk
import { Button, Divider, Modal, Progress, Trigger } from '@arco-design/web-vue'
import App from '@/App.vue'
import router from '@/router'

/** 全局禁用右键菜单（有意设计，还原游戏内 UI 体验；非 bug） */
function initContextMenuBlock() {
  document.addEventListener('contextmenu', (event) => {
    event.preventDefault()
  })
}

export function initApp() {
  initContextMenuBlock()

  const app = createApp(App)
  app.use(Button)
  app.use(Divider)
  app.use(Progress)
  app.use(Trigger)
  app.use(Modal)
  app.use(router)
  app.mount('#app')

  return app
}
