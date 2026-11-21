import { create } from 'zustand'

export type HistoryTaskKind = 'import' | 'export' | 'delete'

export type HistoryTask = {
  kind: HistoryTaskKind
  /** 0~100 */
  percent: number
  /** 附带的进度说明，例如「正在写入」「18 / 42」 */
  detail?: string
}

export const useHistoryTask = create<{ task: HistoryTask | null }>(() => ({ task: null }))

export const startHistoryTask = (kind: HistoryTaskKind) =>
  useHistoryTask.setState({ task: { kind, percent: 0 } })

export const updateHistoryTask = (percent: number, detail?: string) =>
  useHistoryTask.setState((state) =>
    state.task
      ? {
          task: {
            ...state.task,
            percent: Math.min(100, Math.max(0, Math.round(percent))),
            detail,
          },
        }
      : state
  )

export const finishHistoryTask = () => useHistoryTask.setState({ task: null })
