import { errorMessage } from '../common/message'

interface IUploadOptions {
  multiple: boolean
  accept: string
}
export function getPickerFile(options: IUploadOptions) {
  const fileInput = document.createElement('input')
  fileInput.setAttribute('type', 'file')
  fileInput.setAttribute('accept', options.accept)
  fileInput.style.cssText = 'position: absolute; left: -9999px; top: -9999px; opacity: 0'
  fileInput.multiple = options.multiple
  const promise = new Promise<File>(function (resolve) {
    fileInput.addEventListener('change', async function (event) {
      document.body.removeChild(fileInput)
      try {
        const files = (event.target as HTMLInputElement).files as FileList
        resolve(files[0])
      } catch (e) {
        errorMessage(<string>e)
      }
    })
  })
  document.body.appendChild(fileInput)
  fileInput.click()
  return promise
}
