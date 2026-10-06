# City data sources

English | [简体中文](data-sources.zh.md)

The snapshot is dated 2026-10-03, with additions for Hangzhou and Guangzhou on 2026-10-04, and London and Amsterdam on 2026-10-05. At runtime, the app uses JSON bundled in the repository and does not request online map APIs.

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
- Guangzhou Lines 4/12 run continuously parallel through Guanzhou–Higher Education Mega Center North–Higher Education Mega Center South, with matching offset endpoints on approaching segments. Recheck this geometry after future Amap imports, keeping routing topology unchanged.
- Guangzhou Line 3 journeys between the Shipaiqiao and Linhexi sides via Tiyu Xilu count as a transfer within the same line using `sameLineTransfers`. Journeys from the Zhujiang New Town side to either branch remain direct. See [Guangzhou Metro: Tiyu Xilu interchange guide](https://static.nfnews.com/content/202607/07/c12600225.html) for the train-change explanation.
- Guangzhou’s Airport South (Terminal 1) is marked as unserved in the source data and is excluded from the recordable station list. Line 3 connects Airport North (T2) directly to Gaozeng.
- Foshan Line 3, with 37 stations and 36 segments, comes from Amap’s Foshan data. It shares existing interchange IDs at Beijiao Park, Dongping, Wanhua and Guicheng; new station coordinates were arranged manually. The line is maintained in `src/data/guangzhou.json` and preserved during import. Check it when the source adds the line or its interchange stations change.
- Guangzhou retains the source data’s APM, Guangfo Line, Foshan Line 2 and the Foshan section of Line 7. Guangzhou / Foshan trams and Pearl River Delta intercity railways are excluded.
- Hangzhou Lines 3 and 6 each combine their main line and branches, with trunk segments deduplicated. Travel between their branches counts as one train change within the line at South Xixi Wetland and Xiangshan Campus China Academy of Art, respectively. Travel from the trunk to either branch adds no transfer. For Line 3, see [Zhejiang University of Science and Technology’s travel guide](https://wgyzsw.zust.edu.cn/info/1207/1201.htm).
- Shaoxing Line 1’s main line and branch are counted together. The branch includes Huangjiu Xiaozhen (黄酒小镇), Shaoxing No. 1 High School (绍兴一中), Huxi (湖西), Daqingsi (大庆寺), Shaoxing North Railway Station (绍兴北站) and Convention and Exhibition Center (会展中心). Travel between the branch and either direction of the main line counts as one train change at Huangjiu Xiaozhen; main-line journeys passing through do not. Opening and interchange details are in the [Shaoxing state-owned assets operation announcement](https://www.sohu.com/a/908612797_121106832) and the [Shaoxing Municipal Government’s connecting bus service announcement](https://www.sx.gov.cn/art/2025/6/23/art_1229429798_4225360.html).
- Shaoxing Line 2 connects at Meishan Square (梅山广场), Shaoxing Line 1 joins Hangzhou Line 5 at Guniangqiao, and the Hangzhou–Haining Intercity Railway joins Line 9 at Linpingnan Railway Station. IDs across sources are mapped only for verified matches within the Shaoxing lines. Hangzhou’s and Shaoxing’s Olympic Sports Center stations retain separate IDs. East Railway Station and East Railway Station (East Square) retain the source’s separate IDs, without modelling an out-of-station walking interchange.
- The Hangzhou snapshot excludes the conventional-rail Shaoxing Intercity Railway and lines under construction. Hangzhou JSON is maintained separately and is not updated through the existing Amap converter. Updates must check both Hangzhou and Shaoxing sources and the schematic coordinates of supplemental segments.
- Counts are deduplicated by unique station, line and segment IDs. They do not equal an operator’s sum of station counts across lines.

## London (2026-10-05)

The September 2026 [TfL Tube map](https://content.tfl.gov.uk/standard-tube-map.pdf) and the user-provided [large-print edition](https://content.tfl.gov.uk/large-print-tube-map.pdf) define coverage and English station names: all 11 Underground lines, the six named Overground lines, Elizabeth line, DLR, London Trams and London Cable Car. Thameslink, ordinary buses, River Bus and other National Rail services are excluded. The dataset contains 21 lines, 464 station complexes/stops and 616 line-specific segments. Station names are English only; mode suffixes distinguish separate stations. Coordinates and bends are adapted schematic geometry, not a reproduction of the printed map artwork.

- Shared corridors retain each line’s collection segments and run continuously parallel through intermediate stations; station symbols connect the actual drawing endpoints. These include Circle/Hammersmith & City/Metropolitan, Circle/District, District/Piccadilly, District/Hammersmith & City, Bakerloo/Lioness, Metropolitan/Piccadilly, District/Mildmay, Mildmay/Windrush and Elizabeth/Piccadilly at Heathrow, among others. Piccadilly geometry follows the intermediate District stops it passes without adding station membership or routing edges. Apart from such parallel shared corridors, which keep a 14-unit spacing, no line may be drawn through the marker of a stop it does not serve, and different lines should not be drawn on top of each other between stations (for example Waterloo & City and District, Jubilee and the DLR Stratford branch, and Elizabeth and Central are kept apart). `mapGeometry.test.ts` checks this for London and Amsterdam; rerun it after adjusting coordinates. The Circle’s two Paddington–Edgware Road approaches are distinct. Its Hammersmith–central loop–Edgware Road service is not treated as an uninterrupted circular railway.
- Internal interchanges share station IDs. Bank/Monument and Paddington’s connected Underground platforms are station complexes, reducing counts relative to TfL’s individual station counts. Hackney Central/Downs share an internal connecting walkway. External walking links retain separate stops, including Hammersmith, Edgware Road, Bethnal Green, Shepherd’s Bush, West Hampstead, Shadwell, the three Canary Wharf stations and West Croydon. Woolwich and Woolwich Arsenal remain separate. No walking edges are inferred.
- Branch changes on Underground lines use [TfL working timetables](https://tfl.gov.uk/corporate/publications-and-reports/working-timetables). The ordinary Hainault–Woodford shuttle follows [Central WTT 70](https://content.tfl.gov.uk/cen-wtt-70.pdf); WTT 71 was listed but its detailed PDF could not be retrieved. Peak-only through workings are not inferred. District’s Olympia–High Street Kensington and Wimbledon–Edgware Road services remain direct. Piccadilly’s Terminal 4 loop runs Hatton Cross → Terminal 4 → Terminals 2 & 3. Trains do not reverse at Hatton Cross, so reaching Terminal 4 from the Terminals 2 & 3 side via Hatton Cross counts as one change. Northern’s Bank and Charing Cross branches use separate platforms at Euston: the direct Camden Town–Warren Street route runs via Mornington Crescent, and travel between King’s Cross St Pancras and Mornington Crescent or Warren Street changes at Euston. Turnham Green is included although Piccadilly calls there only at certain times.
- [Overground timetables effective 17 May 2026](https://tfl.gov.uk/modes/london-overground/london-overground-timetables) supply branch patterns. Windrush has Highbury–Crystal Palace/West Croydon and Dalston Junction–Clapham Junction/New Cross service paths. Highbury to either Dalston-origin branch requires changing trains on the shared trunk. Mildmay and Weaver retain their branches. The limited Battersea Park Windrush service is outside Tube-map coverage.
- The [May–December 2026 Elizabeth line timetable](https://content.tfl.gov.uk/elizabeth-line-17-may-12-december-2026.pdf) supplies Reading–Abbey Wood and Heathrow T4/T5–Abbey Wood/Shenfield paths. These combine recurring weekday/weekend patterns and are not all available simultaneously. Reading–Shenfield requires a change; stopping-pattern variants, short workings and mainline-platform services are not separate lines or edges.
- The [March 2026 DLR map](https://content.tfl.gov.uk/dlr-route-map.pdf) supplies all 45 stops and the directed Bank → Lewisham bypass of West India Quay. The return train calls there. Service paths distinguish Bank–Lewisham/Woolwich Arsenal, Tower Gateway–Beckton, Stratford–Lewisham and Stratford International–Beckton/Woolwich Arsenal, counting changes between services sharing tracks.
- Pudding Mill Lane–Stratford is a direct bidirectional DLR segment. Its drawn path is separated from Elizabeth line to keep it visible; travel to the Stratford International branch still requires a train change.
- Wembley Park–Finchley Road has separate parallel Jubilee and Metropolitan paths, including the intermediate Jubilee stops skipped by Metropolitan. The Metropolitan express segment remains one routing and collection edge.
- The [Tram service map](https://content.tfl.gov.uk/tram-service-map.pdf) supplies all 39 stops. [Wimbledon’s TfL stop page](https://tfl.gov.uk/tram/stop/940GZZCRWMB/wimbledon-tramlink-stop) supports the Beckenham Junction and Elmers End services. New Addington services traverse the clockwise Croydon street loop; through continuity at the second East Croydon visit is preserved. Reeves Corner is inbound only; westbound trains use Church Street → Wandle Park. Limited early/late Wimbledon–New Addington through workings are not modeled.
- Cable Car’s Royal Docks and Greenwich Peninsula stops are included as a separate operating component. The schema has no walking-link type, so journeys to Royal Victoria or North Greenwich are not synthesized by merging their stations.

Service profiles describe ordinary direct travel, not a timetable-aware journey planner. Frequencies, temporary closures, platform walking times and all exceptional workings are outside this snapshot. Update London manually in its city JSON and check the source maps, service paths, directional segments and station complexes together.

## Amsterdam (2026-10-05)

Coverage is the operating GVB metro network, with 5 lines, 39 unique stations and 71 line-specific segments. Dutch station names are used in both interface languages. Trams, including the former M51 route to Amstelveen and today’s tram 25, buses, ferries and NS rail are excluded. No Schiphol extension or Isolatorweg–Centraal ring-closing connection is invented.

Current [GVB line information](https://gvb.nl/reisinformatie/haltes-en-dienstregeling?id=30), [M50’s stop list](https://gvb.nl/reisinformatie/lijn/GVB/50) and [M51’s stop list](https://www.gvb.nl/reisinformatie/lijn/GVB/51) establish the routes. September 2026 published stop timetables verify [M52](https://www.gvb.nl/en/travel-information/stop/pdf?direction=Inbound&lineNumber=52&startDate=2026-09-22&stopCode=NL%3AS%3A30009583) and [M53](https://www.gvb.nl/en/travel-information/stop/pdf?direction=Outbound&lineNumber=53&startDate=2026-09-29&stopCode=NL%3AS%3A30009542). GVB’s [complete M54 stop list](https://over.gvb.nl/nieuws/gvb-rijdt-met-metro-52-noord-zuidlijn-en-54-op-nieuwjaarsnacht/) is cross-checked against the map and current line coverage.

| Line | Ordinary termini                                      | Stations |
| ---- | ----------------------------------------------------- | -------- |
| M50  | Isolatorweg–Gein                                      | 20       |
| M51  | Isolatorweg–Centraal Station, via Zuid and Spaklerweg | 19       |
| M52  | Noord–Zuid                                            | 8        |
| M53  | Centraal Station–Gaasperplas                          | 14       |
| M54  | Centraal Station–Gein                                 | 15       |

Shared stations use one ID, while each line keeps its own collection segments and drawn path. Shared tracks have continuous parallel paths through intermediate stations, with station markers spanning the paths rather than pulling every line back to the station anchor. M50/M51 share Isolatorweg–Overamstel; M51/M53/M54 share Centraal Station–Spaklerweg; M53/M54 share Spaklerweg–Van der Madeweg; M50/M54 share Van der Madeweg–Gein. Overamstel–Spaklerweg belongs to M51 and Overamstel–Van der Madeweg to M50. Travel between Gein and Gaasperplas requires a real change at Van der Madeweg. M52 connects to the other lines only at Centraal Station and Zuid; Europaplein–RAI is an external walk and has no invented rail edge.

Names follow GVB’s Dutch forms, including `Bijlmer ArenA`, `Amstelstation` and `Burg. de Vlugtlaan`. Generic `Station` prefixes are omitted for compact display where appropriate, with the official prefixed forms retained as search aliases. `Diemen-Zuid` also matches `Diemen Zuid`. Line names use `Metrolijn` and short names M50–M54.

The downloadable [GVB Metrokaart with the 2025 summer overlay](https://assets.ctfassets.net/d6yaib7us1l3/30k69FRENe3aHXpQdpfip4/69b57e56535f1454b1ab4d728cee1b76/Metrokaart_2025_-_zomerwerk.pdf) is a secondary reference for names, approximate placement and line colours; its temporary closures and replacement transport are not used as operating topology. Coordinates and paths are drawn manually for this app. GVB’s [new numbering and service plan](https://over.gvb.nl/nieuws/nieuwe-lijnnummers-en-kleuren-maken-amsterdamse-metro-overzichtelijker/) applies at the start of the 2028 timetable and is not included in this 2026 snapshot. Summer works and other temporary changes are also excluded. Maintain Amsterdam directly in its city JSON, preserving IDs on later updates.

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

Beijing, Shanghai and London are maintained by the MetroListo app developer. Shenzhen and the Guangzhou metropolitan area were contributed by [Hashmapw](https://github.com/Hashmapw); the Hangzhou metropolitan area and Amsterdam were contributed by [scris](https://github.io/scris).

English station names follow operators’ bilingual network maps, preserving proper names, directional abbreviations and English parenthetical text. Proper names are not retranslated when the interface language changes:

- Shanghai: the [Shanghai Metro bilingual map download page](https://service.shmetro.com/en/zlxz/index.htm) and [bilingual network map](https://service.shmetro.com/skin/map/shmetro-map.jpg). The edition used was D202512, including Jinshan Railway; examples include `Nanjing Rd.(E)` and `Jinshanyuanqu`.
- Beijing: the [Beijing MTR official network map page](https://www.mtr.bj.cn/article/line). The [original bilingual map](https://cdnwww.mtr.bj.cn/bjmtr/default/mxFXoKAXCCYv61DjKHdzl.jpg) used includes Yizhuang T1; examples include `Qu Zhuang`, `Lujuan Dong (E)` and `3 Hao Hangzhanlou (Terminal 3)`.
- Shenzhen: the [Shenzhen Metro official bilingual network map](https://www.szmc.net/SMARTC/upload/image/20260630/1782803829923076269.png), including an inset for Pingshan SkyShuttle; examples include `Window of the World`, `SUAT` and `Airport (T3)`.
- Guangzhou: the [Guangzhou Metro official bilingual network map (2026-07-30)](https://cs.gzmtr.com/ckfw/xlu_2020/202607/W020260730790914610429.png), including Guangfo Line and Foshan Lines 2 and 3; examples include `Xiaode Dong`, `Luocun` and `Qiandeng Lake`.

London supplies English-only names and Amsterdam supplies Dutch-only names, both using the normal interface fallback. Chinese and English station names in the Chinese city datasets are stored together in the `names` lists in `src/data/<city>.json` (`zh-CN` / `en`). Other names, sources and contributors are maintained in the same file. `aliases` is used only for search aliases.

The Amap converter supports topology and coordinate updates for Shanghai, Beijing, Shenzhen and Guangzhou, preserving verified names, aliases, city metadata and line order. It prompts for missing official English names on new Beijing and Shanghai stations or lines, and tests check bilingual completeness. Other cities can contribute JSON directly using the same schema.

Community-contributed cities use `attribution: { "kind": "community", "name": "Contributor name" }`, displayed as “Contributed by 〈name〉”. See the [City data schema](city-data.en.md) for field requirements.
