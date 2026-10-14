import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import { localisedName } from './i18n';
import { stationSpans } from './mapGeometry';
import { createNetwork, findRoute, isInterchange, routeGroups, searchStations } from './network';

const city = cities.find((c) => c.id === 'suzhou')!;
const network = createNetwork(city);
const id = (name: string) => city.stations.find((s) => s.names[0].value === name)!.id;
const names = (ids: string[]) => ids.map((s) => network.stationById.get(s)!.names[0].value);
const line = (lineId: string) => city.lines.find((l) => l.id === lineId)!;
const trip = (from: string, to: string) => {
  const route = findRoute(network, id(from), id(to), [], 'transfers');
  expect(route).not.toBeNull();
  return route!;
};

describe('Suzhou Rail Transit', () => {
  it('includes eight metro lines with Chinese and English names on every station and line', () => {
    expect(city.lines.map((l) => l.shortNames[0].value)).toEqual([
      '1',
      '2',
      '3/11',
      '4',
      '5',
      '6',
      '7',
      '8',
    ]);
    expect(city.stations).toHaveLength(235);
    expect(city.segments).toHaveLength(266);
    expect(city.lines.every((l) => l.kind === 'metro')).toBe(true);
    for (const station of city.stations) {
      expect(station.names.some((n) => n.language === 'zh-CN' && n.value.trim())).toBe(true);
      expect(station.names.some((n) => n.language === 'en' && n.value.trim())).toBe(true);
    }
    for (const l of city.lines) {
      expect(localisedName(l, 'en-GB')).toMatch(/^Line \d+(\/\d+)?$/);
      expect(localisedName(l, 'zh-CN')).toMatch(/^\d+号线(\/\d+号线)?$/);
    }
  });

  it('runs Lines 3 and 11 through Weiting as one line without a change', () => {
    const through = line('suzhou-3号线/11号线');
    expect(localisedName(through, 'zh-CN')).toBe('3号线/11号线');
    expect(localisedName(through, 'en-GB')).toBe('Line 3/11');
    expect(through.stationIds).toHaveLength(64);
    expect(names([through.stationIds[0], through.stationIds.at(-1)!])).toEqual([
      '苏州新区火车站',
      '花桥',
    ]);
    const weiting = city.stations.filter((s) => /^唯亭/.test(localisedName(s, 'zh-CN')));
    expect(weiting).toHaveLength(1);
    expect(weiting[0].id).toBe('900000039926038');
    expect(localisedName(weiting[0], 'en-GB')).toBe('Weiting');
    expect(network.stationLines.get(weiting[0].id)!.map((l) => l.id)).toEqual([
      'suzhou-3号线/11号线',
    ]);
    expect(isInterchange(network, weiting[0].id)).toBe(false);
    expect(names(searchStations(network, '唯亭(花桥)').map((s) => s.id))).toEqual(['唯亭']);
    const route = trip('苏州新区火车站', '花桥');
    expect(route.transferIds).toEqual([]);
    expect(route.segmentIds).toHaveLength(63);
    expect(routeGroups(route, city).map((g) => g.lineId)).toEqual(['suzhou-3号线/11号线']);
    expect(trip('苏州园区火车站', '花桥').transferIds).toEqual([]);
  });

  it('keeps the former Line 4 branch on Line 7', () => {
    expect(names(line('suzhou-7号线').stationIds).slice(-8)).toEqual([
      '红庄',
      '蠡墅',
      '石湖莫舍',
      '越溪',
      '文溪路',
      '天鹅荡路',
      '苏州湾北',
      '木里',
    ]);
    const l4 = line('suzhou-4号线');
    expect(l4.stationIds).not.toContain(id('木里'));
    expect(names([l4.stationIds[0], l4.stationIds.at(-1)!])).toEqual(['龙道浜', '同里']);
  });

  it('draws Line 8 and the Line 6 city-centre section with straight approaches', () => {
    const l8 = line('suzhou-8号线');
    for (const edge of city.segments.filter((e) => e.lineId === l8.id)) {
      edge.points!.slice(1).forEach((p, i) => {
        const [dx, dy] = [p[0] - edge.points![i][0], p[1] - edge.points![i][1]];
        expect(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy), edge.id).toBe(true);
      });
    }
    expect(
      new Set(
        ['华池浜', '时代广场', '苏州当代美术馆', '琼姬墩'].map(
          (n) => city.stations.find((s) => s.names[0].value === n)!.x,
        ),
      ),
    ).toEqual(new Set([id('苏州园区火车站')].map((s) => network.stationById.get(s)!.x)));
    expect(
      new Set(
        ['梅巷', '拙政园苏博', '悬桥巷', '临顿路'].map(
          (n) => city.stations.find((s) => s.names[0].value === n)!.x,
        ),
      ).size,
    ).toBe(1);
    // Line 8 runs on a parallel lane 14 units north of Line 3 through Tangzhuang and Suzhou
    // Yuanqu Railway Station; every other drawing endpoint sits on its station anchor.
    const lane = new Map([
      [id('唐庄'), -14],
      [id('苏州园区火车站'), -14],
      [id('琼姬墩'), 14],
    ]);
    for (const edge of city.segments) {
      for (const [station, point] of [
        [edge.from, edge.points![0]],
        [edge.to, edge.points!.at(-1)!],
      ] as const) {
        const s = network.stationById.get(station)!;
        if (edge.lineId === l8.id && lane.has(station))
          expect(point).toEqual([s.x, s.y + lane.get(station)!]);
        else expect(point).toEqual([s.x, s.y]);
      }
    }
    const l6 = line('suzhou-6号线');
    const east = ['苏州奥体中心', '儿童医院总院', '涵青桥', '金家堰', '北斜步'].map(id);
    expect(new Set(east.map((s) => network.stationById.get(s)!.x)).size).toBe(1);
    const diagonal = city.segments.find((e) => e.lineId === l6.id && e.to === id('金尚路'))!;
    const [p, q] = [diagonal.points![0], diagonal.points!.at(-1)!];
    expect(q[0] - p[0]).toBe(q[1] - p[1]);
    for (const name of ['唐庄', '苏州园区火车站', '琼姬墩']) {
      expect(stationSpans(city).get(id(name))?.length).toBeCloseTo(14, 1);
    }
    const south = ['斜塘', '莲池桥', '仁爱路', '松涛街', '裕新路', '车坊'].map(id);
    expect(new Set(south.map((s) => network.stationById.get(s)!.x)).size).toBe(1);
    const northWest = [
      '苏州新区火车站',
      '保丰',
      '富强',
      '长泾',
      '白洋湾公园',
      '金鸡墩',
      '虎丘',
      '青山桥浜',
    ];
    const [first, ...rest] = northWest.map((n) => network.stationById.get(id(n))!);
    const last = rest.at(-1)!;
    for (const s of rest) {
      const cross = (s.x - first.x) * (last.y - first.y) - (s.y - first.y) * (last.x - first.x);
      expect(Math.abs(cross) / Math.hypot(last.x - first.x, last.y - first.y)).toBeLessThan(1.5);
    }
    const shizishan = network.stationById.get(id('狮子山'))!;
    for (const name of ['玉山路', '塔园路']) {
      const s = network.stationById.get(id(name))!;
      expect(Math.abs(s.x - shizishan.x)).toBe(Math.abs(s.y - shizishan.y));
    }
  });

  it('searches English and Pinyin names', () => {
    expect(names(searchStations(network, 'suzhou railway station').map((s) => s.id))).toEqual([
      '苏州火车站',
    ]);
    expect(names(searchStations(network, 'leqiao').map((s) => s.id))).toEqual(['乐桥']);
  });
});
