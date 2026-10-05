import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import type { CityData } from '../types';
import example from '../../docs/city.example.json';
import { stationSpans } from './mapGeometry';

describe('parallel station markers', () => {
  it.each(['london', 'guangzhou'])(
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

  it('preserves Shanghai drawing paths and circular station markers', () => {
    expect(stationSpans(cities.find((c) => c.id === 'shanghai')!).size).toBe(0);
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
