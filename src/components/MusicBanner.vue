<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import axios from 'axios'
import 'aplayer/dist/APlayer.min.css'
import APlayer from 'aplayer'
import { useConfig } from '@/composables/useConfig'

const ap = ref(null)
const songTimes = ref(0)
const retryCount = ref(0)
const MAX_RETRY_COUNT = 3
const songName = ref('')
const isMiniMode = ref(false)

// 使用i18n配置系统
const { configs } = useConfig()
const ifICP = computed(() => configs.value?.ICP || '')
const songlist = computed(() => configs.value?.banner?.musicID || [])

const checkScreenSize = () => {
  if (!ap.value) return

  if (ifICP.value) {
    ap.value.setMode('mini')
    return
  }

  isMiniMode.value = window.innerWidth <= 768

  if (isMiniMode.value) {
    ap.value.setMode('mini')
  } else {
    ap.value.setMode('normal')
  }
}

// 初始化播放器
onMounted(() => {
  ap.value = new APlayer({
    container: document.getElementById('aplayer'),
    autoplay: false,
    mini: false,
    order: 'random',
    lrcType: 3,
    listFolded: true,
    loop: 'none',
    audio: []
  })

  // 歌曲结束事件监听
  ap.value.on('ended', addRandomSong)

  // 初始加载一首歌
  addRandomSong()

  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
})

// 组件卸载时销毁播放器
onBeforeUnmount(() => {
  window.removeEventListener('resize', checkScreenSize)
  if (ap.value) {
    ap.value.destroy()
    ap.value = null
  }
})

// 获取歌曲数据
const fetchSongData = async (songId) => {
  try {
    const response = await axios.get(
      `https://api.injahow.cn/meting/?server=netease&type=song&id=${songId}`,
      { timeout: 8000 }
    )

    // 检查响应数据结构
    console.log('API响应:', response.data)

    // Meting API 返回数组，单曲类型取第一项
    const data = Array.isArray(response.data) ? response.data[0] : response.data

    // 验证数据结构
    if (!data) {
      throw new Error('无效的响应数据')
    }

    // 检查必要的字段
    const songInfo = {
      name: data.title || data.name || '未知歌曲',
      artist: data.author || data.artist || '未知艺术家',
      url: data.url,
      cover: data.pic,
      lrc: data.lrc || ''
    }

    // 验证URL字段
    if (!songInfo.url) {
      throw new Error('歌曲URL不存在')
    }

    songName.value = songInfo.name
    console.log('歌曲信息:', songInfo)

    return songInfo
  } catch (error) {
    console.error('获取歌曲数据失败:', error)
    return null
  }
}

// 添加随机歌曲
const addRandomSong = async () => {
  if (!ap.value) return

  try {
    // 检查歌曲列表是否有效
    if (!songlist.value || songlist.value.length === 0) {
      console.warn('歌曲列表为空')
      return
    }

    // 清空当前播放列表
    ap.value.lrc.hide()
    ap.value.list.clear()

    // 随机选择一首歌
    const randomIndex = Math.floor(Math.random() * songlist.value.length)
    const songId = songlist.value[randomIndex]

    if (!songId) {
      throw new Error('无效的歌曲ID')
    }

    console.log(`尝试加载歌曲 ID: ${songId}`)

    // 获取歌曲数据
    const songData = await fetchSongData(songId)

    if (songData) {
      songTimes.value++
      retryCount.value = 0
      ap.value.list.add(songData)
      ap.value.lrc.show()
      ap.value.play()
      console.log('歌曲加载成功:', songData.name)
    } else {
      throw new Error('无法获取歌曲数据')
    }
  } catch (error) {
    console.error('添加歌曲失败:', error)

    // 如果是第一次尝试失败，销毁播放器
    if (songTimes.value === 0) {
      console.log('首次加载失败，销毁播放器')
      ap.value.destroy()
      ap.value = null
    } else {
      // 如果不是第一次，尝试加载其他歌曲（统计连续失败次数，成功时清零）
      retryCount.value++
      if (retryCount.value < MAX_RETRY_COUNT) {
        console.log(`尝试加载其他歌曲（第 ${retryCount.value} 次重试）`)
        setTimeout(() => addRandomSong(), 1000)
      } else {
        console.warn('连续加载失败次数已达上限，停止重试')
      }
    }
  }
}
</script>

<template>
  <div id="aplayer" :class="{ 'aplayer-mini': ifICP }"></div>
</template>

<style scoped>
#aplayer {
  position: absolute;
  left: clamp(50px, 3.125vw, 100vw);
  bottom: clamp(180px, 11.25vw, 100vw);
  width: clamp(300px, 18.75vw, 100vw);
  aspect-ratio: 446 / 158;
  opacity: 0.9;
  z-index: 2;
  transition: transform 0.3s;
}

#aplayer:active {
  transform: scale(0.95);
}

#aplayer.aplayer-mini {
  right: clamp(20px, 1.25vw, 100vw);
  top: clamp(192px, 12vw, 100vw);
  left: unset;
  bottom: unset;
  width: clamp(120px, 7.5vw, 100vw);
  aspect-ratio: 1;
  border-radius: 100%;
  border: 2px white solid;
}

@media screen and (max-width: 768px) {
  #aplayer {
    right: clamp(20px, 1.25vw, 100vw);
    top: clamp(192px, 12vw, 100vw);
    left: unset;
    bottom: unset;
    width: clamp(120px, 7.5vw, 100vw);
    aspect-ratio: 1;
    border-radius: 100%;
    border: 2px white solid;
  }
}

@media screen and (max-width: 375px) {
  #aplayer {
    width: 96px;
  }
}
</style>

<style>
.aplayer.aplayer-withlrc .aplayer-pic {
  height: 100%;
  aspect-ratio: 1;
  width: unset;
}

.aplayer .aplayer-body,
.aplayer.aplayer-narrow .aplayer-body,
.aplayer.aplayer-narrow .aplayer-pic {
  height: 100%;
}

.aplayer .aplayer-body {
  background-size: contain;
  background: #f0f0f0 var(--deco1) no-repeat right !important;
}

.aplayer.aplayer-withlrc .aplayer-info {
  margin-left: clamp(103px, 6.4375vw, 100vw);
  height: 100%;
}

.aplayer .aplayer-lrc {
  height: calc(100% - 50px);
}

.aplayer .aplayer-lrc:after,
.aplayer .aplayer-lrc:before {
  background: unset;
}
</style>
