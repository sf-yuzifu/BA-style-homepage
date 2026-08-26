import { Modal } from '@arco-design/web-vue'
import { registerSW } from 'virtual:pwa-register'
import { useConfig } from '@/composables/useConfig'

export function initPWA() {
  if ('serviceWorker' in navigator) {
    const { configs } = useConfig()

    const updateSW = registerSW({
      onNeedRefresh() {
        const config = configs.value

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
