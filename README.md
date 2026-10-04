# MetroListo · 全地铁

用日常通勤，收集一座城市。基于 **pnpm + React 18 + TypeScript + Vite + TDesign Mobile React** 的响应式网页应用，通过 **Capacitor** 支持 iOS 和 Android，产品灵感来自 [线格](https://apps.apple.com/cn/app/id6770010912)。

## 本地运行

建议使用 Node.js 22 或更新版本；项目锁定 pnpm 12.8.1。

```sh
pnpm install
pnpm dev
```

打开终端显示的本地地址，默认是 http://localhost:5173。

```sh
pnpm test          # 路由、数据完整性、状态累计和备份校验
pnpm build         # 城市数据格式、TypeScript 检查与生产构建
pnpm preview       # 预览 dist 产物
pnpm format:check  # 格式检查
pnpm format:city   # 城市 JSON 专用格式：一条记录一行
```

`dist/` 可部署到任意静态站点服务。无需 API Key、数据库或后端。字体随应用打包，浏览器运行时不依赖外部地图接口或字体服务。

## iOS / Android

已初始化 Capacitor 8.5.2，应用名称为 **全地铁**，两端标识均为 **`com.tianzeds.ml`**。

```sh
pnpm install
pnpm build              # 构建网页
pnpm sync:capacitor     # 将已构建的网页和插件同步到 iOS 和 Android
pnpm build:ios          # 构建网页并同步两端，随后用 Xcode 打开 ios/App/App.xcodeproj
pnpm build:android      # 构建网页并同步两端，随后用 Android Studio 打开 android/
```

iOS 使用 Swift Package Manager。环境要求、单平台同步、原生构建和签名说明见 [原生应用开发](docs/native-apps.md)。

## 已实现

- 简体中文与英国英语（`en-GB`）界面，自动匹配浏览器语言，并可在数据管理中切换和保存。
- 北京、上海带“官方维护”标识并提供官方英文站名；深圳、广州由 [Hashmapw](https://github.com/Hashmapw) 贡献。扩展城市支持具名用户贡献，站点可只提供当地语言或英文名称。
- 城市名必填中文和英文，可补充当地语言名称（如首尔 / Seoul / 서울）；站点允许只提供英文、中文或当地语言名称。

- 上海 **22 条线路、425 个独立站点、520 个区间**，包括机场联络线、磁浮线、金山铁路（含莘庄站）。
- 北京 **28 条线路、422 个独立站点、514 个区间**，包括亦庄 T1 有轨电车、西郊线、首都机场线、大兴机场线；不包括市郊铁路。
- 深圳 **17 条线路、362 个独立站点、426 个区间**，包括贯通运营的 2/8 号线、6 号线支线及坪山云巴；不包括龙华有轨电车。
- 广州 **22 条线路、365 个独立站点、431 个区间**，包括 APM 线、知识城线、广佛线及佛山 2、3 号线。
- SVG 扁平变形线网图，可拖动、滚轮缩放、双指缩放、全网适配、线路筛选、站点搜索。站名在缩放时自动避让。
- 上下车站 + 最多三个有顺序的换乘站；换乘站必须发生实际换车。支持综合推荐和换乘最少两种路径偏好。
- 先预览完整通路和分段站点，再确认点亮起终点、全部途经站点、实际换乘站与乘车区间。
- 单击站点仅记录该站上下车，不会点亮区间；站点详情内可快捷取消单站点亮，保留其他行程贡献的足迹。
- 站点分别保存途经、换乘、上下车状态。同一站的换乘和上下车记录可同时存在；蓝色实心加橙色标记表示两者都有。
- 足迹时间线、线路收藏进度、撤销记录。撤销后从其余记录重新计算，不会抹掉其他行程共享的足迹。
- localStorage 持久化，城市间隔离，支持跨标签页更新、JSON 备份导出与合并恢复。无效记录隔离保留并随备份导出，不阻断有效足迹；整体无法解析的原始存储不会被自动覆盖。
- 桌面双栏与手机底部导航；键盘可搜索选择站点，地图支持方向键、加减号，站点支持 Enter/空格点亮。

站点数量按线网唯一 ID 去重，不等于运营方按线路累计的站数。支线归入同一线路；不同线路的平行区间分别统计。

## 扩展城市

完整格式、最小示例和扩展步骤见 [城市数据协议](docs/city-data.md)。复制 [示例 JSON](docs/city.example.json)，填写站点、线路和相邻区间，再在 `src/data/index.ts` 注册即可。地图、路径算法、足迹统计、备份无需修改。

每座城市的名称、站点中英文名、线路、来源与贡献者统一维护在 `src/data/<城市>.json`，不需要单独的翻译文件。贡献数据必须运行 `pnpm format:city`，采用“一条站点、线路或区间记录一行”的专用格式；构建和 PR 工作流会检查所有城市 JSON，详见[强制格式规则](docs/city-data.md#必须遵循的-json-格式)。站点、线路全称使用带语言标签的 `names` 列表，线路简称使用 `shortNames`，每个列表至少一项即可。北京和上海也使用同一协议；未来贡献城市的站名不必双语齐全，但城市名必须同时提供中文和英文。

## 数据与实现边界

内置数据快照日期：**2026-10-03**。基础拓扑和变形坐标来自高德公开地铁数据，金山铁路、亦庄 T1、首都机场线方向根据官方资料补充，详见 [数据来源](docs/data-sources.md)。同名但独立运营的车站保留各自 ID，不会仅因站名相同自动换乘；坪山云巴为独立网络，不模拟与地铁之间的步行接驳。

本项目是个人出行足迹记录工具。路由按相邻区间和换线成本计算，不含列车时刻、班次、票价、限流、停运或精确步行时间。机场线和金山铁路也按相邻站点拓扑展示，不代表每趟列车的实际停站方案。

数据保存在**当前浏览器、当前站点地址**的 localStorage 中；不同设备、浏览器或端口不共享记录。清理网站数据前应导出备份。目前没有云同步，也未实现离线安装 PWA。

## 主要文件

```text
src/
  App.tsx                    页面、行程记录与交互
  components/MetroMap.tsx    SVG 线网、缩放拖动和状态显示
  components/StationPicker.tsx
  data/                      城市 JSON 和注册入口
  lib/network.ts             图结构与 Dijkstra 路由
  lib/storage.ts             记录累计、备份验证和持久化
  lib/validate.ts            城市数据运行时校验
  types.ts                   城市、区间、足迹协议
  styles.css                 TDesign 主题与响应式布局
scripts/import-amap.mjs       开发期数据转换器
scripts/format-city-data.mjs  城市数据专用格式器与检查
capacitor.config.ts           原生应用标识、Web 资源目录和平台配置
ios/                         Xcode 工程与 Swift Package Manager 配置
android/                     Android Studio 工程与 Gradle Wrapper
docs/                        数据协议、最小城市示例与来源
```

参考 UI 组件库：[TDesign Mobile React](https://tdesign.tencent.com/mobile-react/getting-started)。
