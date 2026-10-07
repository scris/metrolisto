import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import type { CityData, Point } from '../types';
import example from '../../docs/city.example.json';
import { stationSpans } from './mapGeometry';

describe('parallel station markers', () => {
  it.each(['london', 'guangzhou', 'shanghai'])(
    '%s: encloses the drawing endpoints at shared stops and branches',
    (id) => {
      const city = cities.find((c) => c.id === id)!;
      const spans = stationSpans(city);
      expect(spans.size).toBeGreaterThan(0);
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
          const along = span.length
            ? Math.max(0, Math.min(span.length, (dx * px + dy * py) / span.length))
            : 0;
          const distance = Math.hypot(
            px - (span.length ? (dx * along) / span.length : 0),
            py - (span.length ? (dy * along) / span.length : 0),
          );
          expect(distance).toBeLessThanOrEqual(span.padding + 0.001);
        }
      }
    },
  );

  it.each(['london', 'amsterdam'])('%s: draws no line through a stop it does not serve', (id) => {
    const city = cities.find((c) => c.id === id)!;
    const anchors = new Map(city.stations.map((s) => [s.id, [s.x, s.y] as Point]));
    const markers = new Map(city.stations.map((s) => [s.id, [] as Point[]]));
    const path = (edge: CityData['segments'][number]) =>
      edge.points ?? [anchors.get(edge.from)!, anchors.get(edge.to)!];
    for (const edge of city.segments) {
      markers.get(edge.from)!.push(path(edge)[0]);
      markers.get(edge.to)!.push(path(edge).at(-1)!);
    }
    const distance = (p: Point, a: Point, b: Point) => {
      const dx = b[0] - a[0],
        dy = b[1] - a[1];
      const t = Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)),
      );
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    };
    const crossings = city.segments.flatMap((edge) =>
      city.stations
        .filter(
          (s) =>
            s.id !== edge.from &&
            s.id !== edge.to &&
            markers
              .get(s.id)!
              .some((p) =>
                path(edge).some((b, i, all) => i > 0 && distance(p, all[i - 1], b) < 12),
              ),
        )
        .map((s) => `${edge.id} @ ${s.names[0].value}`),
    );
    expect(crossings).toEqual([]);
  });

  it('places a single-line stop on its offset track without spanning a non-stopping line', () => {
    const city = structuredClone(example) as CityData;
    const edge = city.segments[0];
    const station = city.stations.find((s) => s.id === edge.from)!;
    city.segments = [
      {
        ...edge,
        points: [
          [station.x + 14, station.y],
          [station.x + 14, station.y + 100],
        ],
      },
    ];
    const span = stationSpans(city).get(station.id)!;
    expect(span.center).toEqual([station.x + 14, station.y]);
    expect(span.length).toBe(0);
    expect(span.padding).toBe(0);
  });

  it('joins Shanghai parallel tracks only at the two Jinshan interchanges', () => {
    const city = cities.find((c) => c.id === 'shanghai')!;
    const spans = stationSpans(city);
    expect([...spans.keys()].sort()).toEqual(['310100025685025', '310100025685029']);
    const rail = city.segments.filter((s) => s.lineId === 'shanghai-金山铁路');
    expect(rail[0].points!.at(-1)).toEqual(rail[1].points![0]);
    for (const span of spans.values()) expect(span.length).toBeCloseTo(14, 1);
  });

  it('keeps Jinshan clear of the intermediate Line 1 station markers even when highlighted', () => {
    const city = cities.find((c) => c.id === 'shanghai')!;
    const points = city.segments.find(
      (s) => s.lineId === 'shanghai-金山铁路' && s.to === '310100025685029',
    )!.points!;
    for (const id of ['310100025685028', '310100025685027', '310100025685026']) {
      const station = city.stations.find((s) => s.id === id)!;
      const clearance = Math.min(
        ...points.slice(1).map((b, i) => {
          const a = points[i],
            dx = b[0] - a[0],
            dy = b[1] - a[1];
          const t = Math.max(
            0,
            Math.min(1, ((station.x - a[0]) * dx + (station.y - a[1]) * dy) / (dx * dx + dy * dy)),
          );
          return Math.hypot(station.x - a[0] - t * dx, station.y - a[1] - t * dy);
        }),
      );
      // Ordinary marker radius + outline + the widest route stroke's half-width.
      expect(clearance).toBeGreaterThan(5.7 + 0.9 + 9 / 2);
    }
  });

  it('keeps Guangzhou 4/12 parallel through Daxuechengbei', () => {
    const city = cities.find((c) => c.id === 'guangzhou')!;
    const station = city.stations.find((s) => s.names.some((n) => n.value === '大学城北'))!.id;
    const ports = ['4号线', '12号线'].map((line) => {
      const points = city.segments
        .filter((e) => e.lineId === `guangzhou-${line}` && [e.from, e.to].includes(station))
        .map((e) => (e.from === station ? e.points![0] : e.points!.at(-1)!));
      expect(points).toHaveLength(2);
      expect(points[0]).toEqual(points[1]);
      return points[0];
    });
    expect(ports[0]).not.toEqual(ports[1]);
  });
});
