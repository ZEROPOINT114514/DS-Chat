import { useEffect, useState, type HTMLAttributes, type MutableRefObject, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredPosition, useDelayedOpen } from '../base/anchored.js'
import styles from './HoverCard.module.css'

const ENTER_DELAY = 300
const LEAVE_DELAY = 100
const GAP = 6

export type HoverCardTrigger = (props: {
  domRef: MutableRefObject<HTMLSpanElement | null>
  domProps: Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'className' | 'style'> | undefined
}) => ReactNode

/**
 * 悬停 300ms 后在触发元素下方显示卡片（放不下则上方），鼠标可移入卡片。
 * openOnClick 打开时，点击触发元素切换卡片，点空白处关闭；两者可同时使用。
 */
export const HoverCard = ({
  renderTrigger,
  children,
  openOnClick = false,
}: {
  renderTrigger: HoverCardTrigger
  children: ReactNode
  /** 点击触发元素展开 / 收起卡片，并阻止事件冒泡到外层链接 */
  openOnClick?: boolean
}) => {
  const { open, schedule, cancel } = useDelayedOpen()
  const [pinned, setPinned] = useState(false)
  const visible = open || pinned
  const { anchorRef, floatingRef, position } = useAnchoredPosition<HTMLSpanElement, HTMLDivElement>(
    visible,
    { align: 'center', offset: GAP }
  )

  useEffect(() => () => cancel(), [cancel])

  // 点击卡片与触发元素之外的位置时收起固定住的卡片
  useEffect(() => {
    if (!pinned) {
      return
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) {
        return
      }
      if (anchorRef.current?.contains(target) || floatingRef.current?.contains(target)) {
        return
      }
      setPinned(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [pinned, anchorRef, floatingRef])

  const toggle = () => setPinned((value) => !value)

  return (
    <>
      {renderTrigger({
        domRef: anchorRef,
        domProps: {
          onMouseEnter: () => schedule(true, ENTER_DELAY),
          onMouseLeave: () => {
            if (!pinned) {
              schedule(false, LEAVE_DELAY)
            }
          },
          ...(openOnClick
            ? {
                role: 'button',
                tabIndex: 0,
                'aria-expanded': visible,
                onClick: (event: React.MouseEvent<HTMLSpanElement>) => {
                  event.preventDefault()
                  event.stopPropagation()
                  toggle()
                },
                onKeyDown: (event: React.KeyboardEvent<HTMLSpanElement>) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.stopPropagation()
                    toggle()
                  }
                  if (event.key === 'Escape') {
                    setPinned(false)
                  }
                },
              }
            : {}),
        },
      })}
      {visible
        ? createPortal(
            <div
              ref={floatingRef}
              className={styles.card}
              style={position ?? { top: 0, left: 0, visibility: 'hidden' }}
              onMouseEnter={cancel}
              onMouseLeave={() => {
                if (!pinned) {
                  schedule(false, LEAVE_DELAY)
                }
              }}
            >
              {children}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
