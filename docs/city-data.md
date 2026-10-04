# 城市数据协议 v1

全地铁的地图和路由使用同一份、与供应商无关的 `CityData`。TypeScript 定义位于 `src/types.ts`，运行时校验器为 `src/lib/validate.ts` 中的 `validateCity`。

## 添加城市

1. 复制 `docs/city.example.json` 到 `src/data/your-city.json`，按下表填写真实数据。
2. 在 `src/data/index.ts` 导入 JSON，并添加到注册列表：

```ts
import yourCity from './your-city.json';
export const cities: CityData[] = [shanghai, beijing, shenzhen, guangzhou, yourCity].map(
  validateCity,
);
```

3. 运行 `pnpm format:city`，再运行 `pnpm format:check`、`pnpm test` 和 `pnpm build`。选择新增城市，检查线路、换乘、终点、支线和环线几何。

无需修改地图、算法、存储键或页面逻辑。内置城市的线路断言只适用于各自城市，全网连通性测试会自动覆盖新城市。

## 必须遵循的 JSON 格式

所有 `src/data/**/*.json`（包括尚未注册的新增城市）和 `docs/city.example.json` 必须使用仓库的专用格式器，禁止提交全文件单行压缩或逐层完全展开的版本。

- 顶层字段使用两空格缩进，每个字段一行；数据集合单独分组。
- `stations`、`lines`、`segments`、`sources` 和 `sameLineTransfers` 每个元素各占一行，行内保留逗号、冒号后的空格。
- 名称列表、站点 ID 列表、坐标及路径点在所属对象内保持紧凑，不因长度自动折行。一条记录占一行，修改一个站名通常只影响一行。
- 字段按协议顺序排列，扩展字段按字段名排序；所有数组顺序原样保留，包括名称回退顺序、站点顺序、坐标顺序和单向区间端点。
- 使用 LF 换行，并保留文件末尾换行。格式化不修改字符串内容或线网数据。

示例：

<!-- prettier-ignore -->
```json
{
  "stations": [
    { "id": "example-west", "names": [{ "language": "en", "value": "West Gate" }], "x": 500, "y": 900 },
    { "id": "example-central", "names": [{ "language": "zh-CN", "value": "中央公园" }], "x": 1000, "y": 900 }
  ]
}
```

```sh
pnpm format:city        # 自动整理全部城市和示例数据
pnpm format:city:check  # 只检查，不修改；不合规时退出码为 1
pnpm format            # 整理城市数据及其余项目文件
pnpm format:check      # 检查城市数据及其余项目文件
```

格式器为 `scripts/format-city-data.mjs`，无第三方依赖；高德导入器复用同一格式器。城市 JSON 已从通用 Prettier 中排除，避免互相覆盖。不要手动调用其他格式器重新展开这些文件。

`pnpm build` 会先检查城市格式，不合规即停止构建。每个 PR 和 push 都运行 GitHub Actions 的 **City data format** 检查，不依赖贡献者主动运行本地命令。仓库管理员应在目标分支的保护规则中将 **City data format** 设为必需的状态检查，才能在 GitHub 上阻止不合规 PR 合并；工作流文件本身不会修改远端分支保护设置。

此规则减少多语言名称和路径点展开造成的行数失真，但 Git 增删行数不等于贡献价值；评审贡献时还应参考新增/修正的站点、线路、区间数量与数据核验工作。

## 顶层字段

| 字段                | 类型                       | 说明                                                |
| ------------------- | -------------------------- | --------------------------------------------------- |
| `schemaVersion`     | `1`                        | 协议版本                                            |
| `id`                | string                     | 稳定标识，使用小写字母、数字、短横线，如 `shanghai` |
| `zhName` / `enName` | string                     | 中文城市名、英文城市名，两项均必填                  |
| `localName`         | `{name, language}`?        | 可选当地城市名及 BCP 47 语言标签，如 `서울` / `ko`  |
| `updatedAt`         | string                     | 数据日期，如 `2026-10-03`                           |
| `description`       | string                     | 运营范围说明                                        |
| `descriptionEn`     | string?                    | 英文运营范围说明                                    |
| `attribution`       | object?                    | 官方维护或具名用户贡献，见下文                      |
| `center`            | `[number, number]`         | 默认地图视图中心（示意坐标）                        |
| `sources`           | `{title, titleEn?, url}[]` | 数据来源，可选英文标题，URL 使用 HTTP(S)            |
| `stations`          | Station[]                  | 去重后的站点                                        |
| `lines`             | MetroLine[]                | 线路                                                |
| `segments`          | Segment[]                  | 所有相邻站点区间                                    |

## 名称、语言与贡献者

应用支持 `zh-CN` 和 `en-GB`。首次启动按浏览器语言列表选择支持的语言；其他语言回退到 `en-GB`。在“数据管理 → 语言”可手动切换，选择保存在独立的 `metrolisto.locale.v1` 中，不改变足迹或备份格式。

**城市名必须同时提供中文 `zhName` 和英文 `enName`**，与站点采用哪种语言无关。可选 `localName` 提供当地语言名称，其中 `name` 为非空名称，`language` 为有效的 BCP 47 语言标签。当地名不能替代必填的中文名或英文名；校验器检查字段完整性，名称的实际语言与准确性由贡献者核对。

以首尔为例，城市名称字段可写为（仅说明协议，不代表已提供首尔线网）：

```json
{
  "zhName": "首尔",
  "enName": "Seoul",
  "localName": { "name": "서울", "language": "ko" }
}
```

中文界面以“首尔”为主名，英文界面以“Seoul”为主名；城市选择和数据说明同时补充另一界面语言的名称及“서울”，重复名称只显示一次。省略 `localName` 也有效。此字段仅提供名称，不意味着界面支持韩语。

站点和线路统一使用 **`names` 名称列表**，每项包含 BCP 47 语言标签 `language` 和非空名称 `value`，至少提供一项即可。语言由标签明确指定，不按中文/拉丁字母分组：英文、法文等使用拉丁字母的当地语言同样可以是唯一名称。无需为了满足字段格式而补写另一种语言或重复同一个名称。

显示时依次选择：与界面语言完全匹配的名称 → 同一基础语言的首个名称（如 `en-GB` 匹配 `en`）→ 列表第一项。因此请将首选回退名称放在第一项。搜索匹配所有 `names[].value` 和 `aliases`，不受当前界面语言限制。名称标签不代表应用界面已支持对应语言。

以下均是有效的站点/线路名称字段示例：

```json
{ "names": [{ "language": "en", "value": "Baker Street" }] }
```

```json
{ "names": [{ "language": "zh-CN", "value": "人民广场" }] }
```

```json
{ "names": [{ "language": "fr", "value": "République" }] }
```

双语站点可在同一列表内提供两项：

```json
{
  "names": [
    { "language": "zh-CN", "value": "人民广场" },
    { "language": "en", "value": "People's Square" }
  ]
}
```

每个列表内的语言标签不能重复（不区分大小写，按规范化后的标签校验），空列表、空名称和无效标签会被拒绝。站点/线路直接使用此结构，不再读取旧的 `name` / `en` 字段。城市顶层的中文 `zhName`、英文 `enName` 和可选 `localName` 遵循上文的城市名规则。

可选 `descriptionEn` 提供英文运营范围，`sources[].titleEn` 提供英文来源标题。线路的 `shortNames` 简称列表采用与 `names` 相同的结构和回退规则，也只需提供一种语言。

可选 `attribution` 标识数据来源身份：

```json
{ "kind": "official" }
```

表示“官方维护 / Officially maintained”，用于 MetroListo 第一方维护的北京和上海，**不是交通运营方对应用的认证**。

```json
{ "kind": "community", "name": "Alice" }
```

表示“由 Alice 贡献 / Contributed by Alice”。`name` 必须为非空字符串，界面不会将用户称为维护者。旧数据未提供此字段时显示“贡献者未注明”，不会自动归为官方。

**每座城市只维护一份 `src/data/<城市>.json`**：站点英文名直接写入对应 `stations[]` 对象的 `names` 列表，并标注 `language: "en"`，线路名称、城市名称、贡献者与来源也在同一文件中，无需额外的翻译目录或生成步骤。JSON 必须使用上文的一条记录一行格式，运行 `pnpm format:city` 或 `pnpm format` 整理。

北京、上海必须提供官方英文站名与英文线路名，官方双语线网图来源见 [数据来源](data-sources.md)。这是内置两城的数据质量要求，不是所有城市的协议要求。更新这两城时，转换器从现有城市 JSON 读取已核对名称；新增站点的官方英文名需直接在输出的城市 JSON 中补齐后运行测试，不会拿拼音搜索别名充当英文站名。

## 站点

```ts
interface LocalisedName {
  language: string; // BCP 47，如 zh-CN、en、fr、ko
  value: string;
}
type Names = [LocalisedName, ...LocalisedName[]];

interface Station {
  id: string;
  names: Names; // 至少一项，第一项是缺少界面语言时的回退名称
  aliases?: string[];
  x: number;
  y: number;
  label?: number;
}
```

`x/y` 是用于扁平变形地图的平面坐标，**不是经纬度**。推荐约 3000×2400 的画布，站距约 50–100 单位，尽量使用水平、竖直和 45° 线段。

实际可换乘的多条线路共用同一个站点 ID。仅同名、不直接换乘的独立车站使用不同 ID；可以在名字后注明线路。`aliases` 可以添加曾用名或拼音（搜索忽略空格和大小写）。`label` 可选，用奇偶性指定优先尝试的站名排布方向，最终会自动避让其他文字。

## 线路

```ts
interface MetroLine {
  id: string;
  names: Names; // 线路全称，至少一种语言
  shortNames: Names; // 线路简称，至少一种语言
  color: string; // #RRGGBB
  kind: 'metro' | 'rail' | 'tram' | 'maglev';
  stationIds: string[];
}
```

`stationIds` 只描述线路包含哪些站点，用于筛选和统计。**不会根据数组顺序隐式连线**。请用下面的 `segments` 明确给出所有区间，因此环线、支线和单向线路不需要特殊插件。

同一线路的支线使用同一个 `lineId`，不会被当作跨线换乘；需要同线换车时用下文的 `sameLineTransfers` 声明。

## 区间

```ts
interface Segment {
  id: string;
  lineId: string;
  from: string;
  to: string;
  points?: [number, number][];
  oneWay?: boolean;
}
```

- 默认双向，`oneWay: true` 表示仅可由 `from` 到 `to`。
- `points` 为区间的 SVG 折线坐标（含两端），没有时直接连接站点坐标。
- 环线应显式提供末站到首站的区间。
- 支线分别提供分岔站到各分支的区间，不添加分支终点间的虚构连接。
- 同一线路共用的主干区间只写一次。不同线路共轨时保留各自区间，足迹会分别统计。
- ID 应保持稳定，站名更改或几何调整不要随意更换站点/线路/区间 ID，否则旧足迹与备份无法对应。

## 路径与状态

路径算法为 Dijkstra，状态包含当前站、到达区间、已完成的有序换乘约束。综合推荐的每个区间成本为 1、每次换车额外成本为 4；换乘最少模式使用大于网络区间总数的换车成本。可选换乘站必须发生实际换车，单纯经过不能满足约束。

每条旅程保存有序的 `stationIds`、`segmentIds`、`lineIds`、`transferIds`。起终点为上下车，实际换车站为换乘，其余为途经。多次记录取并集，换乘和上下车状态分别保留。

内置校验会拒绝重复 ID、无效坐标、缺失引用、不合法颜色、与线路归属不符的区间等。测试还检查所有站点双向可达。如果新增城市确有互不连接的独立运营网络（如深圳坪山云巴），在连通性测试中按连通分量断言；跨网络路径会正常返回“未找到通路”。

可选 `sameLineTransfers` 为区间 ID 对数组：每对必须是同一线路上相邻的两个区间，表示在它们之间换车也计为换乘。例如上海 10 号线龙溪路的两个支线方向；主干至任一支线仍算直达。线路收藏仍按 `lineId` 合并，路线搜索会保留到达区间状态来判断换车。

备份可包含 `quarantined` 数组，每项保存 `cityId`、原始 `value` 与校验失败 `reason`。读取及导入时隔离无效记录、未知城市或无效城市记录列表；其余有效记录可继续使用和保存。隔离数据随导出保留、重复导入去重，不计入足迹。无法解析 JSON 或整体版本错误仍阻止覆盖原始存储。

区间可设置 `curve: "cubic"` 使用三次 Bézier 曲线：`points` 首项为起点，之后每三项依次为两个控制点和终点；不设置时仍绘制折线。曲线只影响示意图形状，不改变区间端点或行车方向。
