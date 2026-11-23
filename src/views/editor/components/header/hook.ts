import { onMounted, ref } from 'vue'
import useEditorStore from '@/store/modules/editor'

export function useFile(emit: any) {
  const fileName = ref('')
  const exportFile = (type: string) => {
    document.title = fileName.value
    emit(`download-${type}` as any, fileName.value)
  }

  const importFile = (event: any) => {
    emit('import-md', event?.target?.files[0])
  }

  onMounted(() => (fileName.value = useEditorStore().activeDraftName || document.title))
  return {
    fileName,
    exportFile,
    importFile
  }
}
