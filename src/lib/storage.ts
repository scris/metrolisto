import { routeTransfers } from './network';
import type { CityData, Journey, Progress, SavedData } from '../types';

export const STORAGE_KEY = 'metrolisto.journeys.v1';
export const emptyData = (): SavedData => ({ version: 1, cities: {} });

export function validateBackup(value: unknown, cities: CityData[], recover = false): SavedData {
  if (!value || typeof value !== 'object') throw new Error('无法识别备份文件');
  const data = value as SavedData;
  if (
    data.version !== 1 ||
    !data.cities ||
    typeof data.cities !== 'object' ||
    Array.isArray(data.cities)
  )
    throw new Error('备份版本或格式不正确');
  const result = emptyData();
  const quarantine = (cityId: string, value: unknown, reason: string) => {
    if (!recover) throw new Error(reason);
    (result.quarantined ??= []).push({ cityId, value, reason });
  };
  if (data.quarantined !== undefined) {
    if (
      !Array.isArray(data.quarantined) ||
      data.quarantined.some(
        (entry) =>
          !entry ||
          typeof entry.cityId !== 'string' ||
          typeof entry.reason !== 'string' ||
          !('value' in entry),
      )
    )
      throw new Error('隔离记录格式不正确');
    if (data.quarantined.length) result.quarantined = [...data.quarantined];
  }
  for (const [cityId, journeys] of Object.entries(data.cities)) {
    const city = cities.find((c) => c.id === cityId);
    if (!city || !Array.isArray(journeys) || journeys.length > 20000) {
      quarantine(
        cityId,
        journeys,
        !city ? `请先添加城市数据：${cityId}` : '行程记录格式不正确或数量过多',
      );
      continue;
    }
    const stations = new Set(city.stations.map((s) => s.id));
    const segments = new Map(city.segments.map((s) => [s.id, s]));
    const ids = new Set<string>();
    const valid: Journey[] = [];
    for (const j of journeys) {
      try {
        if (
          !j ||
          typeof j.id !== 'string' ||
          !j.id ||
          ids.has(j.id) ||
          !['trip', 'station'].includes(j.kind) ||
          typeof j.createdAt !== 'string' ||
          !Number.isFinite(Date.parse(j.createdAt))
        )
          throw new Error('行程信息无效');
        if (
          !Array.isArray(j.stationIds) ||
          !j.stationIds.length ||
          j.stationIds.some((id) => !stations.has(id)) ||
          !Array.isArray(j.segmentIds) ||
          !Array.isArray(j.lineIds) ||
          !Array.isArray(j.transferIds)
        )
          throw new Error('站点或线路数据不匹配');
        if (j.kind === 'station') {
          if (
            j.stationIds.length !== 1 ||
            j.segmentIds.length ||
            j.lineIds.length ||
            j.transferIds.length
          )
            throw new Error('单站记录不应含区间');
        } else {
          if (
            j.segmentIds.length !== j.stationIds.length - 1 ||
            !j.segmentIds.length ||
            j.lineIds.length !== j.segmentIds.length
          )
            throw new Error('行程区间数量不匹配');
          j.segmentIds.forEach((id, i) => {
            const edge = segments.get(id),
              a = j.stationIds[i],
              b = j.stationIds[i + 1];
            if (
              !edge ||
              edge.lineId !== j.lineIds[i] ||
              !(
                (edge.from === a && edge.to === b) ||
                (!edge.oneWay && edge.from === b && edge.to === a)
              )
            )
              throw new Error('行程含不连通或方向错误的区间');
          });
          const transfers = routeTransfers(city, j);
          if (JSON.stringify(transfers) !== JSON.stringify(j.transferIds))
            throw new Error('换乘记录不匹配');
        }
        ids.add(j.id);
        valid.push(j);
      } catch (error) {
        quarantine(cityId, j, error instanceof Error ? error.message : '行程信息无效');
      }
    }
    result.cities[cityId] = valid.map((j) => ({
      id: j.id,
      kind: j.kind,
      createdAt: j.createdAt,
      stationIds: [...j.stationIds],
      segmentIds: [...j.segmentIds],
      lineIds: [...j.lineIds],
      transferIds: [...j.transferIds],
    }));
  }
  return result;
}

export function readSavedData(cities: CityData[]): { data: SavedData; error: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { data: raw ? validateBackup(JSON.parse(raw), cities, true) : emptyData(), error: null };
  } catch {
    return {
      data: emptyData(),
      error: '本地记录无法读取，原数据已保留。请导出备份后检查浏览器存储权限。',
    };
  }
}

/** Remove manual visits only; trip endpoints, transfers and sections remain independent. */
export function removeStationLighting(journeys: Journey[], stationId: string): Journey[] {
  return journeys.filter((j) => j.kind !== 'station' || j.stationIds[0] !== stationId);
}

export function getProgress(journeys: Journey[]): Progress {
  const result: Progress = {
    stations: new Map(),
    litStations: new Set(),
    segments: new Set(),
    lines: new Set(),
  };
  for (const j of journeys) {
    j.stationIds.forEach((id, i) => {
      const state = result.stations.get(id) ?? {
        passed: false,
        transferred: false,
        visited: false,
      };
      state.passed = true;
      if (i === 0 || i === j.stationIds.length - 1) state.visited = true;
      if (j.transferIds.includes(id)) state.transferred = true;
      if (state.visited || state.transferred) result.litStations.add(id);
      result.stations.set(id, state);
    });
    j.segmentIds.forEach((id) => result.segments.add(id));
    j.lineIds.forEach((id) => result.lines.add(id));
  }
  return result;
}

/** Merge by record identity, comparing values independently of JSON property order. */
export function mergeBackups(current: SavedData, incoming: SavedData): SavedData {
  const result: SavedData = { version: 1, cities: { ...current.cities } };
  const quarantined = [
    ...new Map(
      [...(current.quarantined ?? []), ...(incoming.quarantined ?? [])].map((entry) => [
        JSON.stringify(entry),
        entry,
      ]),
    ).values(),
  ];
  if (quarantined.length) result.quarantined = quarantined;
  const signature = (j: Journey) =>
    JSON.stringify([j.kind, j.createdAt, j.stationIds, j.segmentIds, j.lineIds, j.transferIds]);
  for (const [cityId, journeys] of Object.entries(incoming.cities)) {
    const merged = new Map((result.cities[cityId] ?? []).map((j) => [j.id, j]));
    for (const journey of journeys) {
      const existing = merged.get(journey.id);
      if (existing && signature(existing) !== signature(journey)) {
        throw new Error('备份存在同 ID 的不同记录，未导入');
      }
      merged.set(journey.id, journey);
    }
    if (merged.size > 20000) throw new Error('合并后的城市行程数量超过 20000 条，未导入');
    result.cities[cityId] = [...merged.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }
  return result;
}
