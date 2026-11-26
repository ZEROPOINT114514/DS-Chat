import { create } from 'zustand'

/** 消息里被点过一次、正在显示关闭键的图片；同一时间只有一张处于该状态 */
export const useActiveImage = create<{ id: string | null }>(() => ({ id: null }))

export const setActiveImage = (id: string | null) => useActiveImage.setState({ id })
export const toggleActiveImage = (id: string) =>
  useActiveImage.setState((state) => ({ id: state.id === id ? null : id }))
