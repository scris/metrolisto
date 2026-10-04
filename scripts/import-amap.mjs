/** Usage: node scripts/import-amap.mjs /path/to/city.json [/path/to/another-city.json ...]
 * Offline build-time adapter. Runtime uses the checked-in, provider-independent schema.
 */
import fs from 'node:fs';
import { formatCityData } from './format-city-data.mjs';

const cityConfigs = {
  shanghai: { amapId: '3100' },
  beijing: { amapId: '1100' },
  shenzhen: {
    amapId: '4403',
    // Same POI and explicit interchange in Amap, despite separate station IDs.
    stationIds: { 440300024058036: '440300024063028' }, // 大剧院 (1/2/5号线)
    shortNames: { '2号线/8号线': '2/8', 坪山云巴1号线: '云巴1' },
  },
  guangzhou: {
    amapId: '4401',
    preservedLines: ['guangzhou-佛山3号线'],
    stationIds: { 900000074701016: '900000099784007' }, // 新市墟 (12/14号线)
    shortNames: { '14号线支线(知识城线)': '14知识城', APM线: 'APM', 广佛线: '广佛' },
  },
};

const point = (p) => p.split(' ').map(Number);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function slicePath(path, a, b, loop) {
  const nearest = (p) =>
    path.reduce((best, v, i) => (distance(p, v) < distance(p, path[best]) ? i : best), 0);
  let ia = nearest(a),
    ib = nearest(b);
  let points = path.slice(Math.min(ia, ib), Math.max(ia, ib) + 1);
  if (ia > ib) points.reverse();
  if (loop) {
    let alternate =
      ia < ib
        ? [...path.slice(0, ia + 1).reverse(), ...path.slice(ib).reverse()]
        : [...path.slice(ia), ...path.slice(0, ib + 1)];
    const length = (ps) => ps.slice(1).reduce((s, p, i) => s + distance(p, ps[i]), 0);
    if (length(alternate) < length(points)) points = alternate;
  }
  return [a, ...points, b].filter((p, i, all) => !i || distance(p, all[i - 1]) > 0.5);
}
function makeCity(input) {
  const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
  const entry = Object.entries(cityConfigs).find(([, config]) => config.amapId === raw.i);
  if (!entry || !Array.isArray(raw.l) || !raw.l.length)
    throw new Error(`Unsupported or invalid Amap city data: ${input}`);
  const [id, config] = entry;
  const current = JSON.parse(
    fs.readFileSync(new URL(`../src/data/${id}.json`, import.meta.url), 'utf8'),
  );
  const currentStations = new Map(current.stations.map((s) => [s.id, s]));
  const currentLines = new Map(current.lines.map((l) => [l.id, l]));
  const stations = new Map(),
    lines = new Map(),
    segments = new Map();
  const addSegment = (lineId, a, b, points, oneWay = false, curve) => {
    const key = `${lineId}:${[a, b].sort().join(':')}`;
    if (!segments.has(key))
      segments.set(key, {
        id: key,
        lineId,
        from: a,
        to: b,
        points,
        ...(oneWay ? { oneWay: true } : {}),
        ...(curve ? { curve } : {}),
      });
  };
  for (const l of raw.l) {
    const name =
      l.ln === '市域机场线'
        ? '机场联络线'
        : id === 'shenzhen' && l.ln !== '2号线/8号线'
          ? l.ln.split('/')[0]
          : l.ln;
    const lineId = `${id}-${id === 'shenzhen' ? name : l.ln}`;
    if (!lines.has(lineId))
      lines.set(lineId, {
        id: lineId,
        names: [{ language: 'zh-CN', value: name }],
        shortNames: [
          {
            language: 'zh-CN',
            value:
              config.shortNames?.[name] ??
              name
                .replace('号线八通线', '')
                .replace('号线大兴线', '')
                .replace('号线', '')
                .replace('市域', ''),
          },
        ],
        color: `#${l.cl}`,
        kind:
          name === '磁浮线'
            ? 'maglev'
            : name === '机场联络线'
              ? 'rail'
              : name === '西郊线'
                ? 'tram'
                : 'metro',
        stationIds: [],
      });
    const line = lines.get(lineId);
    // Exclude provider-marked non-serving stops and the documented Beijing exception.
    const stops = l.st
      .filter((s) => s.su !== '0' && !(id === 'beijing' && s.n === '通运门'))
      .map((s) => ({ ...s, si: config.stationIds?.[s.si] ?? s.si }));
    for (const s of stops) {
      const [x, y] = point(s.p);
      if (!stations.has(s.si))
        stations.set(s.si, {
          id: s.si,
          names: [{ language: 'zh-CN', value: s.n }],
          x,
          y,
          label: Number(s.lg),
          aliases: [s.sp?.replaceAll(' ', '')].filter(Boolean),
        });
      if (!line.stationIds.includes(s.si)) line.stationIds.push(s.si);
    }
    if (l.ln === '首都机场线') continue;
    const path = l.c.map(point);
    for (let i = 0; i < stops.length - (l.lo === '1' ? 0 : 1); i++) {
      const a = stops[i],
        b = stops[(i + 1) % stops.length];
      addSegment(lineId, a.si, b.si, slicePath(path, point(a.p), point(b.p), l.lo === '1'));
    }
  }
  // Lines absent from the primary source are maintained only in the city JSON.
  // Preserve their station data and explicit segments, including fitted geometry.
  for (const lineId of config.preservedLines ?? []) {
    const line = currentLines.get(lineId);
    if (!line) throw new Error(`Missing preserved line in src/data/${id}.json: ${lineId}`);
    if (lines.has(lineId))
      throw new Error(`${lineId} is now in the primary source; review its preservation rule`);
    const sharedStations = new Set(
      current.lines.filter((l) => l.id !== lineId).flatMap((l) => l.stationIds),
    );
    for (const stationId of line.stationIds) {
      const station = currentStations.get(stationId);
      if (!station) throw new Error(`Missing preserved station: ${stationId}`);
      const imported = stations.get(stationId);
      if (sharedStations.has(stationId) && !imported)
        throw new Error(`Missing preserved-line interchange: ${stationId}`);
      if (
        imported &&
        (imported.names.find((n) => n.language === 'zh-CN')?.value !==
          station.names.find((n) => n.language === 'zh-CN')?.value ||
          imported.x !== station.x ||
          imported.y !== station.y)
      )
        throw new Error(`Changed interchange ${stationId}; review src/data/${id}.json`);
      if (!imported) stations.set(stationId, station);
    }
    lines.set(lineId, line);
    for (const edge of current.segments.filter((s) => s.lineId === lineId))
      segments.set(edge.id, edge);
  }
  // Dahongmen's platforms now form one interchange despite separate provider IDs.
  if (id === 'beijing') {
    const oldId = '110100023282030',
      stationId = '110100023114028';
    if (stations.has(oldId) && stations.has(stationId)) {
      stations.delete(oldId);
      for (const line of lines.values())
        line.stationIds = [
          ...new Set(line.stationIds.map((id) => (id === oldId ? stationId : id))),
        ];
      const updated = [...segments.values()];
      segments.clear();
      for (const edge of updated) {
        if (edge.from === oldId) edge.from = stationId;
        if (edge.to === oldId) edge.to = stationId;
        addSegment(edge.lineId, edge.from, edge.to, edge.points, edge.oneWay);
      }
    }
  }
  const byName = (name) =>
    [...stations.values()].find((s) =>
      s.names.some((n) => n.language === 'zh-CN' && n.value === name),
    );
  function addLine(name, shortName, color, kind, names, coords) {
    const lineId = `${id}-${name}`;
    const stops = names.map((name, i) => {
      const existing = byName(name);
      if (existing) return existing;
      const [x, y] = coords[i];
      const s = {
        id: `${id}-${name}`,
        names: [{ language: 'zh-CN', value: name }],
        x,
        y,
        label: 0,
      };
      stations.set(s.id, s);
      return s;
    });
    lines.set(lineId, {
      id: lineId,
      names: [{ language: 'zh-CN', value: name }],
      shortNames: [{ language: 'zh-CN', value: shortName }],
      color,
      kind,
      stationIds: stops.map((s) => s.id),
    });
    stops.slice(1).forEach((b, i) => {
      const a = stops[i];
      const dx = b.x - a.x,
        dy = b.y - a.y,
        diagonal = Math.min(Math.abs(dx), Math.abs(dy));
      const bend = [a.x + Math.sign(dx) * diagonal, a.y + Math.sign(dy) * diagonal];
      addSegment(lineId, a.id, b.id, [[a.x, a.y], bend, [b.x, b.y]]);
    });
  }
  if (id === 'shanghai') {
    addLine(
      '金山铁路',
      '金山',
      '#6789a3',
      'rail',
      ['上海南站', '莘庄', '春申', '新桥', '车墩', '叶榭', '亭林', '金山园区', '金山卫'],
      [
        [0, 0],
        [0, 0],
        [830, 1870],
        [755, 1945],
        [680, 2020],
        [605, 2095],
        [530, 2170],
        [455, 2245],
        [380, 2320],
      ],
    );
    byName('浦东1号2号航站楼').aliases.push('浦东国际机场', '浦东机场', 'pudongairport');
    byName('上海松江站').aliases.push('松江南站');
  } else if (id === 'beijing') {
    addLine(
      '亦庄有轨电车T1线',
      '亦庄T1',
      '#b51c37',
      'tram',
      [
        '屈庄',
        '融兴街',
        '瑞合庄',
        '太和桥北',
        '四海庄',
        '九号村',
        '泰河路',
        '鹿圈东',
        '亦庄同仁',
        '荣昌东街',
        '亦创会展中心',
        '经海一路',
        '定海园西',
        '定海园',
      ],
      [
        [2012, 2010],
        [2012, 1950],
        [2012, 1890],
        [2012, 1830],
        [2012, 1770],
        [2012, 1710],
        [2012, 1650],
        [2012, 1590],
        [2012, 1530],
        [0, 0],
        [2110, 1360],
        [2240, 1360],
        [2370, 1360],
        [2500, 1360],
      ],
    );
    // Keep the T1 arm clear of the parallel Yizhuang line and space its longer labels.
    for (const name of ['亦创会展中心', '经海一路', '定海园西', '定海园']) {
      byName(name).label = 1;
    }
    // Follow the official schematic: parallel terminal stems and an inner U-shaped return.
    Object.assign(byName('3号航站楼'), { x: 2426, y: 307, label: 0 });
    Object.assign(byName('2号航站楼'), { x: 2286, y: 307, label: 0 });
    const lineId = `${id}-首都机场线`;
    const links = [
      ['北新桥', '东直门', false, []],
      ['东直门', '三元桥', false, [[1953, 730]]],
      [
        '三元桥',
        '3号航站楼',
        true,
        [
          [2126, 557],
          [2191, 468],
          [2258, 450],
          [2370, 420],
          [2426, 427],
          [2426, 352],
          [2426, 337],
          [2426, 322],
        ],
        'cubic',
      ],
      [
        '3号航站楼',
        '2号航站楼',
        true,
        [
          [2426, 322],
          [2426, 337],
          [2426, 352],
          [2426, 412],
          [2286, 412],
          [2286, 352],
          [2286, 337],
          [2286, 322],
        ],
        'cubic',
      ],
      [
        '2号航站楼',
        '三元桥',
        true,
        [
          [2286, 322],
          [2286, 337],
          [2286, 352],
          [2286, 404],
          [2286, 427],
          [2258, 450],
          [2191, 468],
          [2126, 557],
        ],
        'cubic',
      ],
    ];
    for (const [aName, bName, oneWay, bends, curve] of links) {
      const a = byName(aName),
        b = byName(bName);
      addSegment(lineId, a.id, b.id, [[a.x, a.y], ...bends, [b.x, b.y]], oneWay, curve);
    }
  }
  // The city JSON is the sole source for reviewed names and metadata. Refresh only
  // provider geometry/topology; contributors edit names directly in that JSON.
  for (const station of stations.values()) {
    const reviewed = currentStations.get(station.id);
    if (reviewed) {
      station.names = reviewed.names;
      station.aliases = reviewed.aliases;
    }
    if (
      current.attribution?.kind === 'official' &&
      !station.names.some((n) => /^en(?:-|$)/i.test(n.language) && n.value.trim())
    )
      console.warn(`请在 src/data/${id}.json 的 names 中核对并填写官方英文站名：${station.id}`);
  }
  for (const line of lines.values()) {
    const reviewed = currentLines.get(line.id);
    if (reviewed) {
      line.names = reviewed.names;
      line.shortNames = reviewed.shortNames;
    }
    if (
      current.attribution?.kind === 'official' &&
      ![line.names, line.shortNames].every((names) =>
        names.some((n) => /^en(?:-|$)/i.test(n.language) && n.value.trim()),
      )
    )
      console.warn(`请在 src/data/${id}.json 核对并填写英文线路名称：${line.id}`);
  }
  return {
    ...current,
    stations: [...stations.values()],
    // Keep the explicit display order from the city JSON; append newly added lines.
    lines: [
      ...current.lines.flatMap((line) => (lines.has(line.id) ? [lines.get(line.id)] : [])),
      ...[...lines.values()].filter((line) => !currentLines.has(line.id)),
    ],
    segments: [...segments.values()],
    ...(id === 'shanghai'
      ? {
          sameLineTransfers: [
            ['10号线', '龙柏新村', '龙溪路', '上海动物园'],
            ['5号线', '金平路', '东川路', '江川路'],
            ['11号线', '白银路', '嘉定新城', '上海赛车场'],
          ].map(([line, a, interchange, b]) =>
            [a, b].map(
              (name) =>
                `${id}-${line}:${[byName(name).id, byName(interchange).id].sort().join(':')}`,
            ),
          ),
        }
      : {}),
  };
}
const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.error(
    'Usage: node scripts/import-amap.mjs /path/to/city.json [/path/to/another-city.json ...]',
  );
  process.exit(1);
}
const cities = inputs.map(makeCity);
if (new Set(cities.map((city) => city.id)).size !== cities.length)
  throw new Error('Pass only one input file per city');
const updates = cities.map((city) => ({
  path: new URL(`../src/data/${city.id}.json`, import.meta.url),
  city,
  json: formatCityData(city),
}));
for (const { path, city, json } of updates) {
  fs.writeFileSync(path, json);
  console.log(
    `${city.zhName}: ${city.stations.length} stations, ${city.lines.length} lines, ${city.segments.length} sections`,
  );
}
