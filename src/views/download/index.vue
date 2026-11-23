<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import useEditorStore from '@/store/modules/editor'
import { errorMessage } from '@/common/message'

const router = useRouter()
const editorStore = useEditorStore()
const printRoot = ref<HTMLElement>()
let style: HTMLStyleElement | undefined
let cancelled = false
onMounted(async () => {
  if (!printRoot.value || !editorStore.nativeContent) return
  style = document.createElement('style')
  style.textContent = editorStore.nativeStyle
  document.head.append(style)
  printRoot.value.innerHTML = editorStore.nativeContent
  editorStore.resetNativeContent()
  editorStore.nativeStyle = ''
  try {
    await document.fonts.ready
    await Promise.all(
      Array.from(printRoot.value.querySelectorAll('img')).map(image => image.decode())
    )
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    if (cancelled) return
    window.print()
    router.back()
  } catch {
    errorMessage('字体或图片未能加载，请返回编辑器重试')
  }
})
onUnmounted(() => {
  cancelled = true
  style?.remove()
  localStorage.removeItem('download')
})
</script>

<template>
  <div ref="printRoot"></div>
</template>
