import { Capacitor, registerPlugin } from '@capacitor/core'
import { readNativeFile } from './camera.js'

type ShareTargetPlugin = {
  consume(): Promise<{ path: string | null; name?: string; mime?: string }>
}

const ShareTarget = registerPlugin<ShareTargetPlugin>('ShareTarget')

/**
 * 取走其他应用分享进来的文件（只取一次）。
 * 没有待处理文件或不是原生环境时返回 null。
 */
export const consumeSharedFile = async (): Promise<File | null> => {
  if (!Capacitor.isNativePlatform()) {
    return null
  }
  try {
    const result = await ShareTarget.consume()
    if (!result.path) {
      return null
    }
    return await readNativeFile(result.path, result.name ?? 'shared-file', result.mime)
  } catch {
    return null
  }
}
