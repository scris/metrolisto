# City data sources

English | [简体中文](data-sources.zh.md)

The snapshot is dated 2026-10-03, with additions for Hangzhou and Guangzhou on 2026-10-04. At runtime, the app uses JSON bundled in the repository and does not request online map APIs.

## Primary sources

| Data                                                                                        | Source                                                                                        |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Shanghai station names, station IDs, line colours, base topology and schematic coordinates  | [Amap public metro data](https://map.amap.com/service/subway?srhdata=3100_drw_shanghai.json)  |
| Beijing station names, station IDs, line colours, base topology and schematic coordinates   | [Amap public metro data](https://map.amap.com/service/subway?srhdata=1100_drw_beijing.json)   |
| Shenzhen station names, station IDs, line colours, base topology and schematic coordinates  | [Amap public metro data](https://map.amap.com/service/subway?srhdata=4403_drw_shenzhen.json)  |
| Guangzhou station names, station IDs, line colours, base topology and schematic coordinates | [Amap public metro data](https://map.amap.com/service/subway?srhdata=4401_drw_guangzhou.json) |

Topology, station names, English names and base schematic coordinates for Hangzhou, including Shaoxing and Haining, come from [Amap’s Hangzhou data](https://map.amap.com/service/subway?srhdata=3301_drw_hangzhou.json). The Shaoxing Line 1 branch and Line 2 come from [Amap’s Shaoxing data](https://map.amap.com/service/subway?srhdata=3306_drw_shaoxing.json), with new station coordinates adapted to the Hangzhou canvas.

## Secondary sources

| Data                                                                                          | Source                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Foshan Line 3 station order, station IDs, English names, colour and interchange relationships | [Amap public Foshan metro data](https://map.amap.com/service/subway?srhdata=4406_drw_foshan.json)                                                                                    |
| Jinshan Railway stations                                                                      | [Shanghai Municipal Government: Jinshan Railway station information (2026-03-13)](https://www.shanghai.gov.cn/nw17239/20260313/cc9fe6e3e47a47aca3a55b29cd0fb089.html)                |
| Jinshan Railway stops at Shanghai South Railway Station and Xinzhuang                         | [Shanghai Municipal Government: timetable changes for some Jinshan Railway services from 1 July](https://www.shanghai.gov.cn/nw17239/20250618/791f004ceee246ff9b6d9635577799c8.html) |
| Yizhuang T1 tram station order                                                                | [Beijing MTR: Yizhuang T1 distances between stations](https://www.mtr.bj.cn/service/line/distable/Yizhuang%20T1%20Line.html)                                                         |
| Capital Airport Express direction: Sanyuan Qiao—T3—T2—Sanyuan Qiao                            | [Beijing Subway: distances between stations](https://wenjuan.bjsubway.com/station/zjgls/)                                                                                            |
| Suspended stops at Bajiao Amusement Park                                                      | [Beijing Subway website (announcement dated 2026-05-16)](https://www.bjsubway.com/)                                                                                                  |
| Deferred opening of Tongyunmen                                                                | [Beijing Subway: Tongyunmen station facilities](https://www.bjsubway.com/station/fwss/line6/2014-12-25/465.html)                                                                     |
| Deferred opening of Laoguanli on Yizhuang T1                                                  | [Beijing Municipal Government: Yizhuang T1](https://www.beijing.gov.cn/renwen/rwzyd/qxdw/lsychmqdd/jkqT1x/202309/t20230927_3268022.html)                                             |

## Data processing rules

- Branches of Shanghai Lines 5, 10 and 11 are combined in their respective line objects, with trunk segments deduplicated by stable ID.
- Travel between the two branches of Shanghai Lines 5, 10 and 11 counts as one train change at Dongchuan Rd., Longxi Rd. and Jiading Xincheng, respectively. Travel from the trunk to either branch does not add a transfer.
- Beijing’s Dahong Men stations on Lines 8 and 10 are merged into one interchange, with related segment endpoints and IDs normalised.
- Branch train-change rules follow the existing branching topology and service patterns: [Line 5 dual service patterns](https://jtw.sh.gov.cn/bmts/20201225/be0cf9f1e8fa4fdf8c81b624df3fda7d.html) and [Line 11 Jiading North / Anting service patterns](https://www.shanghai.gov.cn/nw5827/20200905/0001-5827_785606.html). Temporary service changes and frequencies are not simulated.
- Shanghai Line 4 and Beijing Lines 2 and 10 are closed loops.
- Jinshan Railway adds a nine-station sequence: Shanghai South Railway Station, Xinzhuang, Chunshen, Xinqiao, Chedun, Yexie, Tinglin, Jinshanyuanqu and Jinshanwei. Shanghai South Railway Station and Xinzhuang share IDs with existing metro stations. Schematic coordinates for this line were added manually.
- Yizhuang T1 adds 14 stations from Qu Zhuang to Dinghai Yuan. Rongchang Dongjie shares its ID with the Yizhuang Line to record an interchange accessible on foot. Schematic coordinates for this line were added manually.
- Capital Airport Express does not infer bidirectional adjacency from the original station order. It explicitly defines a bidirectional Beixinqiao—Dongzhimen—Sanyuan Qiao trunk and a one-way airport loop. The schematic follows the official map’s side-by-side terminals, curved branches on both sides and an inner U-shaped connection, with direction arrows along the outbound, inter-terminal and inbound curves.
- Bajiao Amusement Park and Tongyunmen in Beijing, and Laoguanli on Yizhuang T1, are absent from the current list of recordable stations. The operating lines serving the first two connect across these unserved stations to the next operating station. Update the snapshot when they open or reopen.
- National Exhibition and Convention Center on Lines 2/17 and Pudong Rd.(S) on Lines 2/14 retain the provider’s separate station IDs. They are not merged simply because their names match. Routing only uses explicitly defined interchange relationships in the data.
- Shenzhen Line 2/8 is counted as one through-running line, following the source data. The Line 6 branch remains a separate line. Old line aliases, such as “Luobao Line”, are removed from display names.
- Shenzhen’s Pingshan SkyShuttle remains a separate network, without modelling walking connections to the metro. The snapshot excludes Longhua Tram.
- Shenzhen’s Grand Theater on Lines 1/2/5 and Guangzhou’s Xinshixu on Lines 12/14 have their station IDs merged according to explicit interchange relationships in the source data.
- Guangzhou Line 3’s main line and northern extension are combined into one line. The Line 14 branch, Knowledge City Line, remains separate, and Line 11 is a closed loop. Both operating sections of Line 12 belong to the same line, without a segment connecting their endpoints.
- Guangzhou Line 3 journeys between the Shipaiqiao and Linhexi sides via Tiyu Xilu count as a transfer within the same line using `sameLineTransfers`. Journeys from the Zhujiang New Town side to either branch remain direct. See [Guangzhou Metro: Tiyu Xilu interchange guide](https://static.nfnews.com/content/202607/07/c12600225.html) for the train-change explanation.
- Guangzhou’s Airport South (Terminal 1) is marked as unserved in the source data and is excluded from the recordable station list. Line 3 connects Airport North (T2) directly to Gaozeng.
- Foshan Line 3, with 37 stations and 36 segments, comes from Amap’s Foshan data. It shares existing interchange IDs at Beijiao Park, Dongping, Wanhua and Guicheng; new station coordinates were arranged manually. The line is maintained in `src/data/guangzhou.json` and preserved during import. Check it when the source adds the line or its interchange stations change.
- Guangzhou retains the source data’s APM, Guangfo Line, Foshan Line 2 and the Foshan section of Line 7. Guangzhou / Foshan trams and Pearl River Delta intercity railways are excluded.
- Hangzhou Lines 3 and 6 each combine their main line and branches, with trunk segments deduplicated. Travel between their branches counts as one train change within the line at South Xixi Wetland and Xiangshan Campus China Academy of Art, respectively. Travel from the trunk to either branch adds no transfer. For Line 3, see [Zhejiang University of Science and Technology’s travel guide](https://wgyzsw.zust.edu.cn/info/1207/1201.htm).
- Shaoxing Line 1’s main line and branch are counted together. The branch includes Huangjiu Xiaozhen (黄酒小镇), Shaoxing No. 1 High School (绍兴一中), Huxi (湖西), Daqingsi (大庆寺), Shaoxing North Railway Station (绍兴北站) and Convention and Exhibition Center (会展中心). Travel between the branch and either direction of the main line counts as one train change at Huangjiu Xiaozhen; main-line journeys passing through do not. Opening and interchange details are in the [Shaoxing state-owned assets operation announcement](https://www.sohu.com/a/908612797_121106832) and the [Shaoxing Municipal Government’s connecting bus service announcement](https://www.sx.gov.cn/art/2025/6/23/art_1229429798_4225360.html).
- Shaoxing Line 2 connects at Meishan Square (梅山广场), Shaoxing Line 1 joins Hangzhou Line 5 at Guniangqiao, and the Hangzhou–Haining Intercity Railway joins Line 9 at Linpingnan Railway Station. IDs across sources are mapped only for verified matches within the Shaoxing lines. Hangzhou’s and Shaoxing’s Olympic Sports Center stations retain separate IDs. East Railway Station and East Railway Station (East Square) retain the source’s separate IDs, without modelling an out-of-station walking interchange.
- The Hangzhou snapshot excludes the conventional-rail Shaoxing Intercity Railway and lines under construction. Hangzhou JSON is maintained separately and is not updated through the existing Amap converter. Updates must check both Hangzhou and Shaoxing sources and the schematic coordinates of supplemental segments.
- Counts are deduplicated by unique station, line and segment IDs. They do not equal an operator’s sum of station counts across lines.

## Updating data

After downloading new Amap JSON files locally, run the following. The converter uses the city code inside each file to update only the supplied cities:

```sh
node scripts/import-amap.mjs /path/to/shanghai.json /path/to/beijing.json
# Verify and complete new station/line English names, update dates and sources in src/data/*.json
pnpm format:city
pnpm test
pnpm build
```

The converter is used only during development and does not run on the client. When updating, check supplemental lines, suspended stations, interchange ID mappings, separate operating sections and direction rules, and update `updatedAt`. Keep existing station and segment IDs compatible to preserve users’ historical records.

The converter directly outputs the standard city format with one record per line. Run `pnpm format:city` after manual edits. Build and PR formatting checks reject files compressed onto a single line or fully expanded; see the [city data formatting rules](city-data.en.md#required-json-format).

Rights to map data and names remain with their respective rights holders. This directory records sources and processing notes and does not grant a separate licence for third-party data. Before public release, verify providers’ terms against the actual scope of use.

## English names and contributor labels

Beijing and Shanghai are maintained by the MetroListo app developer. Shenzhen and the Guangzhou metropolitan area were contributed by [Hashmapw](https://github.com/Hashmapw); the Hangzhou metropolitan area was contributed by [scris](https://github.io/scris).

English station names follow operators’ bilingual network maps, preserving proper names, directional abbreviations and English parenthetical text. Proper names are not retranslated when the interface language changes:

- Shanghai: the [Shanghai Metro bilingual map download page](https://service.shmetro.com/en/zlxz/index.htm) and [bilingual network map](https://service.shmetro.com/skin/map/shmetro-map.jpg). The edition used was D202512, including Jinshan Railway; examples include `Nanjing Rd.(E)` and `Jinshanyuanqu`.
- Beijing: the [Beijing MTR official network map page](https://www.mtr.bj.cn/article/line). The [original bilingual map](https://cdnwww.mtr.bj.cn/bjmtr/default/mxFXoKAXCCYv61DjKHdzl.jpg) used includes Yizhuang T1; examples include `Qu Zhuang`, `Lujuan Dong (E)` and `3 Hao Hangzhanlou (Terminal 3)`.
- Shenzhen: the [Shenzhen Metro official bilingual network map](https://www.szmc.net/SMARTC/upload/image/20260630/1782803829923076269.png), including an inset for Pingshan SkyShuttle; examples include `Window of the World`, `SUAT` and `Airport (T3)`.
- Guangzhou: the [Guangzhou Metro official bilingual network map (2026-07-30)](https://cs.gzmtr.com/ckfw/xlu_2020/202607/W020260730790914610429.png), including Guangfo Line and Foshan Lines 2 and 3; examples include `Xiaode Dong`, `Luocun` and `Qiandeng Lake`.

Chinese and English station names are stored together in the `names` lists in `src/data/<city>.json` (`zh-CN` / `en`). Other names, sources and contributors are maintained in the same file. `aliases` is used only for search aliases.

The Amap converter supports topology and coordinate updates for Shanghai, Beijing, Shenzhen and Guangzhou, preserving verified names, aliases, city metadata and line order. It prompts for missing official English names on new Beijing and Shanghai stations or lines, and tests check bilingual completeness. Other cities can contribute JSON directly using the same schema.

Community-contributed cities use `attribution: { "kind": "community", "name": "Contributor name" }`, displayed as “Contributed by 〈name〉”. See the [City data schema](city-data.en.md) for field requirements.
