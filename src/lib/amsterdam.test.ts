import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import { localisedName } from './i18n';
import { stationSpans } from './mapGeometry';
import { createNetwork, findRoute, routeGroups, searchStations } from './network';
import { emptyData, getProgress, validateBackup } from './storage';

const city = cities.find((c) => c.id === 'amsterdam')!;
const network = createNetwork(city);
const id = (name: string) => city.stations.find((s) => s.names[0].value === name)!.id;
const names = (ids: string[]) => ids.map((s) => network.stationById.get(s)!.names[0].value);
const trip = (from: string, to: string, via: string[] = []) => {
  const route = findRoute(network, id(from), id(to), via.map(id), 'transfers');
  expect(route).not.toBeNull();
  return route!;
};

describe('Amsterdam metro', () => {
  it('includes the five current GVB metro lines and Dutch-only station names', () => {
    expect(city.lines.map((l) => l.shortNames[0].value)).toEqual([
      'M50',
      'M51',
      'M52',
      'M53',
      'M54',
    ]);
    expect(city.stations).toHaveLength(39);
    expect(city.segments).toHaveLength(71);
    expect(city.lines.every((l) => l.kind === 'metro')).toBe(true);
    expect(city.stations.some((s) => /Westwijk|Schiphol|Uithoorn/.test(s.names[0].value))).toBe(
      false,
    );
    for (const station of city.stations) {
      expect(station.names).toEqual([{ language: 'nl', value: station.names[0].value }]);
      expect(localisedName(station, 'en-GB')).toBe(station.names[0].value);
      expect(localisedName(station, 'zh-CN')).toBe(station.names[0].value);
    }
    expect(new Set(city.stations.map((s) => `${s.x},${s.y}`)).size).toBe(39);
  });

  it.each([
    ['Sloterdijk', 'Burg. de Vlugtlaan', ['50', '51']],
    ['Zuid', 'RAI', ['50', '51']],
    ['Weesperplein', 'Wibautstraat', ['51', '53', '54']],
    ['Spaklerweg', 'Van der Madeweg', ['53', '54']],
    ['Duivendrecht', 'Strandvliet', ['50', '54']],
  ])('keeps each line on the shared %s–%s section', (a, b, lines) => {
    const edges = city.segments.filter(
      (e) => [id(a), id(b)].includes(e.from) && [id(a), id(b)].includes(e.to),
    );
    expect(edges.map((e) => e.lineId)).toEqual(lines.map((l) => `amsterdam-m${l}`));
    expect(new Set(edges.map((e) => JSON.stringify(e.points))).size).toBe(lines.length);
  });

  it.each(['Sloterdijk', 'Nieuwmarkt', 'Amstelstation', 'Duivendrecht', 'Reigersbos'])(
    'keeps parallel paths continuous through %s without merging their drawing endpoints',
    (name) => {
      const station = id(name);
      const ports = network.stationLines.get(station)!.map((line) => {
        const endpoints = city.segments
          .filter((edge) => edge.lineId === line.id && [edge.from, edge.to].includes(station))
          .map((edge) => (edge.from === station ? edge.points![0] : edge.points!.at(-1)!));
        expect(
          endpoints.every((point) => JSON.stringify(point) === JSON.stringify(endpoints[0])),
        ).toBe(true);
        return JSON.stringify(endpoints[0]);
      });
      expect(new Set(ports).size).toBe(ports.length);
      expect(stationSpans(city).get(station)?.length).toBeGreaterThan(13);
    },
  );

  it('spans every parallel drawing endpoint with a single station marker', () => {
    const spans = stationSpans(city);
    for (const edge of city.segments) {
      for (const [station, point] of [
        [edge.from, edge.points?.[0]],
        [edge.to, edge.points?.at(-1)],
      ] as const) {
        const span = spans.get(station);
        if (!span || !point) continue;
        const dx = span.to[0] - span.from[0],
          dy = span.to[1] - span.from[1];
        const px = point[0] - span.from[0],
          py = point[1] - span.from[1];
        expect(Math.abs(dx * py - dy * px) / span.length).toBeLessThan(0.11);
        const along = (dx * px + dy * py) / span.length;
        expect(along).toBeGreaterThanOrEqual(-0.1);
        expect(along).toBeLessThanOrEqual(span.length + 0.1);
      }
    }
  });

  it('keeps M51 through-running via Zuid and Spaklerweg without closing an imaginary ring', () => {
    const route = trip('Isolatorweg', 'Centraal Station');
    expect(route.lineIds.every((l) => l === 'amsterdam-m51')).toBe(true);
    expect(route.transferIds).toEqual([]);
    expect(names(route.stationIds)).toContain('Zuid');
    expect(names(route.stationIds)).toContain('Spaklerweg');
    expect(names(route.stationIds)).not.toContain('Van der Madeweg');
    expect(route.segmentIds).toHaveLength(18);
    expect(
      city.segments.some((e) =>
        [id('Isolatorweg'), id('Centraal Station')].every((s) => s === e.from || s === e.to),
      ),
    ).toBe(false);
  });

  it.each([
    ['Isolatorweg', 'Gein', '50', 19],
    ['Noord', 'Zuid', '52', 7],
    ['Centraal Station', 'Gaasperplas', '53', 13],
    ['Centraal Station', 'Gein', '54', 14],
  ] as const)('preserves the direct service from %s to %s on M%s', (a, b, line, sections) => {
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      const route = trip(from, to);
      expect(route.lineIds.every((l) => l === `amsterdam-m${line}`)).toBe(true);
      expect(route.transferIds).toEqual([]);
      expect(route.segmentIds).toHaveLength(sections);
    }
  });

  it('requires real changes between the Gaasperplas and Gein branches and at Zuid', () => {
    const branch = trip('Gaasperplas', 'Gein');
    expect(names(branch.transferIds)).toEqual(['Van der Madeweg']);
    expect(routeGroups(branch, city)).toHaveLength(2);
    const north = trip('Noord', 'Gein', ['Zuid']);
    expect(names(north.transferIds)).toEqual(['Zuid']);
    expect(routeGroups(north, city).map((g) => g.lineId)).toEqual([
      'amsterdam-m52',
      'amsterdam-m50',
    ]);
  });

  it('searches Dutch station names and official station-prefixed aliases', () => {
    expect(names(searchStations(network, 'station zuid').map((s) => s.id))).toEqual(['Zuid']);
    expect(names(searchStations(network, 'DIEMEN ZUID').map((s) => s.id))).toEqual(['Diemen-Zuid']);
    expect(names(searchStations(network, 'burgemeester').map((s) => s.id))).toEqual([
      'Burg. de Vlugtlaan',
    ]);
    expect(names(searchStations(network, 'bijlmer arena').map((s) => s.id))).toEqual([
      'Bijlmer ArenA',
    ]);
  });

  it('round-trips Dutch routes in backups and collects only the lines actually ridden', () => {
    const route = trip('Gaasperplas', 'Gein');
    const data = emptyData();
    const journey = {
      ...route,
      id: 'amsterdam-trip',
      kind: 'trip' as const,
      createdAt: '2026-10-05T02:00:00Z',
    };
    data.cities.amsterdam = [journey];
    expect(validateBackup(JSON.parse(JSON.stringify(data)), cities)).toEqual(data);
    const progress = getProgress([journey]);
    expect(progress.lines).toEqual(new Set(['amsterdam-m53', 'amsterdam-m54']));
    expect(progress.stations.get(id('Van der Madeweg'))?.transferred).toBe(true);
    expect(progress.segments.size).toBe(route.segmentIds.length);
  });
});
