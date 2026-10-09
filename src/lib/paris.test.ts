import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import { localisedName } from './i18n';
import { stationSpans } from './mapGeometry';
import { createNetwork, findRoute, isInterchange, routeGroups, searchStations } from './network';
import { emptyData, getProgress, validateBackup } from './storage';

const city = cities.find((c) => c.id === 'paris')!;
const network = createNetwork(city);
const id = (name: string) => city.stations.find((s) => s.names[0].value === name)!.id;
const names = (ids: string[]) => ids.map((s) => network.stationById.get(s)!.names[0].value);
const linesAt = (name: string) =>
  city.lines.filter((l) => l.stationIds.includes(id(name))).map((l) => l.shortNames[0].value);
const trip = (from: string, to: string, via: string[] = []) => {
  const route = findRoute(network, id(from), id(to), via.map(id), 'transfers');
  expect(route).not.toBeNull();
  return route!;
};

describe('Paris Métro and RER', () => {
  it('includes 16 Métro lines and RER A–E with French-only station names', () => {
    expect(city.lines.map((l) => l.shortNames[0].value)).toEqual([
      '1',
      '2',
      '3',
      '3bis',
      '4',
      '5',
      '6',
      '7',
      '7bis',
      '8',
      '9',
      '10',
      '11',
      '12',
      '13',
      '14',
      'A',
      'B',
      'C',
      'D',
      'E',
    ]);
    expect(city.stations).toHaveLength(541);
    expect(city.segments).toHaveLength(641);
    expect(city.lines.filter((l) => l.kind === 'rail').map((l) => l.shortNames[0].value)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
    ]);
    expect(city.localName).toEqual({ name: 'Paris', language: 'fr-FR' });
    for (const station of city.stations) {
      expect(station.names).toEqual([{ language: 'fr-FR', value: station.names[0].value }]);
      expect(localisedName(station, 'zh-CN')).toBe(station.names[0].value);
    }
    // Not open in this snapshot: Line 15 Sud, the RER E extension beyond Nanterre and Transilien.
    expect(city.lines.some((l) => l.shortNames[0].value === '15')).toBe(false);
    expect(
      city.stations.some((s) => /Mantes|Vaires|Igny|Jouy-en-Josas/.test(s.names[0].value)),
    ).toBe(false);
  });

  it.each([
    ['1', 25],
    ['2', 25],
    ['3', 25],
    ['3bis', 4],
    ['4', 29],
    ['5', 22],
    ['6', 28],
    ['7', 38],
    ['7bis', 8],
    ['8', 38],
    ['9', 37],
    ['10', 23],
    ['11', 19],
    ['12', 31],
    ['13', 32],
    ['14', 21],
    ['A', 46],
    ['B', 47],
    ['C', 75],
    ['D', 59],
    ['E', 25],
  ])('line %s serves %i stations', (line, count) => {
    expect(city.lines.find((l) => l.shortNames[0].value === line)!.stationIds).toHaveLength(count);
  });

  it('merges station complexes across Métro and RER', () => {
    expect(linesAt('Châtelet – Les Halles')).toEqual(['1', '4', '7', '11', '14', 'A', 'B', 'D']);
    expect(linesAt('Gare du Nord')).toEqual(['4', '5', 'B', 'D', 'E']);
    expect(linesAt('Saint-Lazare')).toEqual(['3', '12', '13', '14', 'E']);
    expect(linesAt('Opéra')).toEqual(['3', '7', '8', 'A']);
    expect(linesAt('Nation')).toEqual(['1', '2', '6', '9', 'A']);
    expect(linesAt('La Défense')).toEqual(['1', 'A', 'E']);
    expect(linesAt('Saint-Michel – Notre-Dame')).toEqual(['4', 'B', 'C']);
    expect(linesAt('Porte Maillot')).toEqual(['1', 'C', 'E']);
    // Separate stations linked only by street-level or walking connections keep their own IDs.
    for (const [a, b] of [
      ["Gare de l'Est", 'Gare du Nord'],
      ['Cluny – La Sorbonne', 'Saint-Michel – Notre-Dame'],
      ['Solférino', "Musée d'Orsay"],
      ['Bir-Hakeim', 'Champ de Mars Tour Eiffel'],
      ['Nanterre – Préfecture', 'Nanterre – La Folie'],
    ])
      expect(id(a)).not.toBe(id(b));
    expect(names(searchStations(network, 'magenta').map((s) => s.id))).toEqual(['Gare du Nord']);
    expect(names(searchStations(network, 'auber').map((s) => s.id))).toContain('Opéra');
    expect(names(searchStations(network, 'haussmann').map((s) => s.id))).toEqual(['Saint-Lazare']);
    expect(
      city.stations.filter((s) => s.names[0].value === 'Malesherbes').map((s) => s.id),
    ).toEqual(['paris-malesherbes', 'paris-malesherbes-rer-d']);
  });

  it('runs every line direct end to end and counts branch changes', () => {
    const l1 = trip('La Défense', 'Château de Vincennes');
    expect(l1.lineIds.every((l) => l === 'paris-1')).toBe(true);
    expect(l1.segmentIds).toHaveLength(24);
    expect(l1.transferIds).toEqual([]);
    const e = trip('Nanterre – La Folie', 'Chelles – Gournay');
    expect(e.lineIds.every((l) => l === 'paris-e')).toBe(true);
    expect(e.transferIds).toEqual([]);
    expect(names(trip("Mairie d'Ivry", 'Villejuif – Louis Aragon').transferIds)).toEqual([
      'Maison Blanche',
    ]);
    expect(names(trip('Boissy-Saint-Léger', 'Marne-la-Vallée – Chessy').transferIds)).toEqual([
      'Vincennes',
    ]);
    expect(names(trip('Robinson', 'Saint-Rémy-lès-Chevreuse').transferIds)).toEqual([
      'Bourg-la-Reine',
    ]);
    expect(names(trip('Chelles – Gournay', 'Tournan').transferIds)).toEqual(['Noisy-le-Sec']);
    expect(names(trip('Saint-Germain-en-Laye', 'Cergy-le-Haut').transferIds)).toEqual([
      'Nanterre – Préfecture',
    ]);
    // Trains to Cergy and Poissy run from Nanterre – Préfecture to Houilles without calling at Nanterre – Université.
    expect(names(trip('La Défense', 'Houilles – Carrières-sur-Seine').stationIds)).toEqual([
      'La Défense',
      'Nanterre – Préfecture',
      'Houilles – Carrières-sur-Seine',
    ]);
  });

  it('keeps the 7bis and Auteuil loops one way', () => {
    const loop = city.segments.filter((s) => s.lineId === 'paris-7bis' && s.oneWay);
    expect(loop.map((s) => s.id).sort()).toEqual([
      'paris-7bis--botzaris--place-des-fetes',
      'paris-7bis--danube--botzaris',
      'paris-7bis--place-des-fetes--pre-saint-gervais',
      'paris-7bis--pre-saint-gervais--danube',
    ]);
    expect(names(trip('Danube', 'Place des Fêtes').stationIds)).toEqual([
      'Danube',
      'Botzaris',
      'Place des Fêtes',
    ]);
    expect(names(trip('Danube', 'Place des Fêtes').transferIds)).toEqual(['Botzaris']);
    expect(names(trip('Buttes Chaumont', 'Danube').stationIds)).toEqual([
      'Buttes Chaumont',
      'Botzaris',
      'Place des Fêtes',
      'Pré-Saint-Gervais',
      'Danube',
    ]);
    const west = trip("Gare d'Austerlitz", 'Boulogne – Pont de Saint-Cloud');
    expect(names(west.stationIds)).toContain("Église d'Auteuil");
    expect(names(west.stationIds)).not.toContain('Mirabeau');
    const east = trip('Boulogne – Pont de Saint-Cloud', "Gare d'Austerlitz");
    expect(names(east.stationIds)).toContain('Mirabeau');
    expect(names(east.stationIds)).not.toContain("Église d'Auteuil");
    expect(east.transferIds).toEqual([]);
  });

  it('draws RER B and D on separate parallel paths between Gare du Nord and Châtelet', () => {
    const trunk = city.segments.filter(
      (s) =>
        [s.from, s.to].includes(id('Gare du Nord')) &&
        [s.from, s.to].includes(id('Châtelet – Les Halles')),
    );
    expect(trunk.map((s) => s.lineId).sort()).toEqual(['paris-b', 'paris-d']);
    const [b, d] = trunk.map((s) => s.points!);
    expect(Math.hypot(b[0][0] - d.at(-1)![0], b[0][1] - d.at(-1)![1])).toBeGreaterThan(13);
    expect(stationSpans(city).get(id('Gare du Nord'))?.length).toBeGreaterThan(13);
    expect(routeGroups(trip('Aéroport Charles de Gaulle 2 – TGV', 'Melun'), city)).toHaveLength(2);
    expect(isInterchange(network, id('Gare du Nord'))).toBe(true);
  });

  it('round-trips journeys in backups and counts only the lines ridden', () => {
    const route = trip('Aéroport Charles de Gaulle 2 – TGV', "Aéroport d'Orly");
    const data = emptyData();
    const journey = {
      ...route,
      id: 'paris-trip',
      kind: 'trip' as const,
      createdAt: '2026-10-08T10:00:00Z',
    };
    data.cities.paris = [journey];
    expect(validateBackup(JSON.parse(JSON.stringify(data)), cities)).toEqual(data);
    const progress = getProgress([journey]);
    expect(progress.lines.size).toBeGreaterThanOrEqual(2);
    expect(progress.segments.size).toBe(route.segmentIds.length);
  });

  it('keeps both southern RER D corridors and the Melun and Malesherbes branches distinct', () => {
    const corridors = [
      [
        'Viry-Châtillon',
        'Grigny Centre',
        "Orangis – Bois de l'Épine",
        'Évry – Courcouronnes',
        'Le Bras de Fer – Évry Génopole',
        'Corbeil-Essonnes',
      ],
      ['Viry-Châtillon', 'Ris-Orangis', 'Grand Bourg', 'Évry – Val de Seine', 'Corbeil-Essonnes'],
      [
        'Villeneuve-Saint-Georges',
        'Montgeron – Crosne',
        'Yerres',
        'Brunoy',
        'Boussy-Saint-Antoine',
        'Combs-la-Ville – Quincy',
        'Lieusaint – Moissy',
        'Savigny-le-Temple – Nandy',
        'Cesson',
        'Le Mée-sur-Seine',
        'Melun',
      ],
      [
        'Corbeil-Essonnes',
        'Essonnes Robinson',
        'Villabé',
        'Le Plessis Chenet',
        'Le Coudray-Montceaux',
        'Saint-Fargeau',
        'Ponthierry – Pringy',
        'Boissise-le-Roi',
        'Vosves',
        'Melun',
      ],
    ];
    for (const stops of corridors) {
      const entry = trip(stops[0], stops[1]);
      expect(names(entry.stationIds)).toEqual(stops.slice(0, 2));
      const route = trip(stops[1], stops.at(-1)!);
      expect(names(route.stationIds)).toEqual(stops.slice(1));
      expect(route.lineIds.every((line) => line === 'paris-d')).toBe(true);
      const positions = [entry.stationIds[0], ...route.stationIds].map((station) =>
        network.stationById.get(station)!,
      );
      for (let i = 1; i < positions.length; i++)
        expect(positions[i].y).toBeGreaterThanOrEqual(positions[i - 1].y);
    }
    const south = findRoute(network, id('Corbeil-Essonnes'), 'paris-malesherbes-rer-d')!;
    expect(south).not.toBeNull();
    expect(south.stationIds.at(-1)).toBe('paris-malesherbes-rer-d');
    for (let i = 1; i < south.stationIds.length; i++) {
      expect(network.stationById.get(south.stationIds[i])!.y).toBeGreaterThan(
        network.stationById.get(south.stationIds[i - 1])!.y,
      );
    }
    const west = network.stationById.get(id('Évry – Courcouronnes'))!;
    const east = network.stationById.get(id('Évry – Val de Seine'))!;
    expect(east.x - west.x).toBeGreaterThan(100);
  });

  it('separates the B/C tracks at Massy instead of drawing them on top of each other', () => {
    const tracks = city.segments.filter(
      (s) =>
        [s.from, s.to].includes(id('Massy – Palaiseau')) &&
        [s.from, s.to].includes(id('Massy – Verrières')),
    );
    expect(tracks.map((s) => s.lineId).sort()).toEqual(['paris-b', 'paris-c']);
    const ports = tracks.map((s) =>
      s.from === id('Massy – Palaiseau') ? s.points![0] : s.points!.at(-1)!,
    );
    expect(Math.hypot(ports[0][0] - ports[1][0], ports[0][1] - ports[1][1])).toBeGreaterThan(13);
  });
});
