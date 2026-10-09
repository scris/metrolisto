# 城市数据协议 v1

[English](city-data.en.md) | 简体中文

全地铁的地图和路由使用同一份、与供应商无关的 `CityData`。TypeScript 定义位于 `src/types.ts`，运行时校验器为 `src/lib/validate.ts` 中的 `validateCity`。

## 添加城市

1. 复制 `docs/city.example.json` 到 `src/data/your-city.json`，按下表填写真实数据。
2. 在 `src/data/index.ts` 导入 JSON，并添加到注册列表：

```ts
import yourCity from './your-city.json';
export const cities: CityData[] = [shanghai, beijing, shenzhen, yourCity].map(validateCity);
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

| 字段                | 类型                       | 说明                                                         |
| ------------------- | -------------------------- | ------------------------------------------------------------ |
| `schemaVersion`     | `1`                        | 协议版本                                                     |
| `id`                | string                     | 稳定标识，使用小写字母、数字、短横线，如 `shanghai`          |
| `zhName` / `enName` | string                     | 中文城市名、英文城市名，两项均必填                           |
| `localLanguage`     | string                     | 必填的 BCP 47 当地语言标签，用于选择城市次名                 |
| `localName`         | `{name, language}`?        | 当地语言不是中文或英文时必填的当地名称及 BCP 47 标签         |
| `latitude`          | number                     | 城市代表位置的 WGS 84 纬度（十进制度），范围 −90～90，必填   |
| `longitude`         | number                     | 城市代表位置的 WGS 84 经度（十进制度），范围 −180～180，必填 |
| `updatedAt`         | string                     | 数据日期，如 `2026-10-03`                                    |
| `description`       | string                     | 运营范围说明                                                 |
| `descriptionEn`     | string?                    | 英文运营范围说明                                             |
| `attribution`       | object?                    | 由应用开发者维护或具名用户贡献，见下文                       |
| `center`            | `[number, number]`         | 默认地图视图中心（示意坐标）                                 |
| `sources`           | `{title, titleEn?, url}[]` | 数据来源，可选英文标题，URL 使用 HTTP(S)                     |
| `stations`          | Station[]                  | 去重后的站点                                                 |
| `lines`             | MetroLine[]                | 线路                                                         |
| `segments`          | Segment[]                  | 所有相邻站点区间                                             |

## 名称、语言与贡献者

城市选择列表以当前打开的城市为起点，按代表位置之间的球面直线距离由近到远排序，当前城市置顶；切换城市后重新排序。`latitude` / `longitude` 与地图示意坐标 `center`、站点 `x/y` 相互独立。新增城市请填写真实经纬度，示例中的 `0, 0` 仅为占位值。

应用支持 `zh-CN` 和 `en-GB`。首次启动按浏览器语言列表选择支持的语言；其他语言回退到 `en-GB`。在“数据管理 → 语言”可手动切换，选择保存在独立的 `metrolisto.locale.v1` 中，不改变足迹或备份格式。

**城市名必须同时提供中文 `zhName`、英文 `enName` 和 `localLanguage`**，与站点采用哪种语言无关。`localLanguage` 为有效的 BCP 47 语言标签，指定用于显示的当地语言：中文使用 `zhName`，英文使用 `enName`，其他语言必须提供对应的 `localName`。`localName.name` 为非空名称，`localName.language` 为有效的 BCP 47 标签，基础语言须与 `localLanguage` 相同。当地名不能替代必填的中文名或英文名；名称的实际语言与准确性由贡献者核对。

英文城市名 `enName` 使用首字母大写的常规拼写，例如 `Hangzhou`、`Guangzhou`、`Shenzhen`，不使用全大写形式。

以首尔为例，城市名称字段可写为（仅说明协议，不代表已提供首尔线网）：

```json
{
  "zhName": "首尔",
  "enName": "Seoul",
  "localLanguage": "ko",
  "localName": { "name": "서울", "language": "ko" }
}
```

城市选择和数据说明的主名固定为当前界面语言：英文模式使用 `enName`，中文模式使用 `zhName`。英文模式的次名为当地语言名称；当地语言为英文时不显示次名。中文模式的次名也为当地语言名称；当地语言为中文时改用 `enName`。中文、英文的地区或文字变体按基础语言判断，例如 `zh-Hant` 属于中文、`en-US` 属于英文。重复名称只显示一次。

例如首尔在英文模式显示“Seoul / 서울”，中文模式显示“首尔 / 서울”；北京在两种模式分别显示“Beijing / 北京”和“北京 / Beijing”；伦敦分别显示“London”和“伦敦 / London”。当地语言为中文或英文时可以省略 `localName`。这些字段不增加对应语言的界面支持。

站点和线路统一使用 **`names` 名称列表**，每项包含 BCP 47 语言标签 `language` 和非空名称 `value`，至少提供一项即可。语言由标签明确指定，不按中文/拉丁字母分组：英文、法文等使用拉丁字母的当地语言同样可以是唯一名称。无需为了满足字段格式而补写另一种语言或重复同一个名称。

显示时依次选择：与界面语言完全匹配的名称 → 同一基础语言的首个名称（如 `en-GB` 匹配 `en`）→ 列表第一项。因此请将首选回退名称放在第一项。搜索匹配所有 `names[].value` 和 `aliases`，不受当前界面语言限制，并忽略大小写、空格和变音符号，例如 `sao sebastiao` 可找到 São Sebastião，无需另加无重音别名。名称标签不代表应用界面已支持对应语言。

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

城市说明 `description` 和 `descriptionEn` 均不以句号结尾，末尾不添加中文句号 `。` 或英文句号 `.`。

可选 `attribution` 标识数据来源身份：

```json
{ "kind": "official" }
```

表示“由应用开发者维护 / Maintainer: App Developer”，用于 MetroListo 第一方维护的北京、上海、伦敦及巴黎，**不是交通运营方对应用的认证**。

```json
{ "kind": "community", "name": "Alice" }
```

表示“由 Alice 贡献 / Contributor: Alice”。`name` 必须为非空字符串，界面不会将用户称为维护者。旧数据未提供此字段时显示“贡献者未注明”，不会自动归为官方。

**每座城市只维护一份 `src/data/<城市>.json`**：站名直接写入对应 `stations[]` 对象的 `names` 列表，并标注对应语言，例如英文使用 `en`，荷兰语使用 `nl`。线路名称、城市名称、贡献者与来源也在同一文件中，无需额外的翻译目录或生成步骤。JSON 必须使用上文的一条记录一行格式，运行 `pnpm format:city` 或 `pnpm format` 整理。

北京、上海必须提供官方英文站名与英文线路名，官方双语线网图来源见 [数据来源](data-sources.zh.md)。这是内置两城的数据质量要求，不是所有城市的协议要求。更新这两城时，转换器从现有城市 JSON 读取已核对名称；新增站点的官方英文名需直接在输出的城市 JSON 中补齐后运行测试，不会拿拼音搜索别名充当英文站名。

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
  kind: 'metro' | 'rail' | 'tram' | 'maglev' | 'cable-car';
  stationIds: string[];
  services?: { id: string; stationIds: string[]; oneWay?: boolean }[];
}
```

`stationIds` 只描述线路包含哪些站点，用于筛选和统计。**不会根据数组顺序隐式连线**。请用下面的 `segments` 明确给出所有区间，因此环线、支线和单向线路不需要特殊插件。

同一线路的支线使用同一个 `lineId`，不会被当作跨线换乘；需要同线换车时用下文的 `sameLineTransfers` 声明。

`cable-car` 表示缆车。可选的 `services` 描述有序直通交路，用于相邻区间的支线规则无法区分共轨服务的情况。每条交路有稳定 ID，至少包含两个所属线路站点；未设 `oneWay: true` 时允许反向运行。街道回路允许站点重复出现，直通延续必须按交路中的下一次位置推进，不能跳到同一站的另一次经过。线路所有运营区间的允许方向必须被交路完整覆盖。即使 `lineId` 不变，切换交路仍计为换车；不应将频率、短交路或临时停运另建为收藏线路。

例如 Windrush 从 Highbury & Islington 始发的列车不直通 Clapham Junction，该分支从 Dalston Junction 始发，需要在共线段换车，仅看 Surrey Quays 两侧相邻区间无法表达这一限制。交路也能保留 Croydon 电车第二次经过 East Croydon 时的连续乘车。省略 `services` 时仍按区间邻接和 `sameLineTransfers` 处理。

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
- `points` 为区间的 SVG 折线坐标（含绘制端点），没有时直接连接站点坐标。绘制端点可偏离站点锚点，以保持共线线路连续平行；同一连续路径的相邻区间在该站须使用一致的绘制端点。站点符号只使用圆形或直胶囊形；多线端点应排在同一条直线上，可以保留较长的胶囊，但不要创建分叉、凸起或不规则站点。接入线段保持水平、垂直或 45° 斜线（0° / 45° / 90° / 135°），需要时增加转角并使用圆角过渡，不要仅移动端点造成折返或任意角度斜线。调整后应检查相邻线段连续、不穿过未停靠的站点，且整个符号均可点击。单线偏移站不横跨未停靠的线路。连接关系和路由仍以 `from`/`to` 站点 ID 为准。
- 环线应显式提供末站到首站的区间。
- 支线分别提供分岔站到各分支的区间，不添加分支终点间的虚构连接。
- 同一线路共用的主干区间只写一次。不同线路共轨时保留各自区间，足迹会分别统计。
- ID 应保持稳定，站名更改或几何调整不要随意更换站点/线路/区间 ID，否则旧足迹与备份无法对应。

## 路径与状态

路径算法为 Dijkstra，状态包含当前站、到达区间、可选直通交路的位置，以及已完成的有序换乘约束。综合推荐的每个区间成本为 1、每次换车额外成本为 4；换乘最少模式使用大于网络区间总数的换车成本。可选换乘站必须发生实际换车，单纯经过不能满足约束。

每条旅程保存有序的 `stationIds`、`segmentIds`、`lineIds`、`transferIds`。起终点为上下车，实际换车站为换乘，其余为途经。多次记录取并集，换乘和上下车状态分别保留。

内置校验会拒绝重复 ID、无效坐标、缺失引用、不合法颜色、与线路归属不符的区间等。测试还检查所有站点双向可达。如果新增城市确有互不连接的独立运营网络（如深圳坪山云巴、伦敦缆车），在连通性测试中按连通分量断言；跨网络路径会正常返回“未找到通路”。

可选 `sameLineTransfers` 为区间 ID 对数组：每对必须是同一线路上相邻的两个区间，表示在它们之间换车也计为换乘。例如上海 10 号线龙溪路的两个支线方向；主干至任一支线仍算直达。线路收藏仍按 `lineId` 合并，路线搜索会保留到达区间状态来判断换车。

地图换乘符号与可选换乘站是两套判定，分别对应 `src/lib/network.ts` 的 `isInterchange` 和 `isTransferStation`，互不替代：

- **地图换乘符号**（加大的站点符号、加粗并优先显示的站名）：站点属于两条及以上线路，或是某条 `sameLineTransfers` 规则中两个区间的公共站。仅有同一线路多条 `services` 交路经过的站点仍按普通站绘制。
- **可选换乘站**（记录旅程时的换乘站选择器，以及路径搜索接受的换乘约束）：包含上述全部站点，另加可在同一线路内换交路的站点，即存在一条到达该站的交路和一条经由另一区间离站的交路，且后者不是前者的直通延续。原路折返不计，因此交路终点站，以及只有同一交路往返经过的站点不会列入。

例如 Windrush 的 Hoxton 可选作换乘站（Highbury & Islington 方向来车换乘前往 Clapham Junction 的列车），但在地图上仍是普通站；Surrey Quays 有 `sameLineTransfers` 规则，两者都是；Abbey Wood 是终点站，两者都不是。因此使用 `services` 的线路若希望分岔站显示换乘符号，仍须为确实需要换车的分支区间对声明 `sameLineTransfers`。

备份校验也会核对直通交路连续性，并保留共线段上有效的已记录换车站。

备份可包含 `quarantined` 数组，每项保存 `cityId`、原始 `value` 与校验失败 `reason`。读取及导入时隔离无效记录、未知城市或无效城市记录列表；其余有效记录可继续使用和保存。隔离数据随导出保留、重复导入去重，不计入足迹。无法解析 JSON 或整体版本错误仍阻止覆盖原始存储。

区间可设置 `curve: "cubic"` 使用三次 Bézier 曲线：`points` 首项为起点，之后每三项依次为两个控制点和终点；不设置时仍绘制折线。曲线只影响示意图形状，不改变区间端点或行车方向。
