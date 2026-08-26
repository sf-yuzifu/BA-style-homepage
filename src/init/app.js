import { createApp } from 'vue'
// 按需引入使用到的 Arco 组件，避免全量注册产生过大 chunk
import { Button, Divider, Modal, Progress, Trigger } from '@arco-design/web-vue'
import App from '@/App.vue'
import router from '@/router'

export function initApp() {
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
