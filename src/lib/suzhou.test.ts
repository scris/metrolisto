import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import { localisedName } from './i18n';
import { createNetwork, findRoute, routeGroups, searchStations } from './network';

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
  it('includes nine metro lines with Chinese and English names on every station and line', () => {
    expect(city.lines.map((l) => l.shortNames[0].value)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '11',
    ]);
    expect(city.stations).toHaveLength(235);
    expect(city.segments).toHaveLength(266);
    expect(city.lines.every((l) => l.kind === 'metro')).toBe(true);
    for (const station of city.stations) {
      expect(station.names.some((n) => n.language === 'zh-CN' && n.value.trim())).toBe(true);
      expect(station.names.some((n) => n.language === 'en' && n.value.trim())).toBe(true);
    }
    for (const l of city.lines) {
      expect(localisedName(l, 'en-GB')).toMatch(/^Line \d+$/);
      expect(localisedName(l, 'zh-CN')).toMatch(/^\d+号线$/);
    }
  });

  it('keeps Weiting as one interchange between Lines 3 and 11', () => {
    const weiting = city.stations.filter((s) => /^唯亭/.test(localisedName(s, 'zh-CN')));
    expect(weiting).toHaveLength(1);
    expect(weiting[0].id).toBe('900000039926038');
    expect(localisedName(weiting[0], 'en-GB')).toBe('Weiting');
    expect(
      network.stationLines
        .get(weiting[0].id)!
        .map((l) => l.id)
        .sort(),
    ).toEqual(['suzhou-11号线', 'suzhou-3号线']);
    expect(names(searchStations(network, '唯亭(花桥)').map((s) => s.id))).toEqual(['唯亭']);
    const route = trip('苏州园区火车站', '花桥');
    expect(names(route.transferIds)).toEqual(['唯亭']);
    expect(routeGroups(route, city).map((g) => g.lineId)).toEqual([
      'suzhou-3号线',
      'suzhou-11号线',
    ]);
  });

  it('keeps the former Line 4 branch on Line 7 and the Line 11 termini', () => {
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
    const l11 = line('suzhou-11号线');
    expect(l11.stationIds).toHaveLength(28);
    expect(names([l11.stationIds[0], l11.stationIds.at(-1)!])).toEqual(['唯亭', '花桥']);
    expect(trip('唯亭', '花桥').segmentIds).toHaveLength(27);
  });

  it('searches English and Pinyin names', () => {
    expect(names(searchStations(network, 'suzhou railway station').map((s) => s.id))).toEqual([
      '苏州火车站',
    ]);
    expect(names(searchStations(network, 'leqiao').map((s) => s.id))).toEqual(['乐桥']);
  });
});
