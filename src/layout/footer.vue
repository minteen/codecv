<template>
  <footer class="project-footer">
    <span>CodeCV · 简历工作台</span>
    <span
      >基于 coderlei 的
      <a href="https://github.com/acmenlei/codecv" target="_blank" rel="noopener noreferrer"
        >codecv</a
      ></span
    >
    <a
      href="https://github.com/minteen/codecv/blob/master/LICENSE"
      target="_blank"
      rel="noopener noreferrer"
      >许可证</a
    >
    <a href="https://github.com/minteen/codecv" target="_blank" rel="noopener noreferrer"
      >当前仓库</a
    >
  </footer>
</template>

<style scoped>
.project-footer {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px 20px;
  padding: 24px;
  background: var(--body-background);
  color: var(--writable-font-color);
  font-size: 12px;
}
a {
  color: inherit;
  text-underline-offset: 3px;
}
</style>
