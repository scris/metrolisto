import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import { localisedName } from './i18n';
import { stationSpans } from './mapGeometry';
import { createNetwork, findRoute, isInterchange, routeGroups, searchStations } from './network';

const city = cities.find((c) => c.id === 'malaga')!;
const network = createNetwork(city);
const id = (name: string) => city.stations.find((s) => s.names[0].value === name)!.id;
const names = (ids: string[]) => ids.map((s) => network.stationById.get(s)!.names[0].value);
const trip = (from: string, to: string) => {
  const route = findRoute(network, id(from), id(to), [], 'transfers');
  expect(route).not.toBeNull();
  return route!;
};

describe('Málaga metro', () => {
  it('includes both lines with Spanish-only names and the 2023 city-centre extension', () => {
    expect(city.lines.map((l) => l.shortNames[0].value)).toEqual(['L1', 'L2']);
    expect(city.stations).toHaveLength(19);
    expect(city.segments).toHaveLength(19);
    expect(city.localName).toEqual({ name: 'Málaga', language: 'es-ES' });
    for (const station of city.stations) {
      expect(station.names).toEqual([{ language: 'es', value: station.names[0].value }]);
      expect(localisedName(station, 'zh-CN')).toBe(station.names[0].value);
    }
    expect(city.stations.some((s) => /Hilera|Trinidad|Hospital/.test(s.names[0].value))).toBe(
      false,
    );
  });

  it('runs Line 1 to Atarazanas while Line 2 terminates at Guadalmedina', () => {
    const l1 = city.lines.find((l) => l.id === 'malaga-l1')!;
    const l2 = city.lines.find((l) => l.id === 'malaga-l2')!;
    expect(names(l1.stationIds)).toEqual([
      'Andalucía Tech',
      'Paraninfo',
      'El Cónsul',
      'Clínico',
      'Universidad',
      'Ciudad de la Justicia',
      'Portada Alta',
      'Carranque',
      'Barbarela',
      'La Unión',
      'El Perchel',
      'Guadalmedina',
      'Atarazanas',
    ]);
    expect(names(l2.stationIds)).toEqual([
      'Palacio de los Deportes',
      'Puerta Blanca',
      'La Luz-La Paz',
      'El Torcal',
      'Princesa-Huelin',
      'La Isla',
      'El Perchel',
      'Guadalmedina',
    ]);
    expect(l2.stationIds).not.toContain(id('Atarazanas'));
    expect(
      city.stations.filter((s) => isInterchange(network, s.id)).map((s) => s.names[0].value),
    ).toEqual(['El Perchel', 'Guadalmedina']);
  });

  it('keeps separate parallel paths on the shared El Perchel–Guadalmedina section', () => {
    const edges = city.segments.filter(
      (e) =>
        [id('El Perchel'), id('Guadalmedina')].includes(e.from) &&
        [id('El Perchel'), id('Guadalmedina')].includes(e.to),
    );
    expect(edges.map((e) => e.lineId)).toEqual(['malaga-l1', 'malaga-l2']);
    expect(new Set(edges.map((e) => JSON.stringify(e.points))).size).toBe(2);
    expect(stationSpans(city).get(id('Guadalmedina'))?.length).toBeCloseTo(14, 1);
  });

  it('changes at El Perchel or Guadalmedina between the lines and rides Line 1 direct to the centre', () => {
    const direct = trip('Andalucía Tech', 'Atarazanas');
    expect(direct.transferIds).toEqual([]);
    expect(direct.segmentIds).toHaveLength(12);
    const change = trip('Palacio de los Deportes', 'Atarazanas');
    expect(names(change.transferIds)).toHaveLength(1);
    expect(['El Perchel', 'Guadalmedina']).toContain(names(change.transferIds)[0]);
    expect(routeGroups(change, city).map((g) => g.lineId)).toEqual(['malaga-l2', 'malaga-l1']);
  });

  it('searches accented names without accents and station aliases', () => {
    expect(names(searchStations(network, 'consul').map((s) => s.id))).toEqual(['El Cónsul']);
    expect(names(searchStations(network, 'maria zambrano').map((s) => s.id))).toEqual([
      'El Perchel',
    ]);
    expect(names(searchStations(network, 'huelin').map((s) => s.id))).toEqual(['Princesa-Huelin']);
  });
});
