import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import { localisedName } from './i18n';
import { createNetwork, findRoute, isInterchange, routeGroups, searchStations } from './network';
import { emptyData, getProgress, validateBackup } from './storage';

const city = cities.find((c) => c.id === 'lisbon')!;
const network = createNetwork(city);
const id = (name: string) => city.stations.find((s) => s.names[0].value === name)!.id;
const names = (ids: string[]) => ids.map((s) => network.stationById.get(s)!.names[0].value);
const trip = (from: string, to: string, via: string[] = []) => {
  const route = findRoute(network, id(from), id(to), via.map(id), 'transfers');
  expect(route).not.toBeNull();
  return route!;
};

describe('Lisbon metro', () => {
  it('includes the four current lines with Portuguese-only station names', () => {
    expect(city.lines.map((l) => l.shortNames[0].value)).toEqual([
      'Azul',
      'Amarela',
      'Verde',
      'Vermelha',
    ]);
    expect(city.stations).toHaveLength(50);
    expect(city.segments).toHaveLength(52);
    expect(city.lines.every((l) => l.kind === 'metro')).toBe(true);
    expect(city.localName).toEqual({ name: 'Lisboa', language: 'pt-PT' });
    for (const station of city.stations) {
      expect(station.names).toEqual([{ language: 'pt-PT', value: station.names[0].value }]);
      expect(localisedName(station, 'en-GB')).toBe(station.names[0].value);
    }
    // The Rato–Cais do Sodré circular section is not open yet.
    expect(city.stations.some((s) => /Estrela|Santos|Alcântara/.test(s.names[0].value))).toBe(
      false,
    );
    expect(new Set(city.stations.map((s) => `${s.x},${s.y}`)).size).toBe(50);
  });

  it.each([
    ['Azul', 'Reboleira', 'Santa Apolónia', 18],
    ['Amarela', 'Odivelas', 'Rato', 13],
    ['Verde', 'Telheiras', 'Cais do Sodré', 13],
    ['Vermelha', 'Aeroporto', 'São Sebastião', 12],
  ])('runs the %s line direct from %s to %s', (line, from, to, stations) => {
    const lineId = `lisbon-${line.toLowerCase()}`;
    expect(city.lines.find((l) => l.id === lineId)!.stationIds).toHaveLength(stations);
    for (const [a, b] of [
      [from, to],
      [to, from],
    ]) {
      const route = trip(a, b);
      expect(route.lineIds.every((l) => l === lineId)).toBe(true);
      expect(route.transferIds).toEqual([]);
      expect(route.segmentIds).toHaveLength(stations - 1);
    }
  });

  it('marks exactly the six interchange stations', () => {
    expect(
      city.stations
        .filter((s) => isInterchange(network, s.id))
        .map((s) => s.names[0].value)
        .sort(),
    ).toEqual([
      'Alameda',
      'Baixa-Chiado',
      'Campo Grande',
      'Marquês de Pombal',
      'Saldanha',
      'São Sebastião',
    ]);
    expect(
      city.stations.filter((s) => /^Alameda$|^Rossio$|^Oriente$/.test(s.names[0].value)),
    ).toHaveLength(3);
  });

  it('changes once between Odivelas and the airport and keeps Rato–Cais do Sodré as a two-change trip', () => {
    const airport = trip('Odivelas', 'Aeroporto');
    expect(names(airport.transferIds)).toEqual(['Saldanha']);
    expect(routeGroups(airport, city).map((g) => g.lineId)).toEqual([
      'lisbon-amarela',
      'lisbon-vermelha',
    ]);
    // Fewest changes rides north to Campo Grande; the balanced route changes twice through the centre.
    const south = trip('Rato', 'Cais do Sodré');
    expect(names(south.transferIds)).toEqual(['Campo Grande']);
    const centre = findRoute(network, id('Rato'), id('Cais do Sodré'), [], 'balanced')!;
    expect(names(centre.transferIds)).toEqual(['Marquês de Pombal', 'Baixa-Chiado']);
    expect(centre.segmentIds).toHaveLength(5);
    const via = trip('Telheiras', 'Reboleira', ['Marquês de Pombal']);
    expect(names(via.transferIds)).toEqual(['Campo Grande', 'Marquês de Pombal']);
  });

  it('searches Portuguese names with or without diacritics and by alias', () => {
    expect(names(searchStations(network, 'sao sebastiao').map((s) => s.id))).toEqual([
      'São Sebastião',
    ]);
    expect(names(searchStations(network, 'S. Sebastião').map((s) => s.id))).toEqual([
      'São Sebastião',
    ]);
    expect(names(searchStations(network, 'entrecampos').map((s) => s.id))).toEqual([
      'Entre Campos',
    ]);
    expect(names(searchStations(network, 'luz').map((s) => s.id))).toEqual(['Colégio Militar/Luz']);
    expect(names(searchStations(network, 'airport').map((s) => s.id))).toEqual(['Aeroporto']);
  });

  it('round-trips Portuguese routes in backups and collects only the lines ridden', () => {
    const route = trip('Odivelas', 'Aeroporto');
    const data = emptyData();
    const journey = {
      ...route,
      id: 'lisbon-trip',
      kind: 'trip' as const,
      createdAt: '2026-10-08T02:00:00Z',
    };
    data.cities.lisbon = [journey];
    expect(validateBackup(JSON.parse(JSON.stringify(data)), cities)).toEqual(data);
    const progress = getProgress([journey]);
    expect(progress.lines).toEqual(new Set(['lisbon-amarela', 'lisbon-vermelha']));
    expect(progress.stations.get(id('Saldanha'))?.transferred).toBe(true);
  });
});
