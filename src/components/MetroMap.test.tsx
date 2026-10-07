import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import example from '../../docs/city.example.json';
import type { CityData, Progress } from '../types';
import { createNetwork } from '../lib/network';
import { localisedName } from '../lib/i18n';
import MetroMap from './MetroMap';

const preferences = vi.hoisted(() => ({ locale: 'zh-CN' as 'zh-CN' | 'en-GB' }));

vi.mock('./LocaleProvider', () => ({
  useLocale: () => ({
    locale: preferences.locale,
    t: (message: string) => message,
    name: (value: Parameters<typeof localisedName>[0]) => localisedName(value, preferences.locale),
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  preferences.locale = 'zh-CN';
});

function renderLabels(
  horizontal: boolean,
  label: number,
  viewportWidth = 1200,
  options: { crossing?: boolean; crowded?: boolean } = {},
) {
  vi.stubGlobal('window', { innerWidth: viewportWidth });
  const city = structuredClone(example) as CityData;
  const crossingLine = city.lines[1];
  city.stations = city.stations.slice(0, 3).map((s, i) => ({
    ...s,
    x: horizontal ? s.x : 1000,
    y: horizontal ? 900 : 400 + i * 500,
    label,
  }));
  city.lines = city.lines.slice(0, 1);
  city.segments = city.segments.slice(0, 2).map((s) => ({ ...s, points: undefined }));
  if (options.crossing) {
    const center = city.stations[1];
    const north = { ...center, id: 'north', y: 400 };
    const south = { ...center, id: 'south', y: 1400 };
    city.stations.push(north, south);
    city.lines.push({
      ...crossingLine,
      stationIds: [north.id, center.id, south.id],
    });
    city.segments.push(
      { id: 'north-center', lineId: city.lines[1].id, from: north.id, to: center.id },
      { id: 'center-south', lineId: city.lines[1].id, from: center.id, to: south.id },
    );
  }
  if (options.crowded) {
    city.stations[1].names.push({
      language: 'en-GB',
      value: 'Central Park International Interchange',
    });
    // Close parallel tracks occupy all eight candidate positions for the middle label.
    for (const y of [870, 930])
      city.segments.push({
        ...city.segments[0],
        id: `parallel-${y}`,
        points: [
          [500, y],
          [1500, y],
        ],
      });
  }
  const progress: Progress = {
    stations: new Map(),
    litStations: new Set(),
    segments: new Set(),
    lines: new Set(),
  };
  const html = renderToStaticMarkup(
    <MetroMap
      network={createNetwork(city)}
      progress={progress}
      route={null}
      activeLine={null}
      exploredOnly={false}
      focusStation={null}
      onStation={() => {}}
      manualStationIds={new Set()}
      onUnlightStation={() => {}}
      onSetEndpoint={() => {}}
    />,
  );
  return [...html.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map(([, attributes, name]) => ({
    name,
    x: Number(attributes.match(/\bx="([^"]+)"/)![1]),
    y: Number(attributes.match(/\by="([^"]+)"/)![1]),
    fontSize: Number(attributes.match(/\bfont-size="([^"]+)"/)![1]),
  }));
}

describe('station label placement', () => {
  it.each([0, 1])('keeps horizontal track labels clear for direction preference %i', (label) => {
    const labels = renderLabels(true, label);
    expect(labels).toHaveLength(3);
    for (const text of labels) {
      const top = text.y - text.fontSize * 1.3 * 0.77;
      const bottom = top + text.fontSize * 1.3;
      // An end station may also use the free space beyond the track's endpoint.
      const besideEndpoint =
        (text.name === 'West Gate' && text.x < 500 - 7) ||
        (text.name === '东门' && text.x > 1500 + 7);
      expect(besideEndpoint || bottom < 900 - 7 || top > 900 + 7).toBe(true);
    }
  });

  it('keeps the middle horizontal station name visible on mobile', () => {
    const labels = renderLabels(true, 0, 390);
    const middle = labels.find((text) => text.name === '中央公园')!;
    expect(middle).toBeDefined();
    expect(middle.y).toBeLessThan(900 - 7);
  });

  it('keeps vertical track labels beside their stations', () => {
    const labels = renderLabels(false, 0);
    expect(labels).toHaveLength(3);
    for (const text of labels) expect(text.x).toBeGreaterThan(1000 + 7);
  });

  it('keeps an interchange name visible in a free corner at a track crossing', () => {
    const labels = renderLabels(true, 0, 1200, { crossing: true });
    const center = labels.find((text) => text.name === '中央公园')!;
    expect(center).toBeDefined();
    expect(center.x).toBeGreaterThan(1000 + 7);
    expect(center.y).toBeLessThan(900 - 7);
  });

  it('retains a long English name when every candidate overlaps a track', () => {
    preferences.locale = 'en-GB';
    const labels = renderLabels(true, 0, 1200, { crossing: true, crowded: true });
    expect(labels.some((text) => text.name === 'Central Park International Interchange')).toBe(
      true,
    );
  });
});
