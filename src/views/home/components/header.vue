<script setup lang="ts">
import ThemeToggle from '@/components/themeToggle.vue'
</script>

<template>
  <header class="workspace-header">
    <div class="header-content">
      <router-link class="brand" to="/" aria-label="CodeCV 简历工作台"
        >CodeCV <span>简历工作台</span></router-link
      >
      <nav aria-label="主导航">
        <router-link to="/">我的简历</router-link>
        <router-link to="/template">模板库</router-link>
        <router-link to="/syntax/helper">语法解析</router-link>
      </nav>
      <theme-toggle />
    </div>
  </header>
</template>

<style lang="scss" scoped>
.workspace-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--background);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.header-content {
  max-width: 1200px;
  min-height: 76px;
  padding: 16px 32px;
  margin: auto;
  display: flex;
  align-items: center;
  gap: 32px;
}
a {
  text-decoration: none;
  color: inherit;
}
.brand {
  font-size: 23px;
  font-weight: 700;
  letter-spacing: -0.8px;
  span {
    margin-left: 14px;
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0;
    color: var(--writable-font-color);
  }
}
nav {
  display: flex;
  gap: 28px;
  margin-left: auto;
  font-size: 14px;
  a {
    padding: 8px 0;
  }
  .router-link-exact-active {
    color: var(--theme);
    box-shadow: 0 2px var(--theme);
  }
}
a:focus-visible {
  outline: 2px solid var(--theme);
  outline-offset: 5px;
}
@media (max-width: 700px) {
  .header-content {
    padding: 16px 20px;
    gap: 20px;
    flex-wrap: wrap;
  }
  .brand span {
    display: none;
  }
  nav {
    gap: 16px;
  }
}
@media (max-width: 480px) {
  .header-content {
    gap: 12px;
  }
  .brand {
    font-size: 20px;
  }
  nav {
    order: 3;
    width: 100%;
    margin: 0;
    justify-content: space-between;
  }
  .header-content > :last-child {
    margin-left: auto;
  }
}
</style>
