# DS-Chat

DeepSeek 移动端客户端。界面按 DeepSeek 官方 Android App 重做，功能来自官方开源示例
[deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo)（MIT），外层用 Capacitor 封装成可安装的 APK。

## 它是什么

- **一个真的能用的 App**：安装包 `DS-Chat-1.3.0.apk`，Android 6.0+ 直接安装，不需要电脑、不需要浏览器。
- **界面**：品牌蓝 `#4D6BFE`、鲸鱼标识、"我是 DeepSeek，很高兴见到你！"首页、气泡消息、输入卡片、
  深度思考 / 智能搜索胶囊按钮、顶栏 ☰ + 居中标题 + 新建对话，与官方 App 的移动端布局对齐。
- **功能**：完整保留 chat-demo 的能力（见下），不是砍版。

## 1.3.0 变更

- **图片可继续编辑**：待发送与已发送的图片都能进查看器后点「裁剪」进入圈画 / 截取，处理结果作为**新附件**放进当前输入框（不再保存到本地下载目录）。
- **已上传图片两步交互**：第一次点击图片只显示右上角关闭键（蓝色描边提示），再点图片才进入预览；点关闭键取消这张图片。
- **文件附件**：点击后调系统「打开方式」选择器（原生 `FileOpener` 插件写缓存 + FileProvider 授权）；SVG 用站内查看器预览。PDF 因 Android WebView 不能渲染，仍交给系统应用打开。
- **内核升级到 chat-demo v0.1.4**：导入改为官方分批流水线（会话 32 条 / 图片 16 个一批）并使用官方导入进度条与 `ImportProgressCallback`，回滚自研的导入进度实现；导出保留百分比进度（上游无对应实现）。同时带上游的旧浏览器兼容封装（`utils/abort.ts`）。

## 1.2.1 变更

- 输入框里待发送的照片：点击改为站内查看器（等比缩放、可裁剪/保存），不再导航到原图；右上角关闭或系统返回键都能退出，返回键不再直接关闭 App。

## 1.2.0 变更

- **输入框**：Enter / Shift+Enter 一律换行，`Ctrl + Enter`（macOS 为 `⌘ + Enter`）或右侧发送按钮才发送，移动端不再依赖输不了的组合键。
- **正文引用角标**：点击只展开来源卡片（再点收起、点空白处关闭），不再同时打开浏览器；跳转放在卡片内部的链接上。
- **跟进上游 v0.1.2 / v0.1.3**：
  - 附件按后缀确定展示方式（栅格图 / PDF 用明确 MIME 打开，SVG 与其余文件下载），响应里的引用、搜索来源、页面链接只保留 HTTP(S) 地址；
  - 上传前把长边超过 4096px 的图片等比缩小，复用的旧 file_id 会先按本地原件检查是否超限，超限则重新上传。
- **历史导入导出**：新增百分比进度条（导出「打包 → 写入文件」两段、导入按条目推进），进行中禁用导入 / 导出 / 清空，避免并发操作互相踩数据。

## 首次使用

1. 打开 App，首次进入会弹出设置，填入 DeepSeek 开放平台的 API Key（[platform.deepseek.com](https://platform.deepseek.com/api_keys)）。
2. 校验通过后即可对话。Key 只存在本机（localStorage），不会上传到任何第三方。
3. 按需在「深度思考」「智能搜索」之间切换：前者走推理模式，后者会联网检索并在回答里给出引用来源。

## 功能清单（来自 chat-demo，全部保留）

| 模块 | 能力 |
| --- | --- |
| 会话 | 多会话、自动标题、重命名、删除、置顶、多选批量置顶/删除、按时间分组 |
| 搜索 | 侧边栏搜索历史对话内容，命中关键词高亮，点结果直接跳转会话 |
| 消息 | 流式输出、停止生成、重新生成、编辑提问、消息分支切换 |
| 推理与检索 | 深度思考（可折叠、显示用时）、智能搜索、链接阅读、来源引用与悬浮卡片 |
| 附件 | 上传 / 拖拽 / 粘贴图片与文档、文件卡片、失败重试；附件面板「拍照 / 相册 / 文件」三入口，附最近照片条 |
| 拍照 | 系统相机拍照（不写入相册）、拍完进编辑器：蓝色涂鸦圈画、旋转、裁剪后直接提问 |
| 图片 | 站内查看：双指缩放、双击放大、左右滑动切换、裁剪、保存到「下载/DS-Chat/」 |
| 系统集成 | 其他应用「分享」或「用 DS-Chat 打开」文件时，新建会话并自动挂为附件 |
| 语音 | 录音输入（移动端实时频谱）、回复朗读 |
| 渲染 | Markdown、代码高亮与一键复制、KaTeX 公式、Mermaid 图表 |
| 外观 | 浅色 / 深色 / 跟随系统、中英文切换、移动端与桌面端自适应 |
| 数据 | 历史导入导出（ZIP）、清空对话、API Key 本地保存 |

## 安装

```text
adb install -r DS-Chat-1.3.0.apk
```

或把 APK 传到手机点击安装（需允许"安装未知来源应用"）。

## 自己构建

前置：Node ≥ 22.12、JDK 17、Android SDK（platform 34 + build-tools 34.0.0）。

```bash
npm install
npm run build            # 产出 dist/
npx cap sync android     # 把 dist/ 同步进 Android 工程
cd android
./gradlew assembleRelease
```

产物在 `android/app/build/outputs/apk/release/app-release-unsigned.apk`，签名：

```bash
$ANDROID_HOME/build-tools/34.0.0/zipalign -p 4 app-release-unsigned.apk aligned.apk
$ANDROID_HOME/build-tools/34.0.0/apksigner sign \
  --ks android/keystore/release.jks \
  --out DS-Chat-1.3.0.apk aligned.apk
```

签名密钥自己生成、自己保管，**不在仓库里**：

```bash
keytool -genkeypair -v -keystore android/keystore/release.jks \
  -alias dschat -keyalg RSA -keysize 2048 -validity 10000
```

**后续升级必须用同一个密钥**，否则手机会拒绝覆盖安装，所以这个文件要另外留好。

## 目录

```text
src/                  前端源码（复用 chat-demo 结构，外观改动集中在下方文件）
  app/brand.css         品牌色、移动端触控与安全区
  components/session/Welcome.*   首页：鲸鱼 + 问候语 + 副标题
  i18n/{zh,en}.ts       文案（问候、占位、页脚合规提示）
  index.html            viewport-fit、状态栏、manifest
public/                 PWA manifest 与图标
android/               Capacitor 生成的 Android 工程
  app/src/main/res/     图标、启动图、深浅色主题与状态栏
  keystore/             发布签名（本地保留，已 gitignore）
```

## 原生桥接

WebView 壳补了五个本地插件，源码在 `android/app/src/main/java/icu/dschat/app/`：

| 插件 | 作用 | Web 侧调用点 |
| --- | --- | --- |
| `ThemeBars` | 用页面实际底色设置状态栏、导航栏颜色，并按深浅色切换图标明暗 | `src/services/native/themeBars.ts`，由 `src/app/theme.ts` 在主题变更时触发 |
| `FileSaver` | 把字节写入系统「下载/DS-Chat/」，解决 WebView 无下载管理器的问题 | `src/services/native/fileSaver.ts`，导出与图片保存共用 |
| `Camera` | `ACTION_IMAGE_CAPTURE` 拍照到应用缓存，读成 Blob 后立即删除，不进系统相册 | `src/services/native/camera.ts`，附件面板「拍照」 |
| `RecentMedia` | 用 MediaStore 取最近照片缩略图；选中时把原图复制到缓存再交给网页 | `src/services/native/recentMedia.ts` |
| `ShareTarget` | 接收 `ACTION_SEND` / `ACTION_VIEW` 传来的文件，复制到缓存等网页取走 | `src/services/native/shareTarget.ts`，由 `App.tsx` 建新会话并挂附件 |

图片编辑与预览：`src/components/media/ImageEditor.tsx` 负责蓝色涂鸦 + 裁剪（画布按屏幕坐标合成，
裁剪框所见即所得），`src/components/files/ImagePreview.tsx` 负责缩放、滑动与保存；
照片编辑结果会作为新附件加入输入框，不覆盖原图。

设置里的「思考内容自动折叠」写在 `src/services/settings.ts`，默认开启；
`ReplyArea` 在流式结束的瞬间收起思考块，历史消息进入时也按该设置收起。

返回键在 `MainActivity.onBackPressed` 里先用 `evaluateJavascript` 问网页
`window.__dsHandleBack()`：网页关掉最上层浮层（图片预览 → 设置 → 搜索 → 侧边栏）就返回 true
不退出；没有浮层返回 false，交回系统退出。回调注册在 `src/app/App.tsx`。

图片预览是站内遮罩（`src/components/files/ImagePreview.tsx`），按可用区域等比缩放，
不再用 `<a target="_blank">` 打开原图——WebView 会按原图像素铺开并按返回直接退出。

两者都通过 `registerPlugin` 在 `MainActivity.onCreate` 里注册；浏览器里 `Capacitor.isNativePlatform()` 为假，
自动退回原生 Web 行为（状态栏交给系统、导出走 `a[download]`）。

## 与官方 App 的差异

- 登录体系没有接入：官方 App 用手机号/微信登录，这里用 API Key，因此没有云同步、分享链接、充值等功能。
- 语音、搜索、文件解析依赖服务端能力，接口由 `https://api.deepseek.com` 提供，与 chat-demo 一致。
- 品牌标识与配色沿用 DeepSeek，仅作个人学习用途，不代表官方发行版本。

## 许可

前端代码来自 chat-demo（MIT），`dist/LICENSE` 随产物分发。第三方依赖遵循各自许可。
