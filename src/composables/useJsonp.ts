/**
 * JSONP 请求工具
 *
 * QQ 音乐 / 酷狗 / 酷我的浏览器侧接口不带 CORS 头，但支持 callback 参数返回可执行脚本；
 * 通过动态注入 <script> 绕过同源限制。回调收到的已是求值后的 JS 对象（非 JSON 文本）。
 */

let jsonpSeq = 0

/** JSONP 超时（毫秒），与 fetch 的 AbortSignal.timeout 对齐 */
export const JSONP_TIMEOUT_MS = 8000

export function jsonp<T>(
  url: string,
  callbackParam = 'callback',
  timeout = JSONP_TIMEOUT_MS
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const callbackName = `__fishArchiveJsonp${++jsonpSeq}`
    const script = document.createElement('script')
    let timer: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      delete (window as unknown as Record<string, unknown>)[callbackName]
      script.remove()
    }

    ;(window as unknown as Record<string, unknown>)[callbackName] = (data: T) => {
      cleanup()
      resolve(data)
    }

    timer = setTimeout(() => {
      cleanup()
      reject(new Error(`JSONP 请求超时: ${url}`))
    }, timeout)

    script.onerror = () => {
      cleanup()
      reject(new Error(`JSONP 加载失败: ${url}`))
    }

    const sep = url.includes('?') ? '&' : '?'
    script.src = `${url}${sep}${callbackParam}=${callbackName}`
    document.head.appendChild(script)
  })
}
