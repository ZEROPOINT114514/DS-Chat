import type { Source } from '../../services/chat/view.js'
import { HoverCard, type HoverCardTrigger } from './HoverCard.js'
import { SourceCard } from './SourceCard.js'

/**
 * 正文里 [citation:N] 的数字角标：悬停或点击展开来源卡片。
 * 点击只切换卡片，不再打开浏览器——跳转链接在卡片内部，避免一次点击触发两个动作。
 */
export const CitationLink = ({ source }: { source: Source }) => {
  const renderTrigger: HoverCardTrigger = ({ domRef, domProps }) => (
    <span ref={domRef} className="ds-markdown-cite" {...domProps}>
      {source.index}
    </span>
  )
  return (
    <HoverCard openOnClick renderTrigger={renderTrigger}>
      <SourceCard source={source} />
    </HoverCard>
  )
}
