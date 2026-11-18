import { create } from 'zustand'

type ImagePreviewState = {
  /** 正在预览的图片地址（本地 object URL），null 表示没有打开预览 */
  url: string | null
  name: string
}

/** 图片预览遮罩：点缩略图打开，点遮罩、关闭按钮或系统返回键关闭 */
export const useImagePreview = create<ImagePreviewState>(() => ({ url: null, name: '' }))

export const openImagePreview = (url: string, name: string) =>
  useImagePreview.setState({ url, name })

export const closeImagePreview = () => useImagePreview.setState({ url: null, name: '' })
