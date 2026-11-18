declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.css' {}

/** 图片资源经 asset module 处理，导入得到打包后的 URL */
declare module '*.png' {
  const url: string
  export default url
}

/** 原生返回键回调：返回 true 表示网页已消费（关闭浮层），false 交给系统退出 */
interface Window {
  __dsHandleBack?: () => boolean
}

/** 公开 API 的地址，见 rspack.config.ts 的 createConfig */
declare const __API_ORIGIN__: string

/** Prism 语言包通过副作用注册到全局 Prism */
declare module 'prismjs/components/*' {}

/** KaTeX 化学公式扩展通过副作用注册到 KaTeX */
declare module 'katex/contrib/mhchem' {}
