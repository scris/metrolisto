import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import { mapRivers } from '../data/rivers';
import type { Point } from '../types';

function sampleCurve(points: Point[]): Point[] {
  const sampled = [points[0]];
  for (let i = 1; i < points.length; i += 3) {
    const [a, b, c, d] = points.slice(i - 1, i + 3);
    for (let n = 1; n <= 100; n++) {
      const t = n / 100,
        u = 1 - t;
      sampled.push(
        [0, 1].map(
          (j) => u ** 3 * a[j] + 3 * u * u * t * b[j] + 3 * u * t * t * c[j] + t ** 3 * d[j],
        ) as Point,
      );
    }
  }
  return sampled;
}

const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const intersects = (a: Point, b: Point, c: Point, d: Point) =>
  cross(a, b, c) * cross(a, b, d) <= 0 &&
  cross(c, d, a) * cross(c, d, b) <= 0 &&
  [0, 1].every(
    (j) =>
      Math.max(a[j], b[j]) >= Math.min(c[j], d[j]) && Math.max(c[j], d[j]) >= Math.min(a[j], b[j]),
  );
const section = (line: string, from: string, to: string) =>
  `${line}: ${[from, to].sort().join(' / ')}`;

// Real river crossings, independent of the schematic drawing control points.
const crossings: Record<string, string[][]> = {
  shanghai: [
    ['2号线', '南京东路', '陆家嘴'],
    ['4号线', '杨树浦路', '浦东大道'],
    ['4号线', '南浦大桥', '塘桥'],
    ['5号线', '江川路', '西渡'],
    ['7号线', '龙华中路', '后滩'],
    ['8号线', '西藏南路', '中华艺术宫'],
    ['9号线', '小南门', '商城路'],
    ['10号线', '国帆路', '双江路'],
    ['11号线', '龙耀路', '东方体育中心'],
    ['12号线', '复兴岛', '东陆路'],
    ['13号线', '世博会博物馆', '世博大道'],
    ['14号线', '豫园', '陆家嘴'],
    ['18号线', '丹阳路', '昌邑路'],
    ['机场联络线', '景洪路', '三林南'],
    ['金山铁路', '车墩', '叶榭'],
  ],
  hangzhou: [
    ['1号线', '近江', '江陵路'],
    ['1号线', '下沙江滨', '杭州大会展中心'],
    ['2号线', '钱江路', '钱江世纪城'],
    ['4号线', '水澄桥', '联庄'],
    ['5号线', '南星桥', '长河'],
    ['6号线', '三堡', '亚运村'],
    ['6号线', '之江文化中心', '西浦路'],
    ['7号线', '市民中心', '奥体中心'],
    ['8号线', '工商大学云滨', '桥头堡'],
    ['19号线', '御道', '平澜路'],
  ],
  london: [
    ['Bakerloo', 'Embankment', 'Waterloo'],
    ['District', 'Gunnersbury', 'Kew Gardens'],
    ['District', 'Putney Bridge', 'East Putney'],
    ['Jubilee', 'Westminster', 'Waterloo'],
    ['Jubilee', 'Canada Water', 'Canary Wharf (Jubilee)'],
    ['Jubilee', 'Canary Wharf (Jubilee)', 'North Greenwich'],
    ['Jubilee', 'North Greenwich', 'Canning Town'],
    ['Northern', 'Bank / Monument', 'London Bridge'],
    ['Northern', 'Embankment', 'Waterloo'],
    ['Victoria', 'Pimlico', 'Vauxhall'],
    ['Waterloo & City', 'Waterloo', 'Bank / Monument'],
    ['Elizabeth', 'Custom House', 'Woolwich'],
    ['Mildmay', 'Kew Gardens', 'Gunnersbury'],
    ['Mildmay', 'Clapham Junction', 'Imperial Wharf'],
    ['Windrush', 'Wapping', 'Rotherhithe'],
    ['Docklands Light Railway', 'King George V', 'Woolwich Arsenal'],
    ['Docklands Light Railway', 'Island Gardens', 'Cutty Sark for Maritime Greenwich'],
    ['London Cable Car', 'Royal Docks', 'Greenwich Peninsula'],
  ],
};

describe('schematic river banks', () => {
  it.each(Object.keys(crossings))('%s crosses only the actual cross-river sections', (id) => {
    const city = cities.find((c) => c.id === id)!;
    const river = mapRivers[id]!;
    const stations = new Map(city.stations.map((s) => [s.id, s]));
    const riverPath = sampleCurve(river.points);
    const actual = city.segments.flatMap((edge) => {
      const from = stations.get(edge.from)!,
        to = stations.get(edge.to)!;
      const points = edge.points ?? [
        [from.x, from.y],
        [to.x, to.y],
      ];
      const path = edge.curve === 'cubic' ? sampleCurve(points) : points;
      return path
        .slice(1)
        .some((b, j) => riverPath.slice(1).some((d, i) => intersects(path[j], b, riverPath[i], d)))
        ? [
            section(
              city.lines.find((l) => l.id === edge.lineId)!.names[0].value,
              from.names[0].value,
              to.names[0].value,
            ),
          ]
        : [];
    });
    expect(actual.sort()).toEqual(crossings[id].map(([line, a, b]) => section(line, a, b)).sort());

    // Keep the full water stroke clear of every station marker, not just its centre.
    for (const s of city.stations) {
      const distance = Math.min(
        ...riverPath.slice(1).map((b, i) => {
          const a = riverPath[i],
            dx = b[0] - a[0],
            dy = b[1] - a[1];
          const t = Math.max(
            0,
            Math.min(1, ((s.x - a[0]) * dx + (s.y - a[1]) * dy) / (dx * dx + dy * dy || 1)),
          );
          return Math.hypot(s.x - a[0] - t * dx, s.y - a[1] - t * dy);
        }),
      );
      expect(distance, s.names[0].value).toBeGreaterThan(river.width / 2 + 6);
    }
  });

  it('keeps Wujiaochang and the Yangpu stations west of the Huangpu', () => {
    const city = cities.find((c) => c.id === 'shanghai')!;
    const river = sampleCurve(mapRivers.shanghai!.points);
    for (const name of ['五角场', '国权路', '新江湾城', '市光路', '嫩江路', '复兴岛']) {
      const s = city.stations.find((s) => s.names[0].value === name)!;
      const crossings = river.slice(1).flatMap((b, i) => {
        const a = river[i];
        if (s.y < Math.min(a[1], b[1]) || s.y >= Math.max(a[1], b[1])) return [];
        return [a[0] + ((b[0] - a[0]) * (s.y - a[1])) / (b[1] - a[1])];
      });
      expect(crossings).toHaveLength(1);
      expect(crossings[0], name).toBeGreaterThan(s.x);
    }
  });

  it('keeps the Jinshan reach straight with Chedun north and Yexie south', () => {
    const city = cities.find((c) => c.id === 'shanghai')!;
    const river = mapRivers.shanghai!.points;
    const upstream = river.findIndex(([x, y], i) => i % 3 === 0 && x === 1100 && y === 2225);
    expect(upstream).toBeGreaterThan(0);
    expect(river.slice(upstream).every(([, y]) => y === 2225)).toBe(true);
    const station = (name: string) => city.stations.find((s) => s.names[0].value === name)!;
    expect(station('车墩').y).toBeLessThan(2225);
    for (const name of ['叶榭', '亭林', '金山园区', '金山卫'])
      expect(station(name).y).toBeGreaterThan(2225);
  });
});
