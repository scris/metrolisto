import type { CityData } from '../types';

const fail = (message: string): never => {
  throw new Error(`城市数据格式错误：${message}`);
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length < 200;
const point = (v: unknown) =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
const languageTag = (v: unknown): v is string => {
  if (!text(v)) return false;
  try {
    return Intl.getCanonicalLocales(v).length === 1;
  } catch {
    return false;
  }
};

function validateNames(value: unknown, context: string) {
  if (!Array.isArray(value) || !value.length) fail(`${context}至少需要一个名称`);
  const languages = new Set<string>();
  for (const entry of value as unknown[]) {
    if (!object(entry) || !languageTag(entry.language) || !text(entry.value))
      fail(`${context}名称或语言标签无效`);
    const language = Intl.getCanonicalLocales((entry as { language: string }).language)[0];
    if (languages.has(language)) fail(`${context}名称语言重复：${language}`);
    languages.add(language);
  }
}

export function validateCity(value: unknown): CityData {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !text(value.id) ||
    !/^[a-z0-9-]+$/.test(value.id) ||
    !text(value.zhName) ||
    !text(value.enName) ||
    !text(value.updatedAt) ||
    !text(value.description) ||
    !point(value.center)
  )
    fail('基本信息不完整');
  const city = value as unknown as CityData;
  if (
    typeof city.latitude !== 'number' ||
    !Number.isFinite(city.latitude) ||
    Math.abs(city.latitude) > 90 ||
    typeof city.longitude !== 'number' ||
    !Number.isFinite(city.longitude) ||
    Math.abs(city.longitude) > 180
  )
    fail('城市经纬度无效');
  if (
    city.localName !== undefined &&
    (!object(city.localName) || !text(city.localName.name) || !languageTag(city.localName.language))
  )
    fail('当地语言城市名或语言标签无效');
  if (![city.stations, city.lines, city.segments, city.sources].every(Array.isArray))
    fail('缺少 stations、lines、segments 或 sources');
  if (!city.stations.length || !city.lines.length || !city.segments.length) fail('线网不能为空');
  if (city.attribution !== undefined) {
    const credit = city.attribution;
    if (
      !object(credit) ||
      !['official', 'community'].includes(credit.kind) ||
      (credit.kind === 'community' && !text(credit.name))
    )
      fail('城市贡献者信息无效');
  }
  if (city.descriptionEn !== undefined && !text(city.descriptionEn)) fail('英文运营范围说明无效');
  const stations = new Set<string>(),
    lines = new Set<string>(),
    segments = new Set<string>();
  for (const s of city.stations) {
    if (!object(s) || !text(s.id) || !point([s.x, s.y]) || stations.has(s.id))
      fail('站点 ID 重复或坐标无效');
    validateNames(s.names, `站点 ${s.id} `);
    if (s.aliases && (!Array.isArray(s.aliases) || !s.aliases.every(text))) fail('站点别名无效');
    stations.add(s.id);
  }
  for (const l of city.lines) {
    if (
      !object(l) ||
      !text(l.id) ||
      !/^#[0-9a-f]{6}$/i.test(l.color) ||
      !['metro', 'tram', 'rail', 'maglev', 'cable-car'].includes(l.kind) ||
      lines.has(l.id)
    )
      fail('线路信息无效');
    validateNames(l.names, `线路 ${l.id} `);
    validateNames(l.shortNames, `线路 ${l.id} 简称`);
    if (
      !Array.isArray(l.stationIds) ||
      l.stationIds.length < 2 ||
      l.stationIds.some((id) => !stations.has(id)) ||
      new Set(l.stationIds).size !== l.stationIds.length
    )
      fail(`${l.id} 的站点引用无效`);
    lines.add(l.id);
  }
  for (const s of city.segments) {
    if (
      !object(s) ||
      !text(s.id) ||
      segments.has(s.id) ||
      !lines.has(s.lineId) ||
      !stations.has(s.from) ||
      !stations.has(s.to) ||
      s.from === s.to
    )
      fail('区间引用无效');
    const line = city.lines.find((l) => l.id === s.lineId)!;
    if (![s.from, s.to].every((id) => line.stationIds.includes(id))) fail('区间端点不在线路中');
    if (s.points && (!Array.isArray(s.points) || s.points.length < 2 || !s.points.every(point)))
      fail('区间示意坐标无效');
    if (
      s.curve !== undefined &&
      (s.curve !== 'cubic' || !s.points || s.points.length < 4 || (s.points.length - 1) % 3 !== 0)
    )
      fail('曲线需要起点及成组三个控制/终点坐标');
    if (s.oneWay !== undefined && typeof s.oneWay !== 'boolean') fail('oneWay 应为布尔值');
    segments.add(s.id);
  }
  if (city.sameLineTransfers !== undefined) {
    if (!Array.isArray(city.sameLineTransfers)) fail('同线换乘规则无效');
    for (const pair of city.sameLineTransfers) {
      if (
        !Array.isArray(pair) ||
        pair.length !== 2 ||
        pair[0] === pair[1] ||
        pair.some((id) => !segments.has(id))
      )
        fail('同线换乘区间引用无效');
      const a = city.segments.find((s) => s.id === pair[0])!;
      const b = city.segments.find((s) => s.id === pair[1])!;
      if (a.lineId !== b.lineId || ![a.from, a.to].some((id) => id === b.from || id === b.to))
        fail('同线换乘区间必须同线相邻');
    }
  }
  for (const line of city.lines) {
    if (line.services === undefined) continue;
    if (!Array.isArray(line.services) || !line.services.length) fail('直通交路不能为空');
    const serviceIds = new Set<string>();
    const covered = new Set<string>();
    for (const service of line.services) {
      if (
        !object(service) ||
        !text(service.id) ||
        serviceIds.has(service.id) ||
        !Array.isArray(service.stationIds) ||
        service.stationIds.length < 2 ||
        service.stationIds.some((id) => !line.stationIds.includes(id)) ||
        (service.oneWay !== undefined && typeof service.oneWay !== 'boolean')
      )
        fail(`${line.id} 的直通交路无效`);
      serviceIds.add(service.id);
      for (let i = 1; i < service.stationIds.length; i++) {
        const from = service.stationIds[i - 1],
          to = service.stationIds[i];
        for (const [a, b] of service.oneWay
          ? [[from, to]]
          : [
              [from, to],
              [to, from],
            ]) {
          const matching = city.segments.filter(
            (edge) =>
              edge.lineId === line.id &&
              ((edge.from === a && edge.to === b) ||
                (!edge.oneWay && edge.to === a && edge.from === b)),
          );
          if (!matching.length) fail(`${line.id} 的交路区间不存在或方向错误`);
          for (const edge of matching) covered.add(`${edge.id}|${a}`);
        }
      }
    }
    for (const edge of city.segments.filter((edge) => edge.lineId === line.id)) {
      if (
        !covered.has(`${edge.id}|${edge.from}`) ||
        (!edge.oneWay && !covered.has(`${edge.id}|${edge.to}`))
      )
        fail(`${line.id} 的交路未覆盖运营区间`);
    }
  }
  for (const source of city.sources)
    if (
      !object(source) ||
      !text(source.title) ||
      (source.titleEn !== undefined && !text(source.titleEn)) ||
      typeof source.url !== 'string' ||
      !/^https?:\/\//.test(source.url)
    )
      fail('来源链接无效');
  return city;
}
