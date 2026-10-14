/** Usage: node scripts/import-amap.mjs /path/to/city.json [/path/to/another-city.json ...]
 * Offline build-time adapter. Runtime uses the checked-in, provider-independent schema.
 */
import fs from 'node:fs';
import { formatCityData } from './format-city-data.mjs';
import { layoutShanghaiAirportLink, layoutShanghaiJinshan } from './shanghai-geometry.mjs';

const cityConfigs = {
  shanghai: { amapId: '3100' },
  beijing: {
    amapId: '1100',
    // Dahongmen's platforms now form one interchange despite separate provider IDs.
    stationIds: { 110100023282030: '110100023114028' }, // 大红门 (8/10号线)
  },
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
  suzhou: {
    amapId: '3205',
    // Lines 3 and 11 run through at Weiting (every train continues), so they form one
    // collection line. Amap labels each platform with the through destination
    // (唯亭(花桥) on Line 3, 唯亭(苏州新区火车站) on Line 11); keep one station ID.
    lineNames: { '3号线': '3号线/11号线', '11号线': '3号线/11号线' },
    shortNames: { '3号线/11号线': '3/11' },
    stationIds: { 900000104525001: '900000039926038' }, // 唯亭 (3/11号线)
  },
  taizhou: {
    amapId: '3310',
    shortNames: { S1线: 'S1' },
    kinds: { S1线: 'rail' },
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
/**
 * Amap station coordinates drift by a few units along straight corridors. Align runs of
 * consecutive stops that are nearly vertical or horizontal to one shared coordinate
 * (preferring interchange stations), move the touching path points with them, and
 * replace nearly straight paths with a straight line. Clear bends are kept.
 */
function straightenRuns(
  stations,
  lines,
  segments,
  tolerance = 10,
  straightTolerance = 4,
  cornerTolerance = 24,
  chamfer = 20,
) {
  const byId = new Map(stations.map((s) => [s.id, s]));
  const lineCount = new Map();
  for (const line of lines)
    for (const id of line.stationIds) lineCount.set(id, (lineCount.get(id) ?? 0) + 1);
  const moved = new Map();
  for (const axis of ['x', 'y']) {
    const other = axis === 'x' ? 'y' : 'x';
    const parent = new Map();
    const find = (id) => (parent.get(id) === id ? id : find(parent.get(id)));
    const union = (a, b) => {
      parent.set(find(a), find(b));
    };
    for (const s of stations) parent.set(s.id, s.id);
    for (const line of lines) {
      line.stationIds.slice(1).forEach((b, i) => {
        const a = line.stationIds[i];
        const pa = byId.get(a),
          pb = byId.get(b);
        const along = Math.abs(pa[axis] - pb[axis]),
          across = Math.abs(pa[other] - pb[other]);
        if (along <= tolerance && across > tolerance) union(a, b);
      });
    }
    const groups = new Map();
    for (const s of stations) {
      const root = find(s.id);
      groups.set(root, [...(groups.get(root) ?? []), s]);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const shared = group.filter((s) => lineCount.get(s.id) > 1);
      const values = (shared.length ? shared : group).map((s) => s[axis]).sort((p, q) => p - q);
      const target = values[Math.floor((values.length - 1) / 2)];
      for (const s of group) {
        // A stop further away is a real bend, not drift; leave it in place.
        if (s[axis] === target || Math.abs(s[axis] - target) > tolerance) continue;
        moved.set(s.id, { ...(moved.get(s.id) ?? {}), [axis]: [s[axis], target] });
        s[axis] = target;
      }
    }
  }
  const index = { x: 0, y: 1 };
  for (const edge of segments) {
    for (const [stationId, fromEnd] of [
      [edge.from, true],
      [edge.to, false],
    ]) {
      const move = moved.get(stationId);
      if (!move) continue;
      const points = fromEnd ? edge.points : [...edge.points].reverse();
      for (const [axis, [before, after]] of Object.entries(move)) {
        const i = index[axis];
        points[0][i] = after;
        // Carry the straight tail of the path (such as the end of a bend) with the station.
        for (let k = 1; k < points.length - 1 && Math.abs(points[k][i] - before) <= tolerance; k++)
          points[k][i] = after;
      }
    }
    const [a, b] = [edge.points[0], edge.points.at(-1)];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const offset = (p) =>
      length ? Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / length : 0;
    const inner = edge.points.slice(1, -1);
    if (inner.every((p) => offset(p) <= straightTolerance)) {
      edge.points = [a, b];
      continue;
    }
    // An L-shaped path whose points hug one straight leg each becomes two straight legs
    // joined by a 45° chamfer instead of the provider's wobbly corner.
    const sx = Math.sign(b[0] - a[0]),
      sy = Math.sign(b[1] - a[1]);
    const c = Math.min(
      chamfer,
      Math.floor(Math.min(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 2),
    );
    if (!inner.length || c < 4) continue;
    const near = (p, x, y) =>
      (x !== null && Math.abs(p[0] - x) <= cornerTolerance) ||
      (y !== null && Math.abs(p[1] - y) <= cornerTolerance);
    if (inner.every((p) => near(p, b[0], a[1])))
      edge.points = [a, [b[0] - sx * c, a[1]], [b[0], a[1] + sy * c], b];
    else if (inner.every((p) => near(p, a[0], b[1])))
      edge.points = [a, [a[0], b[1] - sy * c], [a[0] + sx * c, b[1]], b];
  }
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
      config.lineNames?.[l.ln] ??
      (l.ln === '市域机场线'
        ? '机场联络线'
        : id === 'shenzhen' && l.ln !== '2号线/8号线'
          ? l.ln.split('/')[0]
          : l.ln);
    const lineId = `${id}-${id === 'shenzhen' || config.lineNames?.[l.ln] ? name : l.ln}`;
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
          config.kinds?.[name] ??
          (name === '磁浮线'
            ? 'maglev'
            : name === '机场联络线'
              ? 'rail'
              : name === '西郊线'
                ? 'tram'
                : 'metro'),
        stationIds: [],
      });
    const line = lines.get(lineId);
    // Exclude provider-marked non-serving stops and the documented Beijing exception.
    const stops = l.st
      .filter((s) => s.su !== '0' && !(id === 'beijing' && s.n === '通运门'))
      .map((s) => ({ ...s, si: config.stationIds?.[s.si] ?? s.si }));
    for (const s of stops) {
      const [x, y] = point(s.p);
      // Community-maintained cities start from Amap's English names; official cities
      // take verified names from their bilingual maps instead.
      const english =
        current.attribution?.kind !== 'official' ? s.multilang?.n?.en?.trim() : undefined;
      if (!stations.has(s.si))
        stations.set(s.si, {
          id: s.si,
          names: [
            { language: 'zh-CN', value: s.n },
            ...(english ? [{ language: 'en', value: english }] : []),
          ],
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
      // A stop merged into another station's ID starts from that station's coordinates.
      const at = (s) => [stations.get(s.si).x, stations.get(s.si).y];
      addSegment(lineId, a.si, b.si, slicePath(path, at(a), at(b), l.lo === '1'));
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
        // Chedun stays north of the straight Huangpu reach; Yexie and the
        // remaining stations stay south. Keep this aligned with the map river.
        [830, 2055],
        [755, 2130],
        [680, 2205],
        [605, 2280],
        [530, 2355],
        [455, 2430],
        [380, 2505],
      ],
    );
    layoutShanghaiJinshan([...stations.values()], [...segments.values()]);
    layoutShanghaiAirportLink([...stations.values()], [...segments.values()]);
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
  if (id === 'suzhou') {
    // Order the through-running line from Suzhou Xinqu Railway Station to Huaqiao.
    const through = lines.get(`${id}-3号线/11号线`);
    const next = new Map();
    for (const edge of segments.values()) {
      if (edge.lineId !== through.id) continue;
      next.set(edge.from, [...(next.get(edge.from) ?? []), edge.to]);
      next.set(edge.to, [...(next.get(edge.to) ?? []), edge.from]);
    }
    const ordered = [byName('苏州新区火车站').id];
    while (ordered.length < through.stationIds.length) {
      const step = next.get(ordered.at(-1)).find((s) => !ordered.includes(s));
      if (!step) throw new Error('3号线/11号线 is not a single chain');
      ordered.push(step);
    }
    through.stationIds = ordered;
    straightenRuns([...stations.values()], [...lines.values()], [...segments.values()]);
    // Lay out Line 8 and the eastern end of Line 6 explicitly with horizontal, vertical
    // and 45° approaches relative to the aligned interchange stations. Line 8 runs on a
    // parallel lane 14 units north of Line 3 from Tangzhuang to Suzhou Yuanqu Railway
    // Station, with offset drawing endpoints at both shared stations. The
    // Qiongjidun–Xietang link stays a single diagonal between the parallel Lines 5 and 6.
    const bd = byName('白荡北'),
      tz = byName('唐庄'),
      yq = byName('苏州园区火车站'),
      ao = byName('苏州奥体中心'),
      js = byName('金尚路'),
      qj = byName('琼姬墩'),
      xt = byName('斜塘'),
      sz = byName('狮子山'),
      xq = byName('苏州新区火车站'),
      by = byName('白洋湾公园');
    // Line 6 north-west: one straight line through the two interchanges, stops evenly
    // spaced along it, meeting the horizontal section at Qingshanqiaobang.
    const along = (t) => ({
      x: Math.round(xq.x + (by.x - xq.x) * t),
      y: Math.round(xq.y + (by.y - xq.y) * t),
    });
    const tq = (byName('青山桥浜').y - xq.y) / (by.y - xq.y),
      qs = along(tq);
    const run = tz.x - bd.x,
      lane = tz.y - 14,
      half = Math.round((js.x - ao.x) / 2);
    const moves = {
      新元: { x: byName('西津桥').x - 80, y: byName('西津桥').y - 80 },
      时家桥: { x: byName('西津桥').x - 80 },
      五潨泾: { x: bd.x + Math.round(run / 4), y: bd.y + Math.round(run / 4) },
      古香圩: { x: bd.x + Math.round(run / 2), y: bd.y + Math.round(run / 2) },
      南泽庄: { x: bd.x + Math.round((run * 3) / 4), y: bd.y + Math.round((run * 3) / 4) },
      古楼: { y: lane },
      华池浜: { x: yq.x },
      时代广场: { x: yq.x },
      苏州当代美术馆: { x: yq.x },
      琼姬墩: { x: yq.x },
      莲池桥: { x: xt.x },
      仁爱路: { x: xt.x },
      松涛街: { x: xt.x },
      裕新路: { x: xt.x },
      车坊: { x: xt.x },
      保丰: along(1 / 4),
      富强: along(2 / 4),
      长泾: along(3 / 4),
      金鸡墩: along(1 + (tq - 1) / 3),
      虎丘: along(1 + ((tq - 1) * 2) / 3),
      青山桥浜: { x: qs.x },
      玉山路: { x: sz.x - (byName('玉山路').y - sz.y) },
      塔园路: { x: sz.x + (sz.y - byName('塔园路').y) },
      北斜步: { x: ao.x },
      南斜步: { x: js.x - half, y: js.y - half },
    };
    const same = (p, q) => p[0] === q[0] && p[1] === q[1];
    for (const [name, move] of Object.entries(moves)) {
      const station = byName(name);
      const old = [station.x, station.y];
      Object.assign(station, move);
      for (const edge of segments.values()) {
        if (edge.from === station.id && same(edge.points[0], old))
          edge.points[0] = [station.x, station.y];
        if (edge.to === station.id && same(edge.points.at(-1), old))
          edge.points[edge.points.length - 1] = [station.x, station.y];
      }
    }
    // Full drawing paths keyed by station pair; Line 8 pairs not listed are straight.
    const paths = {
      [`${id}-8号线`]: (a, b) =>
        ({
          '时家桥|白洋湾公园': [
            [a.x, a.y],
            [a.x, b.y + (b.x - a.x)],
            [b.x, b.y],
          ],
          '白洋湾公园|虎北路':
            a.y === b.y
              ? undefined
              : [
                  [a.x, a.y],
                  [a.x + Math.abs(b.y - a.y), b.y],
                  [b.x, b.y],
                ],
          '南泽庄|唐庄': [
            [a.x, a.y],
            [tz.x, bd.y + run],
            [tz.x, lane],
          ],
          '唐庄|古楼': [
            [tz.x, lane],
            [b.x, b.y],
          ],
          '古楼|苏州园区火车站': [
            [a.x, a.y],
            [yq.x, lane],
          ],
          '苏州园区火车站|华池浜': [
            [yq.x, lane],
            [b.x, b.y],
          ],
          // East along a lane 14 units south of Line 6, then down into Xietang.
          '苏州当代美术馆|琼姬墩': [
            [a.x, a.y],
            [qj.x, qj.y + 14],
          ],
          '琼姬墩|斜塘': [
            [qj.x, qj.y + 14],
            [xt.x - 14, qj.y + 14],
            [xt.x, qj.y + 28],
            [xt.x, xt.y],
          ],
        })[`${a.names[0].value}|${b.names[0].value}`] ?? [
          [a.x, a.y],
          [b.x, b.y],
        ],
      [`${id}-1号线`]: (a, b) =>
        ['玉山路|狮子山', '狮子山|塔园路'].includes(`${a.names[0].value}|${b.names[0].value}`)
          ? [
              [a.x, a.y],
              [b.x, b.y],
            ]
          : undefined,
      [`${id}-6号线`]: (a, b) =>
        [
          xq,
          byName('保丰'),
          byName('富强'),
          byName('长泾'),
          by,
          byName('金鸡墩'),
          byName('虎丘'),
        ].includes(a) && b !== byName('苏州新区火车站')
          ? [
              [a.x, a.y],
              [b.x, b.y],
            ]
          : {
              '北斜步|南斜步': [
                [a.x, a.y],
                [ao.x, js.y - (js.x - ao.x)],
                [b.x, b.y],
              ],
              '南斜步|金尚路': [
                [a.x, a.y],
                [b.x, b.y],
              ],
            }[`${a.names[0].value}|${b.names[0].value}`],
    };
    for (const edge of segments.values()) {
      const layout = paths[edge.lineId];
      if (!layout) continue;
      const points = layout(stations.get(edge.from), stations.get(edge.to));
      if (points) edge.points = points;
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
