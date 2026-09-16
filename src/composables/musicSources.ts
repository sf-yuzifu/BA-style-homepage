/**
 * 多音源解析器：把配置里的各源条目统一解析成可播放的 SongInfo
 *
 * 各源链路（均为实测可用）：
 * - netease：api.injahow.cn Meting（CORS，fetch）
 * - neteasePlaylist：同上 type=playlist，一次展开为多首
 * - tencent：c.y.qq.com 元数据 + u.y.qq.com vkey（JSONP），仅免费曲可播
 * - kugou：m.kugou.com playInfo（JSONP），仅免费曲可播
 * - kuwo：search.kuwo.cn 按 rid 查元数据 + antiserver.kuwo.cn 取音频（JSONP）
 * - local：直链/自托管，无接口
 */

import { jsonp } from './useJsonp'
import type { LocalMusicEntry, MusicGroupConfig } from '@/types/config'

export interface SongInfo {
  name: string
  artist: string
  url: string
  cover?: string
  /** howler 显式格式（部分源 URL 无扩展名，靠嗅探会失败） */
  format: string[]
}

/** 随机池条目；resolved 为歌单已展开曲目 */
export type PoolItem =
  | { kind: 'netease'; id: number }
  | { kind: 'tencent'; mid: string }
  | { kind: 'kugou'; hash: string }
  | { kind: 'kuwo'; rid: number; name?: string; artist?: string; cover?: string }
  | { kind: 'local'; url: string; name?: string; artist?: string; cover?: string }
  | { kind: 'resolved'; song: SongInfo }

/** 单曲不可播（VIP / 无版权 / 曲目已下架）：换下一首，不计入 API 连续失败 */
export class TrackUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TrackUnavailableError'
  }
}

/** 源接口故障（网络/超时/响应非法）：计入连续失败，连续多次后隐藏 Banner */
export class SourceUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SourceUnavailableError'
  }
}

const FETCH_TIMEOUT_MS = 8000

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const readString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

const fetchJson = async (url: string): Promise<unknown> => {
  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  } catch (error) {
    throw new SourceUnavailableError(`请求失败: ${url} — ${String(error)}`)
  }
  if (!response.ok) {
    throw new SourceUnavailableError(`HTTP ${response.status}: ${url}`)
  }
  try {
    return await response.json()
  } catch (error) {
    throw new SourceUnavailableError(`响应解析失败: ${url} — ${String(error)}`)
  }
}

/** 把配置分组拍平成随机池 */
export function buildMusicPool(music: MusicGroupConfig | undefined): PoolItem[] {
  const pool: PoolItem[] = []
  if (!music) return pool
  for (const id of music.netease ?? []) pool.push({ kind: 'netease', id })
  for (const mid of music.tencent ?? []) pool.push({ kind: 'tencent', mid })
  for (const hash of music.kugou ?? []) pool.push({ kind: 'kugou', hash })
  for (const entry of music.kuwo ?? []) {
    const item = typeof entry === 'number' ? { id: entry } : entry
    pool.push({
      kind: 'kuwo',
      rid: item.id,
      name: item.name,
      artist: item.artist,
      cover: item.cover
    })
  }
  for (const entry of music.local ?? []) {
    pool.push({
      kind: 'local',
      url: entry.url,
      name: entry.name,
      artist: entry.artist,
      cover: entry.cover
    })
  }
  return pool
}

/** 歌单 ID 列表（供启动时并行展开） */
export function listPlaylistIds(music: MusicGroupConfig | undefined): number[] {
  return music?.neteasePlaylist ?? []
}

// ---- 网易云（Meting）----

/**
 * 解析封面直链：meting 的 pic 是 302 中转且固定跳 90x90（param=90y90），海报满铺太糊——
 * 用 HEAD 跟出最终 CDN 地址（两端都带 CORS），再把尺寸参数改成 300x300；
 * 解析失败退回原地址（90x90 也能看）
 */
const resolveNeteaseCover = async (picUrl: string): Promise<string | undefined> => {
  if (!picUrl) return undefined
  try {
    const response = await fetch(picUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
    const finalUrl = response.url || picUrl
    return finalUrl.replace(/([?&]param=)\d+y\d+/, '$1300y300')
  } catch {
    return picUrl
  }
}

const parseNeteaseSong = async (
  data: Record<string, unknown>,
  deferCover = false
): Promise<SongInfo> => {
  const url = readString(data.url)
  if (!url) {
    throw new TrackUnavailableError('网易云曲目无可播地址（可能已下架）')
  }
  const pic = readString(data.pic) || ''
  return {
    name: readString(data.title) || readString(data.name) || '',
    artist: readString(data.author) || readString(data.artist) || '',
    url,
    // 歌单展开时不逐首 HEAD（百首歌单会拖慢首播），存原始 pic，抽中播放时再升级清晰度
    cover: deferCover ? pic || undefined : await resolveNeteaseCover(pic),
    // meting 的 url 是无扩展名的 302 跳转，howler 嗅探不到格式，必须显式声明
    format: ['mp3']
  }
}

export async function resolveNetease(id: number): Promise<SongInfo> {
  const json = await fetchJson(`https://api.injahow.cn/meting/?server=netease&type=song&id=${id}`)
  const data = Array.isArray(json) ? json[0] : json
  if (!isRecord(data)) {
    throw new SourceUnavailableError('网易云曲目响应结构非法')
  }
  return parseNeteaseSong(data)
}

/** 网易云歌单一次展开；单首解析失败（VIP 等）不影响其余曲目 */
export async function expandNeteasePlaylist(id: number): Promise<SongInfo[]> {
  const json = await fetchJson(
    `https://api.injahow.cn/meting/?server=netease&type=playlist&id=${id}`
  )
  if (!Array.isArray(json)) {
    throw new SourceUnavailableError('网易云歌单响应结构非法')
  }
  const songs: SongInfo[] = []
  for (const item of json) {
    if (!isRecord(item)) continue
    try {
      // deferCover=true：歌单百首规模，逐首 HEAD 解析封面会拖慢展开数秒；
      // 存原始 pic，抽中播放时由 resolveTrack 的 resolved 分支惰性升级清晰度
      songs.push(await parseNeteaseSong(item, true))
    } catch (error) {
      if (!(error instanceof TrackUnavailableError)) throw error
      console.warn(`歌单 ${id} 中曲目跳过:`, error.message)
    }
  }
  return songs
}

// ---- QQ 音乐（JSONP）----

const tencentGuid = '10000'

/** QQ 元数据：VIP（pay_play≠0）直接判不可播，省一次 vkey 请求 */
async function fetchTencentMeta(
  mid: string
): Promise<{ name: string; artist: string; cover?: string }> {
  const json = await jsonp<Record<string, unknown>>(
    `https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?songmid=${encodeURIComponent(mid)}&format=jsonp`
  )
  const list = Array.isArray(json?.data) ? json.data : []
  const data = list[0]
  if (!isRecord(data)) {
    throw new TrackUnavailableError(`QQ 音乐无此曲目: ${mid}`)
  }
  const pay = isRecord(data.pay) ? data.pay : {}
  if (typeof pay.pay_play === 'number' && pay.pay_play !== 0) {
    throw new TrackUnavailableError(`QQ 音乐 VIP 曲目跳过: ${mid}`)
  }
  const singer = Array.isArray(data.singer)
    ? data.singer
        .map((s) => (isRecord(s) ? readString(s.name) : undefined))
        .filter((n): n is string => !!n)
        .join('/')
    : ''
  const albumMid = isRecord(data.album) ? readString(data.album.mid) : undefined
  return {
    name: readString(data.title) || readString(data.name) || '',
    artist: singer,
    cover: albumMid ? `https://y.qq.com/music/photo_new/T002R300x300M000${albumMid}.jpg` : undefined
  }
}

export async function resolveTencent(mid: string): Promise<SongInfo> {
  const meta = await fetchTencentMeta(mid)

  const vkeyUrl =
    'https://u.y.qq.com/cgi-bin/musicu.fcg?data=' +
    encodeURIComponent(
      JSON.stringify({
        req_0: {
          module: 'vkey.GetVkeyServer',
          method: 'CgiGetVkey',
          param: {
            guid: tencentGuid,
            songmid: [mid],
            songtype: [0],
            uin: '0',
            loginflag: 1,
            platform: '20'
          }
        }
      })
    )
  const json = await jsonp<Record<string, Record<string, unknown>>>(vkeyUrl)
  const req0 = json?.req_0
  if (!isRecord(req0)) {
    throw new SourceUnavailableError('QQ 音乐 vkey 响应结构非法')
  }
  const data = isRecord(req0.data) ? req0.data : undefined
  if (!data) {
    throw new SourceUnavailableError('QQ 音乐 vkey 响应缺 data')
  }
  const midurlinfo = Array.isArray(data.midurlinfo) ? data.midurlinfo : []
  const info = midurlinfo[0]
  const purl = isRecord(info) ? readString(info.purl) : undefined
  if (!purl) {
    throw new TrackUnavailableError(`QQ 音乐无可播地址（VIP 或版权下架）: ${mid}`)
  }
  const sipList = Array.isArray(data.sip)
    ? data.sip.filter((s): s is string => typeof s === 'string')
    : []
  // sip 是 http:// 地址，HTTPS 页面会被 mixed content 拦截，改写为 https
  const sip = sipList.find((s) => s.includes('stream')) ?? sipList[0]
  if (!sip) {
    throw new SourceUnavailableError('QQ 音乐 vkey 响应缺 sip')
  }
  const base = sip.replace(/^http:\/\//, 'https://')
  return {
    ...meta,
    url: `${base}${purl}`,
    format: ['m4a']
  }
}

// ---- 酷狗（JSONP）----

interface KugouInfoData {
  url?: unknown
  songName?: unknown
  choricSinger?: unknown
  album_img?: unknown
}

export async function resolveKugou(hash: string): Promise<SongInfo> {
  const json = await jsonp<KugouInfoData>(
    `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${encodeURIComponent(hash)}&format=jsonp`
  )
  if (!isRecord(json)) {
    throw new SourceUnavailableError('酷狗响应结构非法')
  }
  const url = readString(json.url)
  if (!url) {
    throw new TrackUnavailableError(`酷狗无可播地址（VIP 或版权下架）: ${hash}`)
  }
  const coverTemplate = readString(json.album_img)
  return {
    name: readString(json.songName) || '',
    artist: readString(json.choricSinger) || '',
    url,
    // album_img 是 http + {size} 占位模板，升 https 并替换为 400 尺寸
    cover: coverTemplate
      ? coverTemplate.replace(/^http:\/\//, 'https://').replace('{size}', '400')
      : undefined,
    format: ['mp3']
  }
}

// ---- 酷我（JSONP）----

/** 酷我搜索接口返回单引号伪 JSON，但经 script 求值后回调收到的是 JS 对象，直接读字段 */
interface KuwoSearchList {
  abslist?: unknown[]
}

const decodeKuwoText = (value: string | undefined): string | undefined =>
  value ? value.replace(/&nbsp;/g, ' ').trim() || undefined : undefined

async function fetchKuwoMeta(
  rid: number
): Promise<{ name?: string; artist?: string; cover?: string }> {
  const json = await jsonp<KuwoSearchList>(
    `https://search.kuwo.cn/r.s?rid=MUSIC_${rid}&ft=music&rn=1&pn=0&rformat=json&encoding=utf8&moession=1`
  )
  const list = Array.isArray(json?.abslist) ? json.abslist : []
  const data = list[0]
  if (!isRecord(data)) return {}
  const picPath = readString(data.web_albumpic_short)
  return {
    name: decodeKuwoText(readString(data.SONGNAME)),
    artist: decodeKuwoText(readString(data.ARTIST)),
    // 短路径形如 120/70/15/667958326.jpg，首段是尺寸，替换为 400
    cover: picPath
      ? `https://img1.kuwo.cn/star/albumcover/${picPath.replace(/^\d+/, '400')}`
      : undefined
  }
}

export async function resolveKuwo(entry: {
  rid: number
  name?: string
  artist?: string
  cover?: string
}): Promise<SongInfo> {
  // 元数据接口不稳定（部分 rid 查不到），失败不阻断播放，回退配置手写值
  let meta: Awaited<ReturnType<typeof fetchKuwoMeta>> = {}
  try {
    meta = await fetchKuwoMeta(entry.rid)
  } catch (error) {
    console.warn(`酷我元数据获取失败 rid=${entry.rid}:`, error)
  }

  const json = await jsonp<{ code?: unknown; url?: unknown }>(
    `https://antiserver.kuwo.cn/anti.s?type=convert_url3&rid=MUSIC_${entry.rid}&format=mp3&response=url`
  )
  const url = isRecord(json) ? readString(json.url) : undefined
  if (!url) {
    throw new TrackUnavailableError(`酷我无可播地址: ${entry.rid}`)
  }
  return {
    name: entry.name || meta.name || '',
    artist: entry.artist || meta.artist || '',
    url,
    cover: entry.cover || meta.cover,
    format: ['mp3']
  }
}

// ---- 直链 ----

const formatFromUrl = (url: string): string[] => {
  const ext = (url.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase()
  if (ext === 'm4a' || ext === 'mp4' || ext === 'aac') return ['m4a']
  if (ext === 'ogg' || ext === 'oga') return ['ogg']
  if (ext === 'wav') return ['wav']
  if (ext === 'flac') return ['flac']
  return ['mp3']
}

export function resolveLocal(entry: LocalMusicEntry): SongInfo {
  return {
    name: entry.name || '',
    artist: entry.artist || '',
    url: entry.url,
    cover: entry.cover,
    format: formatFromUrl(entry.url)
  }
}

// ---- 统一分发 ----

export async function resolveTrack(item: PoolItem): Promise<SongInfo> {
  switch (item.kind) {
    case 'resolved': {
      // 歌单展开时封面延迟解析（低清 meting pic 中转 URL），抽中播放时才 HEAD 升级
      const song = item.song
      if (song.cover && song.cover.includes('type=pic')) {
        return { ...song, cover: await resolveNeteaseCover(song.cover) }
      }
      return song
    }
    case 'netease':
      return resolveNetease(item.id)
    case 'tencent':
      return resolveTencent(item.mid)
    case 'kugou':
      return resolveKugou(item.hash)
    case 'kuwo':
      return resolveKuwo({ rid: item.rid, name: item.name, artist: item.artist, cover: item.cover })
    case 'local':
      return resolveLocal({
        url: item.url,
        name: item.name,
        artist: item.artist,
        cover: item.cover
      })
  }
}
