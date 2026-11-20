import * as db from './db.js'
import type { Message, SessionSummary } from './types.js'

export type SearchHit = {
  /** 会话 id + 消息 id，用作列表 key */
  key: string
  sessionId: string
  title: string
  messageId: string
  snippet: string
  /** 消息创建时间，列表右侧展示 */
  createdAt: number
  /** 会话更新时间，用于排序 */
  updatedAt: number
}

const SNIPPET_BEFORE = 16
const SNIPPET_AFTER = 48
/** 同一会话最多保留几条命中，避免长对话刷屏 */
const MAX_PER_SESSION = 3

const messageText = (message: Message): string => {
  if (message.role === 'user') {
    return message.content
  }
  return message.blocks.map((block) => (block.type === 'text' ? block.text : '')).join('\n')
}

const buildSnippet = (text: string, at: number, length: number): string => {
  const start = Math.max(0, at - SNIPPET_BEFORE)
  const end = Math.min(text.length, at + length + SNIPPET_AFTER)
  const body = text.slice(start, end).replace(/\s+/g, ' ').trim()
  return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`
}

/**
 * 在全部历史会话的正文里搜索关键词。
 * 会话摘要不带正文，因此逐条按需读取（命中上限 60 条，命中后立即停止读取）。
 */
export const searchSessions = async (query: string, limit = 60): Promise<SearchHit[]> => {
  const keyword = query.trim()
  if (!keyword) {
    return []
  }
  const lower = keyword.toLowerCase()
  const summaries = await db.loadSessionSummaries()
  const ordered: SessionSummary[] = [...summaries].sort((a, b) => b.updatedAt - a.updatedAt)
  const hits: SearchHit[] = []

  for (const summary of ordered) {
    const session = await db.loadSession(summary.id)
    if (!session) {
      continue
    }
    let found = 0
    for (let index = session.messages.length - 1; index >= 0; index -= 1) {
      const message = session.messages[index]
      const text = messageText(message)
      const at = text.toLowerCase().indexOf(lower)
      if (at < 0) {
        continue
      }
      hits.push({
        key: `${session.id}:${message.id}`,
        sessionId: session.id,
        title: session.title || '',
        messageId: message.id,
        snippet: buildSnippet(text, at, keyword.length),
        createdAt: message.createdAt,
        updatedAt: session.updatedAt,
      })
      found += 1
      if (found >= MAX_PER_SESSION) {
        break
      }
      if (hits.length >= limit) {
        return hits
      }
    }
    if (hits.length >= limit) {
      return hits
    }
  }

  return hits
}
