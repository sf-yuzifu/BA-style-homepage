/**
 * Spotify 歌单同步：抓 Spotify 公开歌单/单曲的曲目列表，到网易云/QQ 音乐搜索匹配，
 * 输出可直接粘贴进 _config.yaml 的 netease / tencent 片段。
 *
 * 用法：yarn spotify:sync
 *
 * 链路（全部免登录/免 key）：
 * - Spotify：open.spotify.com/embed/{track|playlist}/{id} 页内 __NEXT_DATA__ JSON
 * - 网易云：music.163.com/api/cloudsearch/pc 搜索（无 CORS，Node 直连）+
 *          api/song/enhance/player/url 批量探活（fee=0 不保证可播，必须探）
 * - QQ：c.y.qq.com/soso/fcgi-bin/client_search_cp（format=json 直返 JSON），
 *        pay.payplay===0 即免费
 *
 * 已知限制：
 * - embed 页歌单曲目上限约 50 首，超长歌单截断
 * - 匹配有误差（同名歌/翻唱/feat 写法），报告供人工抽查
 * - 热门 VIP 曲（如周杰伦）国内源无免费原版，会落到免费翻唱/Live 或跳过
 */

import fs from 'node:fs'
import path from 'node:path'

import { load } from 'js-yaml'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const SEARCH_LIMIT = 50
const PROBE_BATCH = 50
const REQUEST_DELAY_MS = 150
/** 两轮匹配阈值：严格（歌名+艺人双命中）/ 放宽（歌名命中+艺人部分命中） */
const STRICT_SCORE = 80
const RELAXED_SCORE = 60

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ---- 类型 ----

interface SpotifyTrack {
  name: string
  artist: string
  durationMs: number
}

interface Candidate {
  source: 'netease' | 'tencent'
  id: string
  name: string
  artist: string
  durationMs: number
  score: number
}

interface TrackResult {
  track: SpotifyTrack
  match?: Candidate
  /** 未匹配原因 */
  reason?: string
}

// ---- 文本归一化 ----

/** 歌名归一化：NFKC + 小写 + 去空白 + 剥括号变体（Live/Cover/DJ…）+ 去 feat. 后缀 */
function normalizeTitle(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s*(feat|ft|featuring)\.?\s.*$/i, '')
    .replace(/\s+/g, '')
}

/** 变体标记检测：Live/Cover/DJ/伴奏/KTV/Remix 等 */
function hasVariantMarker(raw: string): boolean {
  return /[(（]|live|cover|dj|伴奏|ktv|remix|翻唱|片段|铃声/i.test(raw)
}

/** 艺人拆分：按 / & 、 , feat × 拆多艺人，归一化小写 */
function splitArtists(raw: string): string[] {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .split(/[/&,、]|feat\.?|ft\.?|featuring|×/i)
    .map((a) => a.trim())
    .filter(Boolean)
}

/** 匹配打分：歌名 0~50 + 艺人 0~30 + 时长 0~±20 + 非变体 0~10 */
function scoreMatch(target: SpotifyTrack, cand: { name: string; artist: string; durationMs: number }): number {
  let score = 0
  const t = normalizeTitle(target.name)
  const c = normalizeTitle(cand.name)
  if (t && t === c) score += 50
  else if (t && c && (t.includes(c) || c.includes(t))) score += 30

  const tArtists = splitArtists(target.artist)
  const cArtists = splitArtists(cand.artist)
  if (tArtists.length > 0 && cArtists.length > 0) {
    const hit = tArtists.filter((a) => cArtists.some((b) => b.includes(a) || a.includes(b)))
    if (hit.length === tArtists.length) score += 30
    else if (hit.length > 0) score += 15
  }

  const diff = Math.abs(target.durationMs - cand.durationMs)
  if (diff <= 5000) score += 20
  else if (diff <= 15000) score += 10
  else if (diff > 30000) score -= 20

  if (!hasVariantMarker(cand.name)) score += 10
  return score
}

// ---- Spotify ----

function parseSpotifyUrl(url: string): { type: 'track' | 'playlist'; id: string } | null {
  const m = url.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|playlist)\/([A-Za-z0-9]+)/)
  return m ? { type: m[1] as 'track' | 'playlist', id: m[2] } : null
}

async function fetchSpotifyTracks(type: 'track' | 'playlist', id: string): Promise<SpotifyTrack[]> {
  const embedUrl = `https://open.spotify.com/embed/${type}/${id}`
  const res = await fetch(embedUrl, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Spotify embed HTTP ${res.status}: ${embedUrl}`)
  const html = await res.text()
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)
  if (!m) throw new Error(`未找到 __NEXT_DATA__: ${embedUrl}`)
  const json = JSON.parse(m[1]) as {
    props?: { pageProps?: { state?: { data?: { entity?: Record<string, unknown> } } } }
  }
  const entity = json.props?.pageProps?.state?.data?.entity
  if (!entity) throw new Error(`embed 响应缺 entity: ${embedUrl}`)

  if (type === 'track') {
    const artists = Array.isArray(entity.artists)
      ? (entity.artists as { name?: string }[]).map((a) => a.name ?? '').filter(Boolean)
      : []
    return [
      {
        name: String(entity.name ?? ''),
        artist: artists.join(', '),
        durationMs: Number(entity.duration) || 0
      }
    ]
  }

  const list = Array.isArray(entity.trackList) ? (entity.trackList as Record<string, unknown>[]) : []
  return list.map((item) => ({
    name: String(item.title ?? ''),
    artist: String(item.subtitle ?? ''),
    durationMs: Number(item.duration) || 0
  }))
}

// ---- 网易云 ----

interface NeteaseSong {
  id: number
  name: string
  artist: string
  durationMs: number
  score: number
}

async function searchNetease(keyword: string): Promise<NeteaseSong[]> {
  const url = `https://music.163.com/api/cloudsearch/pc?s=${encodeURIComponent(keyword)}&type=1&limit=${SEARCH_LIMIT}`
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://music.163.com/' } })
  if (!res.ok) throw new Error(`网易云搜索 HTTP ${res.status}`)
  const json = (await res.json()) as {
    result?: { songs?: Record<string, unknown>[] }
  }
  const songs = json.result?.songs ?? []
  const out: NeteaseSong[] = []
  for (const s of songs) {
    // fee: 0=免费 1=VIP 4=数字专辑 8=低品免费/高品VIP；后两者探活后定夺，1/4 直接排除
    const fee = Number(s.fee)
    if (fee === 1 || fee === 4) continue
    const ar = Array.isArray(s.ar) ? (s.ar as { name?: string }[]).map((a) => a.name ?? '') : []
    out.push({
      id: Number(s.id),
      name: String(s.name ?? ''),
      artist: ar.filter(Boolean).join(', '),
      durationMs: Number(s.dt) || 0,
      score: 0
    })
  }
  return out
}

/** 批量探活：url!==null 即匿名可播（fee 字段不可靠，必须探） */
async function probeNeteasePlayable(ids: number[]): Promise<Set<number>> {
  const playable = new Set<number>()
  for (let i = 0; i < ids.length; i += PROBE_BATCH) {
    const chunk = ids.slice(i, i + PROBE_BATCH)
    const url = `https://music.163.com/api/song/enhance/player/url?ids=[${chunk.join(',')}]&br=128000`
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: 'https://music.163.com/' }
    })
    if (!res.ok) {
      console.warn(`  探活 HTTP ${res.status}，跳过该批次`)
      continue
    }
    const json = (await res.json()) as { data?: { id?: number; url?: unknown }[] }
    for (const item of json.data ?? []) {
      if (item.url !== null && item.url !== undefined && item.id) playable.add(item.id)
    }
    await sleep(REQUEST_DELAY_MS)
  }
  return playable
}

// ---- QQ ----

interface QQSong {
  mid: string
  name: string
  artist: string
  durationMs: number
  score: number
}

async function searchQQ(keyword: string): Promise<QQSong[]> {
  const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${encodeURIComponent(keyword)}&format=json&p=1&n=${SEARCH_LIMIT}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`QQ 搜索 HTTP ${res.status}`)
  const json = (await res.json()) as {
    data?: { song?: { list?: Record<string, unknown>[] } }
  }
  const list = json.data?.song?.list ?? []
  const out: QQSong[] = []
  for (const s of list) {
    const pay = s.pay as { payplay?: number } | undefined
    if (pay?.payplay !== 0) continue
    const singer = Array.isArray(s.singer)
      ? (s.singer as { name?: string }[]).map((x) => x.name ?? '')
      : []
    out.push({
      mid: String(s.songmid ?? ''),
      name: String(s.songname ?? ''),
      artist: singer.filter(Boolean).join(', '),
      durationMs: (Number(s.interval) || 0) * 1000,
      score: 0
    })
  }
  return out
}

// ---- 主流程 ----

interface RawConfig {
  banner?: { musicID?: number[]; music?: Record<string, unknown> }
}

function readConfig(root: string): RawConfig {
  const configPath = path.join(root, '_config.yaml')
  if (!fs.existsSync(configPath)) {
    throw new Error(`找不到 _config.yaml（请在项目根目录运行）`)
  }
  return load(fs.readFileSync(configPath, 'utf8')) as RawConfig
}

function collectSpotifyUrls(music: Record<string, unknown> | undefined): string[] {
  if (!Array.isArray(music?.spotify)) return []
  return music.spotify.filter((u): u is string => typeof u === 'string' && u.length > 0)
}

function collectExistingIds(music: Record<string, unknown> | undefined, musicID: number[] | undefined): {
  netease: Set<string>
  tencent: Set<string>
} {
  const netease = new Set<string>()
  for (const id of [...(musicID ?? []), ...((music?.netease as number[]) ?? [])]) {
    netease.add(String(id))
  }
  const tencent = new Set<string>()
  for (const mid of (music?.tencent as (string | number)[]) ?? []) {
    tencent.add(String(mid))
  }
  return { netease, tencent }
}

async function main() {
  const root = process.cwd()
  const config = readConfig(root)
  const music = config.banner?.music
  const urls = collectSpotifyUrls(music)

  if (urls.length === 0) {
    console.log(
      `_config.yaml 的 banner.music.spotify 未配置。\n\n请添加 Spotify 歌曲/歌单链接，例如：\n\nbanner:\n  music:\n    spotify:\n      - https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M\n`
    )
    return
  }

  console.log(`读取到 ${urls.length} 个 Spotify 链接\n`)

  // 1. 抓取全部 Spotify 曲目（跨链接去重）
  const trackMap = new Map<string, SpotifyTrack>()
  for (const url of urls) {
    const parsed = parseSpotifyUrl(url)
    if (!parsed) {
      console.warn(`跳过无法解析的链接: ${url}`)
      continue
    }
    try {
      const tracks = await fetchSpotifyTracks(parsed.type, parsed.id)
      console.log(`[${parsed.type}] ${parsed.id} → ${tracks.length} 首`)
      for (const t of tracks) {
        if (!t.name) continue
        const key = `${normalizeTitle(t.name)}|${splitArtists(t.artist).sort().join(',')}`
        if (!trackMap.has(key)) trackMap.set(key, t)
      }
    } catch (error) {
      console.warn(`抓取失败 ${url}: ${error instanceof Error ? error.message : String(error)}`)
    }
    await sleep(REQUEST_DELAY_MS)
  }

  const tracks = [...trackMap.values()]
  if (tracks.length === 0) {
    console.log('未抓到任何曲目')
    return
  }
  console.log(`\n去重后共 ${tracks.length} 首，开始搜索匹配…\n`)

  // 2. 并行搜两源（每首：网易 + QQ），收集网易候选 ID 供批量探活
  const neteasePools = new Map<number, NeteaseSong[]>() // trackIndex → 候选
  const qqPools = new Map<number, QQSong[]>()
  const allCandidateIds: number[] = []

  for (let i = 0; i < tracks.length; i++) {
    const keyword = `${tracks[i].name} ${tracks[i].artist}`.trim()
    const [ne, qq] = await Promise.all([
      searchNetease(keyword).catch((e) => {
        console.warn(`  网易搜索失败 [${keyword}]: ${e}`)
        return [] as NeteaseSong[]
      }),
      searchQQ(keyword).catch((e) => {
        console.warn(`  QQ 搜索失败 [${keyword}]: ${e}`)
        return [] as QQSong[]
      })
    ])
    neteasePools.set(i, ne)
    qqPools.set(i, qq)
    for (const c of ne) allCandidateIds.push(c.id)
    if ((i + 1) % 10 === 0) console.log(`  已搜索 ${i + 1}/${tracks.length}`)
    await sleep(REQUEST_DELAY_MS)
  }

  // 3. 网易批量探活
  const uniqueIds = [...new Set(allCandidateIds)]
  console.log(`\n网易候选 ${uniqueIds.length} 个，批量探活…`)
  const playableIds = await probeNeteasePlayable(uniqueIds)
  console.log(`可播 ${playableIds.size}/${uniqueIds.length}\n`)

  // 4. 逐首打分选最佳
  const results: TrackResult[] = []
  const newNetease: string[] = []
  const newTencent: string[] = []
  const existing = collectExistingIds(music, config.banner?.musicID)
  const seenNetease = new Set(existing.netease)
  const seenTencent = new Set(existing.tencent)

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]
    const neCands = (neteasePools.get(i) ?? [])
      .map((c) => ({ ...c, score: scoreMatch(track, c) }))
      .filter((c) => playableIds.has(c.id))
      .sort((a, b) => b.score - a.score)
    const qqCands = (qqPools.get(i) ?? [])
      .map((c) => ({ ...c, score: scoreMatch(track, c) }))
      .sort((a, b) => b.score - a.score)

    let match: Candidate | undefined
    for (const threshold of [STRICT_SCORE, RELAXED_SCORE]) {
      const pool: Candidate[] = []
      if (neCands[0] && neCands[0].score >= threshold) {
        pool.push({
          source: 'netease',
          id: String(neCands[0].id),
          name: neCands[0].name,
          artist: neCands[0].artist,
          durationMs: neCands[0].durationMs,
          score: neCands[0].score
        })
      }
      if (qqCands[0] && qqCands[0].score >= threshold) {
        pool.push({
          source: 'tencent',
          id: qqCands[0].mid,
          name: qqCands[0].name,
          artist: qqCands[0].artist,
          durationMs: qqCands[0].durationMs,
          score: qqCands[0].score
        })
      }
      if (pool.length > 0) {
        pool.sort((a, b) => b.score - a.score)
        match = pool[0]
        break
      }
    }

    if (match) {
      results.push({ track, match })
      if (match.source === 'netease') {
        if (!seenNetease.has(match.id)) {
          seenNetease.add(match.id)
          newNetease.push(match.id)
        }
      } else if (!seenTencent.has(match.id)) {
        seenTencent.add(match.id)
        newTencent.push(match.id)
      }
    } else {
      const reasons: string[] = []
      reasons.push(neCands.length === 0 ? '网易无可播候选' : `网易最佳 ${neCands[0].score} 分`)
      reasons.push(qqCands.length === 0 ? 'QQ 无免费候选' : `QQ 最佳 ${qqCands[0].score} 分`)
      results.push({ track, reason: reasons.join('；') })
    }
  }

  // 5. 报告
  let ok = 0
  let neCount = 0
  let qqCount = 0
  for (const [i, r] of results.entries()) {
    const t = r.track
    const dur = (t.durationMs / 1000).toFixed(0)
    if (r.match) {
      ok++
      if (r.match.source === 'netease') neCount++
      else qqCount++
      const m = r.match
      const diff = ((m.durationMs - t.durationMs) / 1000).toFixed(0)
      console.log(
        `  ✓ ${String(i + 1).padStart(3)}. ${t.name} — ${t.artist} [${dur}s]\n` +
          `        → ${m.source} ${m.id}（${m.score} 分，时长差 ${diff}s）${m.name}${m.artist ? ' — ' + m.artist : ''}`
      )
    } else {
      console.log(`  ✗ ${String(i + 1).padStart(3)}. ${t.name} — ${t.artist} [${dur}s]\n        ${r.reason}`)
    }
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`统计：${ok}/${results.length} 匹配（网易 ${neCount}，QQ ${qqCount}）`)

  // 6. YAML 片段（排除配置中已存在的 ID）
  if (newNetease.length > 0 || newTencent.length > 0) {
    console.log(`\n# 将以下内容合并进 _config.yaml 的 banner.music（已排除配置中已有的 ID）：\n`)
    if (newNetease.length > 0) {
      console.log('netease:')
      for (const id of newNetease) console.log(`  - ${id}`)
    }
    if (newTencent.length > 0) {
      if (newNetease.length > 0) console.log('')
      console.log('tencent:')
      for (const mid of newTencent) console.log(`  - '${mid}'`)
    }
  } else {
    console.log('\n无新增 ID（全部已存在或未匹配）')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
