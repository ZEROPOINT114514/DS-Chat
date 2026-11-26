import { Capacitor, registerPlugin } from '@capacitor/core'
import { blobBase64Chunks } from './fileSaver.js'

type FileOpenerPlugin = {
  /** 在应用缓存里建一个待写入的文件，返回后续分块用的 token */
  begin(options: { name: string; mime: string }): Promise<{ token: string }>
  /** 追加一段 base64 数据 */
  chunk(options: { token: string; data: string }): Promise<void>
  /** 收尾：交给系统的「打开方式」选择器 */
  finish(options: { token: string }): Promise<void>
  /** 出错时丢弃缓存文件 */
  abort(options: { token: string }): Promise<void>
}

const FileOpener = registerPlugin<FileOpenerPlugin>('FileOpener')

/** 浏览器里没有系统选择器，退回成下载 */
const downloadInBrowser = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * 交给系统的「打开方式」：原生端分块写缓存 → FileProvider → ACTION_VIEW，
 * 让用户自己挑 WPS、Office、阅读器等应用预览。
 */
export const openFileWithSystem = async (blob: Blob, name: string, mime: string) => {
  if (!Capacitor.isNativePlatform()) {
    downloadInBrowser(blob, name)
    return
  }
  const { token } = await FileOpener.begin({
    name,
    mime: mime || 'application/octet-stream',
  })
  try {
    for await (const data of blobBase64Chunks(blob)) {
      await FileOpener.chunk({ token, data })
    }
    await FileOpener.finish({ token })
  } catch (error) {
    await FileOpener.abort({ token }).catch(() => {})
    throw error
  }
}
