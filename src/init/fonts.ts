import { css as font1 } from '@/assets/font/ResourceHanRoundedCN-Medium.ttf'
import { css as font2 } from '@/assets/font/ResourceHanRoundedCN-Bold.ttf'

export function loadFonts() {
  try {
    console.log(`加载字体: ${font1.family}, 字重: ${font1.weight}`)
    console.log(`加载字体: ${font2.family}, 字重: ${font2.weight}`)
    // 真正等待字体加载完成（解析为 document.fonts.ready 的 Promise）
    return document.fonts.ready
  } catch (error) {
    console.error('字体加载失败:', error)
    return Promise.reject(error)
  }
}
