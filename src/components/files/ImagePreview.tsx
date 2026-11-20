import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  IconCloseOutline16,
  IconCropOutline20,
  IconDownloadOutline16,
} from '../base/icons.js'
import { showToast } from '../base/toastState.js'
import {
  closeImagePreview,
  currentPreview,
  setPreviewIndex,
  useImagePreview,
} from '../../services/imagePreview.js'
import { saveFileNatively } from '../../services/native/fileSaver.js'
import { ImageEditor } from '../media/ImageEditor.js'
import styles from './ImagePreview.module.css'

const MAX_SCALE = 4
const SWIPE_DISTANCE = 64

const extensionOf = (name: string, type: string) => {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext && /^(png|jpe?g|webp|gif|bmp|heic)$/.test(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext
  }
  if (type.includes('png')) {
    return 'png'
  }
  if (type.includes('webp')) {
    return 'webp'
  }
  return 'jpg'
}

/** 保存到系统下载目录；浏览器环境退回 a[download] */
const saveBlob = async (blob: Blob, name: string) => {
  const path = await saveFileNatively(name, blob, blob.type || 'image/jpeg')
  if (path) {
    showToast({ key: 'imagePreviewSaved', params: { path } })
    return
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * 图片查看器：左右滑动切换、双指放大、裁剪与保存。
 * 编辑裁剪复用 ImageEditor 的裁剪框，结果直接落到系统下载目录。
 */
export const ImagePreview = () => {
  const t = useTranslate()
  const { items, index } = useImagePreview()
  const image = currentPreview({ items, index })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [editing, setEditing] = useState<Blob | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null)
  const startRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 })

  // 切换图片时恢复默认缩放
  useEffect(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [index])

  useEffect(() => {
    if (!image) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeImagePreview()
      } else if (event.key === 'ArrowLeft') {
        setPreviewIndex(index - 1)
      } else if (event.key === 'ArrowRight') {
        setPreviewIndex(index + 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [image, index])

  if (!image) {
    return null
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    setDragging(true)
    if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()]
      const distance = Math.hypot(first.x - second.x, first.y - second.y)
      pinchRef.current = { distance, scale }
    } else if (pointers.current.size === 1) {
      startRef.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y }
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) {
      return
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.current.size >= 2 && pinchRef.current) {
      const [first, second] = [...pointers.current.values()]
      const distance = Math.hypot(first.x - second.x, first.y - second.y)
      const next = Math.min(
        MAX_SCALE,
        Math.max(1, (pinchRef.current.scale * distance) / (pinchRef.current.distance || 1))
      )
      setScale(next)
      if (next <= 1.02) {
        setOffset({ x: 0, y: 0 })
      }
      return
    }

    const dx = event.clientX - startRef.current.x
    const dy = event.clientY - startRef.current.y
    if (scale > 1.02) {
      setOffset({ x: startRef.current.offsetX + dx, y: startRef.current.offsetY + dy })
    } else {
      setOffset({ x: dx, y: 0 })
    }
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) {
      pinchRef.current = null
    }
    if (pointers.current.size > 0) {
      return
    }
    setDragging(false)

    const dx = offset.x
    if (scale <= 1.02) {
      if (dx <= -SWIPE_DISTANCE && index < items.length - 1) {
        setPreviewIndex(index + 1)
      } else if (dx >= SWIPE_DISTANCE && index > 0) {
        setPreviewIndex(index - 1)
      }
      setOffset({ x: 0, y: 0 })
      return
    }
    // 放大状态：拖动是平移，不切图
    if (scale > 1.02 && Math.abs(dx) < 2) {
      setOffset({ x: 0, y: 0 })
    }
  }

  // 双击在 1x 与 2.5x 之间切换
  const onDoubleClick = () => {
    setScale((value) => (value > 1.02 ? 1 : 2.5))
    setOffset({ x: 0, y: 0 })
  }

  const saveCurrent = async () => {
    try {
      const response = await fetch(image.url)
      const blob = await response.blob()
      const name = `ds-chat-${Date.now()}.${extensionOf(image.name, blob.type)}`
      await saveBlob(blob, name)
    } catch (error) {
      showToast({
        key: 'imagePreviewSaveFailed',
        params: { message: error instanceof Error ? error.message : String(error) },
        type: 'error',
      })
    }
  }

  const cropCurrent = async () => {
    try {
      const response = await fetch(image.url)
      setEditing(await response.blob())
    } catch (error) {
      showToast({
        key: 'imagePreviewSaveFailed',
        params: { message: error instanceof Error ? error.message : String(error) },
        type: 'error',
      })
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={image.name}>
      <div className={styles.topBar}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('close')}
          onClick={closeImagePreview}
        >
          <IconCloseOutline16 />
        </button>
        <div className={styles.counter}>
          {items.length > 1
            ? t('imagePreviewCounter', { index: index + 1, total: items.length })
            : ''}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t('imagePreviewCrop')}
            onClick={() => void cropCurrent()}
          >
            <IconCropOutline20 />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t('imagePreviewSave')}
            onClick={() => void saveCurrent()}
          >
            <IconDownloadOutline16 />
          </button>
        </div>
      </div>

      <div
        className={clsx(styles.stage, dragging && styles.stageDragging)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <img
          className={styles.image}
          src={image.url}
          alt={image.name}
          draggable={false}
          style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
          }}
        />
      </div>

      {items.length > 1 ? (
        <div className={styles.dots}>
          {items.map((item, dotIndex) => (
            <span
              key={item.id}
              className={clsx(styles.dot, dotIndex === index && styles.dotActive)}
            />
          ))}
        </div>
      ) : null}

      {editing ? (
        <ImageEditor
          blob={editing}
          name={image.name}
          mode="crop"
          doneLabel={t('imagePreviewSave')}
          onCancel={() => setEditing(null)}
          onDone={(file) => {
            setEditing(null)
            void saveBlob(file, file.name)
          }}
        />
      ) : null}
    </div>
  )
}
