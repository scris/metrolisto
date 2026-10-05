import { localisedName } from './i18n';
import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import { createNetwork, findRoute, routeGroups, searchStations } from './network';
import { validateCity } from './validate';
import exampleCity from '../../docs/city.example.json';

const sh = createNetwork(cities[0]),
  bj = createNetwork(cities[1]),
  sz = createNetwork(cities.find((c) => c.id === 'shenzhen')!),
  gz = createNetwork(cities.find((c) => c.id === 'guangzhou')!);
const hz = createNetwork(cities.find((c) => c.id === 'hangzhou')!);
const id = (network: typeof sh, name: string) =>
  network.city.stations.find((s) => localisedName(s, 'zh-CN') === name)!.id;
const route = (network: typeof sh, from: string, to: string, via: string[] = []) =>
  findRoute(
    network,
    id(network, from),
    id(network, to),
    via.map((n) => id(network, n)),
  )!;
const names = (network: typeof sh, stationIds: string[]) =>
  stationIds.map((id) => localisedName(network.stationById.get(id), 'zh-CN'));

describe('complete city networks', () => {
  it('accepts a developer-provided city without built-in city assumptions', () => {
    const city = validateCity(exampleCity);
    const network = createNetwork(city);
    const trip = findRoute(network, 'example-west', 'example-south');
    expect(trip?.stationIds).toEqual(['example-west', 'example-central', 'example-south']);
    expect(trip?.transferIds).toEqual(['example-central']);
  });
  it('includes the requested rail and tram networks, without Beijing suburban rail', () => {
    expect(sh.city.lines).toHaveLength(22);
    expect(sh.city.lines.map((l) => localisedName(l, 'zh-CN'))).toEqual(
      expect.arrayContaining(['机场联络线', '金山铁路', '磁浮线']),
    );
    expect(bj.city.lines).toHaveLength(28);
    expect(bj.city.lines.map((l) => localisedName(l, 'zh-CN'))).toEqual(
      expect.arrayContaining(['亦庄有轨电车T1线', '西郊线', '首都机场线', '大兴机场线']),
    );
    expect(
      bj.city.lines.some((l) => /S2|城市副中心|怀柔|通密/.test(localisedName(l, 'zh-CN'))),
    ).toBe(false);
  });
  it.each(cities)('$zhName: every station is reachable within its operating network', (city) => {
    // SkyShuttle and London's Cable Car have no internal rail interchange.
    const independent =
      city.id === 'shenzhen'
        ? city.lines.find((l) => localisedName(l, 'zh-CN') === '坪山云巴1号线')!.stationIds
        : city.id === 'london'
          ? city.lines.find((l) => l.kind === 'cable-car')!.stationIds
          : [];
    const groups = [city.stations.map((s) => s.id).filter((id) => !independent.includes(id))];
    if (independent.length) groups.push(independent);
    for (const group of groups) {
      for (const reverse of [false, true]) {
        const reached = new Set([group[0]]),
          queue = [group[0]];
        while (queue.length) {
          const s = queue.pop()!;
          for (const edge of city.segments) {
            const next = reverse
              ? edge.to === s
                ? edge.from
                : !edge.oneWay && edge.from === s
                  ? edge.to
                  : null
              : edge.from === s
                ? edge.to
                : !edge.oneWay && edge.to === s
                  ? edge.from
                  : null;
            if (next && !reached.has(next)) {
              reached.add(next);
              queue.push(next);
            }
          }
        }
        expect(reached).toEqual(new Set(group));
      }
    }
  });
  it('does not offer paused or unopened Beijing stations', () => {
    expect(
      bj.city.stations.some((s) =>
        ['通运门', '老观里', '八角游乐园'].includes(localisedName(s, 'zh-CN') ?? ''),
      ),
    ).toBe(false);
  });
  it('supports airport old names and pinyin search', () => {
    expect(localisedName(searchStations(sh, '浦东国际机场')[0], 'zh-CN')).toBe('浦东1号2号航站楼');
    expect(localisedName(searchStations(sh, 'renmin')[0], 'zh-CN')).toBe('人民广场');
  });
  it('rejects dangling edges and duplicate station IDs', () => {
    const invalid = structuredClone(cities[0]);
    invalid.segments[0].to = 'unknown';
    expect(() => validateCity(invalid)).toThrow();
    const duplicate = structuredClone(cities[0]);
    duplicate.stations.push(duplicate.stations[0]);
    expect(() => validateCity(duplicate)).toThrow();
  });
});

describe('Hangzhou, Shaoxing and Haining topology', () => {
  it('includes all three networks and credits scris', () => {
    expect(hz.city.attribution).toEqual({ kind: 'community', name: 'scris' });
    expect(hz.city.lines).toHaveLength(15);
    expect(hz.city.stations).toHaveLength(311);
    expect(hz.city.segments).toHaveLength(347);
    expect(names(hz, route(hz, '双桥', '衙前').transferIds)).toEqual(['姑娘桥']);
    expect(names(hz, route(hz, '南苑', '浙大国际校区').transferIds)).toEqual(['临平南高铁站']);
    expect(names(hz, route(hz, '凤林', '檀渎').transferIds)).toEqual(['梅山广场']);
    expect(hz.city.stations.filter((s) => localisedName(s, 'zh-CN') === '奥体中心')).toHaveLength(
      2,
    );
  });
  it.each([
    ['3号线', '洪园', '西溪湿地南', '留下', '花坞', 38],
    ['6号线', '音乐学院', '美院象山', '霞鸣街', '枫桦西路', 36],
  ])(
    'deduplicates %s branches and counts changes between the two arms',
    (line, a, junction, b, trunk, count) => {
      const lineId = `hangzhou-${line}`;
      const branchNetwork = createNetwork({
        ...hz.city,
        segments: hz.city.segments.filter((s) => s.lineId === lineId),
      });
      expect(hz.lineById.get(lineId)!.stationIds).toHaveLength(count);
      expect(branchNetwork.city.segments).toHaveLength(count - 1);
      for (const [from, to] of [
        [a, b],
        [b, a],
      ]) {
        const trip = route(branchNetwork, from, to);
        expect(names(hz, trip.stationIds)).toEqual([from, junction, to]);
        expect(names(hz, trip.transferIds)).toEqual([junction]);
        expect(routeGroups(trip, hz.city)).toHaveLength(2);
      }
      for (const arm of [a, b]) {
        expect(route(branchNetwork, trunk, arm).transferIds).toHaveLength(0);
        expect(route(branchNetwork, arm, trunk).transferIds).toHaveLength(0);
      }
    },
  );
  it('requires a change between the Shaoxing shuttle branch and either main-line direction', () => {
    const lineId = 'hangzhou-绍兴1号线';
    expect(hz.lineById.get(lineId)!.stationIds).toHaveLength(33);
    expect(hz.city.segments.filter((s) => s.lineId === lineId)).toHaveLength(32);
    expect(names(hz, route(hz, '会展中心', '黄酒小镇').stationIds)).toEqual([
      '会展中心',
      '绍兴北站',
      '大庆寺',
      '湖西',
      '绍兴一中',
      '黄酒小镇',
    ]);
    for (const main of ['镜水路', '张墅']) {
      for (const [from, to] of [
        ['会展中心', main],
        [main, '会展中心'],
      ]) {
        const trip = route(hz, from, to);
        expect(names(hz, trip.transferIds)).toEqual(['黄酒小镇']);
        expect(new Set(trip.lineIds)).toEqual(new Set([lineId]));
        expect(routeGroups(trip, hz.city)).toHaveLength(2);
      }
    }
    expect(route(hz, '镜水路', '张墅').transferIds).toHaveLength(0);
    expect(route(hz, '绍兴北站', '黄酒小镇').transferIds).toHaveLength(0);
  });
});

describe('Shenzhen and Guangzhou topology', () => {
  it('keeps Shenzhen lines 2/8 through-running and line 6 branch separate', () => {
    const coastal = route(sz, '莲塘', '溪涌');
    expect(new Set(coastal.lineIds)).toEqual(new Set(['shenzhen-2号线/8号线']));
    expect(coastal.transferIds).toHaveLength(0);
    const branch = route(sz, '凤凰城', '深理工');
    expect(names(sz, branch.transferIds)).toEqual(['光明']);
    expect(new Set(branch.lineIds)).toEqual(new Set(['shenzhen-6号线', 'shenzhen-6号线支线']));
  });
  it('connects the explicit interchanges despite differing source station IDs', () => {
    expect(sz.city.stations.filter((s) => localisedName(s, 'zh-CN') === '大剧院')).toHaveLength(1);
    expect(names(sz, route(sz, '东门', '国贸').transferIds)).toEqual(['大剧院']);
    expect(gz.city.stations.filter((s) => localisedName(s, 'zh-CN') === '新市墟')).toHaveLength(1);
    expect(names(gz, route(gz, '棠涌', '云霄路').transferIds)).toEqual(['新市墟']);
  });
  it('routes within Pingshan SkyShuttle without inventing a metro transfer', () => {
    const trip = route(sz, '比亚迪北', '坪山高铁站');
    expect(trip.segmentIds).toHaveLength(10);
    expect(trip.transferIds).toHaveLength(0);
    expect(findRoute(sz, id(sz, '比亚迪北'), id(sz, '坪山'))).toBeNull();
    expect(findRoute(sz, id(sz, '坪山'), id(sz, '比亚迪北'))).toBeNull();
  });
  it('joins Guangzhou line 3 branches only through Tiyu Xilu and skips closed stops', () => {
    const line3 = createNetwork({
      ...gz.city,
      segments: gz.city.segments.filter((s) => s.lineId === 'guangzhou-3号线'),
    });
    const trip = route(line3, '天河客运站', '机场北(T2)');
    expect(names(line3, trip.stationIds)).toContain('体育西路');
    expect(names(line3, trip.transferIds)).toEqual(['体育西路']);
    expect(gz.city.stations.some((s) => localisedName(s, 'zh-CN') === '机场南(1号航站楼)')).toBe(
      false,
    );
    expect(names(gz, route(gz, '高增', '机场北(T2)').stationIds)).toEqual(['高增', '机场北(T2)']);
  });
  it.each([
    ['石牌桥', '林和西', ['体育西路']],
    ['珠江新城', '林和西', []],
    ['珠江新城', '石牌桥', []],
  ] as const)('counts Guangzhou line 3 train changes from %s to %s', (from, to, transfers) => {
    for (const [start, end] of [
      [from, to],
      [to, from],
    ]) {
      const trip = route(gz, start, end);
      expect(names(gz, trip.stationIds)).toEqual([start, '体育西路', end]);
      expect(names(gz, trip.transferIds)).toEqual(transfers);
      const groups = routeGroups(trip, gz.city);
      expect(groups).toHaveLength(transfers.length + 1);
      expect(groups.every((group) => group.lineId === 'guangzhou-3号线')).toBe(true);
    }
  });
  it('closes Guangzhou line 11 and connects the Foshan networks', () => {
    expect(route(gz, '大塘', '龙潭').lineIds).toEqual(['guangzhou-11号线']);
    expect(route(gz, '龙潭', '大塘').segmentIds).toHaveLength(1);
    expect(names(gz, route(gz, '石壁', '南庄').transferIds)).toContain('广州南站');
    expect(route(gz, '西塱', '祖庙').lineIds.every((id) => id === 'guangzhou-广佛线')).toBe(true);
  });
  it('includes the complete Foshan line 3 independently of Guangzhou line 3', () => {
    const trip = route(gz, '顺德学院站', '佛山大学');
    expect(trip.stationIds).toHaveLength(37);
    expect(trip.segmentIds).toHaveLength(36);
    expect(new Set(trip.lineIds)).toEqual(new Set(['guangzhou-佛山3号线']));
    expect(trip.transferIds).toHaveLength(0);
    expect(gz.lineById.has('guangzhou-3号线')).toBe(true);
  });
  it.each([
    ['镇安', '桂城', '朝安'],
    ['大墩', '东平', '世纪莲'],
    ['亚艺公园', '湾华', '石梁'],
    ['广教', '北滘公园', '美的'],
  ])('connects Foshan line 3 from %s via %s to %s', (from, interchange, to) => {
    expect(gz.city.stations.filter((s) => localisedName(s, 'zh-CN') === interchange)).toHaveLength(
      1,
    );
    for (const [start, end] of [
      [from, to],
      [to, from],
    ]) {
      const trip = route(gz, start, end);
      expect(names(gz, trip.stationIds)).toEqual([start, interchange, end]);
      expect(names(gz, trip.transferIds)).toEqual([interchange]);
    }
  });
  it('does not connect the two separate sections of Guangzhou line 12 directly', () => {
    const line12 = createNetwork({
      ...gz.city,
      segments: gz.city.segments.filter((s) => s.lineId === 'guangzhou-12号线'),
    });
    expect(findRoute(line12, id(gz, '广州体育馆'), id(gz, '二沙岛'))).toBeNull();
    expect(route(gz, '广州体育馆', '二沙岛').transferIds.length).toBeGreaterThan(0);
  });
  it.each([sz, gz])('$city.zhName: supports pinyin station search', (network) => {
    const name = network === sz ? '深圳北站' : '广州南站';
    const query = network === sz ? 'ShenZhen BeiZhan' : 'GuangZhou NanZhan';
    expect(searchStations(network, query).map((s) => localisedName(s, 'zh-CN'))).toContain(name);
  });
});

describe('route finding', () => {
  it('uses the single Dahongmen interchange between lines 8 and 10', () => {
    expect(
      searchStations(bj, '大红门').filter((s) => localisedName(s, 'zh-CN') === '大红门'),
    ).toHaveLength(1);
    const r = route(bj, '大红门南', '石榴庄');
    expect(names(bj, r.stationIds)).toEqual(['大红门南', '大红门', '石榴庄']);
    expect(names(bj, r.transferIds)).toEqual(['大红门']);
    expect(
      bj.stationLines
        .get(id(bj, '大红门'))
        ?.map((l) => localisedName(l, 'zh-CN'))
        .sort(),
    ).toEqual(['10号线', '8号线']);
  });
  it.each(['balanced', 'transfers'] as const)(
    'counts branch changes with %s routing, without U-turn shortcuts',
    (preference) => {
      for (const [from, to] of [
        ['上海动物园', '龙柏新村'],
        ['龙柏新村', '上海动物园'],
      ]) {
        const r = findRoute(sh, id(sh, from), id(sh, to), [], preference)!;
        expect(names(sh, r.stationIds)).toEqual([from, '龙溪路', to]);
        expect(names(sh, r.transferIds)).toEqual(['龙溪路']);
        expect(routeGroups(r, sh.city)).toHaveLength(2);
        expect(new Set(r.lineIds).size).toBe(1);
      }
    },
  );
  it('accepts a branch interchange as an explicit waypoint but keeps through trains direct', () => {
    expect(searchStations(sh, '龙溪路', true)).toHaveLength(1);
    expect(names(sh, route(sh, '上海动物园', '龙柏新村', ['龙溪路']).transferIds)).toEqual([
      '龙溪路',
    ]);
    expect(route(sh, '上海动物园', '水城路').transferIds).toEqual([]);
    expect(route(sh, '龙柏新村', '水城路').transferIds).toEqual([]);
  });

  it('includes all intermediate stations of a direct trip', () => {
    const r = route(sh, '人民广场', '陆家嘴');
    expect(names(sh, r.stationIds)).toEqual(['人民广场', '南京东路', '陆家嘴']);
    expect(r.segmentIds).toHaveLength(2);
    expect(r.transferIds).toHaveLength(0);
  });
  it('handles line 5 branches without a nonexistent shortcut', () => {
    const r = route(sh, '闵行开发区', '奉贤新城');
    expect(names(sh, r.stationIds)).toContain('东川路');
    expect(r.lineIds.every((l) => l === 'shanghai-5号线')).toBe(true);
    expect(names(sh, r.transferIds)).toEqual(['东川路']);
  });
  it('counts changes between line 11 branches without splitting through services', () => {
    expect(names(sh, route(sh, '白银路', '上海赛车场').transferIds)).toEqual(['嘉定新城']);
    expect(route(sh, '白银路', '马陆').transferIds).toEqual([]);
    expect(route(sh, '上海赛车场', '马陆').transferIds).toEqual([]);
    expect(route(sh, '莘庄', '金平路').transferIds).toEqual([]);
    expect(route(sh, '莘庄', '江川路').transferIds).toEqual([]);
  });
  it('connects the ends of ring lines', () => {
    const r = route(bj, '巴沟', '火器营');
    expect(r.segmentIds).toHaveLength(1);
    expect(r.lineIds).toEqual(['beijing-10号线']);
    expect(route(sh, '宜山路', '上海体育馆').segmentIds).toHaveLength(1);
  });
  it('respects the capital airport one-way terminal loop', () => {
    expect(names(bj, route(bj, '三元桥', '2号航站楼').stationIds)).toEqual([
      '三元桥',
      '3号航站楼',
      '2号航站楼',
    ]);
    expect(names(bj, route(bj, '2号航站楼', '三元桥').stationIds)).toEqual(['2号航站楼', '三元桥']);
    expect(names(bj, route(bj, '2号航站楼', '3号航站楼').stationIds)).toEqual([
      '2号航站楼',
      '三元桥',
      '3号航站楼',
    ]);
  });
  it('requires an actual line change at an optional transfer station', () => {
    const r = route(sh, '徐家汇', '陆家嘴', ['人民广场']);
    expect(names(sh, r.transferIds)).toContain('人民广场');
    const i = r.stationIds.indexOf(id(sh, '人民广场'));
    expect(r.lineIds[i - 1]).not.toBe(r.lineIds[i]);
  });
  it('honors ordered multiple transfer stations', () => {
    const r = route(sh, '徐家汇', '五角场', ['人民广场', '南京东路']);
    const transferNames = names(sh, r.transferIds);
    expect(transferNames.indexOf('人民广场')).toBeLessThan(transferNames.indexOf('南京东路'));
  });
  it('rejects same endpoints, duplicate or invalid waypoints', () => {
    expect(findRoute(sh, id(sh, '人民广场'), id(sh, '人民广场'))).toBeNull();
    expect(findRoute(sh, 'missing', id(sh, '人民广场'))).toBeNull();
    expect(
      findRoute(sh, id(sh, '徐家汇'), id(sh, '陆家嘴'), [id(sh, '人民广场'), id(sh, '人民广场')]),
    ).toBeNull();
    expect(findRoute(sh, id(sh, '徐家汇'), id(sh, '陆家嘴'), [id(sh, '衡山路')])).toBeNull();
  });
  it('routes to the supplemental rail and tram networks', () => {
    expect(route(sh, '人民广场', '金山卫').lineIds).toContain('shanghai-金山铁路');
    expect(route(bj, '宋家庄', '屈庄').lineIds).toContain('beijing-亦庄有轨电车T1线');
    expect(route(sh, '虹桥2号航站楼', '浦东1号2号航站楼').lineIds).toContain('shanghai-市域机场线');
  });
});
