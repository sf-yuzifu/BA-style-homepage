<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import axios from 'axios'
import APlayer from 'aplayer'
import { useConfig } from '@/composables/useConfig'

const ap = ref(null)
const songTimes = ref(0)
const isMiniMode = ref(false)
const currentSong = ref(null)
const audioEl = ref(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const buffered = ref(0)
const lrcLines = ref([])
const currentLyricIndex = ref(-1)
const progressRef = ref(null)
const isSeeking = ref(false)

const { configs } = useConfig()
const ifICP = computed(() => configs.value?.ICP || '')
const songlist = computed(() => configs.value?.banner?.musicID || [])

const checkScreenSize = () => {
  isMiniMode.value = window.innerWidth <= 768
}

const formatTime = (sec) => {
  const s = Number.isFinite(sec) ? Math.max(0, Math.floor(sec)) : 0
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

const parseLrc = (lrc) => {
  if (!lrc) return []
  const lines = String(lrc).split(/\r?\n/)
  const result = []
  for (const line of lines) {
    const text = line.replace(/\[[0-9:.]+\]/g, '').trim()
    const matches = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)]
    if (!matches.length || !text) continue
    for (const m of matches) {
      const mm = Number(m[1])
      const ss = Number(m[2])
      const ms = Number((m[3] || '0').padEnd(3, '0'))
      const t = mm * 60 + ss + ms / 1000
      if (Number.isFinite(t)) result.push({ time: t, text })
    }
  }
  result.sort((a, b) => a.time - b.time)
  return result
}

const updateBuffered = () => {
  const el = audioEl.value
  if (!el || !duration.value) {
    buffered.value = 0
    return
  }
  try {
    const b = el.buffered
    if (!b || b.length === 0) {
      buffered.value = 0
      return
    }
    buffered.value = Math.min(1, Math.max(0, b.end(b.length - 1) / duration.value))
  } catch {
    buffered.value = 0
  }
}

const updateLyric = () => {
  const lines = lrcLines.value
  if (!lines.length) {
    currentLyricIndex.value = -1
    return
  }
  const t = currentTime.value
  let lo = 0
  let hi = lines.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= t) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  currentLyricIndex.value = ans
}

const handleTimeUpdate = () => {
  const el = audioEl.value
  if (!el) return
  currentTime.value = el.currentTime || 0
  updateBuffered()
  updateLyric()
}

const handleDurationChange = () => {
  const el = audioEl.value
  duration.value = el && Number.isFinite(el.duration) ? el.duration : 0
  updateBuffered()
}

const handlePlay = () => {
  isPlaying.value = true
}

const handlePause = () => {
  isPlaying.value = false
}

const detachAudio = () => {
  const el = audioEl.value
  if (!el) return
  el.removeEventListener('timeupdate', handleTimeUpdate)
  el.removeEventListener('durationchange', handleDurationChange)
  el.removeEventListener('progress', updateBuffered)
  el.removeEventListener('play', handlePlay)
  el.removeEventListener('pause', handlePause)
  audioEl.value = null
}

const attachAudio = (el) => {
  detachAudio()
  audioEl.value = el
  el.addEventListener('timeupdate', handleTimeUpdate)
  el.addEventListener('durationchange', handleDurationChange)
  el.addEventListener('progress', updateBuffered)
  el.addEventListener('play', handlePlay)
  el.addEventListener('pause', handlePause)
  handleDurationChange()
  handleTimeUpdate()
  isPlaying.value = !el.paused
}

const syncAudioEl = () => {
  const el = document.querySelector('#aplayer audio')
  if (!el) return
  if (el !== audioEl.value) attachAudio(el)
}

const togglePlay = () => {
  if (!ap.value) return
  const el = audioEl.value
  if (!el) return
  if (el.paused) {
    ap.value.play()
  } else {
    ap.value.pause()
  }
}

const nextSong = () => {
  addRandomSong()
}

const seekToPercent = (p) => {
  const el = audioEl.value
  if (!el) return
  const percent = Math.min(1, Math.max(0, p))
  if (ap.value && typeof ap.value.seek === 'function' && duration.value) {
    ap.value.seek(percent)
    return
  }
  if (duration.value) el.currentTime = duration.value * percent
}

const seekFromEvent = (e) => {
  const el = progressRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const p = (e.clientX - rect.left) / rect.width
  seekToPercent(p)
}

const onSeekPointerDown = (e) => {
  if (!progressRef.value) return
  isSeeking.value = true
  seekFromEvent(e)
  window.addEventListener('pointermove', seekFromEvent)
  window.addEventListener(
    'pointerup',
    () => {
      isSeeking.value = false
      window.removeEventListener('pointermove', seekFromEvent)
    },
    { once: true }
  )
}

onMounted(() => {
  ap.value = new APlayer({
    container: document.getElementById('aplayer'),
    autoplay: false,
    mini: false,
    order: 'random',
    lrcType: 1,
    listFolded: true,
    loop: 'none',
    audio: []
  })

  ap.value.on('ended', addRandomSong)
  addRandomSong()

  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
})

onBeforeUnmount(() => {
  detachAudio()
  window.removeEventListener('resize', checkScreenSize)
  window.removeEventListener('pointermove', seekFromEvent)
  if (ap.value) {
    ap.value.destroy()
  }
})

const fetchSongData = async (songId) => {
  try {
    const response = await axios.get(
      `https://www.lihouse.xyz/coco_widget/music_resource/id/${songId}`
    )

    const data = response.data.song_data || response.data

    if (!data) {
      throw new Error('无效的响应数据')
    }

    const songInfo = {
      name: data.name || data.song_name || '未知歌曲',
      artist: data.artist || data.singer || '未知艺术家',
      url: data.url || data.song_url,
      cover: data.pic || data.cover || data.image,
      lrc: data.lyric || data.lrc || '[00:00.000]暂无歌词\n'
    }

    if (!songInfo.url) {
      throw new Error('歌曲URL不存在')
    }

    return songInfo
  } catch (error) {
    console.error('获取歌曲数据失败:', error)
    return null
  }
}

const addRandomSong = async () => {
  if (!ap.value) return

  try {
    if (!songlist.value || songlist.value.length === 0) {
      console.warn('歌曲列表为空')
      return
    }

    ap.value.list.clear()

    const randomIndex = Math.floor(Math.random() * songlist.value.length)
    const songId = songlist.value[randomIndex]

    if (!songId) {
      throw new Error('无效的歌曲ID')
    }

    const songData = await fetchSongData(songId)

    if (songData) {
      songTimes.value++
      currentSong.value = songData
      lrcLines.value = parseLrc(songData.lrc)
      currentLyricIndex.value = -1
      ap.value.list.add(songData)
      ap.value.play()
      await nextTick()
      syncAudioEl()
    } else {
      throw new Error('无法获取歌曲数据')
    }
  } catch (error) {
    console.error('添加歌曲失败:', error)

    if (songTimes.value === 0) {
      ap.value.destroy()
    } else {
      if (songTimes.value < 3) {
        setTimeout(() => addRandomSong(), 1000)
      }
    }
  }
}

const percent = computed(() => {
  if (!duration.value) return 0
  return Math.min(1, Math.max(0, currentTime.value / duration.value))
})

const currentLyricTriplet = computed(() => {
  const lines = lrcLines.value
  if (!lines.length) {
    return { prev: '', current: '暂无歌词', next: '' }
  }
  const idx = currentLyricIndex.value
  const current = idx >= 0 ? lines[idx]?.text || '' : lines[0]?.text || ''
  const prev = idx > 0 ? lines[idx - 1]?.text || '' : ''
  const next = idx >= 0 && idx + 1 < lines.length ? lines[idx + 1]?.text || '' : ''
  return { prev, current, next }
})

const showMini = computed(() => Boolean(ifICP.value) || isMiniMode.value)
</script>

<template>
  <div class="music-banner" :class="{ 'music-banner-mini': showMini }">
    <div id="aplayer" class="aplayer-host"></div>

    <div
      class="music-card"
      :class="{ 'music-card-mini': showMini, 'music-card-seeking': isSeeking }"
    >
      <button class="music-cover" type="button" @click="togglePlay">
        <img
          v-if="currentSong?.cover"
          class="music-cover-img"
          :src="currentSong.cover"
          alt=""
        />
        <div class="music-cover-mask"></div>
        <div class="music-cover-btn">
          <svg v-if="!isPlaying" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l12-7z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
          </svg>
        </div>
      </button>

      <div v-if="!showMini" class="music-main">
        <div class="music-meta">
          <div class="music-title">
            <span class="music-title-text">{{ currentSong?.name || '加载中…' }}</span>
            <span class="music-artist">{{ currentSong?.artist || '' }}</span>
          </div>
          <button class="music-next" type="button" @click="nextSong">NEXT</button>
        </div>

        <div class="music-lrc">
          <p class="music-lrc-line music-lrc-dim">{{ currentLyricTriplet.prev }}</p>
          <p class="music-lrc-line music-lrc-current">{{ currentLyricTriplet.current }}</p>
          <p class="music-lrc-line music-lrc-dim">{{ currentLyricTriplet.next }}</p>
        </div>

        <div class="music-progress">
          <div ref="progressRef" class="music-bar" @pointerdown="onSeekPointerDown">
            <div class="music-bar-track"></div>
            <div class="music-bar-loaded" :style="{ width: `${buffered * 100}%` }"></div>
            <div class="music-bar-played" :style="{ width: `${percent * 100}%` }"></div>
            <div class="music-bar-thumb" :style="{ left: `${percent * 100}%` }"></div>
          </div>
          <div class="music-time">
            <span>{{ formatTime(currentTime) }}</span>
            <span>/</span>
            <span>{{ formatTime(duration) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.music-banner {
  position: absolute;
  left: clamp(50px, 3.125vw, 100vw);
  bottom: clamp(180px, 11.25vw, 100vw);
  width: clamp(300px, 18.75vw, 100vw);
  aspect-ratio: 446 / 158;
  z-index: 2;
  pointer-events: none;
}

.music-banner-mini {
  right: clamp(20px, 1.25vw, 100vw);
  top: clamp(192px, 12vw, 100vw);
  left: unset;
  bottom: unset;
  width: clamp(120px, 7.5vw, 100vw);
  aspect-ratio: 1;
}

.music-card {
  width: 100%;
  height: 100%;
  background: #fffd;
  filter: drop-shadow(0px 0px clamp(3px, 0.1875vw, 100vw) #0003);
  border-radius: clamp(6px, 0.375vw, 100vw);
  transform: skew(-10deg);
  display: flex;
  overflow: hidden;
  pointer-events: auto;
  transition: transform 0.3s;
}

.music-card:active {
  transform: skew(-10deg) scale(0.95);
}

.music-card-mini {
  border-radius: 100%;
  border: 2px white solid;
  background: transparent;
  filter: drop-shadow(0px 0px clamp(3px, 0.1875vw, 100vw) #0003);
}

.aplayer-host {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.music-cover {
  border: 0;
  padding: 0;
  margin: 0;
  width: auto;
  height: 100%;
  aspect-ratio: 1;
  position: relative;
  background: #f0f0f0;
  cursor: pointer;
  display: block;
  transform: skew(10deg);
  left: -8px;
}

.music-card-mini .music-cover {
  transform: unset;
  left: unset;
  width: 100%;
  border-radius: 100%;
  overflow: hidden;
}

.music-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.music-cover-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #0000 0%, #00000033 100%);
  opacity: 0.65;
}

.music-cover-btn {
  position: absolute;
  right: clamp(8px, 0.5vw, 100vw);
  bottom: clamp(8px, 0.5vw, 100vw);
  width: clamp(28px, 1.75vw, 100vw);
  height: clamp(28px, 1.75vw, 100vw);
  border-radius: 999px;
  background: #77deff;
  display: grid;
  place-items: center;
  filter: drop-shadow(0px 1px 2px #0004);
}

.music-card-mini .music-cover-btn {
  right: 50%;
  bottom: 50%;
  transform: translate(50%, 50%);
  width: clamp(44px, 2.75vw, 100vw);
  height: clamp(44px, 2.75vw, 100vw);
}

.music-cover-btn svg {
  width: 58%;
  height: 58%;
}

.music-cover-btn path {
  fill: #003153;
}

.music-main {
  flex: 1;
  height: 100%;
  padding: clamp(12px, 0.75vw, 100vw) clamp(14px, 0.875vw, 100vw);
  transform: skew(10deg);
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 0.5vw, 100vw);
  background-size: contain;
  background: #f0f0f0 var(--deco1) no-repeat right;
}

.music-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: clamp(10px, 0.625vw, 100vw);
}

.music-title {
  min-width: 0;
  color: #003153;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.music-title-text {
  font-size: clamp(18px, 1.125vw, 100vw);
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.music-artist {
  font-size: clamp(13px, 0.8125vw, 100vw);
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.music-next {
  border: 0;
  background: #daeef5;
  color: #003153;
  border-radius: clamp(4px, 0.25vw, 100vw);
  padding: 0 clamp(10px, 0.625vw, 100vw);
  height: clamp(26px, 1.625vw, 100vw);
  transform: skew(-10deg);
  cursor: pointer;
  font-size: clamp(12px, 0.75vw, 100vw);
  font-weight: 700;
}

.music-lrc {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: clamp(2px, 0.125vw, 100vw);
  overflow: hidden;
}

.music-lrc-line {
  text-align: left;
  line-height: 1.2;
  margin: 0;
  padding: 0;
  color: #003153;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: clamp(12px, 0.75vw, 100vw);
}

.music-lrc-current {
  font-size: clamp(13px, 0.8125vw, 100vw);
  font-weight: 700;
  opacity: 0.95;
}

.music-lrc-dim {
  opacity: 0.55;
}

.music-progress {
  display: flex;
  align-items: center;
  gap: clamp(10px, 0.625vw, 100vw);
}

.music-bar {
  flex: 1;
  position: relative;
  height: clamp(8px, 0.5vw, 100vw);
  cursor: pointer;
}

.music-bar-track,
.music-bar-loaded,
.music-bar-played {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  height: clamp(4px, 0.25vw, 100vw);
  border-radius: 999px;
}

.music-bar-track {
  width: 100%;
  background: #cfe6ef;
  opacity: 0.9;
}

.music-bar-loaded {
  background: #9bb9c8;
  opacity: 0.6;
}

.music-bar-played {
  background: linear-gradient(90deg, #89d5fd, #66e0fe);
}

.music-bar-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: clamp(10px, 0.625vw, 100vw);
  height: clamp(10px, 0.625vw, 100vw);
  border-radius: 999px;
  background: #003153;
  box-shadow: 0 1px 2px #0003;
  opacity: 0.25;
  transition: opacity 0.2s;
}

.music-card:hover .music-bar-thumb,
.music-card-seeking .music-bar-thumb {
  opacity: 0.9;
}

.music-time {
  font-size: clamp(12px, 0.75vw, 100vw);
  color: #003153;
  opacity: 0.7;
  white-space: nowrap;
}

@media screen and (max-width: 768px) {
  .music-banner {
    right: clamp(20px, 1.25vw, 100vw);
    top: clamp(192px, 12vw, 100vw);
    left: unset;
    bottom: unset;
    width: clamp(120px, 7.5vw, 100vw);
    aspect-ratio: 1;
  }

  .music-card {
    border-radius: 100%;
    border: 2px white solid;
    background: transparent;
  }

  .music-main {
    display: none;
  }
}

@media screen and (max-width: 375px) {
  .music-banner {
    width: 96px;
  }
}
</style>
