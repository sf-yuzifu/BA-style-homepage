import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildMusicPool,
  listPlaylistIds,
  resolveTrack,
  resolveNetease,
  SourceUnavailableError,
  TrackUnavailableError
} from '@/composables/musicSources'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** fetch mock：按 method/URL 分发；json 响应用于 GET，HEAD 响应用于封面升级 */
const stubFetch = (
  handler: (input: string, init?: RequestInit) => Record<string, unknown> | Error
) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const result = handler(String(input), init)
      if (result instanceof Error) throw result
      return result as Response
    })
  )
}

describe('buildMusicPool / listPlaylistIds', () => {
  it('空配置：空池', () => {
    expect(buildMusicPool(undefined)).toEqual([])
    expect(listPlaylistIds(undefined)).toEqual([])
  })

  it('各源拍平顺序：netease → tencent → kugou → kuwo → local；酷我数字简写转 rid', () => {
    const pool = buildMusicPool({
      netease: [1, 2],
      tencent: ['mid'],
      kugou: ['hash'],
      kuwo: [42, { id: 7, name: 'x' }],
      local: [{ url: '/a.mp3', name: '本地' }]
    })
    expect(pool).toEqual([
      { kind: 'netease', id: 1 },
      { kind: 'netease', id: 2 },
      { kind: 'tencent', mid: 'mid' },
      { kind: 'kugou', hash: 'hash' },
      { kind: 'kuwo', rid: 42, name: undefined, artist: undefined, cover: undefined },
      { kind: 'kuwo', rid: 7, name: 'x', artist: undefined, cover: undefined },
      { kind: 'local', url: '/a.mp3', name: '本地', artist: undefined, cover: undefined }
    ])
    expect(listPlaylistIds({ neteasePlaylist: [9, 8] })).toEqual([9, 8])
  })
})

describe('resolveTrack：local 格式嗅探', () => {
  const formatOf = async (url: string) => (await resolveTrack({ kind: 'local', url })).format

  it('按扩展名映射 howler 格式', async () => {
    await expect(formatOf('/a.mp3')).resolves.toEqual(['mp3'])
    await expect(formatOf('/a.m4a')).resolves.toEqual(['m4a'])
    await expect(formatOf('/a.mp4')).resolves.toEqual(['m4a'])
    await expect(formatOf('/a.aac')).resolves.toEqual(['m4a'])
    await expect(formatOf('/a.ogg')).resolves.toEqual(['ogg'])
    await expect(formatOf('/a.wav')).resolves.toEqual(['wav'])
    await expect(formatOf('/a.flac')).resolves.toEqual(['flac'])
  })

  it('查询串剥离 + 大小写不敏感 + 未知/无扩展名回退 mp3', async () => {
    await expect(formatOf('/a.MP3?token=x')).resolves.toEqual(['mp3'])
    await expect(formatOf('/a.OGG?x=1')).resolves.toEqual(['ogg'])
    await expect(formatOf('/no-ext')).resolves.toEqual(['mp3'])
    await expect(formatOf('/a.weird')).resolves.toEqual(['mp3'])
  })
})

describe('resolveTrack：resolved（歌单展开曲目）', () => {
  it('封面非 meting 中转：原样返回，不发请求', async () => {
    const song = {
      name: 'n',
      artist: 'a',
      url: '/x.mp3',
      cover: 'https://cdn.x/c.jpg',
      format: ['mp3']
    }
    await expect(resolveTrack({ kind: 'resolved', song })).resolves.toEqual(song)
  })

  it('封面是 meting 中转（type=pic）：HEAD 跟出最终地址并升 300 清晰度', async () => {
    stubFetch((input, init) => {
      if (init?.method === 'HEAD') return { url: 'https://cdn.x/f.jpg?param=90y90' }
      throw new Error('不应发起 GET')
    })
    const song = {
      name: 'n',
      artist: 'a',
      url: '/x.mp3',
      cover: 'https://api.injahow.cn/meting/?type=pic&id=1',
      format: ['mp3']
    }
    const resolved = await resolveTrack({ kind: 'resolved', song })
    expect(resolved.cover).toBe('https://cdn.x/f.jpg?param=300y300')
  })
})

describe('resolveNetease', () => {
  it('正常解析：字段映射 + 封面 HEAD 升级 300y300', async () => {
    stubFetch((input, init) => {
      if (init?.method === 'HEAD') return { url: 'https://cdn.x/final.jpg?param=90y90' }
      if (input.includes('type=song')) {
        return {
          ok: true,
          json: async () => [
            {
              url: 'https://m.x/s.mp3',
              title: '歌名',
              author: '艺人',
              pic: 'https://p.x/c.jpg?param=90y90'
            }
          ]
        }
      }
      throw new Error('unexpected: ' + input)
    })
    const song = await resolveNetease(123)
    expect(song).toEqual({
      name: '歌名',
      artist: '艺人',
      url: 'https://m.x/s.mp3',
      cover: 'https://cdn.x/final.jpg?param=300y300',
      format: ['mp3']
    })
  })

  it('封面 HEAD 失败：回退原始 pic，不影响播放', async () => {
    stubFetch((input, init) => {
      if (init?.method === 'HEAD') return new Error('network')
      return {
        ok: true,
        json: async () => [{ url: 'https://m.x/s.mp3', pic: 'https://p.x/c.jpg' }]
      }
    })
    const song = await resolveNetease(123)
    expect(song.cover).toBe('https://p.x/c.jpg')
  })

  it('曲目无可播地址（VIP/下架）：TrackUnavailableError（换下一首，不计连续失败）', async () => {
    stubFetch(() => ({ ok: true, json: async () => [{ name: '无 url' }] }))
    await expect(resolveNetease(1)).rejects.toBeInstanceOf(TrackUnavailableError)
  })

  it('HTTP 错误 / 网络失败 / 响应非法：SourceUnavailableError（计连续失败）', async () => {
    stubFetch(() => ({ ok: false, status: 500 }))
    await expect(resolveNetease(1)).rejects.toBeInstanceOf(SourceUnavailableError)

    stubFetch(() => new Error('network down'))
    await expect(resolveNetease(1)).rejects.toBeInstanceOf(SourceUnavailableError)

    stubFetch(() => ({ ok: true, json: async () => 'not-an-object' }))
    await expect(resolveNetease(1)).rejects.toBeInstanceOf(SourceUnavailableError)
  })
})
