import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import { localisedName } from './i18n';
import { createNetwork, findRoute, isInterchange } from './network';

const city = cities.find((c) => c.id === 'taizhou')!;
const network = createNetwork(city);
const id = (name: string) => city.stations.find((s) => s.names[0].value === name)!.id;
const names = (ids: string[]) => ids.map((s) => network.stationById.get(s)!.names[0].value);

describe('Taizhou suburban railway', () => {
  it('includes Line S1 only, as suburban rail with Pinyin English names', () => {
    expect(city.lines).toHaveLength(1);
    const s1 = city.lines[0];
    expect(s1.kind).toBe('rail');
    expect(localisedName(s1, 'zh-CN')).toBe('S1线');
    expect(localisedName(s1, 'en-GB')).toBe('Line S1');
    expect(s1.shortNames.map((n) => n.value)).toEqual(['S1', 'S1']);
    expect(city.stations).toHaveLength(15);
    expect(city.segments).toHaveLength(14);
    expect(names(s1.stationIds)).toEqual([
      '台州火车站',
      '学院路',
      '国博中心',
      '汇丰路',
      '锦泰',
      '恩泽医院',
      '台州汽车南站',
      '泽国',
      '温岭火车站',
      '汇川王',
      '温岭第一人民医院',
      '九龙大道',
      '万昌路',
      '南屏',
      '城南',
    ]);
    expect(localisedName(city.stations[0], 'en-GB')).toBe('Taizhou Huochezhan');
    for (const station of city.stations) {
      expect(station.names.some((n) => n.language === 'en' && n.value.trim())).toBe(true);
    }
  });

  it('rides end to end without a change and has no interchange', () => {
    const route = findRoute(network, id('台州火车站'), id('城南'), [], 'transfers')!;
    expect(route).not.toBeNull();
    expect(route.transferIds).toEqual([]);
    expect(route.segmentIds).toHaveLength(14);
    expect(city.stations.some((s) => isInterchange(network, s.id))).toBe(false);
  });
});
