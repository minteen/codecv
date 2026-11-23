<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import 'element-plus/es/components/message-box/style/css'
import { templates, templateLabels } from '@/templates/config'
import {
  copyDraft,
  deleteDraft,
  migrateLegacyDrafts,
  renameDraft,
  type ResumeDraft
} from '@/common/drafts'
import { errorMessage, successMessage } from '@/common/message'
const emit = defineEmits(['create'])

const templateNames = computed<Record<string, string>>(() => ({
  create: '空白简历',
  ...Object.fromEntries(templates.value.map(item => [item.type, item.name]))
}))
const drafts = ref<ResumeDraft[]>([])
const loading = ref(true)
const loadFailed = ref(false)
const search = ref('')
const sort = ref('updated')
const busy = ref(false)
const latestDraft = computed(() => drafts.value[0])
const visibleDrafts = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return drafts.value
    .filter(draft =>
      `${draft.name} ${
        templateLabels.value[draft.templateType] ||
        templateNames.value[draft.templateType] ||
        draft.templateType
      }`
        .toLocaleLowerCase()
        .includes(query)
    )
    .sort((a, b) =>
      sort.value === 'name'
        ? a.name.localeCompare(b.name, 'zh-CN')
        : sort.value === 'created'
        ? b.createdAt - a.createdAt
        : b.updatedAt - a.updatedAt
    )
})

let refreshing = false
async function refresh() {
  if (refreshing) return
  refreshing = true
  loadFailed.value = false
  try {
    drafts.value = await migrateLegacyDrafts(templateNames.value)
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
    refreshing = false
  }
}

function draftLocation(draft: ResumeDraft) {
  return { path: '/editor', query: { type: draft.templateType, draft: draft.id } }
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Show the draft's own text, without rendering arbitrary HTML or remote images.
function excerpt(content: string) {
  return (
    content
      .replace(/<[^>]*>/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith(':::') && !/^[-|:\s]+$/.test(line))
      .slice(0, 8)
      .join('\n')
      .replace(/icon:[\w-]+/g, '')
      .replace(/[#*`>|]/g, '')
      .slice(0, 400) || '这份简历还没有内容，开始记录你的经历吧。'
  )
}

async function manageDraft(action: 'copy' | 'rename' | 'delete', draft: ResumeDraft) {
  if (busy.value) return
  busy.value = true
  try {
    if (action === 'copy') {
      await copyDraft(draft.id)
      successMessage('草稿复制成功')
    } else if (action === 'rename') {
      const { value } = await ElMessageBox.prompt(
        '为不同岗位或版本起一个容易辨认的名字',
        '重命名草稿',
        {
          customClass: 'draft-rename-dialog',
          inputValue: draft.name,
          inputPlaceholder: '请输入简历名称',
          inputPattern: /\S+/,
          inputErrorMessage: '名称不能为空',
          confirmButtonText: '保存',
          cancelButtonText: '取消'
        }
      )
      await renameDraft(draft.id, value)
    } else {
      await ElMessageBox.confirm(`确定删除“${draft.name}”吗？删除后无法恢复。`, '删除草稿', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await deleteDraft(draft.id)
      successMessage('草稿已删除')
    }
    await refresh()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') errorMessage('操作失败，请重试')
  } finally {
    busy.value = false
  }
}

onMounted(refresh)
onActivated(refresh)
</script>

<template>
  <section class="draft-manager" aria-labelledby="workspace-title" :aria-busy="loading">
    <div class="draft-heading">
      <div>
        <p class="eyebrow">为下一次机会，准备好每一个版本</p>
        <h1 id="workspace-title">我的简历</h1>
        <p class="subtitle">继续打磨已有简历，或从一个新版本开始。</p>
      </div>
      <button class="primary-button" @click="emit('create')">
        <span aria-hidden="true">＋</span> 新建简历
      </button>
    </div>

    <div v-if="loading" class="empty-state" role="status">正在加载你的简历草稿…</div>
    <div v-else-if="loadFailed" class="empty-state" role="alert">
      <h2>暂时无法加载草稿</h2>
      <button class="text-button" @click="refresh">重新加载</button>
    </div>
    <template v-else>
      <div v-if="latestDraft" class="recent-draft">
        <div class="recent-info">
          <span class="eyebrow">接着上次写</span>
          <h2>{{ latestDraft.name }}</h2>
          <p>上次编辑于 {{ formatDate(latestDraft.updatedAt) }}</p>
        </div>
        <router-link class="continue-button" :to="draftLocation(latestDraft)"
          >继续编辑 <span aria-hidden="true">↗</span></router-link
        >
      </div>

      <div class="draft-toolbar">
        <h2>
          全部草稿 <span>{{ drafts.length }}</span>
        </h2>
        <div v-if="drafts.length" class="filters">
          <input
            v-model="search"
            type="search"
            aria-label="搜索草稿"
            placeholder="搜索名称或模板"
          />
          <select v-model="sort" aria-label="草稿排序">
            <option value="updated">最近编辑</option>
            <option value="created">最近创建</option>
            <option value="name">按名称排序</option>
          </select>
        </div>
      </div>

      <div v-if="visibleDrafts.length" class="draft-grid">
        <article v-for="draft in visibleDrafts" :key="draft.id" class="draft-card">
          <router-link
            class="draft-link"
            :to="draftLocation(draft)"
            :aria-label="`编辑 ${draft.name}`"
          >
            <div class="draft-preview" aria-hidden="true">
              <div class="paper">
                <span class="paper-label">RESUME</span>
                <p>{{ excerpt(draft.content) }}</p>
              </div>
              <span class="preview-label">内容摘录</span>
            </div>
            <div class="draft-info">
              <h3>{{ draft.name }}</h3>
              <span class="template-label">{{
                templateLabels[draft.templateType] ||
                templateNames[draft.templateType] ||
                draft.templateType
              }}</span>
              <p>
                <time
                  :datetime="new Date(draft.updatedAt).toISOString()"
                  :title="new Date(draft.updatedAt).toLocaleString('zh-CN')"
                  >{{ formatDate(draft.updatedAt) }} 更新</time
                >
              </p>
            </div>
          </router-link>
          <div class="draft-actions">
            <router-link :to="draftLocation(draft)" :aria-label="`继续编辑 ${draft.name}`"
              >编辑 <span aria-hidden="true">↗</span></router-link
            >
            <div>
              <button :disabled="busy" @click="manageDraft('copy', draft)">复制</button>
              <button :disabled="busy" @click="manageDraft('rename', draft)">重命名</button>
              <button class="danger" :disabled="busy" @click="manageDraft('delete', draft)">
                删除
              </button>
            </div>
          </div>
        </article>
      </div>
      <div v-else-if="drafts.length" class="empty-state" role="status">
        <h2>没有找到匹配的草稿</h2>
        <p>换个名称或模板关键词试试。</p>
        <button class="text-button" @click="search = ''">清除搜索</button>
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon" aria-hidden="true">＋</div>
        <h2>从第一份简历开始</h2>
        <p>选一个喜欢的模板，写下你的经历。保存的草稿会出现在这里。</p>
        <button class="primary-button" @click="emit('create')">创建第一份简历</button>
      </div>
    </template>
  </section>
</template>

<style lang="scss">
// MessageBox is mounted on body, outside this component's scoped styles.
.el-message-box.draft-rename-dialog {
  width: 440px;
  max-width: calc(100vw - 40px);
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 20px 64px #00000026;

  .el-message-box__header {
    padding: 0 28px 16px 0;
  }
  .el-message-box__title {
    font-size: 20px;
    font-weight: 600;
  }
  .el-message-box__headerbtn {
    top: 20px;
    right: 20px;
  }
  .el-message-box__content {
    padding: 0;
  }
  .el-message-box__message {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.8;
  }
  .el-message-box__input {
    padding-top: 18px;
  }
  .el-input__wrapper {
    min-height: 44px;
    padding: 0 14px;
    border-radius: 8px;
  }
  .el-message-box__btns {
    padding: 8px 0 0;
  }
  .el-button {
    min-height: 38px;
    padding: 0 20px;
    border-radius: 8px;
  }
}
</style>

<style lang="scss" scoped>
.draft-manager {
  max-width: 1200px;
  min-height: calc(100vh - 144px);
  margin: 0 auto;
  padding: 48px 32px;
  --muted: var(--writable-font-color);
  --line: var(--el-border-color-lighter);
  a {
    text-decoration: none;
    color: inherit;
  }
  button,
  input,
  select {
    font: inherit;
  }
  button,
  a,
  input,
  select {
    &:focus-visible {
      outline: 2px solid var(--theme);
      outline-offset: 4px;
    }
  }
  button {
    cursor: pointer;
  }
  button:disabled {
    cursor: wait;
    opacity: 0.5;
  }
  .primary-button {
    border: 0;
    background: var(--theme);
    color: #fff;
  }
}
.draft-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 32px;
  h1 {
    margin: 10px 0;
    font-size: 34px;
    font-weight: 600;
    letter-spacing: -1px;
  }
}
.eyebrow {
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 1px;
}
.subtitle {
  color: var(--muted);
  font-size: 14px;
  line-height: 1.8;
}
.primary-button,
.continue-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-shrink: 0;
  border-radius: 8px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  &:hover {
    filter: brightness(0.94);
  }
}
.recent-draft {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  padding: 24px 28px;
  background: var(--background);
  border: 1px solid var(--line);
  border-left: 3px solid var(--theme);
  border-radius: 10px;
  margin-bottom: 36px;
  .recent-info {
    min-width: 0;
  }
  h2 {
    margin: 8px 0;
    font-size: 20px;
    overflow-wrap: anywhere;
  }
  p {
    font-size: 12px;
    color: var(--muted);
  }
  .continue-button {
    border: 1px solid var(--line);
  }
}
.draft-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
  h2 {
    font-size: 18px;
    white-space: nowrap;
  }
  h2 span {
    margin-left: 8px;
    font-weight: 400;
    font-size: 14px;
    color: var(--muted);
  }
}
.filters {
  display: flex;
  gap: 12px;
  input,
  select {
    border: 1px solid var(--line);
    border-radius: 7px;
    padding: 10px 12px;
    background: var(--background);
    color: var(--font-color);
    font-size: 13px;
  }
  input {
    width: 230px;
    min-width: 0;
  }
}
.draft-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}
.draft-card {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--background);
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
  &:hover,
  &:focus-within {
    border-color: var(--theme);
    box-shadow: 0 8px 24px #00000008;
  }
}
.draft-link {
  display: block;
}
.draft-preview {
  height: 176px;
  overflow: hidden;
  padding: 20px 32px 0;
  position: relative;
  background: var(--body-background);
  border-bottom: 1px solid var(--line);
}
.paper {
  background: var(--background);
  border: 1px solid var(--line);
  border-radius: 3px;
  min-height: 220px;
  padding: 20px;
  box-shadow: 0 4px 12px #00000006;
  .paper-label {
    font-size: 9px;
    letter-spacing: 3px;
    color: var(--theme);
  }
  p {
    margin-top: 12px;
    white-space: pre-line;
    overflow-wrap: anywhere;
    font-size: 10px;
    line-height: 1.9;
    color: var(--muted);
  }
}
.preview-label {
  position: absolute;
  bottom: 10px;
  right: 12px;
  padding: 4px 6px;
  border-radius: 4px;
  background: var(--background);
  font-size: 10px;
  color: var(--muted);
}
.draft-info {
  padding: 20px;
  h3 {
    font-size: 16px;
    margin-bottom: 10px;
    overflow-wrap: anywhere;
  }
  .template-label {
    display: inline-block;
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 3px 7px;
    font-size: 11px;
    color: var(--muted);
  }
  p {
    margin-top: 14px;
    font-size: 12px;
    color: var(--muted);
  }
}
.draft-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--line);
  font-size: 12px;
  a {
    padding: 5px 4px;
    color: var(--theme);
  }
  button {
    border: 0;
    background: transparent;
    color: var(--muted);
    padding: 5px 6px;
    font-size: 12px;
  }
  button:hover {
    color: var(--theme);
  }
  .danger:hover {
    color: #d84343;
  }
}
.empty-state {
  padding: 56px 20px;
  text-align: center;
  border: 1px dashed var(--line);
  border-radius: 12px;
  background: var(--background);
  h2 {
    font-size: 20px;
    margin-bottom: 12px;
  }
  p {
    font-size: 14px;
    line-height: 1.8;
    color: var(--muted);
    margin-bottom: 24px;
  }
  .empty-icon {
    font-size: 32px;
    color: var(--theme);
    margin-bottom: 16px;
  }
}
.text-button {
  border: 0;
  padding: 12px;
  background: transparent;
  color: var(--theme);
}
@media (max-width: 1000px) {
  .draft-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .draft-manager {
    padding: 28px 20px;
  }
  .draft-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }
  .draft-heading h1 {
    font-size: 28px;
  }
  .recent-draft {
    padding: 20px;
    gap: 16px;
    flex-wrap: wrap;
  }
  .draft-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 16px;
  }
  .filters {
    input {
      flex: 1;
      width: 100%;
    }
    select {
      max-width: 130px;
    }
  }
  .draft-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}
</style>
