import { Modal } from '@arco-design/web-vue'
import { registerSW } from 'virtual:pwa-register'
import { useConfig } from '@/composables/useConfig'

export function initPWA() {
  if ('serviceWorker' in navigator) {
    const { waitForConfig } = useConfig()

    const updateSW = registerSW({
      // onNeedRefresh 由 SW 触发，时机不可控（可能早于配置就绪），需先等待配置加载完成
      async onNeedRefresh() {
        let config
        try {
          config = await waitForConfig()
        } catch (error) {
          // 配置加载超时等极端情况：使用兜底文案（与项目默认语言 en-US 一致），保证更新提示不丢失
          console.error('等待配置失败，PWA 更新提示使用兜底文案:', error)
          config = {
            translate: {
              info: 'Update',
              update: 'A new version is available. Refresh now?',
              ok: 'Refresh',
              cancel: 'Later'
            }
          }
        }

        Modal.open({
          title: config.translate.info,
          content: config.translate.update,
          okText: config.translate.ok,
          cancelText: config.translate.cancel,
          onOk: () => {
            updateSW(true)
          }
        })
      },
      onOfflineReady() {
        console.log('应用已准备好离线使用')
      }
    })

    return updateSW
  }
  return null
}
