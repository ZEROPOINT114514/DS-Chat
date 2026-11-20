import clsx from 'clsx'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  IconCloseFill14,
  IconCloseOutline16,
  IconPanelLeftOutline16,
  IconPinOutline16,
  IconSearchOutline16,
  IconSettingsOutline16,
  IconTrashOutline16,
  NewChatIcon,
} from '../base/icons.js'
import { setSiderCollapsed } from '../../services/settings.js'
import { groupSessions } from '../../services/chat/sessionGroups.js'
import { searchSessions, type SearchHit } from '../../services/chat/search.js'
import {
  newChat,
  pinSessions,
  removeSession,
  selectSession,
  useChatStore,
} from '../../services/chat/store.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { closeMobileSider, useMobileSider } from './mobileSiderState.js'
import { SessionItem } from './SessionItem.js'
import styles from './Sider.module.css'

const pad = (value: number) => String(value).padStart(2, '0')

const hitTime = (time: number) => {
  const date = new Date(time)
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`
}

/** 把命中的关键词包成 <mark>，大小写不敏感 */
const highlight = (text: string, query: string): ReactNode => {
  const keyword = query.trim()
  if (!keyword) {
    return text
  }
  const lower = text.toLowerCase()
  const target = keyword.toLowerCase()
  const parts: ReactNode[] = []
  let cursor = 0
  let at = lower.indexOf(target)
  while (at >= 0) {
    parts.push(text.slice(cursor, at))
    parts.push(<mark key={`${at}-${parts.length}`}>{text.slice(at, at + keyword.length)}</mark>)
    cursor = at + keyword.length
    at = lower.indexOf(target, cursor)
  }
  parts.push(text.slice(cursor))
  return parts
}

/** 展开的侧边栏：搜索、置顶、按时间分组的会话列表、多选、底部设置；移动端放在抽屉里 */
export const Sider = ({ mobile = false }: { mobile?: boolean }) => {
  const t = useTranslate()
  const sessions = useChatStore((state) => state.sessions)
  const activeId = useChatStore((state) => state.activeId)
  const [now, setNow] = useState(Date.now)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [deleting, setDeleting] = useState<SessionSummary | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [batchPending, setBatchPending] = useState(false)

  const pinned = useMemo(
    () => sessions.filter((session) => session.pinnedAt),
    [sessions]
  )
  const groups = useMemo(
    () => groupSessions(sessions.filter((session) => !session.pinnedAt), now, t),
    [sessions, now, t]
  )

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const time = Date.now()
      setNow(time)
      const midnight = new Date(time).setHours(24, 0, 0, 0)
      timer = setTimeout(refresh, midnight - time)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  // 关键词搜索：输入停顿后查一次，清空则回到会话列表
  useEffect(() => {
    const keyword = query.trim()
    if (!keyword) {
      setResults(null)
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(() => {
      void searchSessions(keyword)
        .then((hits) => {
          if (!cancelled) {
            setResults(hits)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setResults([])
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearching(false)
          }
        })
    }, 240)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const exitSelect = () => {
    setSelectMode(false)
    setSelected([])
  }

  const toggleSelect = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
  }

  const closeDrawer = () => {
    if (mobile) {
      closeMobileSider()
    }
  }

  const openHit = (hit: SearchHit) => {
    selectSession(hit.sessionId)
    setQuery('')
    closeDrawer()
  }

  const deleteSelected = async () => {
    setBatchPending(true)
    try {
      const ids = [...selected]
      let failed = 0
      for (const id of ids) {
        if (!(await removeSession(id))) {
          failed += 1
        }
      }
      if (failed > 0) {
        showToast({ key: 'sessionDeleteFailed', type: 'error' })
      } else {
        exitSelect()
      }
    } finally {
      setBatchPending(false)
    }
  }

  return (
    <div className={clsx(styles.sider, mobile && styles.mobile, selectMode && styles.selecting)}>
      <div className={styles.top}>
        {selectMode ? (
          <>
            <div className={styles.selectTitle}>{t('siderSelectedCount', { count: selected.length })}</div>
            <IconButton
              size="m"
              icon={<IconCloseOutline16 />}
              tooltip={t('siderExitMultiSelect')}
              tooltipPlacement="bottom"
              onClick={exitSelect}
            />
          </>
        ) : (
          <>
            <div className={styles.appName}>{t('appName')}</div>
            <IconButton
              size="m"
              icon={<IconPanelLeftOutline16 />}
              tooltip={t('collapseSiderbarButton')}
              tooltipPlacement="bottom"
              onClick={() => (mobile ? closeMobileSider() : setSiderCollapsed(true))}
            />
          </>
        )}
      </div>

      {selectMode ? null : (
        <label className={styles.search}>
          <span className={styles.searchIcon}>
            <IconSearchOutline16 />
          </span>
          <input
            className={styles.searchInput}
            value={query}
            placeholder={t('siderSearchPlaceholder')}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button
              type="button"
              className={styles.searchClear}
              aria-label={t('close')}
              onClick={() => setQuery('')}
            >
              <IconCloseFill14 />
            </button>
          ) : null}
        </label>
      )}

      {results !== null ? (
        <div className={styles.resultsWrap}>
          <div className={styles.resultsHeader}>
            {searching
              ? t('sessionLoading')
              : results.length === 0
                ? t('siderSearchEmpty')
                : t('siderSearchResultCount', { count: results.length })}
          </div>
          <div className={styles.results}>
            {results.map((hit) => (
              <button
                type="button"
                key={hit.key}
                className={styles.result}
                onClick={() => openHit(hit)}
              >
                <div className={styles.resultTop}>
                  <span className={styles.resultTitle}>{hit.title || t('untitledChat')}</span>
                  <span className={styles.resultTime}>{hitTime(hit.createdAt)}</span>
                </div>
                <div className={styles.resultSnippet}>{highlight(hit.snippet, query)}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {selectMode ? null : (
            <button
              type="button"
              className={styles.newChat}
              onClick={() => {
                newChat()
                closeMobileSider()
              }}
            >
              <span className={styles.newChatIcon}>
                <NewChatIcon />
              </span>
              {t('newChat')}
            </button>
          )}
          <div className={styles.listWrap}>
            <div className={styles.list}>
              {pinned.length > 0 ? (
                <div className={styles.section}>
                  <div className={clsx(styles.sectionHeader, styles.pinnedHeader)}>
                    {t('siderPinnedSection')}
                  </div>
                  {pinned.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      active={session.id === activeId}
                      pinned
                      selectMode={selectMode}
                      selected={selected.includes(session.id)}
                      onDelete={() => setDeleting(session)}
                      onTogglePin={() => pinSessions([session.id], false)}
                      onEnterSelect={() => {
                        setSelectMode(true)
                        setSelected([session.id])
                      }}
                      onToggleSelect={() => toggleSelect(session.id)}
                    />
                  ))}
                </div>
              ) : null}
              {groups.map((group) => (
                <div key={group.key} className={styles.section}>
                  <div className={styles.sectionHeader}>{group.label}</div>
                  {group.sessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      active={session.id === activeId}
                      pinned={false}
                      selectMode={selectMode}
                      selected={selected.includes(session.id)}
                      onDelete={() => setDeleting(session)}
                      onTogglePin={() => pinSessions([session.id], true)}
                      onEnterSelect={() => {
                        setSelectMode(true)
                        setSelected([session.id])
                      }}
                      onToggleSelect={() => toggleSelect(session.id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {selectMode ? (
        <div className={styles.batchBar}>
          <button
            type="button"
            className={styles.batchAction}
            disabled={selected.length === 0 || batchPending}
            onClick={() => {
              pinSessions(selected, true)
              exitSelect()
            }}
          >
            <IconPinOutline16 />
            {t('siderPinSelected')}
          </button>
          <span className={styles.batchDivider} />
          <button
            type="button"
            className={clsx(styles.batchAction, styles.batchDanger)}
            disabled={selected.length === 0 || batchPending}
            onClick={() => void deleteSelected()}
          >
            <IconTrashOutline16 />
            {t('siderDeleteSelected')}
          </button>
        </div>
      ) : (
        <div className={styles.bottom}>
          <button type="button" className={styles.settings} onClick={() => openSettings('general')}>
            <span className={styles.settingsIcon}>
              <IconSettingsOutline16 />
            </span>
            <span className={styles.settingsLabel}>{t('settings')}</span>
          </button>
        </div>
      )}

      {deleting ? (
        <Modal
          title={t('deleteSessionModalContentTitle')}
          onClose={() => {
            if (!deletePending) {
              setDeleting(null)
            }
          }}
          footer={
            <>
              <Button variant="outlined" disabled={deletePending} onClick={() => setDeleting(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={deletePending}
                onClick={async () => {
                  setDeletePending(true)
                  try {
                    if (await removeSession(deleting.id)) {
                      setDeleting(null)
                      setSelected((current) => current.filter((id) => id !== deleting.id))
                    } else {
                      showToast({ key: 'sessionDeleteFailed', type: 'error' })
                    }
                  } finally {
                    setDeletePending(false)
                  }
                }}
              >
                {t('delete')}
              </Button>
            </>
          }
        >
          {t('deleteSessionWithFilesDescription')}
        </Modal>
      ) : null}
    </div>
  )
}

/** 移动端抽屉包装：开合状态由 mobileSiderState 管理 */
export const MobileSider = () => {
  const open = useMobileSider((state) => state.open)
  if (!open) {
    return null
  }
  return (
    <>
      <div className={styles.drawerMask} onClick={closeMobileSider} />
      <div className={styles.drawer}>
        <Sider mobile />
      </div>
    </>
  )
}
