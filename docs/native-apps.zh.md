# iOS / Android 原生应用开发

[English](native-apps.en.md) | 简体中文

MetroListo 使用 Capacitor 8.5.2 将现有 React 应用打包到 iOS 和 Android。两端共用网页源码、城市数据和路由逻辑。

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
