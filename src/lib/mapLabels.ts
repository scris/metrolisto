import type { CityData, Point } from '../types';

export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CURVE_TOLERANCE = 0.5;
// Allow for the widest route stroke, the label outline and curve approximation.
const CLEARANCE = 9 / 2 + 2 + CURVE_TOLERANCE;

function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)),
  );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

const midpoint = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function flattenCurve(a: Point, b: Point, c: Point, d: Point, result: Point[], depth = 0) {
  if (
    depth >= 16 ||
    Math.max(distanceToSegment(b, a, d), distanceToSegment(c, a, d)) <= CURVE_TOLERANCE
  ) {
    result.push(d);
    return;
  }
  const ab = midpoint(a, b),
    bc = midpoint(b, c),
    cd = midpoint(c, d),
    abc = midpoint(ab, bc),
    bcd = midpoint(bc, cd),
    middle = midpoint(abc, bcd);
  flattenCurve(a, ab, abc, middle, result, depth + 1);
  flattenCurve(middle, bcd, cd, d, result, depth + 1);
}

/** Cache drawn paths once and measure track length inside each label, including clearance. */
export function labelLineOverlap(city: CityData): (box: LabelBox) => number {
  const anchors = new Map(city.stations.map((s) => [s.id, [s.x, s.y] as Point]));
  const legs = city.segments.flatMap((edge) => {
    const points = edge.points ?? [anchors.get(edge.from)!, anchors.get(edge.to)!];
    const path = edge.curve === 'cubic' ? [points[0]] : points;
    if (edge.curve === 'cubic') {
      for (let i = 0; i + 3 < points.length; i += 3)
        flattenCurve(points[i], points[i + 1], points[i + 2], points[i + 3], path);
    }
    return path.slice(1).map((b, i) => [path[i], b] as const);
  });
  return (box) =>
    legs.reduce((overlap, [a, b]) => {
      let start = 0,
        end = 1;
      // Clip the line segment against the label's rectangle, including stroke clearance.
      for (const axis of [0, 1] as const) {
        const min = (axis === 0 ? box.x : box.y) - CLEARANCE;
        const max = min + (axis === 0 ? box.w : box.h) + CLEARANCE * 2;
        const delta = b[axis] - a[axis];
        if (delta === 0) {
          if (a[axis] < min || a[axis] > max) return overlap;
        } else {
          const t1 = (min - a[axis]) / delta,
            t2 = (max - a[axis]) / delta;
          start = Math.max(start, Math.min(t1, t2));
          end = Math.min(end, Math.max(t1, t2));
          if (start > end) return overlap;
        }
      }
      return overlap + Math.hypot(b[0] - a[0], b[1] - a[1]) * (end - start);
    }, 0);
}
