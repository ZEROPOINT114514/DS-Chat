import { create } from 'zustand'

/**
 * 输入框里被点过一次、正在显示关闭键的待发送图片；同一时间只有一张处于该状态。
 * 已发送的图片不参与这个状态：它们点击即打开查看器，没有「撤回」入口。
 */
export const useActiveDraftImage = create<{ id: string | null }>(() => ({ id: null }))

export const setActiveDraftImage = (id: string | null) => useActiveDraftImage.setState({ id })

export const toggleActiveDraftImage = (id: string) =>
  useActiveDraftImage.setState((state) => ({ id: state.id === id ? null : id }))
