import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
// Bio 页（含其 Live2D 组件依赖）按需懒加载，不占用首屏 chunk
const Bio = () => import('@/views/Bio.vue')
import { useConfig } from '@/composables/useConfig'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/bio',
    name: 'Bio',
    component: Bio,
    // 页面标题对应的 i18n 键（translate.bio）
    meta: { titleKey: 'bio' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const { configs, waitForConfig } = useConfig()

// 根据路由与当前语言配置生成页面标题
const updateTitle = (to) => {
  const baseTitle = configs.value?.title || '个人主页'
  const key = to?.meta?.titleKey
  const subTitle = key ? configs.value?.translate?.[key] : ''
  document.title = subTitle ? `${subTitle} - ${baseTitle}` : baseTitle
}

// 路由切换后更新标题（等待配置就绪，避免被默认标题覆盖）
router.afterEach(async (to) => {
  try {
    await waitForConfig()
  } catch (error) {
    // 配置加载失败时使用默认标题
  }
  updateTitle(to)
})

// 语言切换后同步更新当前页标题
watch(configs, () => {
  updateTitle(router.currentRoute.value)
})

export default router
