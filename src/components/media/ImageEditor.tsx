import clsx from 'clsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  IconCloseOutline16,
  IconCropOutline20,
  IconRotateOutline20,
  IconUndoOutline20,
} from '../base/icons.js'
import styles from './ImageEditor.module.css'

type Point = { x: number; y: number }
/** 线条坐标按原图归一化（0~1），旋转后依然贴着原位置 */
type Stroke = { points: Point[]; width: number }
type Rect = { x: number; y: number; w: number; h: number }

/**
 * 拍照 / 图片的圈画与裁剪编辑器：
 * 黑底全屏、蓝色画笔圈选重点，裁剪框按屏幕坐标截取所见区域，完成后导出 JPEG。
 */
export const ImageEditor = ({
  blob,
  name,
  mode = 'draw',
  doneLabel,
  onCancel,
  onDone,
}: {
  blob: Blob
  name: string
  /** crop：打开就进入裁剪框选；draw：默认画笔 */
  mode?: 'draw' | 'crop'
  doneLabel?: string
  onCancel: () => void
  onDone: (file: File) => void
}) => {
  const t = useTranslate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [ready, setReady] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [cropMode, setCropMode] = useState(mode === 'crop')
  const [crop, setCrop] = useState<Rect | null>(null)
  const dragRef = useRef<{ kind: 'draw' | 'crop'; start: Point } | null>(null)
  const currentRef = useRef<Point[] | null>(null)

  // 加载图片：从 Blob 生成 object URL，卸载时释放
  useEffect(() => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      imageRef.current = image
      setReady(true)
    }
    image.src = url
    return () => {
      URL.revokeObjectURL(url)
      imageRef.current = null
    }
  }, [blob])

  const layout = useCallback(() => {
    const stage = stageRef.current
    const image = imageRef.current
    if (!stage || !image) {
      return null
    }
    const rotated = rotation % 180 !== 0
    const imageWidth = rotated ? image.naturalHeight : image.naturalWidth
    const imageHeight = rotated ? image.naturalWidth : image.naturalHeight
    const width = stage.clientWidth
    const height = stage.clientHeight
    const scale = Math.min((width - 24) / imageWidth, (height - 24) / imageHeight)
    return { width, height, scale, cx: width / 2, cy: height / 2, image }
  }, [rotation])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const frame = layout()
    if (!canvas || !frame) {
      return
    }
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(frame.width * dpr)
    canvas.height = Math.round(frame.height * dpr)
    canvas.style.width = `${frame.width}px`
    canvas.style.height = `${frame.height}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, frame.width, frame.height)

    ctx.save()
    ctx.translate(frame.cx, frame.cy)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(frame.scale, frame.scale)
    ctx.drawImage(frame.image, -frame.image.naturalWidth / 2, -frame.image.naturalHeight / 2)
    ctx.restore()

    const { image } = frame
    const strokeScale = frame.scale
    ctx.save()
    ctx.translate(frame.cx, frame.cy)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(strokeScale, strokeScale)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#4d6bfe'
    const all = currentRef.current
      ? [...strokes, { points: currentRef.current, width: 6 }]
      : strokes
    for (const stroke of all) {
      if (stroke.points.length === 0) {
        continue
      }
      ctx.lineWidth = stroke.width / strokeScale
      ctx.beginPath()
      stroke.points.forEach((point, index) => {
        const x = (point.x - 0.5) * image.naturalWidth
        const y = (point.y - 0.5) * image.naturalHeight
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.stroke()
    }
    ctx.restore()
  }, [layout, rotation, strokes])

  useEffect(() => {
    if (ready) {
      draw()
    }
  }, [ready, draw])

  useEffect(() => {
    const onResize = () => draw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [draw])

  /** 屏幕坐标 → 原图归一化坐标（逆变换：平移 → 反旋转 → 反缩放） */
  const toImagePoint = (clientX: number, clientY: number): Point | null => {
    const stage = stageRef.current
    const frame = layout()
    if (!stage || !frame) {
      return null
    }
    const rect = stage.getBoundingClientRect()
    const dx = clientX - rect.left - frame.cx
    const dy = clientY - rect.top - frame.cy
    const rad = (-rotation * Math.PI) / 180
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad)
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad)
    const x = rx / frame.scale / frame.image.naturalWidth + 0.5
    const y = ry / frame.scale / frame.image.naturalHeight + 0.5
    return { x, y }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const stage = stageRef.current
    if (!stage) {
      return
    }
    // 捕获在画布上，后续 move/up 才会回到同一个元素
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = stage.getBoundingClientRect()
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    if (cropMode) {
      dragRef.current = { kind: 'crop', start: point }
      setCrop({ x: point.x, y: point.y, w: 0, h: 0 })
      return
    }
    dragRef.current = { kind: 'draw', start: point }
    const mapped = toImagePoint(event.clientX, event.clientY)
    currentRef.current = mapped ? [mapped] : []
    draw()
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    const stage = stageRef.current
    if (!drag || !stage) {
      return
    }
    const rect = stage.getBoundingClientRect()
    if (drag.kind === 'crop') {
      const x = Math.min(drag.start.x, event.clientX - rect.left)
      const y = Math.min(drag.start.y, event.clientY - rect.top)
      const w = Math.abs(event.clientX - rect.left - drag.start.x)
      const h = Math.abs(event.clientY - rect.top - drag.start.y)
      setCrop({
        x: Math.max(0, x),
        y: Math.max(0, y),
        w: Math.min(w, rect.width - Math.max(0, x)),
        h: Math.min(h, rect.height - Math.max(0, y)),
      })
      return
    }
    const mapped = toImagePoint(event.clientX, event.clientY)
    if (mapped && currentRef.current) {
      currentRef.current.push(mapped)
      draw()
    }
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = null
    if (drag?.kind === 'draw') {
      const points = currentRef.current
      currentRef.current = null
      if (points && points.length > 1) {
        setStrokes((current) => [...current, { points, width: 6 }])
      } else {
        draw()
      }
    }
  }

  const finish = async () => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const dpr = window.devicePixelRatio || 1
    const region =
      crop && crop.w > 8 && crop.h > 8
        ? { x: crop.x * dpr, y: crop.y * dpr, w: crop.w * dpr, h: crop.h * dpr }
        : { x: 0, y: 0, w: canvas.width, h: canvas.height }
    const output = document.createElement('canvas')
    output.width = Math.max(1, Math.round(region.w))
    output.height = Math.max(1, Math.round(region.h))
    const ctx = output.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, output.width, output.height)
    ctx.drawImage(canvas, region.x, region.y, region.w, region.h, 0, 0, output.width, output.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      output.toBlob(resolve, 'image/jpeg', 0.92)
    )
    if (!blob) {
      return
    }
    const base = name.replace(/\.[^./\\]+$/, '') || 'image'
    onDone(new File([blob], `${base}-edit.jpg`, { type: 'image/jpeg' }))
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t('imageEditorTitle')}>
      <div className={styles.header}>
        <button type="button" className={styles.headerButton} aria-label={t('cancel')} onClick={onCancel}>
          <IconCloseOutline16 />
        </button>
        <div className={styles.title}>{t('imageEditorTitle')}</div>
        <button
          type="button"
          className={clsx(styles.headerButton, cropMode && styles.headerButtonActive)}
          aria-label={t('imageEditorCrop')}
          aria-pressed={cropMode}
          onClick={() => {
            setCropMode((value) => !value)
            setCrop(null)
          }}
        >
          <IconCropOutline20 />
        </button>
      </div>

      <div ref={stageRef} className={styles.stage}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {crop ? (
          <div
            className={styles.cropRect}
            style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
          >
            <span className={styles.corner} data-corner="tl" />
            <span className={styles.corner} data-corner="tr" />
            <span className={styles.corner} data-corner="bl" />
            <span className={styles.corner} data-corner="br" />
          </div>
        ) : null}
        {cropMode && !crop ? <div className={styles.hint}>{t('imageEditorCropHint')}</div> : null}
      </div>

      <div className={styles.bottom}>
        <button
          type="button"
          className={styles.tool}
          disabled={strokes.length === 0}
          onClick={() => setStrokes((current) => current.slice(0, -1))}
        >
          <IconUndoOutline20 />
          {t('imageEditorUndo')}
        </button>
        <button
          type="button"
          className={styles.tool}
          onClick={() => setRotation((value) => (value + 90) % 360)}
        >
          <IconRotateOutline20 />
          {t('imageEditorRotate')}
        </button>
        <button
          type="button"
          className={styles.tool}
          onClick={() => {
            setRotation(0)
            setStrokes([])
            setCrop(null)
            setCropMode(false)
          }}
        >
          {t('imageEditorReset')}
        </button>
        <button
          type="button"
          className={styles.done}
          disabled={!ready}
          onClick={() => void finish()}
        >
          {doneLabel ?? t('imageEditorDone')}
        </button>
      </div>
    </div>
  )
}
