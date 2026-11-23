<script setup lang="ts">
import navMenu from './nav.vue'
import ThemeToggle from '@/components/themeToggle.vue'
import { useFile } from './hook'
import useEditorStore from '@/store/modules/editor'
import { computed, ref } from 'vue'
import { errorMessage, successMessage } from '@/common/message'

const pdfDialog = ref(false)
const pageWidth = ref(210)
const pageHeight = ref(297)
const autoHeight = ref(false)
function setPageSize(width: number, height: number) {
  pageWidth.value = width
  pageHeight.value = height
}
const sizeValid = computed(() =>
  [pageWidth.value, pageHeight.value].every(
    value => Number.isFinite(value) && value >= 50 && value <= 2000
  )
)
function exportPdf() {
  if (!sizeValid.value) return
  document.title = fileName.value
  emit('download-dynamic', fileName.value, {
    width: pageWidth.value,
    height: pageHeight.value,
    autoHeight: autoHeight.value
  })
  pdfDialog.value = false
}

const emit = defineEmits([
  'download-dynamic',
  'download-native',
  'download-md',
  'import-md',
  'download-picture'
])

const { exportFile, importFile, fileName } = useFile(emit)
const editorStore = useEditorStore()
async function saveTemplate() {
  try {
    await editorStore.saveTemplate()
    successMessage('模板已保存')
  } catch (error: any) {
    errorMessage(error.message || '模板保存失败，请重试')
  }
}
const draftStatus = computed(() => {
  if (editorStore.activeTemplateId)
    return editorStore.templateDirty ? '模板有未保存修改' : '模板编辑 · 已保存'
  if (!editorStore.draftSavedAt) return '草稿自动保存'
  return `草稿已保存 ${new Date(editorStore.draftSavedAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })}`
})
</script>

<template>
  <div id="header" class="noto-sans-sc">
    <router-link
      class="workspace-back"
      :to="editorStore.activeTemplateId ? '/template' : '/'"
      :aria-label="editorStore.activeTemplateId ? '返回模板库' : '返回我的简历'"
      ><span aria-hidden="true">←</span>
      {{ editorStore.activeTemplateId ? '模板库' : '我的简历' }}</router-link
    >
    <input
      id="resume-name-input"
      type="text"
      v-model="fileName"
      :aria-label="editorStore.activeTemplateId ? '模板名称' : '导出文件名'"
      @input="editorStore.activeTemplateId && editorStore.setTemplateName(fileName)"
    />
    <span class="draft-status">{{ draftStatus }}</span>
    <nav-menu
      @export-md="exportFile('md')"
      @import-md="importFile"
      @export-picture="exportFile('picture')"
    />
    <button
      v-if="editorStore.activeTemplateId"
      class="exporter btn"
      :disabled="editorStore.templateSaving"
      @click="saveTemplate"
    >
      {{ editorStore.templateSaving ? '保存中…' : '保存模板' }}
    </button>
    <button class="exporter server-export btn" @click="pdfDialog = true">导出PDF</button>
    <button class="exporter local-export btn" @click="exportFile('native')">备用导出</button>
    <div class="operator">
      <theme-toggle />
    </div>
  </div>
  <el-dialog
    v-model="pdfDialog"
    title="导出 PDF"
    width="420px"
    align-center
    class="pdf-export-dialog"
  >
    <form class="pdf-settings" @submit.prevent="exportPdf">
      <p>设置纸张尺寸，内容将按所选宽度排版、按高度分页。</p>
      <div class="paper-presets">
        <button type="button" @click="setPageSize(210, 297)">A4</button>
        <button type="button" @click="setPageSize(297, 210)">A4 横向</button>
        <button type="button" @click="setPageSize(215.9, 279.4)">Letter</button>
      </div>
      <div class="paper-dimensions">
        <label
          >页宽（mm）<input
            v-model.number="pageWidth"
            type="number"
            min="50"
            max="2000"
            step="0.1"
            required
        /></label>
        <label
          >页高（mm）<input
            v-model.number="pageHeight"
            type="number"
            min="50"
            max="2000"
            step="0.1"
            required
        /></label>
      </div>
      <p v-if="!sizeValid" role="alert">宽高需介于 50～2000 mm 之间。</p>
      <label class="auto-height">
        <input v-model="autoHeight" type="checkbox" />自动延长纸张，完整呈现在一页
      </label>
      <p v-if="autoHeight" class="auto-height-help">
        保持页宽和字号，页高至少为设定值，并按内容自动增加。适合电子投递，打印到 A4 时需缩放。
      </p>
      <div class="pdf-settings-actions">
        <el-button @click="pdfDialog = false">取消</el-button>
        <el-button type="primary" native-type="submit" :disabled="!sizeValid">导出 PDF</el-button>
      </div>
    </form>
  </el-dialog>
</template>

<style lang="scss" scoped>
.pdf-settings {
  p {
    margin-bottom: 20px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
  }
  .paper-presets {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }
  .paper-presets button {
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
    padding: 7px 12px;
    background: var(--el-fill-color-blank);
    color: var(--el-text-color-primary);
    cursor: pointer;
  }
  .paper-dimensions {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
  }
  label {
    flex: 1;
    min-width: 0;
  }
  input {
    display: block;
    width: 100%;
    margin-top: 8px;
    padding: 10px 12px;
    border: 1px solid var(--el-border-color);
    border-radius: 7px;
    color: var(--el-text-color-primary);
    background: var(--el-fill-color-blank);
    &:focus {
      outline: 2px solid var(--theme);
    }
  }
  .pdf-settings-actions {
    display: flex;
    justify-content: flex-end;
  }
  .auto-height {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    input {
      width: auto;
      margin: 0;
      accent-color: var(--theme);
    }
  }
  .auto-height-help {
    font-size: 12px;
  }
}
:global(.pdf-export-dialog) {
  max-width: calc(100vw - 32px);
  border-radius: 14px;
}
#header {
  z-index: 9;
  height: 60px;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 15px;
  text-align: center;
  color: var(--font-color);
  background: var(--background);
  font-weight: 600;
  .workspace-back {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    padding: 8px;
    margin-right: 12px;
    color: var(--writable-font-color);
    text-decoration: none;
    font-size: 13px;
    &:hover {
      color: var(--theme);
    }
    &:focus-visible {
      outline: 2px solid var(--theme);
      outline-offset: 2px;
    }
  }

  #resume-name-input {
    border: none;
    outline: none;
    padding: 8px 10px;
    border-radius: 5px;
    background: var(--body-background);
    font-family: var(--font-noto-sans-sc);

    &:focus {
      outline: 2px solid var(--theme);
    }
  }

  .draft-status {
    flex-shrink: 0;
    color: #7a8599;
    font-size: 12px;
    font-weight: 400;
    white-space: nowrap;
  }

  .exporter {
    outline: none;
    border: none;
    padding: 8px 10px;
    border-radius: 6px;
    margin-right: 10px;
    cursor: pointer;
    background: var(--theme);
    color: white;

    &:last-of-type {
      margin-right: 25px;
    }
    &:hover {
      opacity: 0.8;
    }
  }
  .problem,
  .github,
  .icon-back {
    cursor: pointer;
    margin-right: 18px;
    font-weight: normal;
  }
}
</style>
