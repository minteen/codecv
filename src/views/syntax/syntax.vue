<script setup lang="ts">
import MenuBar from '@/components/menu-bar/menu-bar/MenuBar.vue'
import { onMounted, ref } from 'vue'
import '@/assets/highlight.css'
import resumeHelper from './sources/help'

const helper = ref()

onMounted(() => {
  helper.value.innerHTML = resumeHelper
})
</script>

<template>
  <main class="syntax-page noto-sans-sc">
    <div class="syntax-heading">
      <p>写好内容，也排好版</p>
      <h1>语法解析</h1>
      <p>了解 Markdown 语法与简历排版方式，边写边预览。</p>
    </div>
    <div id="syntax" class="flex">
      <div class="syntax-helper" ref="helper"></div>
      <menu-bar
        class="slider"
        body=".syntax-helper"
        :style="{ width: '260px', maxHeight: 'calc(100vh - 100px)' }"
      />
    </div>
  </main>
</template>

<style lang="scss" scoped>
.syntax-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 48px 32px;
}
.syntax-heading {
  margin-bottom: 28px;
  p {
    font-size: 13px;
    color: var(--writable-font-color);
    line-height: 1.8;
  }
  h1 {
    margin: 10px 0;
    font-size: 34px;
    letter-spacing: -0.5px;
  }
}
#syntax {
  gap: 24px;
  .slider {
    position: sticky;
    top: 80px;
    border-radius: 10px;
    margin-left: 0;
    flex-shrink: 0;
    align-self: flex-start;
  }
  .syntax-helper {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    overflow-x: auto;
    border-radius: 10px;
    padding: 20px;
    background: var(--background);
    color: var(--font-color);
  }
}
@media screen and (max-width: 800px) {
  .slider {
    display: none;
  }
}
@media (max-width: 640px) {
  .syntax-page {
    padding: 28px 20px;
  }
  .syntax-heading h1 {
    font-size: 28px;
  }
}
</style>
