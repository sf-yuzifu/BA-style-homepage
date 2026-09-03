/**
 * 失败自动重试：首次尝试失败后再重试 maxRetries 次，重试前按次数递增等待（线性退避）。
 * 所有尝试均失败时抛出最后一次的错误。
 *
 * @param fn 需要重试的异步操作
 * @param maxRetries 最大重试次数（不含首次尝试），默认 3
 * @param baseDelayMs 重试基础间隔（毫秒），第 n 次重试前等待 baseDelayMs * n
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 400
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt))
    }
    try {
      return await fn()
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}
