import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  validateConfig,
  detectBrowserLanguage,
  createConfigLoader
} from '@/composables/configUtils'

const stubLanguage = (language: string) => {
  vi.stubGlobal('navigator', { language })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('detectBrowserLanguage', () => {
  const supported = ['zh-CN', 'zh-TW', 'en-US', 'ja-JP']

  it('精确匹配：zh-CN → zh-CN', () => {
    stubLanguage('zh-CN')
    expect(detectBrowserLanguage(supported)).toBe('zh-CN')
  })

  it('映射表：zh-HK → zh-TW', () => {
    stubLanguage('zh-HK')
    expect(detectBrowserLanguage(supported)).toBe('zh-TW')
  })

  it('前缀匹配：ja 系任何写法 → ja-JP', () => {
    stubLanguage('ja')
    expect(detectBrowserLanguage(supported)).toBe('ja-JP')
  })

  it('不支持的语言：回退 en-US', () => {
    stubLanguage('fr-FR')
    expect(detectBrowserLanguage(supported)).toBe('en-US')
  })

  it('映射命中但站点不支持该语言：继续回退 en-US', () => {
    // ko 不在映射表；用映射内语言验证 supportedLanguages 过滤
    stubLanguage('ja-JP')
    expect(detectBrowserLanguage(['zh-CN'])).toBe('en-US')
  })
})

describe('validateConfig', () => {
  it('非对象输入：返回默认配置', () => {
    const config = validateConfig(null)
    expect(config.level).toBe(1)
    expect(config.memorialLobbies).toEqual([])
    expect(config.banner?.music?.netease).toEqual([])
  })

  it('数字字段脏数据：回退默认值', () => {
    const config = validateConfig({ level: 'NaN-ish', exp: undefined, nextExp: '12' })
    expect(config.level).toBe(1)
    expect(config.exp).toBe(0)
    expect(config.nextExp).toBe(12)
  })

  it('memorialLobbies：逐项补齐缺省（name/path/skel/atlas/offset）', () => {
    const config = validateConfig({ memorialLobbies: [{}] })
    const lobby = config.memorialLobbies?.[0]
    expect(lobby?.name).toBe('角色0')
    expect(lobby?.path).toBe('/l2d/')
    expect(lobby?.skel).toBe('default.skel')
    expect(lobby?.offset).toBe(0.5)
    // offset: 0 是有意值，不能被 falsy 回退吞掉
    const zero = validateConfig({ memorialLobbies: [{ offset: 0 }] })
    expect(zero.memorialLobbies?.[0]?.offset).toBe(0)
  })

  it('banner 归一化：旧 musicID 并入 music.netease 并去重清洗', () => {
    const config = validateConfig({
      banner: {
        musicID: [123, 456],
        music: { netease: [456, 789, -1, 'junk'] }
      }
    })
    expect(config.banner?.music?.netease).toEqual([123, 456, 789])
    // 归一化后旧字段清空，不再双写
    expect(config.banner?.musicID).toEqual([])
  })

  it('banner 归一化：酷我数字简写展开为对象，非法条目丢弃', () => {
    const config = validateConfig({
      banner: { music: { kuwo: [42, -3, { id: 7, name: 'x' }, 'junk'] } }
    })
    expect(config.banner?.music?.kuwo).toEqual([{ id: 42 }, { id: 7, name: 'x' }])
  })

  it('banner 归一化：local 过滤无 url 条目；tencent 接受数字简写转字符串', () => {
    const config = validateConfig({
      banner: {
        music: {
          local: [{ url: '/a.mp3' }, { url: '' }, { name: 'no-url' }],
          tencent: [' mid1 ', 123, {}]
        }
      }
    })
    expect(config.banner?.music?.local).toEqual([{ url: '/a.mp3' }])
    expect(config.banner?.music?.tencent).toEqual(['mid1', '123'])
  })

  it('bio：deprecated 的 bth 回退为 btn；btn 优先', () => {
    const legacy = validateConfig({ bio: { bth: [{ name: 'a', path: '/a.png' }] } })
    expect(legacy.bio?.btn).toEqual([{ name: 'a', path: '/a.png' }])
    const both = validateConfig({
      bio: { bth: [{ name: 'old', path: '/o.png' }], btn: [{ name: 'new', path: '/n.png' }] }
    })
    expect(both.bio?.btn).toEqual([{ name: 'new', path: '/n.png' }])
  })
})

describe('createConfigLoader', () => {
  it('支持静态对象 / Promise / 动态函数三种配置形式', async () => {
    const loader = createConfigLoader({
      'zh-CN': { title: '静态' } as never,
      'en-US': Promise.resolve({ title: 'promise' } as never),
      'ja-JP': async () => ({ title: 'dynamic' }) as never
    })
    expect((await loader.getConfig('zh-CN')).title).toBe('静态')
    expect((await loader.getConfig('en-US')).title).toBe('promise')
    expect((await loader.getConfig('ja-JP')).title).toBe('dynamic')
    expect(loader.getSupportedLocales().sort()).toEqual(['en-US', 'ja-JP', 'zh-CN'])
  })

  it('未知语言与加载失败：均回退默认配置', async () => {
    const loader = createConfigLoader({
      'zh-CN': () => {
        throw new Error('broken')
      }
    })
    expect((await loader.getConfig('fr-FR')).level).toBe(1)
    expect((await loader.getConfig('zh-CN')).level).toBe(1)
  })
})
