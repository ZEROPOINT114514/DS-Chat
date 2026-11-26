import clsx from 'clsx'
import { useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { getOpenMimeType, useUploads } from '../../services/attachments.js'
import { loadFile } from '../../services/chat/db.js'
import { openImagePreview } from '../../services/imagePreview.js'
import { openFileWithSystem } from '../../services/native/fileOpener.js'
import type { FileAttachment } from '../../services/chat/types.js'
import { showToast } from '../base/toastState.js'
import { IconPhotoErrorFill20, IconRefreshOutline16 } from '../base/icons.js'
import { Tooltip } from '../base/Tooltip.js'
import { FileCard } from '../files/FileCard.js'
import { useFileView } from '../files/useFileView.js'
import styles from './MessageFile.module.css'

/** 历史或失效附件的补传状态：只在还没有 serverId 时显示 */
const useUploadState = (file: FileAttachment) =>
  useUploads((state) => {
    if (file.serverId) {
      return null
    }
    const task = state.tasks[file.id]
    return task?.status === 'uploading' || task?.status === 'error' ? task : null
  })

/**
 * 消息里的附件：
 * - 图片：纯图片显示 120×120 缩略图，与文件混排时为 64×64；点击直接进站内查看器，
 *   上传中显示 loading 蒙层，上传失败显示品牌色描边 + 中心重试图标（可重试）或 photo-error 图标（不可重试）。
 * - 文件：显示文件卡片，点击交给系统的「打开方式」选择器。
 */
export const MessageFile = ({
  file,
  onRetry,
}: {
  file: FileAttachment
  /** 本条消息补传失败且可重试时提供 */
  onRetry: (() => void) | null
}) => {
  const t = useTranslate()
  const view = useFileView(file.id, file.name)
  const url = view.url
  // 栅格图与 SVG 都进站内预览（SVG 用 <img> 渲染，不执行脚本）；TIFF / HEIC 交给系统应用
  const previewable = view.renderable

  /** 非图片附件：把原件交给系统的「打开方式」选择器 */
  const openWithSystem = async () => {
    try {
      const blob = await loadFile(file.id)
      if (!blob) {
        return
      }
      await openFileWithSystem(blob, file.name, getOpenMimeType(file.name, file.mimeType))
    } catch (error) {
      showToast({
        key: 'fileOpenFailed',
        params: { message: error instanceof Error ? error.message : String(error) },
        type: 'error',
      })
    }
  }
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const upload = useUploadState(file)
  const uploading = upload?.status === 'uploading'
  const failed = upload?.status === 'error'
  const retryable = failed && upload.retryable
  const errorText = failed ? t(upload.error.key, upload.error.params) : undefined

  const retry = retryable ? onRetry : null

  if (previewable && url !== null) {
    const preview = url ? (
      failedUrl === url ? (
        <span className={styles.failedIcon} role="img" aria-label={file.name}>
          <IconPhotoErrorFill20 />
        </span>
      ) : (
        <img src={url} alt={file.name} onError={() => setFailedUrl(url)} />
      )
    ) : null

    // 上传中：本地原件已在 IndexedDB，先垫在蒙层下显示，避免只有一块灰色占位
    if (uploading) {
      return (
        <div className={clsx(styles.image, styles.imageThumb)} title={file.name}>
          {preview}
          <div className={styles.overlay}>
            <span className={styles.spinner} />
          </div>
        </div>
      )
    }

    // 「上传失败」只显示状态，其余原因写在图片底部的渐变上
    const reason =
      errorText && errorText !== t('uploadFileStatusFailed') ? (
        <span className={styles.reason}>{errorText}</span>
      ) : null

    // 上传失败不可重试：保留缩略图，底部渐变显示原因
    if (failed && !retry) {
      return (
        <div
          className={clsx(styles.image, styles.imageThumb)}
          title={errorText}
          aria-label={errorText}
        >
          {preview ?? (
            <span className={styles.failedIcon}>
              <IconPhotoErrorFill20 />
            </span>
          )}
          {reason}
        </div>
      )
    }

    // 上传失败可重试：缩略图 + 红色描边 + 蒙层重试图标，原因在底部
    if (failed && retry) {
      const retryLabel = t('uploadRetry', { message: errorText ?? t('uploadFileStatusFailed') })
      return (
        <Tooltip content={retryLabel}>
          <button
            type="button"
            className={clsx(styles.image, styles.imageThumb, styles.retryImage)}
            aria-label={retryLabel}
            onClick={retry}
          >
            {preview}
            <div className={clsx(styles.overlay, styles.retryOverlay)}>
              <IconRefreshOutline16 />
            </div>
            {reason}
          </button>
        </Tooltip>
      )
    }

    // 正常态（已发送）：点击直接进站内查看器
    return url ? (
      <button
        type="button"
        className={clsx(styles.image, styles.imageThumb)}
        title={file.name}
        aria-label={file.name}
        onClick={() => void openImagePreview(file.id)}
      >
        {preview}
      </button>
    ) : (
      // 原件还没加载出来（极短暂）
      <div className={styles.image} />
    )
  }

  return (
    <FileCard
      name={file.name}
      size={file.size}
      status={uploading ? 'uploading' : failed ? 'error' : 'done'}
      error={errorText}
      onRetry={retry ?? undefined}
      onOpen={url && !upload ? () => void openWithSystem() : undefined}
    />
  )
}
