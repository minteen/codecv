<script setup lang="ts">
import Header from './components/header/header.vue'
import MarkdownRender from '@/views/editor/components/preview/render.vue'
import Editor from '@/views/editor/components/editor/editorContainer.vue'
import { useResumeType, useDownLoad, useImportMD, useAvatar, useShowExport } from './hook'
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import 'element-plus/es/components/message-box/style/css'
import useEditorStore from '@/store/modules/editor'
import { startGuide } from './components/guide/guide'
import type { PdfPageSize } from '@/common/pdf'

const { resumeType } = useResumeType()
const { downloadDynamic, downloadNative, downloadMD } = useDownLoad(resumeType)
const { importMD } = useImportMD(resumeType)
const { setAvatar } = useAvatar(resumeType)
const { showExport } = useShowExport()
startGuide()

const route = useRoute()
const editorStore = useEditorStore()
const ready = ref(false)
const loadError = ref(false)
let loadVersion = 0
async function confirmTemplateLeave() {
  if (!editorStore.activeTemplateId || !editorStore.templateDirty) return true
  try {
    await ElMessageBox.confirm('模板有未保存的修改，离开后这些修改将丢失。', '离开模板编辑？', {
      confirmButtonText: '放弃修改并离开',
      cancelButtonText: '继续编辑',
      type: 'warning'
    })
    return true
  } catch {
    return false
  }
}
onBeforeRouteLeave(confirmTemplateLeave)
onBeforeRouteUpdate(confirmTemplateLeave)
function beforeUnload(event: BeforeUnloadEvent) {
  if (editorStore.activeTemplateId && editorStore.templateDirty) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', beforeUnload))

async function loadDraft() {
  const version = ++loadVersion
  ready.value = false
  loadError.value = false
  editorStore.closeDraft()
  if (route.path !== '/editor') return
  try {
    if (route.query.mode === 'template') {
      await editorStore.initTemplate(resumeType.value)
    } else
      await editorStore.initMDContent(
        resumeType.value,
        route.query.draft ? String(route.query.draft) : undefined
      )
    if (version === loadVersion) ready.value = true
  } catch {
    if (version === loadVersion) loadError.value = true
  }
}

// The page is kept alive: a new URL must start a new editing session, even
// when both drafts use the same template. Unmount editors while loading.
watch(() => route.fullPath, loadDraft, { immediate: true, flush: 'sync' })
</script>

<template>
  <Header
    v-if="ready"
    @download-dynamic="(filename: string, size: PdfPageSize) => downloadDynamic(true, filename, size)"
    @download-picture="(filename: string) => downloadDynamic(false, filename)"
    @download-native="downloadNative"
    @download-md="downloadMD"
    @import-md="importMD"
  />
  <div v-if="ready" id="editor">
    <Editor />
    <markdown-render class="markdown-render" @upload-avatar="setAvatar" />
    <el-tooltip content="导出PDF文件" v-if="showExport">
      <i
        data-aos="fade-in"
        data-aos-duration="800"
        data-aos-offset="50"
        class="iconfont icon-export hover pointer standby-export"
        @click="downloadDynamic(true)"
      ></i>
    </el-tooltip>
  </div>
  <div v-else-if="loadError" class="draft-load-state" role="alert">
    <p>
      {{
        route.query.mode === 'template'
          ? '无法打开这个模板，请重试或返回模板库。'
          : '无法打开这份草稿，请重试或返回主页选择其他草稿。'
      }}
    </p>
    <button @click="loadDraft">重新加载</button>
    <router-link :to="route.query.mode === 'template' ? '/template' : '/'">{{
      route.query.mode === 'template' ? '返回模板库' : '返回我的简历'
    }}</router-link>
  </div>
  <div v-else class="draft-load-state" role="status">
    {{ route.query.mode === 'template' ? '正在加载模板…' : '正在加载草稿…' }}
  </div>
</template>

<style lang="scss" scoped>
.draft-load-state {
  padding: 80px 24px;
  text-align: center;
  color: var(--font-color);
  p {
    margin-bottom: 20px;
  }
  button,
  a {
    margin: 12px;
  }
}
#editor {
  display: flex;
  position: relative;
  .markdown-render {
    flex: 1;
    margin: 0 10px;
    border-radius: 10px;
  }
  .standby-export {
    position: absolute;
    top: 120px;
    right: 30px;
    z-index: 3;
    color: #f8f8f8;
    background: var(--theme);
    text-align: center;
    line-height: 45px;
    padding-left: 2px;
    font-size: 22px;
    width: 45px;
    height: 45px;
    border-radius: 50%;

    &:hover {
      color: var(--theme);
      background: #f8f8f8;
    }
  }
}
</style>
