import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import { localisedName } from './i18n';
import { mergedStops, stationSpans } from './mapGeometry';
import {
  createNetwork,
  findRoute,
  isInterchange,
  isTransferStation,
  routeGroups,
  searchStations,
} from './network';
import { emptyData, getProgress, validateBackup } from './storage';

const city = cities.find((c) => c.id === 'valencia')!;
const network = createNetwork(city);
const id = (name: string) => city.stations.find((s) => s.names[0].value === name)!.id;
const names = (ids: string[]) => ids.map((s) => network.stationById.get(s)!.names[0].value);
const line = (n: number) => city.lines.find((l) => l.id === `valencia-l${n}`)!;
const trip = (from: string, to: string, via: string[] = []) => {
  const route = findRoute(network, id(from), id(to), via.map(id), 'transfers');
  expect(route).not.toBeNull();
  return route!;
};
const only = (n: number) =>
  createNetwork({
    ...city,
    lines: [line(n)],
    segments: city.segments.filter((s) => s.lineId === `valencia-l${n}`),
    sameLineTransfers: city.sameLineTransfers!.filter(
      ([a]) => network.segmentById.get(a)!.lineId === `valencia-l${n}`,
    ),
  });

describe('Metrovalencia', () => {
  it('includes all ten lines with Valencian-only station names', () => {
    expect(city.lines.map((l) => l.shortNames[0].value)).toEqual([
      'L1',
      'L2',
      'L3',
      'L4',
      'L5',
      'L6',
      'L7',
      'L8',
      'L9',
      'L10',
    ]);
    expect(city.lines.filter((l) => l.kind === 'tram').map((l) => l.shortNames[0].value)).toEqual([
      'L4',
      'L6',
      'L8',
      'L10',
    ]);
    expect(city.stations).toHaveLength(144);
    expect(city.segments).toHaveLength(216);
    expect(city.localName).toEqual({ name: 'València', language: 'ca-ES-valencia' });
    for (const station of city.stations) {
      expect(station.names).toEqual([
        { language: 'ca-ES-valencia', value: station.names[0].value },
      ]);
      expect(localisedName(station, 'zh-CN')).toBe(station.names[0].value);
    }
    expect(new Set(city.stations.map((s) => `${s.x},${s.y}`)).size).toBe(144);
  });

  it.each([
    [1, 'Bétera', 'Castelló', 40],
    [2, 'Llíria', 'Torrent Avinguda', 34],
    [3, 'Rafelbunyol', 'Aeroport', 27],
    [5, 'Marítim', 'Aeroport', 18],
    [7, 'Marítim', 'Torrent Avinguda', 16],
    [8, 'Neptú', 'Marítim', 4],
    [9, 'Alboraia Peris Aragó', 'Riba-roja de Túria', 23],
    [10, 'Alacant', 'Natzaret', 8],
  ])('runs L%s direct between %s and %s', (n, from, to, stations) => {
    expect(line(n).stationIds).toHaveLength(stations);
    for (const [a, b] of [
      [from, to],
      [to, from],
    ]) {
      const route = trip(a, b);
      expect(route.lineIds.every((l) => l === `valencia-l${n}`)).toBe(true);
      expect(route.transferIds).toEqual([]);
      expect(route.segmentIds).toHaveLength(stations - 1);
    }
  });

  it('keeps Torrent Avinguda off L1 and Castelló off L2', () => {
    expect(line(1).stationIds).not.toContain(id('Torrent Avinguda'));
    expect(line(2).stationIds).not.toContain(id('Castelló'));
    expect(names(trip('Bétera', 'Torrent Avinguda').transferIds)).toHaveLength(1);
  });

  it.each([
    ['Beniferri', 'Campanar', [1, 2]],
    ['Patraix', 'Safranar', [1, 2, 7]],
    ['Torrent', 'Torrent Avinguda', [2, 7]],
    ['Mislata', 'Nou d’Octubre'.replace('’', "'"), [3, 5, 9]],
    ['Alameda', 'Colón', [3, 5, 7, 9]],
    ['Colón', 'Xàtiva', [3, 5, 9]],
    ['Facultats-Manuel Broseta', 'Benimaclet', [3, 9]],
    ['Amistat', 'Ayora', [5, 7]],
    ['Universitat Politècnica', 'La Carrasca', [4, 6]],
    ['Grau-La Marina', 'Francesc Cubells', [6, 8]],
  ])('keeps each line on the shared %s–%s section', (a, b, lines) => {
    const edges = city.segments.filter(
      (e) => [id(a), id(b)].includes(e.from) && [id(a), id(b)].includes(e.to),
    );
    expect(edges.map((e) => e.lineId)).toEqual(lines.map((l) => `valencia-l${l}`));
    expect(new Set(edges.map((e) => JSON.stringify(e.points))).size).toBe(lines.length);
  });

  it('keeps flat capsules only where separate tracks meet and merges every other stop', () => {
    const spans = stationSpans(city);
    expect([...spans.keys()].map((s) => network.stationById.get(s)!.names[0].value)).toEqual([
      'Empalme',
      'Àngel Guimerà',
      'Benimaclet',
      'Marítim',
    ]);
    for (const [station, length, angle] of [
      ['Empalme', 7, 135],
      ['Àngel Guimerà', 14, 90],
      ['Benimaclet', 7, 0],
      ['Marítim', 7, 90],
    ] as const) {
      const span = spans.get(id(station))!;
      expect(span.length, station).toBeCloseTo(length, 0);
      expect(span.padding, station).toBeLessThan(0.1);
      expect(Math.abs(span.angle) % 180, station).toBeCloseTo(angle, 5);
    }
    const merged = mergedStops(city);
    for (const name of ['Beniferri', 'Mislata', 'Xàtiva', 'Alameda', 'Jesús', 'Trinitat'])
      expect(merged.has(id(name)), name).toBe(true);
    for (const name of ['Grau-La Marina', 'Francesc Cubells', 'Torrent Avinguda', 'Aeroport'])
      expect(merged.has(id(name)), name).toBe(true);
    for (const name of ['Empalme', 'Àngel Guimerà', 'Benimaclet', 'Marítim', 'À Punt', 'Bailén'])
      expect(merged.has(id(name)), name).toBe(false);
    // Every other line meets the station anchor, then runs on its own track in between.
    for (const station of city.stations) {
      if (spans.has(station.id)) continue;
      // Every other line meets the station anchor, then runs on its own track in between.
      for (const edge of city.segments) {
        if (!edge.points) continue;
        if (edge.from === station.id) expect(edge.points[0]).toEqual([station.x, station.y]);
        if (edge.to === station.id) expect(edge.points.at(-1)).toEqual([station.x, station.y]);
      }
    }
    for (const [a, b] of [
      ['Beniferri', 'Campanar'],
      ['Patraix', 'Safranar'],
      ['Alameda', 'Colón'],
      ['Mislata', "Nou d'Octubre"],
      ['Amistat', 'Ayora'],
      ['Universitat Politècnica', 'La Carrasca'],
    ]) {
      const edges = city.segments.filter(
        (e) => [id(a), id(b)].includes(e.from) && [id(a), id(b)].includes(e.to),
      );
      const tracks = edges.map((e) =>
        (e.points ?? [])
          .slice(1, -1)
          .map((p) => p.join(','))
          .join(' '),
      );
      expect(new Set(tracks).size).toBe(edges.length);
    }
    // Every leg of every segment is horizontal, vertical or diagonal at 45°.
    for (const edge of city.segments) {
      const from = network.stationById.get(edge.from)!,
        to = network.stationById.get(edge.to)!;
      const points = edge.points ?? [
        [from.x, from.y],
        [to.x, to.y],
      ];
      points.slice(1).forEach((p, i) => {
        const dx = p[0] - points[i][0],
          dy = p[1] - points[i][1];
        if (Math.hypot(dx, dy) < 0.5) return;
        const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 45;
        expect(Math.min(angle, 45 - angle)).toBeLessThan(0.5);
      });
    }
  });

  it('models the L4 branches with changes at À Punt and Vicent Andrés Estellés only', () => {
    expect(line(4).stationIds).toHaveLength(33);
    const coma = trip('Mas del Rosari', 'Dr. Lluch');
    expect(coma.transferIds).toEqual([]);
    expect(coma.segmentIds).toHaveLength(29);
    const fira = trip('Fira València', 'Empalme');
    expect(fira.transferIds).toEqual([]);
    expect(names(trip('Ll. Llarga-Terramelar', 'Parc Científic').transferIds)).toEqual(['À Punt']);
    expect(names(trip('Fira València', 'À Punt').transferIds)).toEqual(['Vicent Andrés Estellés']);
    expect(isInterchange(network, id('À Punt'))).toBe(true);
    expect(isInterchange(network, id('Vicent Andrés Estellés'))).toBe(true);
    expect(isInterchange(network, id('Campus'))).toBe(false);
  });

  it('runs the Cabanyal–Malva-rosa loop one way for L4 and L6 and skips Dr. Lluch southbound on L6', () => {
    const loop = city.segments.filter(
      (e) =>
        [
          'La Cadena',
          'Platja Malva-rosa',
          'Platja les Arenes',
          'Dr. Lluch',
          'Cabanyal',
          'Canyamelar',
        ]
          .map(id)
          .includes(e.from) && e.oneWay,
    );
    expect(loop).toHaveLength(11);
    const north = trip('Marítim', 'Tossal del Rei');
    expect(names(north.stationIds)).toEqual(
      expect.arrayContaining(['Canyamelar', 'Dr. Lluch', 'Cabanyal', 'La Cadena']),
    );
    expect(names(north.stationIds)).not.toContain('Platja Malva-rosa');
    expect(north.transferIds).toEqual([]);
    const south = trip('Tossal del Rei', 'Marítim');
    expect(names(south.stationIds)).toEqual(
      expect.arrayContaining(['Platja Malva-rosa', 'Platja les Arenes', 'Canyamelar']),
    );
    expect(names(south.stationIds)).not.toContain('Dr. Lluch');
    expect(south.transferIds).toEqual([]);
    // Northbound L6 trams continue to Tossal del Rei, so Dr. Lluch to Marítim means changing to a southbound tram.
    const back = findRoute(only(6), id('Dr. Lluch'), id('Marítim'), [], 'transfers')!;
    expect(names(back.transferIds)).toEqual(['La Cadena']);
    expect(names(back.stationIds)).toEqual(
      expect.arrayContaining(['Cabanyal', 'Platja Malva-rosa', 'Canyamelar']),
    );
    // L4 trams terminate at Dr. Lluch, so continuing around the loop counts as a change there.
    const around = findRoute(only(4), id('Platja les Arenes'), id('Cabanyal'), [], 'transfers')!;
    expect(names(around.transferIds)).toEqual(['Dr. Lluch']);
    expect(names(trip('Ll. Llarga-Terramelar', 'Parc Científic').stationIds)).toHaveLength(3);
    expect(isTransferStation(network, id('La Cadena'))).toBe(true);
    expect(isInterchange(network, id('Cabanyal'))).toBe(true);
    expect(names(trip('La Cadena', 'Cabanyal').stationIds)).toEqual([
      'La Cadena',
      'Platja Malva-rosa',
      'Platja les Arenes',
      'Dr. Lluch',
      'Cabanyal',
    ]);
  });

  it('keeps Alacant separate from Xàtiva and Bailén without an invented rail link', () => {
    expect(findRoute(network, id('Alacant'), id('Xàtiva'))).toBeNull();
    expect(findRoute(network, id('Natzaret'), id('Colón'))).toBeNull();
    expect(isInterchange(network, id('Xàtiva'))).toBe(true);
    expect(isInterchange(network, id('Bailén'))).toBe(false);
    expect(isInterchange(network, id('Alacant'))).toBe(false);
  });

  it('changes between metro lines at the shared stations', () => {
    const airport = trip('Bétera', 'Aeroport');
    expect(names(airport.transferIds)).toEqual(['Àngel Guimerà']);
    expect(routeGroups(airport, city).map((g) => g.lineId)).toEqual([
      'valencia-l1',
      expect.stringMatching(/valencia-l[35]/),
    ]);
    const tram = trip('Tossal del Rei', 'Rafelbunyol');
    expect(names(tram.transferIds)).toEqual(['Benimaclet']);
    expect(names(trip('Llíria', 'Marítim').transferIds)).toHaveLength(1);
    const west = trip('Neptú', 'Riba-roja de Túria');
    expect(names(west.transferIds)).toHaveLength(2);
    expect(names(west.transferIds)[0]).toBe('Marítim');
  });

  it('searches Valencian names without diacritics and Spanish aliases', () => {
    expect(names(searchStations(network, 'angel guimera').map((s) => s.id))).toEqual([
      'Àngel Guimerà',
    ]);
    expect(names(searchStations(network, 'plaza españa').map((s) => s.id))).toEqual([
      'Pl. Espanya',
    ]);
    expect(names(searchStations(network, 'doctor lluch').map((s) => s.id))).toEqual(['Dr. Lluch']);
    expect(names(searchStations(network, 'terramelar').map((s) => s.id))).toEqual([
      'Ll. Llarga-Terramelar',
    ]);
    expect(names(searchStations(network, 'villanueva').map((s) => s.id))).toEqual(['Castelló']);
    expect(names(searchStations(network, 'aeropuerto').map((s) => s.id))).toEqual(['Aeroport']);
  });

  it('round-trips routes in backups and collects only the lines actually ridden', () => {
    const route = trip('Tossal del Rei', 'Rafelbunyol');
    const data = emptyData();
    const journey = {
      ...route,
      id: 'valencia-trip',
      kind: 'trip' as const,
      createdAt: '2026-10-08T02:00:00Z',
    };
    data.cities.valencia = [journey];
    expect(validateBackup(JSON.parse(JSON.stringify(data)), cities)).toEqual(data);
    const progress = getProgress([journey]);
    expect(progress.lines).toEqual(new Set(['valencia-l6', 'valencia-l3']));
    expect(progress.stations.get(id('Benimaclet'))?.transferred).toBe(true);
  });
});
