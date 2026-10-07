import { describe, expect, it } from 'vitest';
import example from '../../docs/city.example.json';
import type { CityData, Point } from '../types';
import { labelLineOverlap } from './mapLabels';

function collision(points?: Point[], curve?: 'cubic') {
  const city = structuredClone(example) as CityData;
  city.segments = [{ ...city.segments[0], points, curve }];
  const overlap = labelLineOverlap(city);
  return (box: Parameters<typeof overlap>[0]) => overlap(box) > 0;
}

describe('station label line clearance', () => {
  it('penalises running along a track more than crossing it briefly', () => {
    const city = structuredClone(example) as CityData;
    city.segments = [
      {
        ...city.segments[0],
        points: [
          [0, 0],
          [200, 0],
          [200, 200],
        ],
      },
    ];
    const overlap = labelLineOverlap(city);
    expect(overlap({ x: 20, y: -10, w: 150, h: 20 })).toBeGreaterThan(
      overlap({ x: 120, y: 80, w: 150, h: 20 }),
    );
  });
  it('rejects labels on horizontal tracks, with space above and below', () => {
    const intersects = collision();
    expect(intersects({ x: 512, y: 890, w: 100, h: 20 })).toBe(true);
    expect(intersects({ x: 450, y: 868, w: 100, h: 20 })).toBe(false);
    expect(intersects({ x: 450, y: 912, w: 100, h: 20 })).toBe(false);
  });

  it('allows labels beside vertical tracks', () => {
    const intersects = collision([
      [500, 800],
      [500, 1000],
    ]);
    expect(intersects({ x: 512, y: 890, w: 100, h: 20 })).toBe(false);
    expect(intersects({ x: 388, y: 890, w: 100, h: 20 })).toBe(false);
    expect(intersects({ x: 450, y: 920, w: 100, h: 20 })).toBe(true);
  });

  it('includes the highlighted route stroke and label outline in clearance', () => {
    const intersects = collision([
      [0, 0],
      [200, 0],
    ]);
    expect(intersects({ x: 50, y: 6, w: 100, h: 20 })).toBe(true);
    expect(intersects({ x: 50, y: 12, w: 100, h: 20 })).toBe(false);
  });

  it('checks all polyline legs and uses drawing coordinates for offset tracks', () => {
    const intersects = collision([
      [0, 0],
      [0, 100],
      [200, 100],
    ]);
    expect(intersects({ x: 50, y: 90, w: 100, h: 20 })).toBe(true);
    expect(intersects({ x: 50, y: 40, w: 100, h: 20 })).toBe(false);
  });

  it('checks diagonal crossings without reserving the entire path bounding box', () => {
    const intersects = collision([
      [0, 0],
      [200, 200],
    ]);
    expect(intersects({ x: 90, y: 90, w: 20, h: 20 })).toBe(true);
    expect(intersects({ x: 20, y: 150, w: 20, h: 20 })).toBe(false);
  });

  it('follows cubic curves instead of their control polygon or endpoint chord', () => {
    const intersects = collision(
      [
        [0, 0],
        [0, 200],
        [200, 200],
        [200, 0],
        [200, -200],
        [400, -200],
        [400, 0],
      ],
      'cubic',
    );
    expect(intersects({ x: 90, y: 140, w: 20, h: 20 })).toBe(true);
    expect(intersects({ x: 290, y: -160, w: 20, h: 20 })).toBe(true);
    expect(intersects({ x: 90, y: -10, w: 20, h: 20 })).toBe(false);
    expect(intersects({ x: 90, y: 190, w: 20, h: 20 })).toBe(false);
  });
});
