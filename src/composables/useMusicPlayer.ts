import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Howl } from 'howler'
import { useConfig } from '@/composables/useConfig'
import { useSettings } from '@/composables/useSettings'
import {
  buildMusicPool,
  expandNeteasePlaylist,
  listPlaylistIds,
  resolveTrack,
  SourceUnavailableError,
  TrackUnavailableError,
  type PoolItem,
  type SongInfo
} from '@/composables/musicSources'
import type { MusicGroupConfig } from '@/types/config'

/**
 * BGM 播放器状态机（MusicBanner 的逻辑半边）：
 * 多源随机池、抽签不放回、Howl 装载/播放、失败分级降级、自动播放补播、进度同步。
 * DOM 相关交互（进度条拖动比例换算、跑马灯测量、窄屏判定）留在组件内。
 */
export function useMusicPlayer() {
  const { configs } = useConfig()
  const { effectiveBgmVolume } = useSettings()

  const translate = computed(() => configs.value?.translate)

  /** API 最终失败后隐藏整个 Banner，不留空白占位 */
  const visible = ref(true)
  const songName = ref('')
  const songArtist = ref('')
  const songCover = ref('')
  const playing = ref(false)
  const duration = ref(0)
  const progress = ref(0)
  /** 拖动进度中：进度条跟随拖动位置预览，松手才真正 seek（播放不中断） */
  const seeking = ref(false)

  let currentHowl: Howl | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let progressRafId: number | null = null
  let retryCount = 0
  const MAX_RETRY_COUNT = 3
  /** play() 被浏览器自动播放策略拦下的待播标记（页面无手势直达大厅时触发）：不换歌，等首次点击补播 */
  let autoplayBlocked = false

  const percent = computed(() =>
    duration.value > 0 ? Math.min(100, (progress.value / duration.value) * 100) : 0
  )

  // BGM 关闭时暂停而不是零音量继续播，避免白耗流量；恢复时接着当前曲目播
  watch(effectiveBgmVolume, (volume, previous) => {
    const howl = currentHowl
    if (!howl) return
    howl.volume(volume)
    if (volume <= 0) {
      howl.pause()
    } else if (previous <= 0) {
      howl.play()
    }
  })

  const stopProgressLoop = () => {
    if (progressRafId !== null) {
      cancelAnimationFrame(progressRafId)
      progressRafId = null
    }
  }

  /** 播放期间用 rAF 同步进度（howler 本身没有进度事件） */
  const startProgressLoop = () => {
    stopProgressLoop()
    const tick = () => {
      const howl = currentHowl
      if (howl) {
        if (!seeking.value) {
          const pos = howl.seek()
          if (typeof pos === 'number') progress.value = pos
        }
        const d = howl.duration()
        if (d > 0 && d !== duration.value) duration.value = d
      }
      progressRafId = requestAnimationFrame(tick)
    }
    progressRafId = requestAnimationFrame(tick)
  }

  /** 释放当前曲目（切歌/卸载/隐藏前调用），避免多个 Howl 同时挂载 */
  const releaseCurrent = () => {
    if (!currentHowl) return
    currentHowl.stop()
    currentHowl.unload()
    currentHowl = null
  }

  const hideBanner = () => {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    stopProgressLoop()
    releaseCurrent()
    visible.value = false
  }

  /** 单曲获取/装载失败后的统一降级：连续失败重试 3 次，仍不行则隐藏整个 Banner */
  const retryOrHide = () => {
    retryCount++
    if (retryCount < MAX_RETRY_COUNT) {
      retryTimer = setTimeout(() => void addRandomSong(), 1000)
    } else {
      hideBanner()
    }
  }

  /**
   * 单曲不可播（VIP/下架）：不计入 API 连续失败，直接换下一首；
   * 连续不可播达到池大小（全部抽完都播不了）才隐藏，防止全 VIP 配置死循环
   */
  let skipCount = 0

  const skipToNext = () => {
    skipCount++
    if (skipCount >= Math.max(pool.length, 1)) {
      hideBanner()
    } else {
      void addRandomSong()
    }
  }

  /** 每次 playSong 递增：组件据此重置封面加载失败态（同 URL 连续两首也要重建 img 重试） */
  const songSeq = ref(0)

  /** 装载并播放一首歌曲（静音时只装载不播放，恢复音量后续播） */
  const playSong = (song: SongInfo) => {
    releaseCurrent()
    const t = translate.value
    songName.value = song.name || t?.musicUnknownSong || 'Unknown song'
    songArtist.value = song.artist || t?.musicUnknownArtist || 'Unknown artist'
    songCover.value = song.cover || ''
    songSeq.value++
    progress.value = 0
    duration.value = 0

    const howl = new Howl({
      src: [song.url],
      // meting 的 url 是无扩展名的 302 跳转（?server=netease&type=url&id=...），
      // howler 按 URL 后缀嗅探格式会得到 null 并直接 loaderror——必须显式声明格式；
      // 各源格式不同（网易/酷狗/酷我 mp3、QQ m4a），由解析器按源指定
      format: song.format,
      // BGM 是长音频：走 HTML5 Audio 流式播放，不整段下载解码成 PCM
      html5: true,
      volume: effectiveBgmVolume.value,
      onplay: () => {
        // 所有回调都过这道理代闸：已被顶替/释放的旧 Howl 的迟到事件一律忽略
        if (howl !== currentHowl) return
        autoplayBlocked = false
        // 真正开始播放才算成功：归零重试与跳过计数（fetch 成功不算数——装载失败的曲目也要能重试到位）
        retryCount = 0
        skipCount = 0
        playing.value = true
        startProgressLoop()
      },
      onpause: () => {
        if (howl !== currentHowl) return
        playing.value = false
        stopProgressLoop()
      },
      onstop: () => {
        if (howl !== currentHowl) return
        playing.value = false
        stopProgressLoop()
      },
      // 播完自动随机下一首（等价旧 APlayer 的 loop:'none' + order:'random'）
      onend: () => {
        if (howl !== currentHowl) return
        playing.value = false
        stopProgressLoop()
        void addRandomSong()
      },
      onloaderror: () => {
        if (howl !== currentHowl) return
        retryOrHide()
      },
      onplayerror: () => {
        if (howl !== currentHowl) return
        // play() 被拒多为自动播放策略（如 introMode:'once' 已看时无手势直达大厅），
        // 不是曲目损坏——绝不能走重试换歌，只标记待播，等用户首次点页面时补播
        autoplayBlocked = true
        playing.value = false
        stopProgressLoop()
      }
    })
    currentHowl = howl
    if (effectiveBgmVolume.value > 0) howl.play()
  }

  // ---- 随机池：配置分组拍平 + 歌单启动时一次展开 ----

  let pool: PoolItem[] = []
  /** 歌单展开中：首播前等待，避免先播单曲再涌入一堆歌单曲 */
  let poolReady: Promise<void> = Promise.resolve()

  const rebuildPool = (music: MusicGroupConfig | undefined) => {
    pool = buildMusicPool(music)
  }

  const expandPlaylists = async (music: MusicGroupConfig | undefined) => {
    const ids = listPlaylistIds(music)
    if (ids.length === 0) return
    const results = await Promise.allSettled(ids.map((id) => expandNeteasePlaylist(id)))
    const resolved: PoolItem[] = []
    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const song of result.value) {
          resolved.push({ kind: 'resolved', song })
        }
      } else {
        // 歌单展开失败不隐藏 Banner（其它源照常工作）
        console.error('歌单展开失败:', result.reason)
      }
    }
    if (resolved.length > 0) {
      pool = [...pool, ...resolved]
    }
  }

  // 抽签不放回：一袋抽完才重置；列表变化时自动重建
  let songBag: number[] = []
  let songBagSource: readonly PoolItem[] | null = null
  let songBagCurrentIndex = -1

  function drawRandomIndex(list: readonly PoolItem[]): number {
    if (songBagSource !== list) {
      songBag = []
      songBagSource = list
      songBagCurrentIndex = -1
    }
    if (songBag.length === 0) {
      songBag = list.map((_, i) => i)
      if (list.length > 1 && songBagCurrentIndex >= 0) {
        const withoutCurrent = songBag.filter((i) => i !== songBagCurrentIndex)
        if (withoutCurrent.length > 0) {
          songBag = withoutCurrent
        }
      }
    }
    const pick = Math.floor(Math.random() * songBag.length)
    const [index] = songBag.splice(pick, 1)
    songBagCurrentIndex = index
    return index
  }

  // 随机加载一首歌
  const addRandomSong = async () => {
    try {
      await poolReady
      if (pool.length === 0) {
        console.warn('歌曲列表为空')
        hideBanner()
        return
      }

      const item = pool[drawRandomIndex(pool)]
      console.log('尝试加载曲目:', item)

      const songData = await resolveTrack(item)
      playSong(songData)
      console.log('歌曲加载成功:', songData.name || songData.url)
    } catch (error) {
      // 分级失败语义：单曲不可播换下一首（不计入连续失败）；源接口故障走重试/隐藏
      if (error instanceof TrackUnavailableError) {
        console.warn('曲目不可播，换下一首:', error.message)
        skipToNext()
        return
      }
      if (error instanceof SourceUnavailableError) {
        console.error('音源接口故障:', error.message)
      } else {
        console.error('添加歌曲失败:', error)
      }
      retryOrHide()
    }
  }

  /** 播放/暂停切换 */
  const togglePlay = () => {
    autoplayBlocked = false
    const howl = currentHowl
    if (!howl) return
    if (playing.value) {
      howl.pause()
    } else {
      howl.play()
    }
  }

  /** 手动切下一首（清掉挂起的重试并归零计数，避免累计失败次数误伤） */
  const nextSong = () => {
    autoplayBlocked = false
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    retryCount = 0
    skipCount = 0
    void addRandomSong()
  }

  /** 自动播放被拦时的补播：用户首次点击页面（任意处）时恢复播放 */
  const unlockAutoplay = () => {
    if (!autoplayBlocked) return
    autoplayBlocked = false
    const howl = currentHowl
    if (howl && effectiveBgmVolume.value > 0) howl.play()
  }

  // ---- 进度拖动（组件把 DOM 事件换算成秒数后调这三个）----

  /** 按下进度条：进入拖动态，进度条跟随预览（播放不中断） */
  const beginSeek = (position: number) => {
    seeking.value = true
    progress.value = position
  }

  const updateSeek = (position: number) => {
    if (seeking.value) progress.value = position
  }

  /** 松手：结束拖动并真正 seek */
  const endSeek = (position: number) => {
    if (!seeking.value) return
    seeking.value = false
    progress.value = position
    currentHowl?.seek(position)
  }

  /** 键盘步进 seek：不经拖动态，直接跳转到目标位置（越界收拢到 [0, duration]） */
  const seekTo = (position: number) => {
    if (duration.value <= 0) return
    progress.value = Math.min(Math.max(position, 0), duration.value)
    currentHowl?.seek(progress.value)
  }

  // 配置热更新（如语言切换重新合并配置）时重建随机池
  const musicConfig = computed(() => configs.value?.banner?.music)
  watch(musicConfig, (music) => {
    rebuildPool(music)
  })

  // 初始化
  onMounted(() => {
    // 拍平随机池并展开歌单
    const music = configs.value?.banner?.music
    rebuildPool(music)
    const expansion = expandPlaylists(music)
    // 池里已有其它源曲目（单曲/QQ/酷狗/…）时立即开播，歌单后台展开后自动并入随机池；
    // 仅当只有歌单源时才阻塞首播等展开完成
    poolReady = pool.length > 0 ? Promise.resolve() : expansion
    void addRandomSong()
    window.addEventListener('pointerdown', unlockAutoplay)
  })

  // 组件卸载时销毁播放器
  onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', unlockAutoplay)
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    stopProgressLoop()
    releaseCurrent()
  })

  return {
    visible,
    songName,
    songArtist,
    songCover,
    songSeq,
    playing,
    duration,
    progress,
    seeking,
    percent,
    togglePlay,
    nextSong,
    beginSeek,
    updateSeek,
    endSeek,
    seekTo
  }
}
