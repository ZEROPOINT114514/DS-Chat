import { Capacitor, registerPlugin } from '@capacitor/core'

type FileSaverPlugin = {
  /** 创建导出任务，返回后续分块写入用的 token */
  begin(options: { name: string; mime: string }): Promise<{ token: string }>
  /** 追加一段 base64 数据 */
  chunk(options: { token: string; data: string }): Promise<void>
  /** 收尾并返回文件在系统里的位置 */
  finish(options: { token: string }): Promise<{ path: string }>
  /** 出错时丢弃已写入的内容 */
  abort(options: { token: string }): Promise<void>
}

const FileSaver = registerPlugin<FileSaverPlugin>('FileSaver')

/** 单次写入 512KB，避免把整份内容拼成一个巨大的字符串 */
const CHUNK_BYTES = 512 * 1024

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  const step = 8192
  for (let offset = 0; offset < bytes.length; offset += step) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + step))
  }
  return btoa(binary)
}

/**
 * 按固定大小切片逐块编码：每块都是独立合法的 base64，
 * 原生侧可以逐块解码后顺序写进同一个文件，不用先拼成几十 MB 的字符串。
 */
export async function* blobBase64Chunks(blob: Blob): AsyncGenerator<string> {
  for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
    const buffer = await blob.slice(offset, offset + CHUNK_BYTES).arrayBuffer()
    yield bytesToBase64(new Uint8Array(buffer))
  }
}

/**
 * 原生环境把文件写进系统下载目录并返回展示路径；浏览器返回 null，
 * 由调用方继续用 a[download] 触发下载。
 */
export const saveFileNatively = async (
  name: string,
  blob: Blob,
  mime: string,
  onProgress?: (written: number, total: number) => void
): Promise<string | null> => {
  if (!Capacitor.isNativePlatform()) {
    return null
  }

  const { token } = await FileSaver.begin({ name, mime })
  let written = 0
  try {
    for await (const data of blobBase64Chunks(blob)) {
      await FileSaver.chunk({ token, data })
      written = Math.min(written + CHUNK_BYTES, blob.size)
      onProgress?.(written, blob.size)
    }
    const { path } = await FileSaver.finish({ token })
    return path
  } catch (error) {
    await FileSaver.abort({ token }).catch(() => {})
    throw error
  }
}
