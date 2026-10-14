import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import { localisedName } from './i18n';
import { stationSpans } from './mapGeometry';
import {
  createNetwork,
  findRoute,
  isInterchange,
  isTransferStation,
  routeGroups,
  searchStations,
} from './network';

const city = cities.find((c) => c.id === 'stockholm')!;
const network = createNetwork(city);
const id = (name: string) => city.stations.find((s) => s.names[0].value === name)!.id;
const names = (ids: string[]) => ids.map((s) => network.stationById.get(s)!.names[0].value);
const service = (serviceId: string) =>
  city.lines.flatMap((l) => l.services!).find((s) => s.id === serviceId)!;
const trip = (from: string, to: string, via: string[] = []) => {
  const route = findRoute(network, id(from), id(to), via.map(id), 'transfers');
  expect(route).not.toBeNull();
  return route!;
};

describe('Stockholm tunnelbana', () => {
  it('includes the three colour lines, seven services and Swedish-only station names', () => {
    expect(city.lines.map((l) => l.id)).toEqual([
      'stockholm-green',
      'stockholm-red',
      'stockholm-blue',
    ]);
    expect(city.lines.flatMap((l) => l.services!.map((s) => s.id))).toEqual([
      't17',
      't18',
      't19',
      't13',
      't14',
      't10',
      't11',
    ]);
    expect(city.lines.map((l) => l.stationIds.length)).toEqual([49, 36, 20]);
    expect(city.stations).toHaveLength(100);
    expect(city.segments).toHaveLength(102);
    expect(city.localName).toEqual({ name: 'Stockholm', language: 'sv' });
    expect(localisedName(city.lines[0], 'zh-CN')).toBe('Gröna linjen');
    expect(localisedName(city.lines[0], 'en-GB')).toBe('Green line');
    for (const station of city.stations) {
      expect(station.names).toEqual([{ language: 'sv', value: station.names[0].value }]);
      expect(localisedName(station, 'en-GB')).toBe(station.names[0].value);
      expect(localisedName(station, 'zh-CN')).toBe(station.names[0].value);
    }
    expect(city.stations.some((s) => /Kymlinge/.test(s.names[0].value))).toBe(false);
    expect(new Set(city.stations.map((s) => `${s.x},${s.y}`)).size).toBe(100);
  });

  it.each([
    ['t17', 'Åkeshov', 'Skarpnäck', 24],
    ['t18', 'Alvik', 'Farsta strand', 23],
    ['t19', 'Hässelby strand', 'Hagsätra', 35],
    ['t13', 'Norsborg', 'Ropsten', 25],
    ['t14', 'Fruängen', 'Mörby centrum', 19],
    ['t10', 'Hjulsta', 'Kungsträdgården', 14],
    ['t11', 'Akalla', 'Kungsträdgården', 12],
  ])('runs service %s between %s and %s in both directions', (serviceId, from, to, count) => {
    const path = service(serviceId);
    expect(path.stationIds).toHaveLength(count);
    expect(names([path.stationIds[0], path.stationIds.at(-1)!])).toEqual([from, to]);
    expect(path.oneWay).toBeUndefined();
    const route = trip(from, to);
    expect(route.transferIds).toEqual([]);
    expect(route.segmentIds).toHaveLength(count - 1);
  });

  it('marks line junctions and cross-line interchanges, and offers trunk changes between services', () => {
    expect(
      city.stations.filter((s) => isInterchange(network, s.id)).map((s) => s.names[0].value),
    ).toEqual([
      'Fridhemsplan',
      'T-Centralen',
      'Gamla stan',
      'Slussen',
      'Gullmarsplan',
      'Skärmarbrink',
      'Liljeholmen',
      'Östermalmstorg',
      'Västra skogen',
    ]);
    expect(isTransferStation(network, id('Odenplan'))).toBe(true);
    expect(isInterchange(network, id('Odenplan'))).toBe(false);
    expect(isTransferStation(network, id('Hagsätra'))).toBe(false);
    expect(isTransferStation(network, id('Hallunda'))).toBe(false);
  });

  it('changes trains on the shared trunk between branches of one colour line', () => {
    const skarpnack = trip('Hässelby strand', 'Skarpnäck');
    expect(skarpnack.transferIds).toHaveLength(1);
    expect(service('t17').stationIds).toContain(skarpnack.transferIds[0]);
    expect(routeGroups(skarpnack, city).map((g) => g.lineId)).toEqual([
      'stockholm-green',
      'stockholm-green',
    ]);
    const farsta = trip('Hagsätra', 'Farsta strand');
    expect(names(farsta.transferIds)).toEqual(['Gullmarsplan']);
    const ropsten = trip('Fruängen', 'Ropsten');
    expect(ropsten.transferIds).toHaveLength(1);
    expect(names(service('t13').stationIds)).toContain(names(ropsten.transferIds)[0]);
    expect(names(trip('Hjulsta', 'Akalla').transferIds)).toEqual(['Västra skogen']);
  });

  it('changes between colour lines at the shared central stations', () => {
    const route = trip('Hjulsta', 'Hagsätra');
    expect(routeGroups(route, city).map((g) => g.lineId)).toEqual([
      'stockholm-blue',
      'stockholm-green',
    ]);
    expect(['Fridhemsplan', 'T-Centralen']).toContain(names(route.transferIds)[0]);
    const red = trip('Norsborg', 'Hässelby strand', ['Slussen']);
    expect(names(red.transferIds)).toEqual(['Slussen']);
    expect(routeGroups(red, city).map((g) => g.lineId)).toEqual([
      'stockholm-red',
      'stockholm-green',
    ]);
  });

  it('draws the Red line parallel to the Green line from T-Centralen to Slussen', () => {
    for (const [a, b] of [
      ['T-Centralen', 'Gamla stan'],
      ['Gamla stan', 'Slussen'],
    ]) {
      const edges = city.segments.filter(
        (e) => [id(a), id(b)].includes(e.from) && [id(a), id(b)].includes(e.to),
      );
      expect(edges.map((e) => e.lineId)).toEqual(['stockholm-green', 'stockholm-red']);
      expect(new Set(edges.map((e) => JSON.stringify(e.points ?? null))).size).toBe(2);
    }
    const spans = stationSpans(city);
    for (const name of ['T-Centralen', 'Gamla stan', 'Slussen']) {
      expect(spans.get(id(name))?.length).toBeCloseTo(14, 1);
    }
  });

  it('searches Swedish names without diacritics and by alias', () => {
    expect(names(searchStations(network, 'hasselby').map((s) => s.id))).toEqual([
      'Hässelby strand',
      'Hässelby gård',
    ]);
    expect(names(searchStations(network, 'sankt eriksplan').map((s) => s.id))).toEqual([
      'S:t Eriksplan',
    ]);
    expect(names(searchStations(network, 'kth').map((s) => s.id))).toEqual(['Tekniska högskolan']);
    expect(names(searchStations(network, 'stockholm central').map((s) => s.id))).toEqual([
      'T-Centralen',
    ]);
  });
});
