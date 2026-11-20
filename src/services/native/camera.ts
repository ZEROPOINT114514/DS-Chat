import { Capacitor, registerPlugin } from '@capacitor/core'

type CameraPlugin = {
  /** 调系统相机拍照，返回应用缓存目录里的临时文件 */
  capture(): Promise<{ path: string; name: string }>
  /** 读取完成后删除临时文件 */
  release(options: { path: string }): Promise<void>
}

const Camera = registerPlugin<CameraPlugin>('Camera')

export const supportsNativeCamera = () => Capacitor.isNativePlatform()

/** 把原生沙盒里的文件读成 Web File，交给附件面板使用 */
export const readNativeFile = async (
  path: string,
  name: string,
  mime?: string
): Promise<File> => {
  const response = await fetch(Capacitor.convertFileSrc(path))
  const blob = await response.blob()
  return new File([blob], name, { type: mime || blob.type || 'application/octet-stream' })
}

/**
 * 拍照：照片只写进应用缓存目录，读成 Blob 后立刻删除，
 * 因此相册里不会多出照片，完全符合“不保存至本地”。
 */
export const capturePhoto = async (): Promise<{ blob: Blob; name: string } | null> => {
  if (!Capacitor.isNativePlatform()) {
    return null
  }
  const { path, name } = await Camera.capture()
  try {
    const response = await fetch(Capacitor.convertFileSrc(path))
    const blob = await response.blob()
    return { blob, name }
  } finally {
    void Camera.release({ path }).catch(() => {})
  }
}
