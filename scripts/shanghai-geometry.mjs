/** Straighten the Airport Link's southbound leg below Zhongchun Road. */
export function layoutShanghaiAirportLink(stations, segments) {
  const from = stations.find((s) => s.id === '310100024546011');
  const to = stations.find((s) => s.id === '900000070795023');
  const edge = segments.find(
    (s) => s.lineId === 'shanghai-市域机场线' && s.from === from?.id && s.to === to?.id,
  );
  if (!from || !to || !edge) throw new Error('Missing Zhongchun Road–Jinghong Road section');
  const radius = 15;
  edge.points = [
    [from.x, from.y],
    [from.x, to.y - radius],
    [from.x + 1, to.y - 9],
    [from.x + 4, to.y - 4],
    [from.x + 9, to.y - 1],
    [from.x + radius, to.y],
    [to.x, to.y],
  ];
}

/** Keep Jinshan beside Line 1, including its rounded approach to Xinzhuang. */
export function layoutShanghaiJinshan(stations, segments) {
  const stops = ['莘庄', '外环路', '莲花路', '锦江乐园', '上海南站'].map((name) => {
    const station = stations.find((s) =>
      s.names.some((n) => n.language === 'zh-CN' && n.value === name),
    );
    if (!station) throw new Error(`Missing Shanghai corridor station: ${name}`);
    return station;
  });
  const section = (line, from, to) => {
    const edge = segments.find(
      (s) => s.lineId === `shanghai-${line}` && s.from === from.id && s.to === to.id,
    );
    if (!edge) throw new Error(`Missing Shanghai section: ${line} ${from.id}–${to.id}`);
    return edge;
  };
  // Remove the tiny backtrack beside Waihuanlu before offsetting the corridor.
  const paths = stops.slice(1).map((to, i) => {
    const edge = section('1号线', stops[i], to);
    edge.points = edge.points.filter(([x, y]) => x !== 999 || y !== 1743);
    return edge.points;
  });
  const path = paths.flatMap((points, i) => (i ? points.slice(1) : points));
  const normals = path.slice(1).map((b, i) => {
    const a = path[i],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      length = Math.hypot(dx, dy);
    return [-dy / length, dx / length];
  });
  // Use the northwest side so the southbound railway never crosses Line 5.
  const gap = -14;
  const parallel = path.map((point, i) => {
    const a = normals[Math.max(0, i - 1)],
      b = normals[Math.min(i, normals.length - 1)],
      factor = gap / (1 + a[0] * b[0] + a[1] * b[1]);
    return point.map((value, j) => Math.round((value + (a[j] + b[j]) * factor) * 100) / 100);
  });
  section('金山铁路', stops.at(-1), stops[0]).points = parallel.reverse();
  const chunshen = stations.find((s) => s.id === 'shanghai-春申');
  const onward = section('金山铁路', stops[0], chunshen);
  const [x, y] = parallel.at(-1);
  // Leave the interchange vertically, then turn southwest clear of Line 5.
  onward.points = [
    [x, y],
    [x, y + 9],
    [x, y + 13],
    [x - 1, y + 17],
    [x - 3, y + 21],
    [x - 6, y + 25],
    [chunshen.x, y + 25 + x - 6 - chunshen.x],
    [chunshen.x, chunshen.y],
  ];
}
