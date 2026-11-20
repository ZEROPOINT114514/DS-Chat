import { Capacitor, registerPlugin } from '@capacitor/core'
import { readNativeFile } from './camera.js'

type RecentMediaPlugin = {
  list(options: { limit: number }): Promise<{
    items: { uri: string; thumbPath: string; name: string }[]
  }>
  open(options: { uri: string; name: string }): Promise<{ path: string; name: string }>
}

const RecentMedia = registerPlugin<RecentMediaPlugin>('RecentMedia')

export type RecentPhoto = { uri: string; name: string; url: string }

/**
 * 相册最近的照片，用于附件面板的缩略图条。
 * 没有权限或不是原生环境时返回空数组，面板只剩三个入口。
 */
export const loadRecentPhotos = async (limit = 8): Promise<RecentPhoto[]> => {
  if (!Capacitor.isNativePlatform()) {
    return []
  }
  try {
    const { items } = await RecentMedia.list({ limit })
    return items.map((item) => ({
      uri: item.uri,
      name: item.name,
      url: Capacitor.convertFileSrc(item.thumbPath),
    }))
  } catch {
    return []
  }
}

/** 选中的最近照片：先让原生复制到缓存，再读成 File */
export const readRecentPhoto = async (photo: RecentPhoto): Promise<File> => {
  const { path, name } = await RecentMedia.open({ uri: photo.uri, name: photo.name })
  return readNativeFile(path, name)
}
