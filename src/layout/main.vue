<script setup lang="ts">
import Footer from './footer.vue'
import WorkspaceHeader from '@/views/home/components/header.vue'
</script>

<template>
  <WorkspaceHeader v-if="$route.path !== '/editor'" />
  <div id="main" :class="{ 'workspace-shell': $route.meta.workspace }">
    <el-tooltip placement="bottom" content="返回顶部">
      <el-backtop :bottom="100" />
    </el-tooltip>
    <router-view v-slot="{ Component }">
      <keep-alive :max="10" include="home,editor,syntax,template">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
  <Footer v-if="$route.path !== '/editor'" />
</template>

<style lang="scss" scoped>
#main {
  min-height: calc(100vh - 60px);
}
#main.workspace-shell {
  background: var(--body-background);
  color: var(--font-color);
  min-height: calc(100vh - 156px);
}
.workspace-footer {
  padding: 24px;
  text-align: center;
  color: var(--writable-font-color);
  background: var(--body-background);
  font-size: 12px;
}
</style>
