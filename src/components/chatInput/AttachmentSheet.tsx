import { useEffect, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  IconCameraOutline24,
  IconFileOutline24,
  IconImageOutline24,
} from '../base/icons.js'
import { ACCEPT } from '../../services/attachments.js'
import { supportsNativeCamera } from '../../services/native/camera.js'
import {
  loadRecentPhotos,
  readRecentPhoto,
  type RecentPhoto,
} from '../../services/native/recentMedia.js'
import styles from './AttachmentSheet.module.css'

/**
 * 附件面板：最近照片 + 拍照 / 相册 / 文件。
 * 拍照走原生相机（照片只在内存里），相册与文件交给系统选择器。
 */
export const AttachmentSheet = ({
  open,
  onClose,
  onFiles,
  onCamera,
  onCapturedFile,
}: {
  open: boolean
  onClose: () => void
  onFiles: (files: File[]) => void
  /** 原生拍照；不支持原生相机时为空，面板会退回 <input capture> */
  onCamera: (() => void) | null
  /** 拍到的照片先进圈画编辑器，不直接进附件列表 */
  onCapturedFile: (file: File) => void
}) => {
  const t = useTranslate()
  const [recent, setRecent] = useState<RecentPhoto[]>([])
  const albumRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    let cancelled = false
    void loadRecentPhotos(8).then((photos) => {
      if (!cancelled) {
        setRecent(photos)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) {
    return null
  }

  const takeFrom = (input: HTMLInputElement | null) => input?.click()

  return (
    <div className={styles.mask} onClick={onClose}>
      <div className={styles.sheet} onClick={(event) => event.stopPropagation()}>
        {recent.length > 0 ? (
          <div className={styles.recent}>
            {recent.map((photo) => (
              <button
                key={photo.uri}
                type="button"
                className={styles.thumb}
                onClick={async () => {
                  try {
                    const file = await readRecentPhoto(photo)
                    onFiles([file])
                    onClose()
                  } catch {
                    // 读取失败保持面板打开，用户可换一张
                  }
                }}
              >
                <img src={photo.url} alt={photo.name} loading="lazy" />
              </button>
            ))}
          </div>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              if (onCamera) {
                onCamera()
                onClose()
              } else {
                // 不能先关面板：input 被卸载后选中的照片就丢了
                takeFrom(cameraRef.current)
              }
            }}
          >
            <IconCameraOutline24 />
            <span>{t('attachSheetPhoto')}</span>
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={() => takeFrom(albumRef.current)}
          >
            <IconImageOutline24 />
            <span>{t('attachSheetAlbum')}</span>
          </button>
          <button
            type="button"
            className={styles.action}
            onClick={() => takeFrom(fileRef.current)}
          >
            <IconFileOutline24 />
            <span>{t('attachSheetFile')}</span>
          </button>
        </div>

        <input
          ref={albumRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            if (files.length > 0) {
              onFiles(files)
              onClose()
            }
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            if (files.length > 0) {
              onFiles(files)
              onClose()
            }
          }}
        />
        {supportsNativeCamera() ? null : (
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) {
                onCapturedFile(file)
                onClose()
              }
            }}
          />
        )}
      </div>
    </div>
  )
}
