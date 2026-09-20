import { describe, it, expect, vi, afterEach } from 'vitest'
import { retryAsync } from '@/utils/retry'

describe('retryAsync', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('首次成功：不重试，直接返回结果', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(retryAsync(fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('失败 2 次后成功：共 3 次尝试，按 400/800ms 线性退避', async () => {
    vi.useFakeTimers()
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockResolvedValue('ok')

    const promise = retryAsync(fn)
    // 首次尝试立即执行并失败，随后第 1 次重试前等 400ms
    await vi.advanceTimersByTimeAsync(400)
    expect(fn).toHaveBeenCalledTimes(2)
    // 第 2 次重试前等 800ms
    await vi.advanceTimersByTimeAsync(800)
    await expect(promise).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('全部失败：抛出最后一次的错误，尝试次数 = maxRetries + 1', async () => {
    vi.useFakeTimers()
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockRejectedValueOnce(new Error('e3'))
      .mockRejectedValue(new Error('final'))

    const promise = retryAsync(fn)
    const assertion = expect(promise).rejects.toThrow('final')
    await vi.advanceTimersByTimeAsync(400 + 800 + 1200)
    await assertion
    expect(fn).toHaveBeenCalledTimes(4)
  })

  it('maxRetries = 0：只尝试一次，失败立即抛出（不等退避）', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('once'))
    await expect(retryAsync(fn, 0)).rejects.toThrow('once')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
