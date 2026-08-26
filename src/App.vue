<script setup>
import { useLoading } from '@/composables/useLoading'
import Loading from '@/components/Loading.vue'
import Cursor from '@/components/Cursor.vue'

const { loading, percent } = useLoading()
</script>

<template>
  <!-- 加载状态 -->
  <transition name="loading">
    <Loading v-if="loading" :percent="percent" />
  </transition>

  <router-view v-if="!loading" v-slot="{ Component }">
    <keep-alive>
      <component :is="Component" />
    </keep-alive>
  </router-view>

  <!-- 幕布效果 -->
  <div id="curtain"></div>

  <!-- 自定义光标 -->
  <Cursor />
</template>

<style>
/* 导入样式文件 */
@import '@/assets/app.css';
</style>
