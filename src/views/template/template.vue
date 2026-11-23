<script setup lang="ts">
import { computed, ref, onActivated } from 'vue'
import {
  templates,
  type TemplateType,
  addLibraryTemplate,
  removeLibraryTemplate,
  loadTemplateLibrary
} from '@/templates/config'
import ResumeCard from './components/resumeCard.vue'
import { templateCategory } from './constant'
import { useRouter } from 'vue-router'
import { createDraft } from '@/common/drafts'
import { errorMessage, successMessage } from '@/common/message'
import { ElMessageBox } from 'element-plus'
import 'element-plus/es/components/message-box/style/css'

const router = useRouter()
const busy = ref(false)
async function startDraft(template?: TemplateType) {
  if (busy.value) return
  busy.value = true
  try {
    const type = template?.type || 'create'
    const draft = await createDraft(type, template?.name || '空白简历', template?.content || '', {
      appearance: template?.appearance,
      baseTemplate: template?.baseTemplate || type
    })
    await router.push({ path: '/editor', query: { type, draft: draft.id } })
  } catch {
    errorMessage('创建简历失败，请重试')
  } finally {
    busy.value = false
  }
}
function editTemplate(template: TemplateType) {
  router.push({ path: '/editor', query: { type: template.type, mode: 'template' } })
}
async function removeTemplate(template: TemplateType) {
  if (busy.value) return
  busy.value = true
  try {
    await ElMessageBox.confirm(
      `确定删除模板“${template.name}”吗？删除后将无法再使用这个模板创建简历，已有简历不受影响。`,
      '删除模板',
      { type: 'warning', confirmButtonText: '删除模板', cancelButtonText: '取消' }
    )
    await removeLibraryTemplate(template.type)
    if (!categories.value.includes(category.value)) category.value = '全部'
    successMessage('模板已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') errorMessage('删除模板失败，请重试')
  } finally {
    busy.value = false
  }
}
async function addTemplate() {
  if (busy.value) return
  busy.value = true
  try {
    const { value } = await ElMessageBox.prompt('给新模板起一个容易辨认的名字', '添加模板', {
      inputPlaceholder: '例如：后端开发简约模板',
      inputPattern: /\S+/,
      inputErrorMessage: '模板名称不能为空',
      confirmButtonText: '创建并编辑',
      cancelButtonText: '取消'
    })
    const template = await addLibraryTemplate(value)
    await router.push({ path: '/editor', query: { type: template.type, mode: 'template' } })
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') errorMessage('添加模板失败，请重试')
  } finally {
    busy.value = false
  }
}
onActivated(() => {
  void loadTemplateLibrary().catch(() => errorMessage('模板加载失败，请重试'))
})
const search = ref('')
const category = ref('全部')
function clearFilters() {
  search.value = ''
  category.value = '全部'
}
const categories = computed(() =>
  templateCategory.filter(
    item => item === '全部' || templates.value.some(template => template.name.includes(item))
  )
)
const visibleTemplates = computed(() =>
  templates.value.filter(
    template =>
      (category.value === '全部' || template.name.includes(category.value)) &&
      template.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())
  )
)
</script>

<template>
  <main class="template-picker noto-sans-sc" aria-labelledby="template-title" :aria-busy="busy">
    <div class="picker-intro">
      <div>
        <p class="picker-eyebrow">把好的排版，留作下一次的起点</p>
        <h1 id="template-title">模板库</h1>
        <p>点击模板修改内容与样式，或添加自己的模板。</p>
      </div>
      <button class="blank-start" :disabled="busy" @click="addTemplate">
        <span aria-hidden="true">＋</span> 添加模板
      </button>
    </div>
    <div class="picker-tools">
      <div class="category-filters" role="group" aria-label="模板分类">
        <button
          v-for="item in categories"
          :key="item"
          :aria-pressed="category === item"
          @click="category = item"
        >
          {{ item }}
        </button>
      </div>
      <input v-model="search" type="search" placeholder="搜索模板名称" aria-label="搜索模板" />
    </div>
    <p class="template-count" role="status">
      {{ visibleTemplates.length }} 个模板<span> · 修改模板不会影响已有简历</span>
    </p>
    <div v-if="visibleTemplates.length" class="template-grid">
      <ResumeCard
        v-for="template in visibleTemplates"
        :key="template.type"
        :theme="template"
        :disabled="busy"
        @edit="editTemplate"
        @create="startDraft"
        @delete="removeTemplate"
      />
    </div>
    <div v-else class="no-templates">
      <h3>{{ templates.length ? '没有找到匹配的模板' : '还没有模板' }}</h3>
      <p>
        {{
          templates.length
            ? '试试其他名称，或添加一个新模板。'
            : '添加一个模板，保存你自己的内容与排版。'
        }}
      </p>
      <button v-if="templates.length" @click="clearFilters">清除筛选</button>
      <button v-else :disabled="busy" @click="addTemplate">添加模板</button>
    </div>
    <p v-if="busy" class="template-count" role="status">正在处理，请稍候…</p>
  </main>
</template>

<style lang="scss" scoped>
.template-picker {
  color: var(--font-color);
  max-width: 1200px;
  margin: 0 auto;
  padding: 48px 32px;
}
.picker-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
  h1 {
    font-size: 34px;
    letter-spacing: -0.5px;
    margin: 8px 0 10px;
  }
  p {
    font-size: 13px;
    color: var(--writable-font-color);
    line-height: 1.7;
  }
  .picker-eyebrow {
    font-size: 11px;
    letter-spacing: 1px;
  }
}
.blank-start {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 11px 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--background);
  color: var(--font-color);
  cursor: pointer;
}
.picker-tools {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-top: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
  input {
    width: 210px;
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid var(--el-border-color);
    border-radius: 7px;
    background: var(--background);
    color: var(--font-color);
  }
}
.category-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  button {
    padding: 8px 12px;
    border: 0;
    border-radius: 6px;
    color: var(--writable-font-color);
    background: transparent;
    cursor: pointer;
  }
  [aria-pressed='true'] {
    background: var(--theme);
    color: white;
  }
}
.template-count {
  margin: 18px 0;
  font-size: 12px;
  color: var(--writable-font-color);
}
.template-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  align-items: start;
}
.no-templates {
  text-align: center;
  padding: 48px 20px;
  h3 {
    margin-bottom: 12px;
  }
  p {
    margin-bottom: 20px;
  }
  button {
    padding: 10px 16px;
    border-radius: 6px;
    border: 1px solid var(--el-border-color);
    background: var(--background);
    color: var(--theme);
    cursor: pointer;
  }
}
button,
input {
  font: inherit;
  &:focus-visible {
    outline: 2px solid var(--theme);
    outline-offset: 3px;
  }
}
button:disabled {
  opacity: 0.6;
  cursor: wait;
}
@media (max-width: 900px) {
  .template-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .template-picker {
    padding: 28px 20px;
  }
  .picker-intro {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    h1 {
      font-size: 28px;
    }
  }
  .picker-tools {
    flex-direction: column-reverse;
    align-items: stretch;
    input {
      width: 100%;
    }
  }
  .template-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .template-count span {
    display: none;
  }
}
@media (max-width: 380px) {
  .template-grid {
    grid-template-columns: 1fr;
  }
}
</style>
