import { create } from 'zustand'
import * as db from './chat/db.js'
import { useChatStore } from './chat/store.js'
import type { Session } from './chat/types.js'

export type PreviewImage = {
  id: string
  name: string
  url: string
}

type ImagePreviewState = {
  /** 当前会话里的全部图片，按消息顺序排列，用于左右滑动切换 */
  items: PreviewImage[]
  index: number
}

export const useImagePreview = create<ImagePreviewState>(() => ({ items: [], index: 0 }))

/** 当前显示的图片；没打开返回 null */
export const currentPreview = (state: ImagePreviewState): PreviewImage | null =>
  state.items.length > 0 ? (state.items[state.index] ?? null) : null

const objectUrls = new Map<string, string>()

const urlFor = async (id: string): Promise<string | null> => {
  const cached = objectUrls.get(id)
  if (cached) {
    return cached
  }
  const blob = await db.loadFile(id)
  if (!blob) {
    return null
  }
  const url = URL.createObjectURL(blob)
  objectUrls.set(id, url)
  return url
}

/** 按消息顺序收集会话里的图片（用户消息里的图片附件） */
const collectImages = (session: Session | undefined) => {
  if (!session) {
    return []
  }
  const list: { id: string; name: string }[] = []
  for (const message of session.messages) {
    if (message.role !== 'user') {
      continue
    }
    for (const file of message.files) {
      if (file.isImage) {
        list.push({ id: file.id, name: file.name })
      }
    }
  }
  return list
}

/** 点开某张图片：把同一会话里的其他图片一起准备好，支持左右滑动 */
export const openImagePreview = async (fileId: string) => {
  const state = useChatStore.getState()
  const session =
    state.activeId !== null && Object.hasOwn(state.sessionCache, state.activeId)
      ? state.sessionCache[state.activeId]
      : undefined
  const targets = collectImages(session)
  const resolved = await Promise.all(
    targets.map(async (target) => {
      const url = await urlFor(target.id)
      return url ? { ...target, url } : null
    })
  )
  const items = resolved.filter((item): item is PreviewImage => item !== null)
  if (items.length === 0) {
    return
  }
  const found = items.findIndex((item) => item.id === fileId)
  useImagePreview.setState({ items, index: found < 0 ? 0 : found })
}

/**
 * 用现成的地址打开预览（例如输入框里还没发送的草稿图片）。
 * 这些地址由调用方持有，关闭时不会释放，避免草稿缩略图变成空白。
 */
export const openImagePreviewItems = (items: PreviewImage[], index: number) => {
  if (items.length === 0) {
    return
  }
  useImagePreview.setState({
    items,
    index: Math.min(Math.max(index, 0), items.length - 1),
  })
}

export const setPreviewIndex = (index: number) =>
  useImagePreview.setState((state) => ({
    index: Math.min(Math.max(index, 0), Math.max(state.items.length - 1, 0)),
  }))

/** 关闭预览并释放临时地址，下次打开重新从本地库读取 */
export const closeImagePreview = () => {
  for (const url of objectUrls.values()) {
    URL.revokeObjectURL(url)
  }
  objectUrls.clear()
  useImagePreview.setState({ items: [], index: 0 })
}

export const isPreviewOpen = () => useImagePreview.getState().items.length > 0
