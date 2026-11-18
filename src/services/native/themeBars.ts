import { Capacitor, registerPlugin } from '@capacitor/core'

type ThemeBarsPlugin = {
  /** 原生端设置状态栏与导航栏颜色，并用 dark 决定图标明暗 */
  apply(options: { color: string; dark: boolean }): Promise<void>
}

const ThemeBars = registerPlugin<ThemeBarsPlugin>('ThemeBars')

/** Android 端只接受 #RRGGBB，把计算样式里的 rgb()/rgba() 转成十六进制 */
export const toHexColor = (value: string): string => {
  const match = value.match(/rgba?\(([^)]+)\)/i)
  if (!match) {
    return value.startsWith('#') ? value : '#FFFFFF'
  }
  const channels = match[1].split(',').map((part) => Math.round(Number.parseFloat(part)))
  if (channels.length < 3 || channels.some((channel) => Number.isNaN(channel))) {
    return '#FFFFFF'
  }
  return `#${channels
    .slice(0, 3)
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

/** 把当前页面底色推到原生状态栏与导航栏；非原生环境直接跳过 */
export const syncSystemBars = (dark: boolean): void => {
  if (!Capacitor.isNativePlatform()) {
    return
  }
  const color = toHexColor(getComputedStyle(document.body).backgroundColor)
  void ThemeBars.apply({ color, dark }).catch(() => {
    // 老版本壳不支持该插件时保持系统默认配色，不影响页面主题
  })
}
