import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import example from '../../docs/city.example.json';
import { cityDistanceKm, sortCitiesByDistance } from './cityDistance';
import { validateCity } from './validate';

describe('city distance ordering', () => {
  it.each([
    ['shanghai', ['shanghai', 'hangzhou', 'beijing', 'guangzhou', 'shenzhen']],
    ['beijing', ['beijing', 'shanghai', 'hangzhou', 'guangzhou', 'shenzhen']],
    ['shenzhen', ['shenzhen', 'guangzhou', 'hangzhou', 'shanghai', 'beijing']],
    ['guangzhou', ['guangzhou', 'shenzhen', 'hangzhou', 'shanghai', 'beijing']],
    ['hangzhou', ['hangzhou', 'shanghai', 'guangzhou', 'shenzhen', 'beijing']],
  ])('orders cities relative to %s without changing the registry', (id, expected) => {
    const original = [...cities];
    expect(
      sortCitiesByDistance(
        cities,
        cities.find((city) => city.id === id)!,
      ).map((c) => c.id),
    ).toEqual(expected);
    expect(cities).toEqual(original);
  });

  it('accounts for the shorter path across the antimeridian and longitude at high latitudes', () => {
    expect(
      cityDistanceKm({ latitude: 0, longitude: 179 }, { latitude: 0, longitude: -179 }),
    ).toBeCloseTo(222.39, 1);
    const current = { latitude: 80, longitude: 0 };
    expect(cityDistanceKm(current, { latitude: 80, longitude: 10 })).toBeLessThan(
      cityDistanceKm(current, { latitude: 77, longitude: 0 }),
    );
    expect(cityDistanceKm(current, current)).toBe(0);
    expect(
      cityDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 }),
    ).toBeCloseTo(Math.PI * 6371);
  });

  it('puts the current city first even when another city has the same coordinates', () => {
    const current = validateCity(example);
    const other = { ...current, id: 'other-city' };
    expect(sortCitiesByDistance([other, current], current).map((c) => c.id)).toEqual([
      current.id,
      other.id,
    ]);
  });
});

describe('city coordinates', () => {
  it.each([
    { latitude: undefined },
    { longitude: undefined },
    { latitude: null },
    { longitude: '0' },
    { latitude: NaN },
    { longitude: Infinity },
    { latitude: 90.01 },
    { latitude: -90.01 },
    { longitude: 180.01 },
    { longitude: -180.01 },
  ])('rejects missing or invalid geographic coordinates: %j', (coordinates) => {
    expect(() => validateCity({ ...example, ...coordinates })).toThrow('城市经纬度无效');
  });

  it.each([
    { latitude: 0, longitude: 0 },
    { latitude: 90, longitude: 180 },
    { latitude: -90, longitude: -180 },
  ])('accepts zero and valid coordinate boundaries: %j', (coordinates) => {
    expect(validateCity({ ...example, ...coordinates })).toMatchObject(coordinates);
  });
});
