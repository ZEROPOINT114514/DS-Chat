import { Capacitor, registerPlugin } from '@capacitor/core'
import { readBlobBase64 } from './fileSaver.js'

type FileOpenerPlugin = {
  /** 把字节写入应用缓存，再交给系统的「打开方式」选择器 */
  open(options: { name: string; mime: string; data: string }): Promise<void>
}

const FileOpener = registerPlugin<FileOpenerPlugin>('FileOpener')

/** 浏览器里退化成下载，原生端弹出系统打开方式选择器 */
const fallbackDownload = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export const openFileWithSystem = async (blob: Blob, name: string, mime: string) => {
  if (!Capacitor.isNativePlatform()) {
    fallbackDownload(blob, name)
    return
  }
  await FileOpener.open({
    name,
    mime: mime || 'application/octet-stream',
    data: await readBlobBase64(blob),
  })
}
