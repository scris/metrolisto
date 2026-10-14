import type { CityData, Point, Station } from '../types';

export interface StationSpan {
  points: Point[];
  from: Point;
  to: Point;
  length: number;
  angle: number;
  center: Point;
  padding: number;
}

/** Distance to the marker spine, including its allowance for offset endpoints. */
export function stationMarkerDistance(
  station: Station,
  span: StationSpan | undefined,
  point: Point,
) {
  const from = span?.from ?? ([station.x, station.y] as Point);
  const to = span?.to ?? from;
  const dx = to[0] - from[0],
    dy = to[1] - from[1];
  const along = Math.max(
    0,
    Math.min(1, ((point[0] - from[0]) * dx + (point[1] - from[1]) * dy) / (dx * dx + dy * dy || 1)),
  );
  return Math.max(
    0,
    Math.hypot(point[0] - from[0] - along * dx, point[1] - from[1] - along * dy) -
      (span?.padding ?? 0),
  );
}

/** Span offset drawing endpoints while keeping a single logical station. */
export function stationSpans(city: CityData): Map<string, StationSpan> {
  const endpoints = new Map(city.stations.map((s) => [s.id, [] as Point[]]));
  const anchors = new Map(city.stations.map((s) => [s.id, [s.x, s.y] as Point]));
  for (const edge of city.segments) {
    endpoints.get(edge.from)!.push(edge.points?.[0] ?? anchors.get(edge.from)!);
    endpoints.get(edge.to)!.push(edge.points?.at(-1) ?? anchors.get(edge.to)!);
  }
  const spans = new Map<string, StationSpan>();
  for (const [id, points] of endpoints) {
    if (!points.length) continue;
    let from = points[0],
      to = points[0],
      length = 0;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const distance = Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]);
        if (distance > length) {
          from = points[i];
          to = points[j];
          length = distance;
        }
      }
    }
    if (
      length > 0.1 ||
      Math.hypot(from[0] - anchors.get(id)![0], from[1] - anchors.get(id)![1]) > 0.1
    )
      spans.set(id, {
        points: [...new Map(points.map((point) => [point.join(','), point])).values()],
        from,
        to,
        length,
        angle: (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI,
        center: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
        padding:
          length > 0.1
            ? Math.max(
                ...points.map(
                  (point) =>
                    Math.abs(
                      (to[0] - from[0]) * (point[1] - from[1]) -
                        (to[1] - from[1]) * (point[0] - from[0]),
                    ) / length,
                ),
              )
            : 0,
      });
  }
  return spans;
}

/** Drawn tracks this close are one shared section rather than separate approaches. */
const SHARED_TRACK_GAP = 12;

/**
 * Multi-line stops where every pair of lines runs together on a shared section, drawn as
 * ordinary stops. The interchange marker is reserved for stops where separately drawn
 * tracks meet, cross or terminate.
 */
export function mergedStops(city: CityData): Set<string> {
  const anchors = new Map(city.stations.map((s) => [s.id, [s.x, s.y] as Point]));
  type Approach = { to: string; path: Point[] };
  const approaches = new Map<string, Map<string, Approach[]>>();
  const add = (station: string, line: string, approach: Approach) => {
    const lines = approaches.get(station) ?? new Map<string, Approach[]>();
    lines.set(line, [...(lines.get(line) ?? []), approach]);
    approaches.set(station, lines);
  };
  for (const edge of city.segments) {
    const path = edge.points ?? [anchors.get(edge.from)!, anchors.get(edge.to)!];
    add(edge.from, edge.lineId, { to: edge.to, path });
    add(edge.to, edge.lineId, { to: edge.from, path: [...path].reverse() });
  }
  const close = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= SHARED_TRACK_GAP;
  const length = (path: Point[]) =>
    path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]), 0);
  const together = (a: Approach[], b: Approach[]) =>
    a.some((x) =>
      b.some(
        (y) =>
          x.to === y.to &&
          close(x.path[0], y.path[0]) &&
          close(x.path.at(-1)!, y.path.at(-1)!) &&
          Math.abs(length(x.path) - length(y.path)) <= 2 * SHARED_TRACK_GAP,
      ),
    );
  const merged = new Set<string>();
  for (const [station, lines] of approaches) {
    const groups = [...lines.values()];
    if (
      groups.length > 1 &&
      groups.every((a, i) => groups.slice(i + 1).every((b) => together(a, b)))
    )
      merged.add(station);
  }
  return merged;
}

/** Cubic paths store a start point followed by control/control/end triples. */
export function cubicPath(points: Point[]): string {
  return `M ${points[0].join(',')} C ${points
    .slice(1)
    .map((p) => p.join(','))
    .join(' ')}`;
}

export function cubicArrow(points: Point[]) {
  const index = Math.floor((points.length - 1) / 3 / 2) * 3;
  const [a, b, c, d] = points.slice(index, index + 4);
  // Position and derivative at t=1/2 of the middle curve.
  const x = (a[0] + 3 * b[0] + 3 * c[0] + d[0]) / 8;
  const y = (a[1] + 3 * b[1] + 3 * c[1] + d[1]) / 8;
  const dx = -a[0] - b[0] + c[0] + d[0];
  const dy = -a[1] - b[1] + c[1] + d[1];
  return {
    x,
    y,
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    length:
      Math.hypot(b[0] - a[0], b[1] - a[1]) +
      Math.hypot(c[0] - b[0], c[1] - b[1]) +
      Math.hypot(d[0] - c[0], d[1] - c[1]),
  };
}
