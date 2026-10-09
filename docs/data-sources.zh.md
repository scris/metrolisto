# 城市数据来源

[English](data-sources.en.md) | 简体中文

快照日期为 2026-10-03，杭州及广州补充于 2026-10-04，伦敦及阿姆斯特丹补充于 2026-10-05，里斯本、瓦伦西亚、马拉加及巴黎补充于 2026-10-08。运行时使用仓库内的 JSON，不在线请求地图 API。

## 主要来源

| 数据                                            | 来源                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| 上海站名、站点 ID、线路颜色、基础拓扑与示意坐标 | [高德公开地铁数据](https://map.amap.com/service/subway?srhdata=3100_drw_shanghai.json)  |
| 北京站名、站点 ID、线路颜色、基础拓扑与示意坐标 | [高德公开地铁数据](https://map.amap.com/service/subway?srhdata=1100_drw_beijing.json)   |
| 深圳站名、站点 ID、线路颜色、基础拓扑与示意坐标 | [高德公开地铁数据](https://map.amap.com/service/subway?srhdata=4403_drw_shenzhen.json)  |
| 广州站名、站点 ID、线路颜色、基础拓扑与示意坐标 | [高德公开地铁数据](https://map.amap.com/service/subway?srhdata=4401_drw_guangzhou.json) |

杭州（含绍兴、海宁）的拓扑、站名、英文名与基础示意坐标来自[高德杭州数据](https://map.amap.com/service/subway?srhdata=3301_drw_hangzhou.json)；绍兴 1 号线支线及 2 号线来自[高德绍兴数据](https://map.amap.com/service/subway?srhdata=3306_drw_shaoxing.json)，新增站点坐标适配到杭州画布。

## 次要来源

| 数据                                             | 来源                                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| 佛山 3 号线站序、站点 ID、英文名、颜色与换乘关系 | [高德公开佛山地铁数据](https://map.amap.com/service/subway?srhdata=4406_drw_foshan.json)                                              |
| 金山铁路站点                                     | [上海市政府：金山铁路各站信息（2026-03-13）](https://www.shanghai.gov.cn/nw17239/20260313/cc9fe6e3e47a47aca3a55b29cd0fb089.html)      |
| 金山铁路上海南站、莘庄停站                       | [上海市政府：7 月 1 日起金山铁路部分站车时刻调整](https://www.shanghai.gov.cn/nw17239/20250618/791f004ceee246ff9b6d9635577799c8.html) |
| 亦庄有轨电车 T1 站序                             | [京港地铁：亦庄 T1 站间距](https://www.mtr.bj.cn/service/line/distable/Yizhuang%20T1%20Line.html)                                     |
| 首都机场线三元桥—T3—T2—三元桥方向                | [北京地铁：站间距信息](https://wenjuan.bjsubway.com/station/zjgls/)                                                                   |
| 八角游乐园暂停停靠                               | [北京地铁官网（2026-05-16 公告）](https://www.bjsubway.com/)                                                                          |
| 通运门暂缓开通                                   | [北京地铁：通运门站服务设施](https://www.bjsubway.com/station/fwss/line6/2014-12-25/465.html)                                         |
| 亦庄 T1 老观里暂缓开通                           | [北京市政府：亦庄 T1 线](https://www.beijing.gov.cn/renwen/rwzyd/qxdw/lsychmqdd/jkqT1x/202309/t20230927_3268022.html)                 |

## 整理规则

- 上海 5、10、11 号线的支线合并在线路对象中，主干区间按稳定 ID 去重。
- 上海 5、10、11 号线两支线之间分别经东川路、龙溪路、嘉定新城计一次换车；主干至任一支线不额外计换乘。
- 北京大红门的 8、10 号线站点合并为一个换乘站，并统一相关区间端点和 ID。
- 支线换车规则依据已有分叉拓扑及运营交路整理：[5 号线双交路说明](https://jtw.sh.gov.cn/bmts/20201225/be0cf9f1e8fa4fdf8c81b624df3fda7d.html)、[11 号线嘉定北/安亭交路说明](https://www.shanghai.gov.cn/nw5827/20200905/0001-5827_785606.html)。不模拟临时运营调整和班次。
- 上海 4 号线、北京 2 和 10 号线闭合成环。
- 金山铁路增加 9 站序列：上海南站、莘庄、春申、新桥、车墩、叶榭、亭林、金山园区、金山卫。其中上海南站、莘庄与已有地铁站共用 ID。该线路示意坐标为手工添加。
- 上海南站—莘庄区间的金山铁路沿 1 号线路径保持 14 单位间距，两个换乘站的标记连接实际绘图端点；外环路、莲花路、锦江乐园仅标记在 1 号线上。导入脚本会重新应用此布局，莘庄以南的金山铁路先沿独立竖直段出站，再转向西南。
- 亦庄 T1 增加屈庄至定海园 14 站，荣昌东街与亦庄线共用 ID，用于记录可步行换乘。该线路示意坐标为手工添加。
- 首都机场线不按原始站序推断双向邻接，而是显式维护北新桥—东直门—三元桥双向主干及机场单向回路。示意图参照官方图的并排航站楼、两侧曲线支路及内侧 U 形连接，方向箭头分别沿出城、航站楼间、回城曲线放置。
- 北京八角游乐园、通运门以及亦庄 T1 老观里不在当前可记录站点列表中。前两者所在的运行线路跨过这些不服务站点连接下一运营站。后续开放时应更新快照。
- 国家会展中心（2/17 号线）和浦东南路（2/14 号线）保留供应商的独立站点 ID，没有因为同名自动合并。当前路由只使用数据中的明确换乘关系。
- 深圳 2/8 号线沿用源数据按一条贯通线路统计，6 号线支线保留为独立线路。显示名去掉旧线路别名（如“罗宝线”）。
- 深圳坪山云巴作为独立网络保留，不建模与地铁的步行接驳。当前快照不含龙华有轨电车。
- 深圳大剧院（1/2/5 号线）、广州新市墟（12/14 号线）按源数据明确的换乘关系合并站点 ID。
- 广州 3 号线主线和北延段合并为同一线路，14 号线支线（知识城线）保留为独立线路，11 号线闭合成环。12 号线的两个运营区段归入同一线路，两段端点之间不添加区间。
- 广州 4/12 号线官洲–大学城北–大学城南的共线段连续平行，中间站不将线路收回同一锚点；接入区间使用对应的偏移端点。以后从高德更新时须重新检查这段绘图，保持路由拓扑不变。
- 广州 3 号线石牌桥侧与林和西侧之间经体育西路时，使用 `sameLineTransfers` 计为同线换乘；珠江新城侧至任一支线仍按直达记录。换车说明参照[广州地铁：体育西路换乘指引](https://static.nfnews.com/content/202607/07/c12600225.html)。
- 广州机场南（1 号航站楼）在源数据中标记为不服务，不在可记录站点列表中；3 号线在机场北（T2）与高增之间直连。
- 佛山 3 号线（37 站、36 区间）取自高德佛山数据，在北滘公园、东平、湾华、桂城共用已有换乘站 ID，新增站点坐标手工整理。线路维护在 `src/data/guangzhou.json`，导入时保留；源数据新增该线路或换乘站变化时需核对。
- 广州保留源数据中的 APM 线、广佛线、佛山 2 号线及 7 号线佛山段；不含广州/佛山有轨电车及珠三角城际铁路。
- 杭州 3、6 号线各自合并主支线并去重主干区间。两支线之间分别在西溪湿地南、美院象山计一次同线换车；主干至任一支线不额外计换乘。3 号线换乘参照[浙江科技大学出行指引](https://wgyzsw.zust.edu.cn/info/1207/1201.htm)。
- 绍兴 1 号线主支线合并统计，支线包含黄酒小镇、绍兴一中、湖西、大庆寺、绍兴北站、会展中心；支线至主线两个方向均在黄酒小镇计一次换车，主线经过该站不计换车。开通及换乘说明见[绍兴国资运营公告](https://www.sohu.com/a/908612797_121106832)和[绍兴市政府公交配套公告](https://www.sx.gov.cn/art/2025/6/23/art_1229429798_4225360.html)。
- 绍兴 2 号线在梅山广场接入，绍兴 1 号线在姑娘桥接入杭州 5 号线，杭海城际在临平南高铁站接入 9 号线。跨来源仅对绍兴线路内已核对的同站映射 ID；杭州、绍兴各自的奥体中心保留独立 ID。火车东站与火车东站（东广场）保留源数据的独立 ID，不模拟出站步行换乘。
- 杭州快照不含国铁制式的绍兴城际线及在建线路。杭州 JSON 单独维护，不通过现有高德转换器更新；更新时须同时核对杭州、绍兴两个来源及补充区间的示意坐标。
- 统计按独立站点 ID、线路 ID、区间 ID 去重。数字不对应运营方各线路站数之和。

## 伦敦（2026-10-05）

以 2026 年 9 月版 [TfL Tube map](https://content.tfl.gov.uk/standard-tube-map.pdf) 及用户提供的[大字版](https://content.tfl.gov.uk/large-print-tube-map.pdf)为范围和英文站名依据，包含全部 11 条 Underground、六条具名 Overground、Elizabeth line、DLR、London Trams 和 London Cable Car；不含 Thameslink、普通公交、水上巴士及其他国铁服务。共 21 条线路、464 个站点或站内综合体、616 个按线路区分的区间。站名仅用英文，独立车站增加模式括注以区分。坐标和折线经过示意化调整，不直接复刻原 PDF 图形。

- 共线段保留各线独立记录，绘图连续平行经过中间站，站点符号连接实际绘制端点。包括 Circle/Hammersmith & City/Metropolitan、Circle/District、District/Piccadilly、District/Hammersmith & City、Bakerloo/Lioness、Metropolitan/Piccadilly、District/Mildmay、Mildmay/Windrush，以及 Heathrow 的 Elizabeth/Piccadilly 共线段等。Piccadilly 绘图经过不停车的 District 站点坐标，但不增加停站或路由区间。除这类保持 14 单位间距的平行共线外，线路折线不得穿过不停靠车站的站点符号，不同线路在站间也不应重叠绘制（如 Waterloo & City 与 District、Jubilee 与 DLR Stratford 支线、Elizabeth 与 Central 均分开绘制）；`mapGeometry.test.ts` 会检查伦敦、阿姆斯特丹、里斯本、瓦伦西亚、马拉加和巴黎的这一约束，调整坐标后须重新运行。Circle 在 Paddington–Edgware Road 的南北两种进路分别建模，Hammersmith–市中心绕行–Edgware Road 交路不作为连续环线。
- 站内换乘共用 ID。Bank/Monument、Paddington 相连的 Underground 站台归为站内综合体，因此站点数与 TfL 独立车站计数不同。Hackney Central/Downs 有站内连接通道，合并记录。需出站步行的 Hammersmith、Edgware Road、Bethnal Green、Shepherd’s Bush、West Hampstead、Shadwell、三座 Canary Wharf 和 West Croydon 保留独立站点；Woolwich 与 Woolwich Arsenal 也不合并，不推断步行边。
- Underground 支线换车参照 [TfL 工作时刻表](https://tfl.gov.uk/corporate/publications-and-reports/working-timetables)。Hainault–Woodford 按 [Central WTT 70](https://content.tfl.gov.uk/cen-wtt-70.pdf) 的常规接驳交路处理；目录已列出 WTT 71，但未能获取其详细 PDF，因此不推断高峰限定直通交路。District 的 Olympia–High Street Kensington、Wimbledon–Edgware Road 保留直达。Piccadilly 的 Terminal 4 回路方向为 Hatton Cross → Terminal 4 → Terminals 2 & 3，列车不在 Hatton Cross 折返，从 Terminals 2 & 3 一侧经 Hatton Cross 前往 Terminal 4 计一次换车；Northern 在 Euston 的 Bank 支线与 Charing Cross 支线站台不贯通，Camden Town–Warren Street 直达需经 Mornington Crescent，King’s Cross St Pancras 与 Mornington Crescent、Warren Street 之间在 Euston 换车；Turnham Green 虽仅部分时段停靠，仍纳入拓扑。
- [2026 年 5 月 17 日起的 Overground 时刻表](https://tfl.gov.uk/modes/london-overground/london-overground-timetables)用于核对交路。Windrush 维护 Highbury–Crystal Palace/West Croydon 和 Dalston Junction–Clapham Junction/New Cross 直通路径，Highbury 前往后两条分支需在共线段换车。Mildmay、Weaver 保留各分支。Battersea Park 的少量 Windrush 服务不在 Tube map 范围内。
- [2026 年 5–12 月 Elizabeth line 时刻表](https://content.tfl.gov.uk/elizabeth-line-17-may-12-december-2026.pdf)用于核对 Reading–Abbey Wood，以及 Heathrow T4/T5–Abbey Wood/Shenfield 交路。这些路径合并常规工作日与周末服务，并非所有交路同时运行；Reading–Shenfield 需换车。不将停站差异、短交路或国铁站台服务另建为收藏线路或额外区间。
- [2026 年 3 月 DLR 图](https://content.tfl.gov.uk/dlr-route-map.pdf)用于核对全部 45 站，以及 Bank → Lewisham 方向不停 West India Quay 的单向跨越；返程停靠。交路区分 Bank–Lewisham/Woolwich Arsenal、Tower Gateway–Beckton、Stratford–Lewisham、Stratford International–Beckton/Woolwich Arsenal，共用轨道的不同交路之间计换车。
- Pudding Mill Lane–Stratford 为双向直达 DLR 区间，绘制路径与 Elizabeth line 分开以免被遮挡；与 Stratford International 分支之间仍按实际换车处理。
- Wembley Park–Finchley Road 的 Jubilee 与 Metropolitan 绘图连续平行，包括 Metropolitan 不停靠的 Jubilee 中间站。Metropolitan 的直达区间仍只占一个路由和收藏区间。
- [Tram service map](https://content.tfl.gov.uk/tram-service-map.pdf)提供全部 39 站，[Wimbledon 的 TfL 站点页](https://tfl.gov.uk/tram/stop/940GZZCRWMB/wimbledon-tramlink-stop)用于核对 Beckenham Junction 和 Elmers End 服务。New Addington 服务经过 Croydon 顺时针街道回路，保留第二次经过 East Croydon 时的直通连续性。Reeves Corner 仅向市中心停靠，西行使用 Church Street → Wandle Park。未建模少量早晚 Wimbledon–New Addington 直通班次。
- 缆车的 Royal Docks、Greenwich Peninsula 作为独立运营分量纳入。协议尚无步行接驳类型，因此不通过合并站点制造与 Royal Victoria、North Greenwich 的跨模式路线。

交路描述常规直通乘车关系，不能代替按具体时刻查询的出行规划；不模拟频率、临时停运、站台步行时间及全部特殊交路。伦敦直接维护城市 JSON，更新时应同时核对图版、直通路径、单向区间与站内综合体。

## 阿姆斯特丹（2026-10-05）

范围为运营中的 GVB 地铁网络，共 5 条线路、39 个独立站点、71 个按线路区分的区间；中英文界面均显示荷兰语站名。不含 tram（包括旧 M51 的 Amstelveen 路段及现有 tram 25）、公交、渡轮和 NS 铁路。不添加尚未运营的 Schiphol 延伸或 Isolatorweg–Centraal 闭环连接。

以 [GVB 当前线路目录](https://gvb.nl/reisinformatie/haltes-en-dienstregeling?id=30)、[M50 站序](https://gvb.nl/reisinformatie/lijn/GVB/50)、[M51 站序](https://www.gvb.nl/reisinformatie/lijn/GVB/51)核对交路；2026 年 9 月公布的站点时刻表用于核对 [M52](https://www.gvb.nl/en/travel-information/stop/pdf?direction=Inbound&lineNumber=52&startDate=2026-09-22&stopCode=NL%3AS%3A30009583) 和 [M53](https://www.gvb.nl/en/travel-information/stop/pdf?direction=Outbound&lineNumber=53&startDate=2026-09-29&stopCode=NL%3AS%3A30009542)。GVB 的 [M54 完整站序](https://over.gvb.nl/nieuws/gvb-rijdt-met-metro-52-noord-zuidlijn-en-54-op-nieuwjaarsnacht/)与图版及当前线路范围交叉核对。

| 线路 | 常规终点                                          | 站数 |
| ---- | ------------------------------------------------- | ---- |
| M50  | Isolatorweg–Gein                                  | 20   |
| M51  | Isolatorweg–Centraal Station，经 Zuid、Spaklerweg | 19   |
| M52  | Noord–Zuid                                        | 8    |
| M53  | Centraal Station–Gaasperplas                      | 14   |
| M54  | Centraal Station–Gein                             | 15   |

共站使用统一 ID，各线共用轨道的区间保留独立收藏记录和绘图路径。共线段连续平行经过中间站，站点符号横跨各线，不将每条线路收回站点锚点。M50/M51 共线 Isolatorweg–Overamstel；M51/M53/M54 共线 Centraal Station–Spaklerweg；M53/M54 共线 Spaklerweg–Van der Madeweg；M50/M54 共线 Van der Madeweg–Gein。Overamstel–Spaklerweg 属于 M51，Overamstel–Van der Madeweg 属于 M50。Gein 与 Gaasperplas 两分支之间在 Van der Madeweg 实际换车。M52 只在 Centraal Station、Zuid 接入其他地铁；Europaplein–RAI 需出站步行，不添加虚构铁路区间。

站名保留 GVB 荷兰语形式，如 `Bijlmer ArenA`、`Amstelstation`、`Burg. de Vlugtlaan`。部分站名省略通用的 `Station` 前缀，使地图显示更紧凑，并保留官方带前缀形式作为搜索别名；`Diemen-Zuid` 同时支持搜索 `Diemen Zuid`。线路全称使用 `Metrolijn`，简称为 M50–M54。

可下载的 [GVB Metrokaart（附 2025 夏季施工标记）](https://assets.ctfassets.net/d6yaib7us1l3/30k69FRENe3aHXpQdpfip4/69b57e56535f1454b1ab4d728cee1b76/Metrokaart_2025_-_zomerwerk.pdf)仅辅助核对站名、大致位置与线路颜色，不采用其临时停运或替代运输覆盖层作为运营拓扑。坐标和折线为应用手工编排。[GVB 新编号及交路计划](https://over.gvb.nl/nieuws/nieuwe-lijnnummers-en-kleuren-maken-amsterdamse-metro-overzichtelijker/)从 2028 年时刻表开始实施，不提前纳入本次 2026 快照；夏季施工及其他临时调整也不纳入。阿姆斯特丹直接维护城市 JSON，后续更新应保留已有 ID。

## 里斯本（2026-10-08）

范围为运营中的 Metropolitano de Lisboa 线网，共 4 条线路、50 个独立站点、52 个区间；中英文界面均显示葡萄牙语站名。站序、换乘与排版参照运营方[地图与线网图页](https://www.metrolisboa.pt/viajar/mapas-e-diagramas/)提供的 [2026 年 8 月版线网图](https://www.metrolisboa.pt/wp-content/uploads/2026/08/DiagramaRedeAgosto2026.pdf)。不含 CP 铁路、Fertagus、Transtejo 渡轮、Carris 电车及公交。

| 线路     | 终点                     | 站数 |
| -------- | ------------------------ | ---- |
| Azul     | Reboleira–Santa Apolónia | 18   |
| Amarela  | Odivelas–Rato            | 13   |
| Verde    | Telheiras–Cais do Sodré  | 13   |
| Vermelha | Aeroporto–São Sebastião  | 12   |

Campo Grande、Marquês de Pombal、Baixa-Chiado、Alameda、Saldanha、São Sebastião 各使用统一 ID；没有共轨区间，因此无需平行绘制。Restauradores 与 Rossio、Cais do Sodré 与 Santa Apolónia 保留独立站点，不添加虚构步行接驳。Rato–Cais do Sodré 之间新增 Estrela、Santos 的[环线工程](https://projetos.metrolisboa.pt/expansao/)[预计 2027 年第一季度启用](https://www.timeout.pt/lisboa/pt/noticias/atraso-vai-em-tres-anos-e-tres-meses-mas-metro-aponta-abertura-da-linha-circular-para-inicio-de-2027-040126)，本次不纳入；待运营方公布最终交路后再调整黄、绿两线。线路名使用官方颜色名（如 `Linha Azul`），简称为颜色。坐标沿用线网图的 45° 排版，为应用手工编排。

## 瓦伦西亚（2026-10-08）

范围为 FGV 运营的 Metrovalencia 完整线网，共 10 条线路、144 个独立站点、216 个按线路区分的区间；中英文界面均显示瓦伦西亚语站名。站序、支线交路及单向区间取自 [FGV Metrovalencia GTFS 数据](https://www.metrovalencia.es/google_transit_feed/google_transit.zip)（[Mobility Database](https://mobilitydatabase.org/feeds/gtfs/mdb-2830) 收录的快照，日历自 2026 年 9 月起），并与[官方线网图](https://www.redtransporte.com/img/transporte/valencia/metro-valencia/plano-metro-valencia.pdf)交叉核对站名、换乘与位置。不含 Renfe Cercanías、EMT 公交及规划中的 11、12 号线。

| 线路 | 常规终点                                                         | 站数 | 模式 |
| ---- | ---------------------------------------------------------------- | ---- | ---- |
| L1   | Bétera–Castelló                                                  | 40   | 地铁 |
| L2   | Llíria–Torrent Avinguda                                          | 34   | 地铁 |
| L3   | Rafelbunyol–Aeroport                                             | 27   | 地铁 |
| L4   | Mas del Rosari / Ll. Llarga-Terramelar / Fira València–Dr. Lluch | 33   | 电车 |
| L5   | Marítim–Aeroport                                                 | 18   | 地铁 |
| L6   | Tossal del Rei–Marítim                                           | 21   | 电车 |
| L7   | Marítim–Torrent Avinguda                                         | 16   | 地铁 |
| L8   | Marítim–Neptú                                                    | 4    | 电车 |
| L9   | Alboraia Peris Aragó–Riba-roja de Túria                          | 23   | 地铁 |
| L10  | Alacant–Natzaret                                                 | 8    | 电车 |

- 共轨区间各线保留独立收藏记录和绘图路径，以 14 单位间距连续平行经过中间站，站点符号横跨各线。L1/L2 共线 Empalme–Torrent，L7 自 Jesús 起与之并行至 Torrent Avinguda；L3/L5/L9 共线 Alameda–Roses（L9 往 Riba-roja，L3/L5 往 Aeroport），L3/L9 共线 Alboraia Peris Aragó–Alameda，L5/L7 共线 Marítim–Colón，L4/L6 共线 Trinitat–Beteró 及海滨环路，L6/L8 共线 Marítim–Grau-La Marina。`mapGeometry.test.ts` 检查线路不穿过不停靠站点。
- GTFS 中少量非常规班次不作为线路归属：L1 开往 Torrent Avinguda 的班次、L3 单趟开往 Riba-roja de Túria 的班次、L5 和 L7 经 Facultats 开往 Machado 的班次，以及 L8 早晚绕行海滨环路的班次。L2 部分班次跳停 Font del Barranc 属停站方案差异，不是独立区间。
- L4 西端有三条支线：Mas del Rosari 与 Ll. Llarga-Terramelar 在 À Punt 汇合，Fira València 支线在 Vicent Andrés Estellés 汇入。`sameLineTransfers` 将两站的支线间换车计为换乘，主干至任一支线仍算直达。
- Cabanyal–Malva-rosa 电车环路为单向：La Cadena → Platja Malva-rosa → Platja les Arenes → Dr. Lluch → Cabanyal → La Cadena，L4 以 Dr. Lluch 为终点，经 `sameLineTransfers` 将在该站继续绕行计为换车。L6 开往 Marítim 方向不经 Dr. Lluch（Platja les Arenes → Canyamelar），开往 Tossal del Rei 方向经 Dr. Lluch、Cabanyal；因此 L6 声明两条单向 `services`，Dr. Lluch 前往 Marítim 需在 La Cadena 换乘南行电车。
- L10 为独立运营分量。[Alacant–Xàtiva 步行通道](https://www.elperiodic.com/valencia/nuevo-tunel-subterraneo-metro-conecta-valencia-subsuelo_1029812)于 2025 年 12 月启用，但连接的是两座车站，因此保留各自 ID，不添加虚构铁路区间；Bailén 与 Xàtiva 同理。连通性测试按独立分量断言 L10。
- 站名沿用 FGV 瓦伦西亚语形式，如 `Pl. Espanya`、`Av. del Cid`、`Dr. Lluch`、`Vicent Zaragozà`、`Ll. Llarga-Terramelar`；`Plaza España`、`Doctor Lluch`、`Villanueva de Castellón`、`Aeropuerto` 等西班牙语或展开形式作为搜索别名。站名语言标签为 `ca-ES-valencia`。线路颜色采用 GTFS `route_color`；L5 的数据颜色不可用，取自官方线网图的绿色。

## 马拉加（2026-10-08）

范围为运营中的 Metro de Málaga 线网，共 2 条线路、19 个独立站点、19 个区间；中英文界面均显示西班牙语站名。站序参照[安达卢西亚自治区政府线网概况](https://www.juntadeandalucia.es/organismos/aopja/areas/infraestructuras-ferroviarias/metro-malaga.html)及其[乘坐指南与站点目录](https://www.juntadeandalucia.es/sites/default/files/inline-files/2025/02/GU%C3%8DA%20DE%20USO_Viajar%20en%20Metro%20%28.pdf%29.pdf)；[2023 年 3 月市中心延伸段](https://www.urban-transport-magazine.com/en/metro-malaga-reaches-the-inner-city-centre/)新增 Guadalmedina 和 Atarazanas。1 号线 Andalucía Tech–Atarazanas（13 站），2 号线 Palacio de los Deportes–Guadalmedina（8 站）；两线共线 El Perchel–Guadalmedina 并平行绘制，Atarazanas 仅 1 号线停靠。不建模 María Zambrano 的 Cercanías，`María Zambrano` 作为 El Perchel 的搜索别名。2 号线往 Hilera、La Trinidad、Hospital Civil 的延伸段[仍在施工](https://www.canalsur.es/noticias/andalucia/malaga/moreno-inaugura-la-ampliacion-del-metro-de-malaga-hasta-el-hospital-civil/2180651.html)，不纳入。坐标为应用手工编排。

## 巴黎（2026-10-08）

范围为巴黎地铁（1–14 号线、3bis、7bis）及 RER A–E 全线：21 条线路、541 个独立站点或站内综合体、641 个按线路区分的区间；中英文界面均显示法语站名。不含有轨电车、Transilien、Orlyval、CDGVAL 及公交。15 号线南段（[预计 2027 年秋](https://fr.wikipedia.org/wiki/Ligne_15_du_m%C3%A9tro_de_Paris)）和 [RER E 延伸至 Mantes-la-Jolie](https://www.sortiraparis.com/en/news/in-paris/articles/332366-here-is-the-official-date-for-the-extension-to-mantes-la-jolie-to-enter-service)（2027 年 2 月 28 日起）不纳入。

- 站序、支线与单向区间来自 [Île-de-France Mobilités GTFS 数据](https://data.iledefrance-mobilites.fr/explore/dataset/offre-horaires-tc-gtfs-idfm/)（2026 年 10 月时刻表，地铁线路 `IDFM:C01371`–`C01387`，RER `C01727`–`C01743`）。跳站与半直达交路视为停站变体而非独立区间；仅当没有任何列车停靠中间站时保留直达边：RER A 开往 Cergy、Poissy 的列车由 Nanterre – Préfecture 直达 Houilles – Carrières-sur-Seine，不停 Nanterre – Université，因此该直达边与经 Nanterre – Université 的 Saint-Germain-en-Laye 支线并存。零星交路不计入线路归属：RER E 开往 Vaires – Torcy 的班次不纳入；Massy – Palaiseau – Versailles Chantiers 段在数据中为 Transilien V 线运营，不属于 RER C。
- 线路颜色使用[线路参考数据](https://data.iledefrance-mobilites.fr/explore/dataset/referentiel-des-lignes/)的官方 `colourweb_hexa` 值。
- 站内综合体沿用 GTFS 父站，即 IDFM 的[换乘区（zones de correspondance）](https://data.iledefrance-mobilites.fr/explore/dataset/zones-de-correspondance/)：Nation、Gare de Lyon、La Défense、Denfert-Rochereau、Bibliothèque François Mitterrand、Invalides、Gare d’Austerlitz、Montparnasse – Bienvenüe、Saint-Michel – Notre-Dame（含地铁 Saint-Michel）、Porte Maillot（含 Neuilly – Porte Maillot）均为单一综合体。另按官方图版的站内换乘通道合并：Châtelet 与 Châtelet – Les Halles、Gare du Nord 与 Magenta、Saint-Lazare 与 Haussmann – Saint-Lazare、Opéra 与 Auber、Pereire 与 Pereire – Levallois、Javel – André Citroën 与 Javel、11 号线与 RER E 的 Rosny – Bois-Perrier、Thiais – Orly 与 Pont de Rungis – Aéroport d’Orly；被合并的站名保留为搜索别名。Gare de l’Est、Cluny – La Sorbonne、Solférino / Musée d’Orsay、Bir-Hakeim / Champ de Mars、Alma-Marceau / Pont de l’Alma、Nanterre – Préfecture / Nanterre – La Folie、Saint-Denis / Basilique de Saint-Denis 保持独立，不添加虚构步行区间。Malesherbes 和 Saint-Fargeau 各有地铁与 RER D 两站，ID 不同。
- 支线换车通过 `sameLineTransfers` 表达：Maison Blanche（7）、La Fourche（13）、Botzaris（7bis 环）、10 号线 Auteuil 环、Nanterre – Préfecture、Maisons-Laffitte、Vincennes（A）、Bourg-la-Reine、Aulnay-sous-Bois（B）、Champ de Mars、Viroflay Rive Gauche、Choisy-le-Roi、Brétigny（C）、Villeneuve-Saint-Georges、Viry-Châtillon、Corbeil-Essonnes（D）、Noisy-le-Sec（E）；主线到支线仍为直达。7bis 环（Botzaris → Place des Fêtes → Pré-Saint-Gervais → Danube → Botzaris）与 10 号线环（Javel → Église d’Auteuil → Michel-Ange – Auteuil → Porte d’Auteuil → Boulogne；Boulogne → Michel-Ange – Molitor → Chardon Lagache → Mirabeau → Javel，另含 Porte d’Auteuil → Michel-Ange – Molitor 折返联络线）为单向。
- RER B、D 共线 Gare du Nord – Châtelet – Les Halles，绘图平行分开，站点符号横跨两线；其余线路不共用轨道。
- 坐标为改编的示意几何。城区参照用户提供的 [RATP 官方地铁示意图](https://www.ratp.fr/plan-metro)（2026 年 1 月版，`Plan-Metro.1736413859.pdf`），保留连续的线路走廊，并为换乘综合体的各线保留独立绘制端点，避免汇入平均坐标造成折返。郊区参照[区域线网图](https://eu.ftp.opendatasoft.com/stif/PlansRegion/Plans/REGION_PF_sans_tram.pdf)及站序，以连续的横线、竖线和斜线排布。RER D 的两条 Viry-Châtillon–Corbeil 路径、两种 Melun 进路及 Malesherbes 支线分别绘制，Massy 的 B/C 线路也保留独立端点。`mapGeometry.test.ts` 已将巴黎纳入“线路不穿过不服务站点”的检查，`paris.test.ts` 检查 D 南部路由及站序。调整排版时保留 ID、拓扑、单向区间和 `sameLineTransfers`，不要以综合体平均坐标重新生成走线。

## 更新数据

将新的高德 JSON 下载到本地后运行，转换器按文件内的城市代码只更新传入的城市：

```sh
node scripts/import-amap.mjs /path/to/shanghai.json /path/to/beijing.json
# 在 src/data/*.json 核对并补齐新增站点和线路的英文名、更新日期及来源
pnpm format:city
pnpm test
pnpm build
```

转换器只在开发时使用，不参与客户端运行。更新时核对补充线路、暂停站点、换乘 ID 映射、分段运营和方向规则，并同步修改 `updatedAt`。对已有站点和区间保持 ID 兼容，避免影响用户历史记录。

转换器直接输出“一条记录一行”的统一城市格式；手工修改后运行 `pnpm format:city`。构建与 PR 格式检查会拒绝全文件压缩或完全展开的版本，详见[城市数据格式规则](city-data.zh.md#必须遵循的-json-格式)。

地图数据及名称的权利归原权利人；此目录保留来源与整理说明，不为第三方数据另行授予许可。正式对外发布时按实际使用范围核实供应商使用条款。

## 英文名称与贡献者标识

杭州都市圈于 2026-10-07 补齐 41 个缺失英文站名（杭州 7 个、绍兴 34 个），取自[高德杭州数据](https://map.amap.com/service/subway?srhdata=3301_drw_hangzhou.json)与[高德绍兴数据](https://map.amap.com/service/subway?srhdata=3306_drw_shaoxing.json)的 `multilang.n.en` 字段；旧 `en` 字段为空不代表没有英文名。荆长路的 `jingchang Road` 统一首字母为 `Jingchang Road`，其余补充名称保留来源拼写。当前杭州、绍兴、海宁共 311 个站点均提供英文名，测试检查完整性。

北京、上海、伦敦、巴黎由 MetroListo 应用开发者维护；深圳、广州都市圈由 [Hashmapw](https://github.com/Hashmapw) 贡献。杭州都市圈、阿姆斯特丹、里斯本、瓦伦西亚、马拉加由 [scris](https://github.io/scris) 贡献。

英文站名参照运营方双语线网图，保留其专名、方向缩写和英文括注，不按界面语言重新翻译专名：

- 上海：[上海地铁双语图下载页](https://service.shmetro.com/en/zlxz/index.htm)及[双语线网图](https://service.shmetro.com/skin/map/shmetro-map.jpg)，读取图版为 D202512，包含金山铁路；例如 `Nanjing Rd.(E)`、`Jinshanyuanqu`。
- 北京：[京港地铁官方线网图](https://www.mtr.bj.cn/article/line)，本次读取的[原始双语图](https://cdnwww.mtr.bj.cn/bjmtr/default/mxFXoKAXCCYv61DjKHdzl.jpg)含亦庄 T1；例如 `Qu Zhuang`、`Lujuan Dong (E)`、`3 Hao Hangzhanlou (Terminal 3)`。
- 深圳：[深圳地铁官方双语线网图](https://www.szmc.net/SMARTC/upload/image/20260630/1782803829923076269.png)，包含坪山云巴小图；例如 `Window of the World`、`SUAT`、`Airport (T3)`。
- 广州：[广州地铁官方双语线网图（2026-07-30）](https://cs.gzmtr.com/ckfw/xlu_2020/202607/W020260730790914610429.png)，包含广佛线及佛山 2、3 号线；例如 `Xiaode Dong`、`Luocun`、`Qiandeng Lake`。

伦敦仅提供英文名称，阿姆斯特丹仅提供荷兰语名称，里斯本仅提供葡萄牙语名称，瓦伦西亚仅提供瓦伦西亚语名称，马拉加仅提供西班牙语名称，巴黎仅提供法语名称，均使用现有界面名称回退规则；搜索忽略变音符号，无需另加无重音别名。中国城市的中英文站名统一存放在 `src/data/<city>.json` 的 `names` 列表中（`zh-CN` / `en`），其他名称、来源与贡献者也在同一文件维护。`aliases` 仅用于搜索别名。

高德转换器支持上海、北京、深圳和广州的拓扑与坐标更新，保留已核对的名称、别名、城市元数据和线路顺序。北京、上海新增站点或线路缺少官方英文名时会提示补齐，测试会检查双语完整性。其他城市可直接按统一协议贡献 JSON。

用户贡献城市使用 `attribution: { "kind": "community", "name": "贡献者名称" }`，显示“由〈名称〉贡献”。字段要求见 [城市数据协议](city-data.zh.md)。
