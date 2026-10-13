# iOS / Android / HarmonyOS 原生应用开发

[English](native-apps.en.md) | 简体中文

MetroListo 使用 Capacitor 8.5.2 将现有 React 应用打包到 iOS 和 Android，使用 [Cloak](https://github.com/WisdomGardenInc/Cloak) 1.0.8 打包到 HarmonyOS。各端共用网页源码、城市数据和路由逻辑。以下各节说明 iOS 和 Android，HarmonyOS 见[文末](#harmonyos)。

## 工程配置

| 项目                              | 配置                                                                        |
| --------------------------------- | --------------------------------------------------------------------------- |
| 应用名称                          | 全地铁                                                                      |
| iOS Bundle Identifier             | `com.tianzeds.ml`                                                           |
| Android applicationId / namespace | `com.tianzeds.ml`                                                           |
| 配置文件                          | `capacitor.config.ts`                                                       |
| Web 产物                          | `dist/`                                                                     |
| iOS 工程                          | `ios/App/App.xcodeproj`                                                     |
| iOS 依赖管理                      | Swift Package Manager，`ios/App/CapApp-SPM/Package.swift` 由 Capacitor 维护 |
| 最低 iOS 版本                     | 15.0                                                                        |
| Android 工程                      | `android/`                                                                  |
| 最低 Android API                  | 24（Android 7.0）                                                           |
| Android compileSdk / targetSdk    | 36                                                                          |

应用加载内置 Web 资源，配置中没有开发服务器地址。iOS 使用自动内容边距，适配系统安全区域；Android 沿用 Capacitor 的系统栏处理。地图、行程记录和城市数据在离线环境下也能加载。

## 本地环境

- Node.js 22+、pnpm 12.8.1。
- iOS：macOS、Xcode 26+ 与对应的 iOS SDK。工程已包含 Capacitor 8.5 的 `SceneDelegate` 和 UIScene 配置，可供 Xcode 27 使用；无需 CocoaPods。
- Android：Android Studio 2025.2.1+、JDK 21、Android SDK Platform 36 及 Android Studio 提示安装的构建工具。可使用 Android Studio 自带的 JDK。

首次打开 Xcode 工程时需要联网解析 Swift Package Manager 依赖；首次打开 Android 工程时需要联网下载 Gradle 和 Maven 依赖。Android SDK 路径放在本机 `android/local.properties` 中，不提交到版本库。

参考：[Capacitor 环境要求](https://capacitorjs.com/docs/getting-started/environment-setup)、[Swift Package Manager](https://capacitorjs.com/docs/ios/spm)、[Capacitor 8.5 UIScene 变更](https://capacitorjs.com/docs/updating/8-5)。

## 开发流程

从仓库检出后，先安装依赖并同步 Web 产物：

```sh
pnpm install
pnpm build && pnpm sync:capacitor
```

之后按需要构建，再通过 IDE 打开工程：

```sh
pnpm build:ios
pnpm build:android
```

这两个构建命令都会重新构建 Web 应用并同步两端，不自动启动 IDE。随后在 Xcode 打开 `ios/App/App.xcodeproj`，或在 Android Studio 打开 `android/`。已有最新 Web 产物时，也可以仅同步单个平台：

```sh
pnpm exec cap sync ios
pnpm exec cap sync android
```

网页调试继续使用 `pnpm dev`。修改网页代码、Capacitor 配置或增加插件后，在原生工程重新构建前执行同步；仅修改 Swift / Java 原生代码时，直接通过对应 IDE 构建。

`ios/` 和 `android/` 是受版本控制的原生工程，不要在日常开发时重复执行 `cap add`，也不要当作 Web 构建产物删除。`cap sync` 生成的 Web 资源、桥接配置、Cordova 兼容目录，以及编译缓存和用户 IDE 设置已被忽略；新检出必须执行同步。

## 构建与签名

- iOS：在 Xcode 的 App target → Signing & Capabilities 选择自己的开发团队；按需设置签名、版本号和发布配置，然后构建或 Archive。
- Android：在 Android Studio 中构建；命令行可在 `android/` 目录运行 `./gradlew assembleDebug`。发布版本需配置自己的签名密钥并生成 AAB。

工程保留 Capacitor 模板的图标和启动图。正式发布前按项目视觉规范替换，签名证书、密钥和本机路径不提交到版本库。

## 数据与验证范围

足迹仍使用 localStorage，数据保存在当前安装应用的 WebView 内；与 Safari、Chrome 或网页开发服务器的数据相互独立。卸载应用或清除应用数据会删除本地足迹。

备份导出使用 [Filesystem](https://capacitorjs.com/docs/apis/filesystem) 将 UTF-8 JSON 写入应用缓存，再通过 [Share](https://capacitorjs.com/docs/apis/share) 打开系统分享面板，由用户选择保存位置或接收应用。取消和失败不会提示导出成功。Android 已配置缓存 FileProvider，iOS 的 `PrivacyInfo.xcprivacy` 声明 `NSPrivacyAccessedAPICategoryFileTimestamp`，使用官方建议的理由码 `C617.1`（访问应用自身文件的时间戳）；这是 Filesystem 插件所需的 Apple 隐私清单，不申请额外权限，也不启用上传。缓存文件由系统回收；完成备份需在分享面板保存到应用外。网页端仍使用浏览器下载，导入仍使用文件选择器。原生文件选择、分享保存和重新导入需要在发布前真机验证。

项目基础检查：

```sh
pnpm test
pnpm format:check
pnpm build && pnpm sync:capacitor
```

`pnpm build && pnpm sync:capacitor` 验证 TypeScript / Web 构建、资源复制及平台配置同步，不执行 Swift / Java 编译、设备安装或模拟器运行。

## HarmonyOS

HarmonyOS 工程位于 `harmony/`，由 Cloak 在 ArkWeb 中加载同一份 Web 产物，支持手机、平板和电脑。

| 项目          | 配置                                                                                    |
| ------------- | --------------------------------------------------------------------------------------- |
| 应用名称      | 全地铁（中文）/ MetroListo（其他语言）                                                  |
| bundleName    | `com.tianzeds.ml`                                                                       |
| 版本号        | `harmony/AppScope/app.json5`                                                            |
| 设备类型      | `phone`、`tablet`、`2in1`，见 `harmony/entry/src/main/module.json5`                     |
| 框架          | `@wisdomgarden/cloak` 1.0.8，由 ohpm 安装                                               |
| Cloak 配置    | `harmony/entry/src/main/resources/rawfile/config.json`                                  |
| Web 产物      | `harmony/entry/src/main/resources/rawfile/www/`，由 `pnpm sync:harmony` 从 `dist/` 复制 |
| 最低系统版本  | HarmonyOS 5.0.3（API 15）                                                               |
| 目标 SDK 版本 | HarmonyOS 6.0.0（API 20）                                                               |

### 环境与开发流程

需要包含 API 20 SDK 的 DevEco Studio 6.0.0 或更新版本；ohpm 和 hvigor 随 DevEco Studio 提供。

```sh
pnpm install
pnpm build:harmony
```

`pnpm build:harmony` 构建网页并复制到 `rawfile/www/`，不启动 IDE。随后用 DevEco Studio 打开 `harmony/`，等待 ohpm 同步完成后运行到真机或模拟器。已有最新 Web 产物时可只执行 `pnpm sync:harmony`。

`rawfile/www/`、`oh_modules/` 和构建目录已被忽略，新检出必须先执行一次同步；否则应用显示 Cloak 自带的默认页面。`harmony/oh-package-lock.json5` 受版本控制。

### 构建与签名

`harmony/build-profile.json5` 的 `signingConfigs` 为空。调试时在 DevEco Studio 的 File → Project Structure → Signing Configs 中启用自动签名，或填入自己的证书和 Profile。DevEco Studio 会把本机路径和加密口令写回该文件，这部分改动不要提交。发布需使用在 AppGallery Connect 申请的发布证书和 Profile。

也可以用 DevEco Studio 自带的命令行工具构建。未配置签名时产物为未签名 HAP，只用于验证编译：

```sh
export DEVECO=/Applications/DevEco-Studio.app/Contents
export DEVECO_SDK_HOME=$DEVECO/sdk JAVA_HOME=$DEVECO/jbr/Contents/Home
export PATH=$DEVECO/tools/ohpm/bin:$DEVECO/tools/hvigor/bin:$DEVECO/tools/node/bin:$PATH
cd harmony
ohpm install
hvigorw assembleHap --mode module -p product=default -p buildMode=debug --no-daemon
```

### 与其他平台的差异

- **窗口**：不使用沉浸式布局，状态栏和窗口底色与页面背景一致（`#F3F5F9`）；应用固定为浅色。手机和平板跟随系统的旋转设置。电脑上使用系统窗口标题栏，窗口最小为 360 × 480 vp，布局由网页的响应式断点决定。
- **返回**：WebView 有历史记录时后退；没有时交给系统，应用退到后台并保留当前地图状态。
- **备份导出**：ArkWeb 不处理网页的 blob 下载。`FileExportPlugin` 打开系统的文件保存面板（DocumentViewPicker），把 UTF-8 JSON 写入用户选择的位置，不需要申请权限。取消和写入失败不会提示导出成功。导入仍使用网页的文件选择器。
- **外部链接**：`AppControlPlugin` 交给系统浏览器打开，不在应用的 WebView 中加载。
- **权限**：只声明 `ohos.permission.INTERNET`，与 Android 一致；该权限由系统授予，没有弹窗。
- **数据**：足迹保存在 WebView 的 `http://localhost` 源下。修改 `config.json` 的 `APP_HOST` 会让已安装的应用读不到原有足迹。`EntryBackupAbility` 允许系统备份和恢复应用数据。
- **图标**：分层图标由 `assets/icon/app-icon.svg` 拆分而来，`background.png` 是场景，`foreground.png` 是扇形光束，叠加后与 iOS 图标一致；`startIcon.png` 用于启动页。

两个插件在 `harmony/entry/src/main/ets/plugins/`，网页一侧的调用在 `src/lib/harmony.ts`。Cloak 官方插件见 [CloakPlugins](https://github.com/WisdomGardenInc/CloakPlugins)；其中 Filesystem 只能读写应用沙箱，无法把备份保存到用户选择的位置。

### 验证范围

`pnpm build:harmony` 验证 Web 构建和资源复制，上面的 hvigor 命令验证 ArkTS 编译和 HAP 打包。签名、安装、文件保存面板、从备份恢复和系统浏览器跳转需要在发布前分别在手机、平板和电脑上验证。
