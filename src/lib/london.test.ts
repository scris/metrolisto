import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import type { CityData } from '../types';
import { localisedName } from './i18n';
import { createNetwork, findRoute, routeGroups, routeTransfers, searchStations } from './network';
import { emptyData, validateBackup } from './storage';
import { validateCity } from './validate';

const city = cities.find((c) => c.id === 'london')!;
const network = createNetwork(city);
const id = (name: string) => city.stations.find((s) => s.names[0].value === name)!.id;
const names = (ids: string[]) => ids.map((id) => network.stationById.get(id)!.names[0].value);
const only = (line: string) =>
  createNetwork({
    ...city,
    lines: city.lines.filter((l) => l.id === `london-${line}`),
    segments: city.segments.filter((s) => s.lineId === `london-${line}`),
    sameLineTransfers: city.sameLineTransfers!.filter(
      ([a]) => network.segmentById.get(a)!.lineId === `london-${line}`,
    ),
  });
const trip = (
  line: string,
  from: string,
  to: string,
  via: string[] = [],
  preference: 'balanced' | 'transfers' = 'balanced',
) => {
  const route = findRoute(only(line), id(from), id(to), via.map(id), preference);
  expect(route).not.toBeNull();
  return route!;
};

describe('London coverage and interchanges', () => {
  it('includes all Tube-map TfL modes, six named Overground lines and English-only names', () => {
    expect(city.lines).toHaveLength(21);
    expect(city.stations).toHaveLength(464);
    expect(
      city.lines.filter((l) =>
        ['liberty', 'lioness', 'mildmay', 'suffragette', 'weaver', 'windrush'].some(
          (name) => l.id === `london-${name}`,
        ),
      ),
    ).toHaveLength(6);
    expect(city.lines.map((l) => l.kind)).toContain('cable-car');
    expect(city.lines.some((l) => /thameslink/i.test(l.names[0].value))).toBe(false);
    expect(
      city.stations.some((s) =>
        ['City Thameslink', 'Fenchurch Street', 'Battersea Park'].includes(s.names[0].value),
      ),
    ).toBe(false);
    for (const item of [...city.stations, ...city.lines]) {
      expect(item.names).toEqual([{ language: 'en', value: item.names[0].value }]);
      expect(localisedName(item, 'zh-CN')).toBe(item.names[0].value);
    }
    expect(new Set(city.stations.map((s) => `${s.x},${s.y}`)).size).toBe(city.stations.length);
  });
  it.each([
    ['South Kensington', 'Sloane Square', ['circle', 'district']],
    ['Baker Street', 'Great Portland Street', ['circle', 'hammersmith-city', 'metropolitan']],
    ['Kensal Green', "Queen's Park", ['bakerloo', 'lioness']],
    ['Kew Gardens', 'Richmond', ['district', 'mildmay']],
    ['Rayners Lane', 'Eastcote', ['metropolitan', 'piccadilly']],
  ])(
    'retains separate collection sections on shared tracks from %s to %s',
    (from, to, lineNames) => {
      const edges = city.segments.filter(
        (e) => [id(from), id(to)].includes(e.from) && [id(from), id(to)].includes(e.to),
      );
      expect(edges.map((e) => e.lineId).sort()).toEqual(
        lineNames.map((name) => `london-${name}`).sort(),
      );
      expect(new Set(edges.map((e) => JSON.stringify(e.points))).size).toBe(edges.length);
    },
  );
  it.each([
    ['Kenton', ['bakerloo', 'lioness']],
    ['Royal Oak', ['circle', 'hammersmith-city']],
    ['Great Portland Street', ['circle', 'hammersmith-city', 'metropolitan']],
    ['Barbican', ['circle', 'hammersmith-city', 'metropolitan']],
    ['Sloane Square', ['circle', 'district']],
    ['East Ham', ['district', 'hammersmith-city']],
    ['Ruislip', ['metropolitan', 'piccadilly']],
    ['Kew Gardens', ['district', 'mildmay']],
  ])('keeps %s parallel paths continuous through the stop', (name, lines) => {
    const station = id(name);
    const ports = lines.map((line) => {
      const points = city.segments
        .filter(
          (edge) => edge.lineId === `london-${line}` && [edge.from, edge.to].includes(station),
        )
        .map((edge) => (edge.from === station ? edge.points![0] : edge.points!.at(-1)!));
      expect(points).toHaveLength(2);
      expect(points[0]).toEqual(points[1]);
      return JSON.stringify(points[0]);
    });
    expect(new Set(ports).size).toBe(lines.length);
  });
  it('keeps Piccadilly parallel past intermediate District-only stops without adding calls', () => {
    const piccadilly = city.lines.find((line) => line.id === 'london-piccadilly')!;
    expect(piccadilly.stationIds).not.toContain(id('West Kensington'));
    const route = trip('piccadilly', 'Barons Court', "Earl's Court");
    expect(names(route.stationIds)).toEqual(['Barons Court', "Earl's Court"]);
    const points = network.segmentById.get(route.segmentIds[0])!.points!;
    const station = network.stationById.get(id('West Kensington'))!;
    expect(points.some((point) => point[0] === station.x && point[1] === station.y + 14)).toBe(
      true,
    );
  });
  it('keeps Jubilee visible beneath the Metropolitan express section from Wembley Park to Finchley Road', () => {
    const stops = [
      'Wembley Park',
      'Neasden',
      'Dollis Hill',
      'Willesden Green',
      'Kilburn',
      'West Hampstead (Jubilee)',
      'Finchley Road',
    ];
    const jubilee = trip('jubilee', stops[0], stops.at(-1)!);
    expect(names(jubilee.stationIds)).toEqual(stops);
    const metropolitan = trip('metropolitan', stops[0], stops.at(-1)!);
    expect(names(metropolitan.stationIds)).toEqual([stops[0], stops.at(-1)!]);
    expect(metropolitan.segmentIds).toHaveLength(1);
    const express = network.segmentById.get(metropolitan.segmentIds[0])!.points!;
    const distanceToExpress = ([x, y]: readonly number[]) =>
      Math.min(
        ...express.slice(1).map((b, i) => {
          const a = express[i];
          const dx = b[0] - a[0],
            dy = b[1] - a[1];
          const along = Math.max(
            0,
            Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)),
          );
          return Math.hypot(x - a[0] - along * dx, y - a[1] - along * dy);
        }),
      );
    for (const segmentId of jubilee.segmentIds) {
      const edge = network.segmentById.get(segmentId)!;
      const from = network.stationById.get(edge.from)!,
        to = network.stationById.get(edge.to)!;
      const points = edge.points ?? [
        [from.x, from.y],
        [to.x, to.y],
      ];
      for (const [i, point] of points.entries()) {
        expect(distanceToExpress(point)).toBeGreaterThan(10);
        if (!i) continue;
        const previous = points[i - 1];
        expect(
          distanceToExpress([(point[0] + previous[0]) / 2, (point[1] + previous[1]) / 2]),
        ).toBeGreaterThan(10);
      }
    }
    for (const stop of [stops[0], stops.at(-1)!]) {
      const endpoints = city.segments
        .filter(
          (edge) =>
            edge.lineId === 'london-metropolitan' && [edge.from, edge.to].includes(id(stop)),
        )
        .map((edge) => (edge.from === id(stop) ? edge.points![0] : edge.points!.at(-1)!));
      expect(endpoints).toHaveLength(2);
      expect(endpoints[0]).toEqual(endpoints[1]);
    }
  });
  it('preserves separate stations where an external walk is required', () => {
    expect(searchStations(network, 'Bethnal Green')).toHaveLength(2);
    expect(searchStations(network, 'Canary Wharf')).toHaveLength(3);
    expect(
      searchStations(network, 'Hammersmith').filter((s) =>
        s.names[0].value.startsWith('Hammersmith'),
      ),
    ).toHaveLength(2);
    expect(id('Woolwich')).not.toBe(id('Woolwich Arsenal'));
    expect(searchStations(network, 'Monument')[0].id).toBe(id('Bank / Monument'));
    expect(searchStations(network, 'Hackney Downs')[0].id).toBe(
      id('Hackney Central / Hackney Downs'),
    );
    expect(trip('cable-car', 'Royal Docks', 'Greenwich Peninsula').segmentIds).toHaveLength(1);
    expect(findRoute(network, id('Royal Docks'), id('Royal Victoria'))).toBeNull();
  });
});

describe('London Underground branches and direction', () => {
  it('keeps the Bakerloo central station order', () => {
    expect(names(trip('bakerloo', 'Marylebone', 'Oxford Circus').stationIds)).toEqual([
      'Marylebone',
      'Baker Street',
      "Regent's Park",
      'Oxford Circus',
    ]);
  });
  it('keeps Circle through trains direct on the northern Paddington approach', () => {
    expect(trip('circle', 'Royal Oak', 'Baker Street').transferIds).toEqual([]);
    expect(trip('circle', 'Bayswater', 'Baker Street').transferIds).toHaveLength(1);
    expect(trip('circle', 'Royal Oak', 'Bayswater').transferIds).toHaveLength(1);
    expect(
      city.segments.filter(
        (e) =>
          e.lineId === 'london-circle' &&
          [id('Paddington'), id('Edgware Road (Circle / District / Hammersmith & City)')].includes(
            e.from,
          ) &&
          [id('Paddington'), id('Edgware Road (Circle / District / Hammersmith & City)')].includes(
            e.to,
          ),
      ),
    ).toHaveLength(2);
  });
  it.each([
    ['central', 'West Acton', 'Hanger Lane', 'North Acton'],
    ['central', 'Fairlop', 'Grange Hill', 'Hainault'],
    ['central', 'Roding Valley', 'South Woodford', 'Woodford'],
    ['district', 'West Kensington', 'High Street Kensington', "Earl's Court"],
    ['district', 'Kensington (Olympia)', 'Gloucester Road', "Earl's Court"],
    ['district', 'Gunnersbury', 'Chiswick Park', 'Turnham Green'],
    ['northern', 'Nine Elms', 'Elephant & Castle', 'Kennington'],
    ['northern', 'Chalk Farm', 'Kentish Town', 'Camden Town'],
    ['metropolitan', 'Amersham', 'Chesham', 'Chalfont & Latimer'],
  ])('counts %s branch changes between %s and %s', (line, a, b, junction) => {
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      const route = trip(line, from, to);
      expect(names(route.transferIds)).toEqual([junction]);
      expect(routeGroups(route, city)).toHaveLength(2);
    }
  });
  it.each([
    ['district', 'West Brompton', 'High Street Kensington'],
    ['district', 'Kensington (Olympia)', 'High Street Kensington'],
    ['central', 'Leyton', 'Hainault'],
    ['northern', 'Waterloo', 'Nine Elms'],
    ['northern', 'Borough', 'Oval'],
  ])('retains %s through trains from %s to %s', (line, from, to) => {
    expect(trip(line, from, to).transferIds).toEqual([]);
  });
  it('respects the Piccadilly Terminal 4 loop instead of making it bidirectional', () => {
    expect(names(trip('piccadilly', 'Heathrow Terminal 4', 'Hatton Cross').stationIds)).toEqual([
      'Heathrow Terminal 4',
      'Heathrow Terminals 2 & 3',
      'Hatton Cross',
    ]);
    expect(
      names(trip('piccadilly', 'Heathrow Terminals 2 & 3', 'Heathrow Terminal 4').stationIds),
    ).toEqual(['Heathrow Terminals 2 & 3', 'Hatton Cross', 'Heathrow Terminal 4']);
    expect(
      trip('piccadilly', 'Heathrow Terminal 4', 'Heathrow Terminal 5').transferIds,
    ).toHaveLength(1);
  });
});

describe('DLR train services', () => {
  it('connects Pudding Mill Lane directly to Stratford in both directions', () => {
    for (const [from, to] of [
      ['Pudding Mill Lane', 'Stratford'],
      ['Stratford', 'Pudding Mill Lane'],
    ]) {
      const route = trip('dlr', from, to);
      expect(names(route.stationIds)).toEqual([from, to]);
      expect(route.transferIds).toEqual([]);
      expect(route.segmentIds).toEqual(['london-dlr--pudding-mill-lane--stratford']);
    }
  });
  it('skips West India Quay only on the Bank to Lewisham direction', () => {
    const outbound = trip('dlr', 'Bank / Monument', 'Lewisham');
    const inbound = trip('dlr', 'Lewisham', 'Bank / Monument');
    expect(names(outbound.stationIds)).not.toContain('West India Quay');
    expect(names(inbound.stationIds)).toContain('West India Quay');
    expect(outbound.transferIds).toEqual([]);
    expect(inbound.transferIds).toEqual([]);
    expect(trip('dlr', 'Bank / Monument', 'West India Quay').transferIds).toHaveLength(1);
  });
  it.each([
    ['Tower Gateway', 'Woolwich Arsenal'],
    ['Bank / Monument', 'Beckton'],
    ['Stratford International', 'Lewisham'],
    ['Pudding Mill Lane', 'Stratford High Street'],
  ])('requires a change between %s and %s despite the shared tracks', (a, b) => {
    for (const preference of ['balanced', 'transfers'] as const) {
      expect(trip('dlr', a, b, [], preference).transferIds).toHaveLength(1);
    }
  });
  it.each([
    ['Bank / Monument', 'Woolwich Arsenal'],
    ['Tower Gateway', 'Beckton'],
    ['Stratford International', 'Woolwich Arsenal'],
    ['Stratford International', 'Beckton'],
    ['Stratford', 'Lewisham'],
  ])('supports the direct service between %s and %s', (a, b) => {
    expect(trip('dlr', a, b).transferIds).toEqual([]);
    expect(trip('dlr', b, a).transferIds).toEqual([]);
  });
});

describe('Overground and Elizabeth line services', () => {
  it.each([
    ['mildmay', 'South Acton', "Shepherd's Bush (Mildmay)", 'Willesden Junction'],
    ['weaver', 'Clapton', 'Rectory Road', 'Hackney Central / Hackney Downs'],
    ['weaver', 'Bush Hill Park', 'Southbury', 'Edmonton Green'],
    ['windrush', 'New Cross', 'New Cross Gate', 'Surrey Quays'],
    ['windrush', 'Crystal Palace', 'Penge West', 'Sydenham'],
  ])('counts %s changes between %s and %s', (line, a, b, junction) => {
    expect(names(trip(line, a, b).transferIds)).toEqual([junction]);
  });
  it('does not invent Highbury to Clapham Junction or New Cross through trains', () => {
    for (const terminus of ['Clapham Junction', 'New Cross']) {
      for (const [a, b] of [
        ['Highbury & Islington', terminus],
        [terminus, 'Highbury & Islington'],
      ]) {
        const route = trip('windrush', a, b, ['Dalston Junction']);
        expect(names(route.transferIds)).toEqual(['Dalston Junction']);
        expect(routeGroups(route, city)).toHaveLength(2);
        expect(routeTransfers(city, route)).toEqual(route.transferIds);
      }
    }
    expect(trip('windrush', 'Dalston Junction', 'Clapham Junction').transferIds).toEqual([]);
    expect(trip('windrush', 'Highbury & Islington', 'Crystal Palace').transferIds).toEqual([]);
  });
  it('preserves Elizabeth through running and the Reading/Shenfield train change', () => {
    expect(trip('elizabeth', 'Reading', 'Abbey Wood').transferIds).toEqual([]);
    expect(trip('elizabeth', 'Heathrow Terminal 4', 'Shenfield').transferIds).toEqual([]);
    expect(trip('elizabeth', 'Heathrow Terminal 4', 'Abbey Wood').transferIds).toEqual([]);
    expect(trip('elizabeth', 'Heathrow Terminal 5', 'Abbey Wood').transferIds).toEqual([]);
    expect(trip('elizabeth', 'Reading', 'Shenfield').transferIds).toHaveLength(1);
  });
  it('round-trips a service change in backups and rejects a falsely direct journey', () => {
    const route = trip('windrush', 'Highbury & Islington', 'Clapham Junction', [
      'Dalston Junction',
    ]);
    const data = emptyData();
    data.cities.london = [
      { ...route, id: 'london-service-change', kind: 'trip', createdAt: '2026-10-05T01:00:00Z' },
    ];
    expect(validateBackup(data, cities)).toEqual(data);
    data.cities.london[0].transferIds = [];
    expect(() => validateBackup(data, cities)).toThrow('换乘记录不匹配');
    expect(validateBackup(data, cities, true).cities.london).toEqual([]);
    expect(validateBackup(data, cities, true).quarantined).toHaveLength(1);
  });
  it.each([
    'missing-station',
    'missing-edge',
    'wrong-direction',
    'uncovered-edge',
    'duplicate-service',
  ])('rejects malformed service data: %s', (kind) => {
    const clone = structuredClone(city) as CityData;
    const line = clone.lines.find((l) => l.id === 'london-dlr')!;
    const service = line.services![0];
    if (kind === 'missing-station') service.stationIds[0] = 'unknown';
    if (kind === 'missing-edge') service.stationIds.splice(2, 1);
    if (kind === 'wrong-direction') service.stationIds.reverse();
    if (kind === 'uncovered-edge') line.services!.splice(1, 1);
    if (kind === 'duplicate-service') line.services!.push(structuredClone(service));
    expect(() => validateCity(clone)).toThrow();
  });
});

describe('London Trams direction', () => {
  it('locates a recorded change at the second visit to East Croydon', () => {
    const stationIds = [
      'New Addington',
      "King Henry's Drive",
      'Fieldway',
      'Addington Village',
      'Gravel Hill',
      'Coombe Lane',
      'Lloyd Park',
      'Sandilands',
      'Lebanon Road',
      'East Croydon',
      'George Street',
      'Church Street',
      'Centrale',
      'West Croydon (Trams)',
      'Wellesley Road',
      'East Croydon',
      'George Street',
      'Church Street',
      'Wandle Park',
    ].map(id);
    const segments = stationIds
      .slice(1)
      .map((to, i) =>
        city.segments.find(
          (edge) =>
            edge.lineId === 'london-trams' &&
            ((edge.from === stationIds[i] && edge.to === to) ||
              (!edge.oneWay && edge.to === stationIds[i] && edge.from === to)),
        )!,
      );
    const route = {
      stationIds,
      segmentIds: segments.map((edge) => edge.id),
      lineIds: segments.map((edge) => edge.lineId),
      transferIds: [id('East Croydon')],
    };
    expect(routeTransfers(city, route)).toEqual(route.transferIds);
    const groups = routeGroups(route, city);
    expect(groups).toHaveLength(2);
    expect(names(groups[0].stationIds)).toEqual(names(stationIds.slice(0, 16)));
    expect(names(groups[1].stationIds)).toEqual([
      'East Croydon',
      'George Street',
      'Church Street',
      'Wandle Park',
    ]);
    const data = emptyData();
    data.cities.london = [
      { ...route, id: 'croydon-loop-change', kind: 'trip', createdAt: '2026-10-05T02:00:00Z' },
    ];
    expect(validateBackup(data, cities)).toEqual(data);
  });
  it('keeps New Addington trains on their Croydon loop and changes for Wimbledon', () => {
    const loop = trip('trams', 'George Street', 'Lebanon Road');
    expect(names(loop.stationIds)).toEqual([
      'George Street',
      'Church Street',
      'Centrale',
      'West Croydon (Trams)',
      'Wellesley Road',
      'East Croydon',
      'Lebanon Road',
    ]);
    expect(loop.transferIds).toEqual([]);
    for (const [from, to] of [
      ['Wimbledon', 'New Addington'],
      ['New Addington', 'Wimbledon'],
      ['New Addington', 'Elmers End'],
    ]) {
      const route = trip('trams', from, to);
      expect(route.transferIds).toHaveLength(1);
      expect(routeTransfers(city, route)).toEqual(route.transferIds);
    }
    expect(trip('trams', 'Wimbledon', 'Beckenham Junction').transferIds).toEqual([]);
    expect(trip('trams', 'New Addington', 'Centrale').transferIds).toEqual([]);
  });
  it('includes all 39 stops and the one-way Croydon streets', () => {
    expect(only('trams').city.lines[0].stationIds).toHaveLength(39);
    expect(names(trip('trams', 'Wandle Park', 'Reeves Corner').stationIds)).toEqual([
      'Wandle Park',
      'Reeves Corner',
    ]);
    expect(names(trip('trams', 'Reeves Corner', 'Wandle Park').stationIds)).toEqual([
      'Reeves Corner',
      'Centrale',
      'West Croydon (Trams)',
      'Wellesley Road',
      'East Croydon',
      'George Street',
      'Church Street',
      'Wandle Park',
    ]);
    expect(names(trip('trams', 'George Street', 'Centrale').stationIds)).toEqual([
      'George Street',
      'Church Street',
      'Centrale',
    ]);
    expect(names(trip('trams', 'Lloyd Park', 'Addiscombe').transferIds)).toEqual(['Sandilands']);
  });
});
