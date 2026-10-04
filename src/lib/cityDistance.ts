import type { CityData } from '../types';

type Location = Pick<CityData, 'latitude' | 'longitude'>;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance between representative city locations, in kilometres. */
export function cityDistanceKm(from: Location, to: Location): number {
  const a =
    Math.sin(radians(to.latitude - from.latitude) / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(radians(to.longitude - from.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function sortCitiesByDistance(cities: readonly CityData[], current: CityData): CityData[] {
  return cities
    .map((city) => ({ city, distance: cityDistanceKm(current, city) }))
    .sort((a, b) => {
      if (a.city.id === current.id) return b.city.id === current.id ? 0 : -1;
      if (b.city.id === current.id) return 1;
      return a.distance - b.distance;
    })
    .map(({ city }) => city);
}
