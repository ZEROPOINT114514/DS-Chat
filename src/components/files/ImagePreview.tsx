import { useEffect } from 'react'
import { IconCloseOutline16 } from '../base/icons.js'
import { useTranslate } from '../../i18n/index.js'
import { closeImagePreview, useImagePreview } from '../../services/imagePreview.js'
import styles from './ImagePreview.module.css'

/**
 * 图片预览遮罩：图片按可用区域等比缩放，不再新开页面加载原图。
 * 点遮罩、右上角关闭按钮、Esc 或系统返回键都能关闭（返回键由 App 的返回处理接管）。
 */
export const ImagePreview = () => {
  const t = useTranslate()
  const { url, name } = useImagePreview()

  useEffect(() => {
    if (!url) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeImagePreview()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [url])

  if (!url) {
    return null
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={closeImagePreview}
    >
      <button
        type="button"
        className={styles.close}
        aria-label={t('close')}
        onClick={closeImagePreview}
      >
        <IconCloseOutline16 />
      </button>
      <img
        className={styles.image}
        src={url}
        alt={name}
        draggable={false}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  )
}
