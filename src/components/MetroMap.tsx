import { useLocale } from './LocaleProvider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Focus, LocateFixed, Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { isInterchange, type Network } from '../lib/network';
import { cubicArrow, cubicPath, stationSpans, type StationSpan } from '../lib/mapGeometry';
import type { Progress, Route, Station } from '../types';

interface Props {
  network: Network;
  progress: Progress;
  route: Route | null;
  activeLine: string | null;
  exploredOnly: boolean;
  focusStation: string | null;
  onStation: (station: Station) => void;
  manualStationIds: Set<string>;
  onUnlightStation: (station: Station) => void;
  onSetEndpoint: (id: string, kind: 'from' | 'to') => void;
  onAddJourney?: () => void;
}

const COLOR = {
  visited: '#0052d9',
  transferred: '#e37318',
  passed: '#7aa0f2',
  idle: '#b4bac4',
  dim: '#e1e4ea',
  halo: '#fafbfc',
};

function StationMarker({
  station,
  span,
  r,
  ...paint
}: {
  station: Station;
  span?: StationSpan;
  r: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}) {
  if (!span || !span.length)
    return (
      <circle
        cx={span?.center[0] ?? station.x}
        cy={span?.center[1] ?? station.y}
        r={r}
        {...paint}
      />
    );
  const dx = span.to[0] - span.from[0],
    dy = span.to[1] - span.from[1];
  const branches = span.points.flatMap((point) => {
    const along = Math.max(
      0,
      Math.min(
        1,
        ((point[0] - span.from[0]) * dx + (point[1] - span.from[1]) * dy) / span.length ** 2,
      ),
    );
    const nearest = [span.from[0] + along * dx, span.from[1] + along * dy];
    return Math.hypot(point[0] - nearest[0], point[1] - nearest[1]) > 0.1
      ? [`M ${nearest.join(' ')} L ${point.join(' ')}`]
      : [];
  });
  const path = [`M ${span.from.join(' ')} L ${span.to.join(' ')}`, ...branches].join(' ');
  return (
    <g opacity={paint.opacity}>
      {paint.stroke && (
        <path
          d={path}
          fill="none"
          stroke={paint.stroke}
          strokeWidth={r * 2 + (paint.strokeWidth ?? 0)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={paint.fill}
        strokeWidth={r * 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

export default function MetroMap({
  network,
  progress,
  route,
  activeLine,
  exploredOnly,
  focusStation,
  onStation,
  manualStationIds,
  onUnlightStation,
  onSetEndpoint,
  onAddJourney,
}: Props) {
  const { locale, t, name } = useLocale();
  const { city } = network;
  const spans = useMemo(() => stationSpans(city), [city]);
  // Stops that only offer a change between direct services keep the ordinary marker.
  const interchanges = useMemo(
    () => new Set(city.stations.filter((s) => isInterchange(network, s.id)).map((s) => s.id)),
    [network, city],
  );
  const frame = useRef<HTMLDivElement>(null),
    svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 900, height: 570 });
  const [view, setView] = useState({
    x: city.center[0],
    y: city.center[1],
    width: window.innerWidth <= 760 ? 1250 : 2050,
  });
  const [selected, setSelected] = useState<Station | null>(null);
  const [labelsOn, setLabelsOn] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);
  const gestureStart = useRef({ x: 0, y: 0 });
  const height = (view.width * size.height) / size.width;
  const routeEdges = useMemo(() => new Set(route?.segmentIds), [route]);
  const routeStations = useMemo(() => new Set(route?.stationIds), [route]);
  const scale = view.width / size.width;

  useEffect(() => {
    if (onAddJourney) setExpanded(false);
  }, [onAddJourney]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width && height) setSize({ width, height });
    });
    if (frame.current) observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);

  const fit = (ids?: string[], segmentIds?: string[]) => {
    const stations = ids ? ids.map((id) => network.stationById.get(id)!) : city.stations;
    if (!stations.length) return;
    const stationIds = new Set(stations.map((s) => s.id));
    const points = city.segments
      .filter((s) =>
        segmentIds ? segmentIds.includes(s.id) : stationIds.has(s.from) && stationIds.has(s.to),
      )
      .flatMap((s) => s.points ?? []);
    const xs = [...stations.map((s) => s.x), ...points.map((p) => p[0])],
      ys = [...stations.map((s) => s.y), ...points.map((p) => p[1])];
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    setView({
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      width: Math.max(650, maxX - minX + 240, ((maxY - minY + 200) * size.width) / size.height),
    });
  };

  useEffect(() => {
    if (focusStation) {
      const s = network.stationById.get(focusStation);
      if (s) {
        setSelected(s);
        setView({ x: s.x, y: s.y, width: 900 });
      }
    }
  }, [focusStation, network]);

  useEffect(() => {
    if (route) fit(route.stationIds, route.segmentIds);
  }, [route, size.width, size.height]); // keep the full route visible after layout changes
  useEffect(() => {
    if (activeLine) fit(network.lineById.get(activeLine)?.stationIds);
  }, [activeLine]);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5,
        py = (e.clientY - rect.top) / rect.height - 0.5;
      setView((v) => {
        const width = Math.min(6000, Math.max(360, v.width * Math.exp(e.deltaY * 0.0015)));
        return {
          width,
          x: v.x + px * (v.width - width),
          y: v.y + (py * (v.width - width) * rect.height) / rect.width,
        };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpanded(false);
        setSelected(null);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);

  const labels = useMemo(() => {
    if (!labelsOn) return [];
    const fontSize = Math.max(16, scale * 10.5);
    const boxes: { x: number; y: number; w: number; h: number }[] = [];
    return [...city.stations]
      .filter(
        (s) =>
          s.x > view.x - view.width / 2 - 50 &&
          s.x < view.x + view.width / 2 + 50 &&
          s.y > view.y - height / 2 - 50 &&
          s.y < view.y + height / 2 + 50,
      )
      .sort((a, b) => {
        const priority = (s: Station) =>
          (s.id === selected?.id ? 20 : 0) +
          (routeStations.has(s.id) ? 10 : 0) +
          (interchanges.has(s.id) ? 5 : 0) +
          (progress.stations.has(s.id) ? 3 : 0);
        return priority(b) - priority(a);
      })
      .flatMap((s) => {
        if (activeLine && !network.lineById.get(activeLine)!.stationIds.includes(s.id)) return [];
        const w =
            Array.from(name(s)).reduce(
              (width, char) => width + (/[^\x00-\x7F]/.test(char) ? 1 : 0.62),
              0,
            ) * fontSize,
          h = fontSize * 1.3,
          gap = 12 + (spans.get(s.id)?.padding ?? 0);
        const span = spans.get(s.id),
          [cx, cy] = span?.center ?? [s.x, s.y],
          minX = span ? Math.min(span.from[0], span.to[0]) : s.x,
          maxX = span ? Math.max(span.from[0], span.to[0]) : s.x,
          minY = span ? Math.min(span.from[1], span.to[1]) : s.y,
          maxY = span ? Math.max(span.from[1], span.to[1]) : s.y;
        const directions = [
          { x: maxX + gap, y: cy - h / 2 },
          { x: minX - w - gap, y: cy - h / 2 },
          { x: cx - w / 2, y: minY - h - gap },
          { x: cx - w / 2, y: maxY + gap },
        ];
        if ((s.label ?? 0) % 2) directions.reverse();
        const box = directions.find(
          (p) =>
            p.x >= view.x - view.width / 2 + scale * 8 &&
            p.x + w <= view.x + view.width / 2 - scale * 8 &&
            p.y >= view.y - height / 2 + scale * 8 &&
            p.y + h <= view.y + height / 2 - scale * 8 &&
            !boxes.some(
              (b) =>
                p.x < b.x + b.w + 8 &&
                p.x + w + 8 > b.x &&
                p.y < b.y + b.h + 5 &&
                p.y + h + 5 > b.y,
            ),
        );
        if (!box) return [];
        boxes.push({ ...box, w, h });
        return [{ station: s, x: box.x, y: box.y + h * 0.77, fontSize }];
      });
  }, [
    view,
    size,
    city,
    labelsOn,
    selected,
    activeLine,
    progress,
    routeStations,
    network,
    spans,
    interchanges,
    height,
    scale,
    locale,
    name,
  ]);

  const zoom = (factor: number) =>
    setView((v) => ({ ...v, width: Math.max(360, Math.min(6000, v.width * factor)) }));
  const canSelect = (s: Station) =>
    (!activeLine || network.lineById.get(activeLine)!.stationIds.includes(s.id)) &&
    (!route || routeStations.has(s.id));
  const selectStation = (s: Station) => {
    if (canSelect(s) && !moved.current) {
      setSelected(s);
      onStation(s);
    }
  };
  const selectedState = selected ? progress.stations.get(selected.id) : undefined;
  const selectedLit = !!selected && progress.litStations.has(selected.id);

  return (
    <div ref={frame} className={`map-frame ${expanded ? 'expanded' : ''}`}>
      <svg
        ref={svgRef}
        className="network-svg"
        viewBox={`${view.x - view.width / 2} ${view.y - height / 2} ${view.width} ${height}`}
        role="group"
        aria-label={t('{0}地铁示意图，可拖动和缩放，点击站点单独点亮', name(city))}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          const delta = view.width * 0.1;
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-'].includes(e.key))
            e.preventDefault();
          if (e.key === '+') zoom(0.8);
          if (e.key === '-') zoom(1.25);
          if (e.key.startsWith('Arrow'))
            setView((v) => ({
              ...v,
              x: v.x + (e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0),
              y: v.y + (e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0),
            }));
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          if (!pointers.current.size) {
            moved.current = false;
            gestureStart.current = { x: e.clientX, y: e.clientY };
          }
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const old = pointers.current.get(e.pointerId);
          if (!old) return;
          const dx = e.clientX - old.x,
            dy = e.clientY - old.y;
          if (
            Math.hypot(e.clientX - gestureStart.current.x, e.clientY - gestureStart.current.y) > 5
          )
            moved.current = true;
          if (pointers.current.size === 2) {
            const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)![1];
            const before = Math.hypot(old.x - other.x, old.y - other.y),
              after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
            if (before > 0 && after > 0) zoom(before / after);
            moved.current = true;
          } else if (moved.current)
            setView((v) => ({
              ...v,
              x: v.x - (dx * v.width) / size.width,
              y: v.y - (dy * v.width) / size.width,
            }));
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }}
        onPointerUp={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          // Pointer capture targets the SVG, so hit-test the release position for stations.
          if (!moved.current) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = view.x + (e.clientX - rect.left - rect.width / 2) * scale;
            const y = view.y + (e.clientY - rect.top - rect.height / 2) * scale;
            const station = [...city.stations]
              .filter(canSelect)
              .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
            if (station && Math.hypot(station.x - x, station.y - y) < Math.max(13, scale * 12))
              selectStation(station);
          }
          pointers.current.delete(e.pointerId);
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          moved.current = true;
        }}
      >
        <defs>
          <pattern id={`dots-${city.id}`} width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1.2" fill="#c9cfd8" opacity=".5" />
          </pattern>
        </defs>
        <rect
          x={view.x - view.width / 2}
          y={view.y - height / 2}
          width={view.width}
          height={height}
          fill={`url(#dots-${city.id})`}
        />
        {city.id === 'shanghai' && (
          <g pointerEvents="none">
            <path
              d="M 1810 350 C 2180 490 1960 790 1735 950 C 1535 1090 2120 1160 1790 1480 S 1410 1770 1510 2100"
              fill="none"
              stroke="#e8f0f6"
              strokeWidth="42"
            />
            <text
              x="1755"
              y="1510"
              fill="#a9bfcd"
              fontSize="20"
              letterSpacing="8"
              transform="rotate(-48 1755 1510)"
            >
              {t('黄浦江')}
            </text>
          </g>
        )}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {city.segments.map((edge) => {
            const line = network.lineById.get(edge.lineId)!;
            const a = network.stationById.get(edge.from)!,
              b = network.stationById.get(edge.to)!;
            const isLit = progress.segments.has(edge.id),
              isRoute = routeEdges.has(edge.id);
            const dim = (activeLine && activeLine !== edge.lineId) || (route && !isRoute);
            const points = edge.points ?? [
              [a.x, a.y],
              [b.x, b.y],
            ];
            const color = exploredOnly && !isLit && !isRoute ? COLOR.dim : line.color;
            // Place a direction arrow on the longest straight leg, clear of station markers.
            const arrow = edge.oneWay
              ? edge.curve === 'cubic'
                ? cubicArrow(points)
                : points
                    .slice(1)
                    .map((p, i) => ({
                      x: (p[0] + points[i][0]) / 2,
                      y: (p[1] + points[i][1]) / 2,
                      angle: (Math.atan2(p[1] - points[i][1], p[0] - points[i][0]) * 180) / Math.PI,
                      length: Math.hypot(p[0] - points[i][0], p[1] - points[i][1]),
                    }))
                    .sort((a, b) => b.length - a.length)[0]
              : null;
            const arrowSize = Math.max(9, scale * 5);
            return (
              <g
                key={edge.id}
                opacity={dim ? 0.12 : isLit || isRoute ? 1 : exploredOnly ? 0.7 : 0.7}
              >
                {edge.curve === 'cubic' ? (
                  <path
                    d={cubicPath(points)}
                    stroke={color}
                    strokeWidth={isRoute ? 9 : isLit ? 8 : 5.5}
                    className={isRoute ? 'preview-line' : ''}
                  />
                ) : (
                  <polyline
                    points={points.map((p) => p.join(',')).join(' ')}
                    stroke={color}
                    strokeWidth={isRoute ? 9 : isLit ? 8 : 5.5}
                    className={isRoute ? 'preview-line' : ''}
                  />
                )}
                {arrow && arrow.length > arrowSize * 4 && (
                  <path
                    d={`M ${-arrowSize} ${-arrowSize * 0.65} L ${arrowSize} 0 L ${-arrowSize} ${arrowSize * 0.65} Z`}
                    transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`}
                    fill={color}
                    stroke={COLOR.halo}
                    strokeWidth={Math.max(1.5, scale)}
                  >
                    <title>
                      {name(a)} → {name(b)}
                      {t('· 单向运行')}
                    </title>
                  </path>
                )}
              </g>
            );
          })}
        </g>
        <g>
          {city.stations.map((s) => {
            const span = spans.get(s.id),
              [cx, cy] = span?.center ?? [s.x, s.y];
            const state = progress.stations.get(s.id),
              interchange = interchanges.has(s.id);
            const inRoute = routeStations.has(s.id),
              inLine = !activeLine || network.lineById.get(activeLine)!.stationIds.includes(s.id);
            const r = interchange ? 8.8 : 5.7;
            const color = state?.visited
              ? COLOR.visited
              : state?.transferred
                ? COLOR.transferred
                : state?.passed
                  ? COLOR.passed
                  : COLOR.idle;
            const opacity = !inLine || (route && !inRoute) ? 0.2 : 1;
            return (
              <g
                key={s.id}
                role="button"
                tabIndex={canSelect(s) ? 0 : -1}
                aria-disabled={!canSelect(s)}
                aria-label={t('点亮站点 {0}', name(s))}
                onClick={(e) => {
                  // Assistive technologies can dispatch a click without pointer events.
                  if (e.detail === 0) {
                    moved.current = false;
                    selectStation(s);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    moved.current = false;
                    selectStation(s);
                  }
                }}
                className="map-station"
                opacity={opacity}
              >
                <title>
                  {name(s)} · {network.stationLines.get(s.id)!.map(name).join(' / ')}
                  {state?.visited
                    ? t(' · 已上下车')
                    : state?.transferred
                      ? t(' · 已换乘')
                      : state?.passed
                        ? t(' · 已途经')
                        : ''}
                </title>
                <StationMarker
                  station={s}
                  span={span}
                  r={Math.max(r + 7, scale * 9)}
                  fill="transparent"
                />
                {selected?.id === s.id && (
                  <StationMarker
                    station={s}
                    span={span}
                    r={24}
                    fill={COLOR.visited}
                    opacity={0.12}
                  />
                )}
                <StationMarker
                  station={s}
                  span={span}
                  r={r}
                  fill={state?.visited ? COLOR.visited : state?.transferred ? '#fff1e9' : 'white'}
                  stroke={inRoute ? COLOR.visited : color}
                  strokeWidth={interchange ? 2.4 : 1.8}
                />
                {interchange && (
                  <circle cx={cx} cy={cy} r="3.1" fill={state?.visited ? 'white' : color} />
                )}
                {state?.visited && state.transferred && (
                  <circle
                    cx={cx + 6}
                    cy={cy - 6}
                    r="3.4"
                    fill={COLOR.transferred}
                    stroke="white"
                    strokeWidth="1"
                  />
                )}
              </g>
            );
          })}
        </g>
        <g pointerEvents="none">
          {labels.map(({ station: s, x, y, fontSize }) => (
            <text
              key={s.id}
              x={x}
              y={y}
              fontSize={fontSize}
              fontWeight={interchanges.has(s.id) ? 600 : 400}
              fill={progress.stations.get(s.id)?.visited ? '#0043b3' : '#5a6270'}
              stroke={COLOR.halo}
              strokeWidth="4"
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {name(s)}
            </text>
          ))}
        </g>
      </svg>
      {selected && canSelect(selected) && (
        <div className="station-popover">
          <button
            className="icon-btn small"
            aria-label={t('关闭站点详情')}
            onClick={() => setSelected(null)}
          >
            <X size={15} />
          </button>
          <h3>{name(selected)}</h3>
          <div className="station-lines">
            {network.stationLines.get(selected.id)!.map((l) => (
              <span className="line-tag" key={l.id} style={{ background: l.color }}>
                {name({ names: l.shortNames })}
              </span>
            ))}
          </div>
          <p className={`station-status ${selectedLit ? 'lit' : ''}`}>
            <span className="dot" />
            {selectedState?.visited
              ? t('已点亮 · 上下车过')
              : selectedState?.transferred
                ? t('已点亮 · 换乘过')
                : selectedState?.passed
                  ? t('仅途经过 · 尚未点亮')
                  : t('尚未点亮 · 点击站点即可单独点亮')}
          </p>
          <div className="popover-actions">
            <button
              onClick={() => {
                onSetEndpoint(selected.id, 'from');
                setSelected(null);
              }}
            >
              {t('从这里出发')}
            </button>
            <button
              onClick={() => {
                onSetEndpoint(selected.id, 'to');
                setSelected(null);
              }}
            >
              {t('到这里去')}
            </button>
          </div>
          {manualStationIds.has(selected.id) && (
            <button className="popover-undo" onClick={() => onUnlightStation(selected)}>
              <RotateCcw size={12} />
              {t('取消单站点亮')}
            </button>
          )}
        </div>
      )}
      <div className="map-ctl">
        {onAddJourney ? (
          <button
            className="ctl add-journey"
            aria-label={t('记录一段旅程')}
            aria-haspopup="dialog"
            title={t('记录一段旅程')}
            onClick={onAddJourney}
          >
            <Plus size={24} />
          </button>
        ) : (
          <button
            className="ctl"
            aria-label={expanded ? t('退出全屏地图') : t('展开地图')}
            title={expanded ? t('退出全屏') : t('全屏')}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <X size={18} /> : <Maximize2 size={16} />}
          </button>
        )}
        <button
          className={labelsOn ? 'ctl active' : 'ctl'}
          aria-pressed={labelsOn}
          aria-label={t('显示站名')}
          title={t('站名')}
          onClick={() => setLabelsOn(!labelsOn)}
        >
          <span className="aa">Aa</span>
        </button>
        <div className="ctl-group">
          <button
            className="zoom"
            aria-label={t('放大地图')}
            title={t('放大')}
            onClick={() => zoom(0.78)}
          >
            <Plus size={18} />
          </button>
          <button
            className="zoom"
            aria-label={t('缩小地图')}
            title={t('缩小')}
            onClick={() => zoom(1.28)}
          >
            <Minus size={18} />
          </button>
          <button aria-label={t('查看完整线网')} title={t('完整线网')} onClick={() => fit()}>
            <Focus size={17} />
          </button>
          <button
            aria-label={t('回到市中心')}
            title={t('回到市中心')}
            onClick={() => setView({ x: city.center[0], y: city.center[1], width: 2050 })}
          >
            <LocateFixed size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
