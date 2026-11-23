<script setup lang="ts">
import { type TemplateType } from '@/templates/config'

defineProps<{ theme: TemplateType; disabled?: boolean }>()
defineEmits<{
  (event: 'edit', theme: TemplateType): void
  (event: 'create', theme: TemplateType): void
  (event: 'delete', theme: TemplateType): void
}>()
</script>

<template>
  <article class="template-card">
    <button
      class="template-open"
      :disabled="disabled"
      :aria-label="`编辑模板：${theme.name}`"
      @click="$emit('edit', theme)"
    >
      <span class="template-preview">
        <img v-if="theme.img && !theme.updatedAt" :src="theme.img" alt="" loading="lazy" />
        <span v-else class="text-preview"
          ><strong>{{ theme.name }}</strong
          ><span>{{
            theme.content
              .replace(/<[^>]*>/g, '')
              .replace(/[#*`]/g, '')
              .slice(0, 700) || '空白模板，点击开始编写内容。'
          }}</span></span
        >
        <span class="choose-template">编辑模板 <span aria-hidden="true">↗</span></span>
      </span>
      <span class="template-name">{{ theme.name }}</span>
      <span class="template-caption">{{
        theme.updatedAt ? '自定义内容与排版' : '内置模板，可修改保存'
      }}</span>
    </button>
    <button class="create-from-template" :disabled="disabled" @click="$emit('create', theme)">
      用此模板新建简历 <span aria-hidden="true">＋</span>
    </button>
    <button
      class="delete-template"
      :disabled="disabled"
      :aria-label="`删除模板：${theme.name}`"
      @click="$emit('delete', theme)"
    >
      删除模板
    </button>
  </article>
</template>

<style lang="scss" scoped>
.template-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  text-align: left;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 12px;
  background: var(--background);
  color: var(--font-color);
  font: inherit;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  &:hover,
  &:focus-visible {
    border-color: var(--theme);
    box-shadow: 0 8px 24px #0000000a;
  }
  &:focus-visible {
    outline: 2px solid var(--theme);
    outline-offset: 3px;
  }
  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}
.template-open {
  display: flex;
  flex-direction: column;
  min-width: 0;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.template-open:focus-visible,
.create-from-template:focus-visible,
.delete-template:focus-visible {
  outline: 2px solid var(--theme);
  outline-offset: 3px;
}
.create-from-template {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 12px 0 0;
  margin-top: 14px;
  border: 0;
  border-top: 1px solid var(--el-border-color-lighter);
  background: transparent;
  font: inherit;
  font-size: 12px;
  color: var(--theme);
  cursor: pointer;
}
.template-open:disabled,
.create-from-template:disabled,
.delete-template:disabled {
  opacity: 0.6;
  cursor: wait;
}
.delete-template {
  align-self: flex-start;
  margin-top: 12px;
  padding: 4px 0;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 12px;
  color: var(--writable-font-color);
  cursor: pointer;
  &:hover {
    color: var(--el-color-danger);
  }
}
.text-preview {
  display: block;
  background: white;
  color: #334155;
  padding: 18px;
  height: 100%;
  strong {
    display: block;
    font-size: 15px;
    padding-bottom: 12px;
    border-bottom: 1px solid #dce1e8;
    margin-bottom: 12px;
  }
  > span {
    display: block;
    white-space: pre-line;
    overflow-wrap: anywhere;
    font-size: 9px;
    line-height: 1.8;
  }
}
.template-preview {
  display: block;
  width: 100%;
  aspect-ratio: 210 / 250;
  position: relative;
  overflow: hidden;
  background: var(--body-background);
  border-radius: 7px;
  border: 1px solid var(--el-border-color-lighter);
  img {
    display: block;
    width: 100%;
    height: auto;
  }
}
.choose-template {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  padding: 10px 14px;
  background: var(--background);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  justify-content: space-between;
}
.template-card:hover .choose-template,
.template-card:focus-visible .choose-template {
  background: var(--theme);
  color: white;
  border-color: transparent;
}
.template-name {
  margin: 14px 0 7px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.6;
}
.template-caption {
  font-size: 11px;
  color: var(--writable-font-color);
}
</style>
