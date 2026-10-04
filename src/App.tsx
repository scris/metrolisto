import { useLocale } from './components/LocaleProvider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, Popup, Segmented, TabBar, TabBarItem } from 'tdesign-mobile-react';
import {
  AlertCircle,
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Download,
  Footprints,
  Globe2,
  HardDrive,
  Layers2,
  Map as MapIcon,
  MapPin,
  Plus,
  Route as RouteIcon,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrainFront,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { contributionLabel } from './lib/i18n';
import { downloadBackup } from './lib/backup';
import { cities } from './data';
import { sortCitiesByDistance } from './lib/cityDistance';
import { createNetwork, findRoute, routeGroups } from './lib/network';
import {
  getProgress,
  mergeBackups,
  readSavedData,
  removeStationLighting,
  STORAGE_KEY,
  validateBackup,
} from './lib/storage';
import type { Journey, Route, SavedData, Station } from './types';
import MetroMap from './components/MetroMap';
import StationPicker from './components/StationPicker';
import CityNames from './components/CityNames';

type Page = 'map' | 'journal' | 'lines';
const LAST_CITY_KEY = 'metrolisto.last-city.v1';

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export default function App() {
  const { locale, setLocale, t, name } = useLocale();
  const nav = [
    { id: 'map' as const, label: t('探索地图'), icon: MapIcon },
    { id: 'journal' as const, label: t('我的足迹'), icon: Footprints },
    { id: 'lines' as const, label: t('线路收藏'), icon: Layers2 },
  ];
  const lineKind = {
    metro: t('城市地铁'),
    rail: t('市域铁路'),
    tram: t('有轨电车'),
    maglev: t('磁浮列车'),
  };

  const [initial] = useState(() => readSavedData(cities));
  const showSuggestion = !Object.values(initial.data.cities).some((records) => records.length > 0);
  const [saved, setSaved] = useState<SavedData>(initial.data);
  const [storageError, setStorageError] = useState(initial.error);
  const [storageBlocked, setStorageBlocked] = useState(!!initial.error);
  const [viewedJourney, setViewedJourney] = useState<Route | null>(null);
  const exporting = useRef(false);
  const [cityId, setCityId] = useState(() => {
    try {
      const lastCity = localStorage.getItem(LAST_CITY_KEY);
      return cities.find((city) => city.id === lastCity)?.id ?? cities[0].id;
    } catch {
      return cities[0].id;
    }
  });
  const [page, setPage] = useState<Page>('map');
  const [cityOpen, setCityOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [lineOpen, setLineOpen] = useState(false);
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [via, setVia] = useState<string[]>([]);
  const [preference, setPreference] = useState<'balanced' | 'transfers'>('balanced');
  const [preview, setPreview] = useState<Route | null>(null),
    [routeError, setRouteError] = useState('');
  const [focusStation, setFocusStation] = useState<string | null>(null),
    [activeLine, setActiveLine] = useState<string | null>(null),
    [exploredOnly, setExploredOnly] = useState(true);
  const [toast, setToast] = useState<{ text: string; undoId?: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [journeyDetail, setJourneyDetail] = useState<Journey | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const planner = useRef<HTMLElement>(null);
  const isMobile = useMedia('(max-width: 760px)');
  const isMobileMap = isMobile && page === 'map';
  const city = cities.find((c) => c.id === cityId)!;
  const sortedCities = useMemo(() => sortCitiesByDistance(cities, city), [city]);
  const network = useMemo(() => createNetwork(city), [city]);
  const journeys = saved.cities[city.id] ?? [];
  const progress = useMemo(() => getProgress(journeys), [journeys]);
  const manualStationIds = useMemo(
    () => new Set(journeys.filter((j) => j.kind === 'station').map((j) => j.stationIds[0])),
    [journeys],
  );
  const percentage = ((progress.stations.size / city.stations.length) * 100).toFixed(1);
  const trips = journeys.filter((j) => j.kind === 'trip');
  const displayName = (id: string) => name(network.stationById.get(id)) || id;
  const suggestion = useMemo(() => {
    const preferred =
      city.id === 'shanghai'
        ? ['人民广场', '陆家嘴']
        : city.id === 'beijing'
          ? ['天安门东', '环球度假区']
          : [];
    const line = city.lines[0];
    const start =
      city.stations.find((s) =>
        s.names.some((n) => n.language === 'zh-CN' && n.value === preferred[0]),
      )?.id ?? line.stationIds[0];
    const end =
      city.stations.find((s) =>
        s.names.some((n) => n.language === 'zh-CN' && n.value === preferred[1]),
      )?.id ?? line.stationIds[Math.min(4, line.stationIds.length - 1)];
    return { start, end };
  }, [city]);

  useEffect(() => {
    document.documentElement.classList.toggle('mobile-map-active', isMobileMap);
    return () => document.documentElement.classList.remove('mobile-map-active');
  }, [isMobileMap]);
  useEffect(() => {
    if (!isMobileMap) setPlannerOpen(false);
  }, [isMobileMap]);
  useEffect(() => {
    setToast(null);
  }, [locale]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        try {
          setSaved(
            e.newValue
              ? validateBackup(JSON.parse(e.newValue), cities, true)
              : { version: 1, cities: {} },
          );
          setStorageBlocked(false);
          setStorageError(null);
        } catch {
          setStorageBlocked(true);
          setStorageError('另一个页面的记录无法读取，请检查备份。');
        }
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const commit = (next: SavedData, allowRecovery = false) => {
    if (storageBlocked && !allowRecovery) {
      setToast({ text: t('原始记录无法读取，请先在数据管理中导出并恢复备份。') });
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved(next);
      setStorageBlocked(false);
      setStorageError(null);
      return true;
    } catch {
      setStorageError('保存失败：浏览器存储不可用或已满。请导出备份，释放空间后重试。');
      setToast({ text: t('未能保存记录，请检查浏览器存储空间。') });
      return false;
    }
  };
  const addJourney = (journey: Journey) =>
    commit({ ...saved, cities: { ...saved.cities, [cityId]: [journey, ...journeys] } });
  const removeJourney = (id: string) => {
    if (
      commit({
        ...saved,
        cities: { ...saved.cities, [cityId]: journeys.filter((j) => j.id !== id) },
      })
    )
      setToast({ text: t('记录已撤销，相关足迹已重新计算') });
    setDeleteId(null);
  };
  const invalidate = () => {
    setViewedJourney(null);
    setPreview(null);
    setRouteError('');
  };
  const changeCity = (id: string) => {
    setCityId(id);
    try {
      localStorage.setItem(LAST_CITY_KEY, id);
    } catch {
      // A blocked preference write should not prevent switching cities.
    }
    setFrom('');
    setTo('');
    setVia([]);
    invalidate();
    setActiveLine(null);
    setFocusStation(null);
    setCityOpen(false);
    setJourneyDetail(null);
    setToast(null);
  };
  const setEndpoint = (id: string, kind: 'from' | 'to') => {
    kind === 'from' ? setFrom(id) : setTo(id);
    invalidate();
    setPage('map');
    if (isMobile) setPlannerOpen(true);
    else planner.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const lightStation = (s: Station) => {
    if (progress.stations.get(s.id)?.visited) {
      setToast({ text: t('{0}已经点亮，上下车足迹已记录', name(s)) });
      return;
    }
    const journey: Journey = {
      id: crypto.randomUUID(),
      kind: 'station',
      createdAt: new Date().toISOString(),
      stationIds: [s.id],
      segmentIds: [],
      lineIds: [],
      transferIds: [],
    };
    if (addJourney(journey))
      setToast({ text: t('已点亮「{0}」· 未点亮区间', name(s)), undoId: journey.id });
  };
  const unlightStation = (s: Station) => {
    const remaining = removeStationLighting(journeys, s.id);
    if (remaining.length === journeys.length) return;
    if (commit({ ...saved, cities: { ...saved.cities, [cityId]: remaining } })) {
      const hasJourney = getProgress(remaining).stations.has(s.id);
      setToast({
        text: t('已取消「{0}」的单站点亮{1}', name(s), hasJourney ? t('，行程足迹已保留') : ''),
      });
    }
  };
  const planRoute = (start = from, end = to, waypoints = via) => {
    if (!start || !end) {
      setRouteError('请先选择上车站和下车站。');
      return;
    }
    if (start === end) {
      setRouteError('上车站与下车站不能相同，可以点击地图单独点亮此站。');
      return;
    }
    if (waypoints.some((id) => !id)) {
      setRouteError('请选择换乘站，或移除空白的换乘项。');
      return;
    }
    const route = findRoute(network, start, end, waypoints, preference);
    if (!route) {
      setRouteError('未找到符合换乘要求的通路，请检查换乘站及其顺序。');
      setPreview(null);
      return;
    }
    setRouteError('');
    setActiveLine(null);
    setViewedJourney(null);
    setPreview(route);
  };
  const confirmRoute = () => {
    if (!preview) return;
    const journey: Journey = {
      ...preview,
      id: crypto.randomUUID(),
      kind: 'trip',
      createdAt: new Date().toISOString(),
    };
    if (addJourney(journey)) {
      setToast({
        text: t(
          '旅程已收集，点亮 {0} 站、{1} 个区间',
          preview.stationIds.length,
          preview.segmentIds.length,
        ),
        undoId: journey.id,
      });
      setPreview(null);
      setFrom('');
      setTo('');
      setVia([]);
      setPlannerOpen(false);
    }
  };
  const useSuggestion = () => {
    const a = suggestion.start,
      b = suggestion.end;
    setFrom(a);
    setTo(b);
    setVia([]);
    planRoute(a, b, []);
    planner.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const importBackup = async (file: File) => {
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error(t('备份文件不得超过 10 MB'));
      const imported = validateBackup(JSON.parse(await file.text()), cities, true);
      const next = mergeBackups(saved, imported);
      if (commit(next, true)) setToast({ text: t('备份已恢复，与现有记录合并完成') });
    } catch (e) {
      setToast({ text: e instanceof Error ? t(e.message) : t('备份读取失败，请检查文件格式') });
    }
  };
  const exportBackup = async () => {
    if (exporting.current) return;
    exporting.current = true;
    try {
      const raw = storageBlocked ? localStorage.getItem(STORAGE_KEY) : null;
      if (storageBlocked && raw === null) throw new Error(t('无法读取原始记录'));
      const outcome = await downloadBackup(
        raw ?? JSON.stringify(saved, null, 2),
        raw !== null ? 'MetroListo-original-recovery.json' : undefined,
        locale,
      );
      setToast({
        text:
          outcome === 'native' ? t('分享面板已关闭，请确认已保存备份') : t('已请求浏览器下载备份'),
      });
    } catch (error) {
      setToast({
        text:
          error instanceof Error
            ? t('备份未导出：{0}', t(error.message))
            : t('备份未导出或分享已取消'),
      });
    } finally {
      exporting.current = false;
    }
  };
  const shortDate = (date: string) =>
    new Date(date).toLocaleString(locale, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  const closeButton = (label: string, onClick: () => void) => (
    <button className="icon-btn" aria-label={label} onClick={onClick}>
      <X size={18} />
    </button>
  );
  const pageCopy = {
    map: { title: t('探索地图'), sub: t('点击站点单独点亮，或记录一段完整旅程。') },
    journal: { title: t('我的足迹'), sub: t('单独点亮与完整旅程，都收藏在这里。') },
    lines: {
      title: t('线路收藏'),
      sub: t(
        '{0} · 已乘坐 {1} / {2} 条线路',
        locale === 'en-GB' ? (city.descriptionEn ?? city.description) : city.description,
        progress.lines.size,
        city.lines.length,
      ),
    },
  }[page];

  const stationRatio = progress.stations.size / city.stations.length;
  const hero = (
    <section className="hero">
      <div className="hero-body">
        <span className="hero-label">
          <MapPin size={13} /> {name(city)}
          {t('· 探索度')}
        </span>
        <div className="hero-number">
          {percentage}
          <small>%</small>
        </div>
        <p>
          {progress.stations.size === 0
            ? t('你的城市故事，从熟悉的那一站开始。')
            : stationRatio === 1
              ? t('整座城市，都有你的足迹。')
              : t('还有 {0} 个站点，等你去发现。', city.stations.length - progress.stations.size)}
        </p>
        <div className="hero-track" aria-hidden="true">
          <i style={{ width: `${Math.max(stationRatio * 100, 0)}%` }} />
          {[0, 25, 50, 75, 100].map((stop) => (
            <span
              key={stop}
              className={stationRatio * 100 >= stop ? 'on' : ''}
              style={{ left: `${stop}%` }}
            />
          ))}
          <b style={{ left: `${stationRatio * 100}%` }}>
            <TrainFront size={12} />
          </b>
        </div>
      </div>
      <div className="hero-stats">
        <div>
          <strong>{progress.stations.size}</strong>
          <span>
            / {city.stations.length} {t('站点')}
          </span>
        </div>
        <div>
          <strong>{progress.segments.size}</strong>
          <span>
            / {city.segments.length} {t('区间')}
          </span>
        </div>
        <div>
          <strong>{progress.lines.size}</strong>
          <span>/ {t('{0} 线路', city.lines.length)}</span>
        </div>
        <div>
          <strong>{trips.length}</strong>
          <span>{locale === 'en-GB' && trips.length === 1 ? 'journey' : t('次旅程')}</span>
        </div>
      </div>
    </section>
  );

  const journeyPlanner = (
    <section
      className={isMobile ? 'sheet planner planner-sheet' : 'card planner'}
      ref={planner}
      role={isMobile ? 'dialog' : undefined}
      aria-modal={isMobile ? true : undefined}
      aria-label={isMobile ? t('记录一段旅程') : undefined}
    >
      <div className={isMobile ? 'planner-head sheet-head' : 'planner-head'}>
        <div>
          <h2>{t('记录一段旅程')}</h2>
          <p>{t('先预览路线，再确认点亮沿途')}</p>
        </div>
        {isMobile && closeButton(t('关闭旅程记录'), () => setPlannerOpen(false))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          planRoute();
        }}
      >
        <div className="route-form">
          <div className="route-row">
            <i className="start" />
            <div>
              <label>{t('上车站')}</label>
              <StationPicker
                network={network}
                value={from}
                onChange={(id) => {
                  setFrom(id);
                  invalidate();
                }}
                label={t('上车站')}
                placeholder={t('从哪一站出发')}
              />
            </div>
          </div>
          {via.map((id, i) => (
            <div className="route-row" key={i}>
              <i className="via" />
              <div>
                <label>
                  {t('换乘站')}
                  {i + 1}
                </label>
                <StationPicker
                  network={network}
                  value={id}
                  transferOnly
                  onChange={(next) => {
                    setVia((v) => v.map((s, j) => (j === i ? next : s)));
                    invalidate();
                  }}
                  label={t('换乘站{0}', i + 1)}
                  placeholder={t('选择换乘站点')}
                />
              </div>
              <button
                type="button"
                className="remove"
                aria-label={t('移除换乘站{0}', i + 1)}
                onClick={() => {
                  setVia((v) => v.filter((_, j) => j !== i));
                  invalidate();
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <div className="route-row">
            <i className="end" />
            <div>
              <label>{t('下车站')}</label>
              <StationPicker
                network={network}
                value={to}
                onChange={(id) => {
                  setTo(id);
                  invalidate();
                }}
                label={t('下车站')}
                placeholder={t('在哪一站停下')}
              />
            </div>
          </div>
          <button
            type="button"
            className="swap"
            aria-label={t('交换上车站和下车站')}
            onClick={() => {
              setFrom(to);
              setTo(from);
              setVia([...via].reverse());
              invalidate();
            }}
          >
            <ArrowDownUp size={16} />
          </button>
        </div>
        <div className="route-options">
          <button
            type="button"
            className="link-btn"
            disabled={via.length >= 3}
            onClick={() => {
              setVia([...via, '']);
              invalidate();
            }}
          >
            <Plus size={15} />
            {t('添加换乘站')}
          </button>
          <Segmented
            className="pref-seg"
            value={preference}
            options={[
              { value: 'balanced', label: t('综合推荐') },
              { value: 'transfers', label: t('换乘最少') },
            ]}
            onChange={({ value }) => {
              setPreference(value as typeof preference);
              invalidate();
            }}
          />
        </div>
        {routeError && (
          <p className="form-error" role="alert">
            <AlertCircle size={14} />
            {t(routeError)}
          </p>
        )}
        {!preview && (
          <Button block theme="primary" type="submit" className="plan-btn">
            <RouteIcon size={17} />
            {t('预览行程路线')}
          </Button>
        )}
      </form>
      {preview ? (
        <div className="route-preview">
          <div className="preview-head">
            <span>
              <CheckCircle2 size={15} />
              {t('通路已找到')}
            </span>
            <b>
              {t('{0} 站 · 换乘次数：{1}', preview.stationIds.length, preview.transferIds.length)}
            </b>
          </div>
          <div className="itinerary">
            {routeGroups(preview).map((group, i) => (
              <div className="leg" key={i}>
                <i style={{ background: network.lineById.get(group.lineId)!.color }} />
                <div>
                  <strong>
                    {displayName(group.from)} <ArrowRight size={13} /> {displayName(group.to)}
                  </strong>
                  <small>
                    {name(network.lineById.get(group.lineId)!)} · {group.stops}{' '}
                    {locale === 'en-GB' && group.stops === 1 ? 'section' : t('个区间')}
                  </small>
                  <details>
                    <summary>{t('查看沿途站点')}</summary>
                    <p>{group.stationIds.map(displayName).join(' → ')}</p>
                  </details>
                </div>
              </div>
            ))}
          </div>
          <Button block theme="primary" className="plan-btn" onClick={confirmRoute}>
            <Sparkles size={17} />
            {t('确认行程，点亮沿途')}
          </Button>
          <p className="preview-note">{t('确认后记录上下车站、换乘站与全部途经区间')}</p>
        </div>
      ) : (
        <p className="planner-tip">{t('最多可添加三个换乘站，换乘站需实际换车')}</p>
      )}
    </section>
  );

  return (
    <div className={isMobileMap ? 'app mobile-map' : 'app'}>
      {!isMobile && (
        <aside className="rail">
          <a
            className="rail-logo"
            href="#"
            aria-label={t('全地铁首页')}
            onClick={(e) => {
              e.preventDefault();
              setPage('map');
            }}
          >
            <img src="/favicon.svg" alt="" />
          </a>
          <nav className="rail-nav" aria-label={t('主导航')}>
            {nav.map((item) => (
              <button
                key={item.id}
                className={page === item.id ? 'rail-item selected' : 'rail-item'}
                aria-current={page === item.id ? 'page' : undefined}
                onClick={() => setPage(item.id)}
              >
                <item.icon size={22} strokeWidth={page === item.id ? 2 : 1.75} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="rail-bottom">
            <button className="rail-item" onClick={() => setHelpOpen(true)}>
              <CircleHelp size={22} strokeWidth={1.75} />
              <span>{t('使用指南')}</span>
            </button>
            <button className="rail-item" onClick={() => setSettingsOpen(true)}>
              <Settings2 size={22} strokeWidth={1.75} />
              <span>{t('数据管理')}</span>
            </button>
          </div>
        </aside>
      )}
      <div className="app-body">
        <header className="topbar">
          <div className="brand">
            <img src="/favicon.svg" alt="" />
            {t('全地铁')}
            {locale === 'zh-CN' && <small>MetroListo</small>}
          </div>
          <button
            className="city-switch"
            onClick={() => setCityOpen(true)}
            aria-label={t('切换城市')}
          >
            <MapPin size={15} />
            {name(city)}
            <ChevronDown size={14} />
          </button>
          <div className="topbar-actions">
            <span className="storage-state">
              <span className={`dot ${storageError ? 'error' : ''}`} />
              {storageError ? t('存储异常') : t('足迹仅保存在此设备')}
            </span>
            {!isMobile && (
              <button className="icon-btn" aria-label={t('导出足迹备份')} onClick={exportBackup}>
                <Download size={19} strokeWidth={1.75} />
              </button>
            )}
            {isMobile && (
              <button
                className="icon-btn"
                aria-label={t('使用指南')}
                onClick={() => setHelpOpen(true)}
              >
                <CircleHelp size={20} strokeWidth={1.75} />
              </button>
            )}
            <button
              className="icon-btn"
              aria-label={t('数据管理')}
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={20} strokeWidth={1.75} />
            </button>
          </div>
        </header>
        <main className="page" key={page}>
          {(!isMobile || page !== 'map') && (
            <div className="page-head">
              <div>
                <h1>{pageCopy.title}</h1>
                <p>{pageCopy.sub}</p>
              </div>
            </div>
          )}
          {(storageError || !!(saved.quarantined?.length ?? 0)) && (
            <div className="banner" role="alert">
              <AlertCircle size={18} />
              <span>
                {(storageError ? t(storageError) : null) ??
                  t(
                    '有 {0} 项记录暂不可用，原始内容已保留在备份中，其余足迹可正常记录。',
                    saved.quarantined?.length ?? 0,
                  )}
              </span>
              <button onClick={() => setSettingsOpen(true)}>
                {t('管理备份')}
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          {page !== 'map' && hero}
          {page === 'map' ? (
            <div className="explore">
              <section className="card map-card">
                {viewedJourney && (
                  <div className="active-line">
                    {t('正在查看已记录旅程')}
                    <button onClick={() => setViewedJourney(null)}>
                      <X size={13} />
                      {t('退出旅程查看')}
                    </button>
                  </div>
                )}
                <div className="map-toolbar">
                  <Segmented
                    value={exploredOnly ? 'mine' : 'all'}
                    block={isMobile}
                    options={[
                      {
                        value: 'mine',
                        label: (
                          <span className="seg-label">
                            <Footprints size={14} />
                            {t('我的足迹')}
                          </span>
                        ),
                      },
                      {
                        value: 'all',
                        label: (
                          <span className="seg-label">
                            <Globe2 size={14} />
                            {t('城市线网')}
                          </span>
                        ),
                      },
                    ]}
                    onChange={({ value }) => setExploredOnly(value === 'mine')}
                  />
                  <span className="toolbar-spacer" />
                  <StationPicker
                    network={network}
                    value=""
                    label={t('搜索地图站点')}
                    placeholder={t('搜索站点')}
                    variant="search"
                    onChange={(id) => {
                      setViewedJourney(null);
                      setFocusStation(id);
                      setActiveLine(null);
                    }}
                  />
                  <button
                    className={`filter-btn ${activeLine ? 'active' : ''}`}
                    onClick={() => setLineOpen(true)}
                    aria-label={t('筛选地铁线路')}
                  >
                    {activeLine ? (
                      <i style={{ background: network.lineById.get(activeLine)?.color }} />
                    ) : (
                      <Layers2 size={16} />
                    )}
                    <span>{activeLine ? name(network.lineById.get(activeLine)) : t('线路')}</span>
                    <ChevronDown size={14} />
                  </button>
                </div>
                {activeLine && (
                  <div className="active-line">
                    <i style={{ background: network.lineById.get(activeLine)!.color }} />
                    {t('仅显示')}
                    <strong>{name(network.lineById.get(activeLine)!)}</strong>
                    <button onClick={() => setActiveLine(null)}>
                      <X size={13} />
                      {t('显示全部线路')}
                    </button>
                  </div>
                )}
                <MetroMap
                  key={city.id}
                  network={network}
                  progress={progress}
                  route={preview ?? viewedJourney}
                  activeLine={activeLine}
                  exploredOnly={exploredOnly}
                  focusStation={focusStation}
                  onStation={lightStation}
                  manualStationIds={manualStationIds}
                  onUnlightStation={unlightStation}
                  onSetEndpoint={setEndpoint}
                  onAddJourney={isMobile ? () => setPlannerOpen(true) : undefined}
                />
                <div className="map-foot">
                  <div className="legend" aria-label={t('足迹图例')}>
                    <span>
                      <i className="legend-dot" />
                      {t('未点亮')}
                    </span>
                    <span>
                      <i className="legend-dot passed" />
                      {t('途经过')}
                    </span>
                    <span>
                      <i className="legend-dot transfer" />
                      {t('换乘过')}
                    </span>
                    <span>
                      <i className="legend-dot visited" />
                      {t('上下车过')}
                    </span>
                    <span>
                      <i className="legend-line" />
                      {t('已乘区间')}
                    </span>
                  </div>
                  <button
                    className="icon-btn small"
                    onClick={() => setHelpOpen(true)}
                    aria-label={t('查看点亮规则')}
                  >
                    <CircleHelp size={16} />
                  </button>
                </div>
                <div className="line-strip">
                  {city.lines.map((l) => (
                    <button
                      title={name(l)}
                      key={l.id}
                      className={activeLine === l.id ? 'active' : ''}
                      onClick={() => {
                        setViewedJourney(null);
                        setActiveLine(activeLine === l.id ? null : l.id);
                        setPreview(null);
                      }}
                    >
                      <i style={{ background: l.color }} />
                      {name({ names: l.shortNames })}
                    </button>
                  ))}
                </div>
              </section>
              {!isMobile && (
                <aside className="side">
                  {journeyPlanner}
                  {hero}
                </aside>
              )}
              {!isMobile && showSuggestion && (
                <section className="card suggest">
                  <span className="suggest-icon">
                    <TrainFront size={20} />
                  </span>
                  <div>
                    <h3>
                      {city.id === 'shanghai'
                        ? t('穿过江底，去看一眼陆家嘴')
                        : city.id === 'beijing'
                          ? t('沿着长安街，去赴一场奇遇')
                          : t('从熟悉的一站，开始新的探索')}
                    </h3>
                    <p>
                      {city.id === 'shanghai'
                        ? ['人民广场', '南京东路', '陆家嘴']
                            .map((local) =>
                              name(
                                city.stations.find((station) =>
                                  station.names.some(
                                    (n) => n.language === 'zh-CN' && n.value === local,
                                  ),
                                ),
                              ),
                            )
                            .join(' → ')
                        : city.id === 'beijing'
                          ? ['天安门东', '国贸', '环球度假区']
                              .map((local) =>
                                name(
                                  city.stations.find((station) =>
                                    station.names.some(
                                      (n) => n.language === 'zh-CN' && n.value === local,
                                    ),
                                  ),
                                ),
                              )
                              .join(' → ')
                          : `${displayName(suggestion.start)} → ${displayName(suggestion.end)}`}
                    </p>
                  </div>
                  <Button size="small" theme="primary" variant="outline" onClick={useSuggestion}>
                    {t('试一试')}
                  </Button>
                </section>
              )}
            </div>
          ) : page === 'journal' ? (
            <section className="card panel">
              <div className="panel-head">
                <div>
                  <h2>
                    {t('全部记录')}
                    <span className="count">{journeys.length}</span>
                  </h2>
                  <p>{t('点击记录查看详情，撤销后足迹会重新计算。')}</p>
                </div>
                <Button size="small" variant="outline" onClick={exportBackup}>
                  <Download size={14} />
                  {t('导出备份')}
                </Button>
              </div>
              {journeys.length ? (
                <div className="records">
                  {journeys.map((j) => (
                    <article className="record" key={j.id}>
                      <span className={`record-icon ${j.kind}`}>
                        {j.kind === 'trip' ? <RouteIcon size={19} /> : <MapPin size={19} />}
                      </span>
                      <button className="record-main" onClick={() => setJourneyDetail(j)}>
                        <h3>
                          {displayName(j.stationIds[0])}
                          {j.kind === 'trip' && (
                            <>
                              <ArrowRight size={15} />
                              {displayName(j.stationIds.at(-1)!)}
                            </>
                          )}
                        </h3>
                        <p>
                          {j.kind === 'trip'
                            ? t(
                                '{0} 站 · {1} 个区间 · {2} 次换乘',
                                j.stationIds.length,
                                j.segmentIds.length,
                                j.transferIds.length,
                              )
                            : t('单站点亮 · 上下车过')}
                          {' · '}
                          {shortDate(j.createdAt)}
                        </p>
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={t('撤销{0}记录', displayName(j.stationIds[0]))}
                        onClick={() => setDeleteId(j.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                      <ChevronRight size={18} className="record-chevron" />
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <div className="empty-icon">
                    <Footprints size={30} />
                  </div>
                  <h3>{t('还没有足迹')}</h3>
                  <p>{t('在地图上点亮一个站点，或记录一段完整旅程。')}</p>
                  <Button theme="primary" onClick={() => setPage('map')}>
                    {t('去探索地图')}
                  </Button>
                </div>
              )}
            </section>
          ) : (
            <section>
              <div className="lines-grid">
                {city.lines.map((line) => {
                  const edges = city.segments.filter((s) => s.lineId === line.id),
                    lit = edges.filter((s) => progress.segments.has(s.id)).length;
                  const stationLit = line.stationIds.filter((id) =>
                    progress.stations.has(id),
                  ).length;
                  const ratio = edges.length ? lit / edges.length : 0;
                  return (
                    <button
                      className="line-card"
                      key={line.id}
                      onClick={() => {
                        setViewedJourney(null);
                        setActiveLine(line.id);
                        setPreview(null);
                        setPage('map');
                      }}
                    >
                      <div className="line-card-top">
                        <span className="line-badge" style={{ background: line.color }}>
                          {name({ names: line.shortNames })}
                        </span>
                        <ArrowUpRight size={16} />
                      </div>
                      <h3>{name(line)}</h3>
                      <p>{t('{0} 个站点 · {1}', line.stationIds.length, lineKind[line.kind])}</p>
                      <div className="meter">
                        <i style={{ width: `${ratio * 100}%`, background: line.color }} />
                      </div>
                      <div className="line-card-foot">
                        <span>{t('已点亮 {0} / {1} 站', stationLit, line.stationIds.length)}</span>
                        <strong>{Math.round(ratio * 100)}%</strong>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          {(!isMobile || page !== 'map') && (
            <footer className="footer">
              <span>{t('全地铁 MetroListo · 从一站，到一城。')}</span>
              <span>
                {t('示意线网，非实时导航')}
                <button onClick={() => setHelpOpen(true)}>
                  {t('数据说明')}
                  <ArrowUpRight size={13} />
                </button>
              </span>
            </footer>
          )}
        </main>
      </div>
      {isMobile && (
        <TabBar
          className="mobile-tabbar"
          value={page}
          split={false}
          shape="round"
          zIndex={100}
          theme="tag"
          onChange={(value) => setPage(value as Page)}
        >
          {nav.map((item) => (
            <TabBarItem key={item.id} value={item.id} icon={<item.icon size={22} />}>
              {item.label}
            </TabBarItem>
          ))}
        </TabBar>
      )}
      {isMobileMap && (
        <Popup
          visible={plannerOpen}
          placement="bottom"
          onClose={() => setPlannerOpen(false)}
          destroyOnClose
          className="app-popup journey-popup"
        >
          {journeyPlanner}
        </Popup>
      )}
      <Popup
        visible={cityOpen}
        placement={isMobile ? 'bottom' : 'center'}
        onClose={() => setCityOpen(false)}
        destroyOnClose
        className="app-popup"
      >
        <div className="sheet">
          <div className="sheet-head">
            <div>
              <h2>{t('选择城市')}</h2>
              <p>{t('每座城市的足迹独立记录，切换不会丢失数据。')}</p>
            </div>
            {closeButton(t('关闭城市选择'), () => setCityOpen(false))}
          </div>
          {sortedCities.map((c) => (
            <button
              className={`city-option ${c.id === cityId ? 'selected' : ''}`}
              key={c.id}
              onClick={() => changeCity(c.id)}
            >
              <span className="city-option-icon">
                <TrainFront size={22} />
              </span>
              <div>
                <strong>
                  <CityNames city={c} locale={locale} />
                </strong>
                <p>
                  <span className="city-credit">{contributionLabel(c, locale)}</span>
                  {t('{0} 条线路 · {1} 个站点', c.lines.length, c.stations.length)}
                </p>
              </div>
              {c.id === cityId ? <Check size={18} /> : <ChevronRight size={18} />}
            </button>
          ))}
        </div>
      </Popup>
      <Popup
        visible={lineOpen}
        placement="bottom"
        onClose={() => setLineOpen(false)}
        destroyOnClose
        className="app-popup"
      >
        <div className="sheet bottom">
          <div className="sheet-head">
            <div>
              <h2>{t('筛选线路')}</h2>
              <p>{t('只显示一条线路及其站点。')}</p>
            </div>
            {closeButton(t('关闭线路选择'), () => setLineOpen(false))}
          </div>
          <div className="line-grid">
            <button
              className={!activeLine ? 'selected' : ''}
              onClick={() => {
                setActiveLine(null);
                setLineOpen(false);
              }}
            >
              <Globe2 size={16} />
              <span>{t('全部线路')}</span>
            </button>
            {city.lines.map((l) => (
              <button
                key={l.id}
                className={activeLine === l.id ? 'selected' : ''}
                onClick={() => {
                  setViewedJourney(null);
                  setActiveLine(l.id);
                  setPreview(null);
                  setLineOpen(false);
                }}
              >
                <i style={{ background: l.color }} />
                <span>{name(l)}</span>
              </button>
            ))}
          </div>
        </div>
      </Popup>
      <Popup
        visible={settingsOpen}
        placement={isMobile ? 'bottom' : 'center'}
        onClose={() => setSettingsOpen(false)}
        destroyOnClose
        className="app-popup"
      >
        <div className="sheet">
          <div className="sheet-head">
            <div>
              <h2>{t('数据管理')}</h2>
              <p>{t('导出备份，或从备份中恢复足迹。')}</p>
            </div>
            {closeButton(t('关闭数据管理'), () => setSettingsOpen(false))}
          </div>
          <label className="language-setting">
            <span>{t('语言')}</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as 'zh-CN' | 'en-GB')}
            >
              <option value="zh-CN">简体中文</option>
              <option value="en-GB">English (UK)</option>
            </select>
          </label>
          <div className="info-box">
            <HardDrive size={20} />
            <div>
              <h3>{t('已在当前设备保存')}</h3>
              <p>{t('无需登录，所有足迹仅保存在此浏览器。清理浏览器数据前，请记得导出备份。')}</p>
            </div>
          </div>
          <button className="action-row" onClick={exportBackup}>
            <Download size={20} />
            <div>
              <strong>{t('导出足迹备份')}</strong>
              <small>{t('包含所有城市的行程与单站打卡')}</small>
            </div>
            <ChevronRight size={18} />
          </button>
          <button className="action-row" onClick={() => fileInput.current?.click()}>
            <Upload size={20} />
            <div>
              <strong>{t('从备份中恢复')}</strong>
              <small>{t('导入 JSON 文件，自动合并并去除重复记录')}</small>
            </div>
            <ChevronRight size={18} />
          </button>
          <p className="privacy">
            <ShieldCheck size={15} />
            {t('全地铁不会上传你的足迹。')}
          </p>
        </div>
      </Popup>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importBackup(file);
          e.target.value = '';
        }}
      />
      <Popup
        visible={helpOpen}
        placement={isMobile ? 'bottom' : 'center'}
        onClose={() => setHelpOpen(false)}
        destroyOnClose
        className="app-popup"
      >
        <div className="sheet wide">
          <div className="sheet-head">
            <div>
              <h2>{t('使用指南')}</h2>
              <p>{t('三步记录你的城市足迹。')}</p>
            </div>
            {closeButton(t('关闭使用指南'), () => setHelpOpen(false))}
          </div>
          <div className="guide-step">
            <span>1</span>
            <div>
              <h3>{t('单站点亮')}</h3>
              <p>
                {t(
                  '单击地图上的站点即可标记“上下车过”，不会点亮任何区间。可以从提示中撤销，也可以在“我的足迹”中删除记录。',
                )}
              </p>
            </div>
          </div>
          <div className="guide-step">
            <span>2</span>
            <div>
              <h3>{t('记录完整旅程')}</h3>
              <p>
                {t(
                  '输入上下车站，可按顺序添加最多三个换乘站。预览路线与沿途站点，确认后点亮所有途经站点和乘车区间。',
                )}
              </p>
            </div>
          </div>
          <div className="guide-step">
            <span>3</span>
            <div>
              <h3>{t('看懂足迹颜色')}</h3>
              <p>
                {t(
                  '蓝色实心表示上下车过，橙色圆环表示换乘过，浅蓝圆圈表示仅途经。同时上下车与换乘过的站点，会显示蓝色实心加橙色标记。',
                )}
              </p>
            </div>
          </div>
          <div className="sources">
            <p className="city-credit">{contributionLabel(city, locale)}</p>
            <h3>
              <BookOpen size={15} />
              {t('线网数据说明')}
            </h3>
            <p>
              <CityNames city={city} locale={locale} /> {t('· 数据快照')} {city.updatedAt}
              {locale === 'en-GB' ? '. ' : '。'}
              {locale === 'en-GB' ? (city.descriptionEn ?? city.description) : city.description}
              {t(
                '。本应用记录个人足迹，不提供实时运营、时刻或票价信息，实际出行请以运营方公告为准。',
              )}
            </p>
            {city.sources.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                {locale === 'en-GB' ? (s.titleEn ?? s.title) : s.title}
                <ArrowUpRight size={13} />
              </a>
            ))}
          </div>
          <p className="sheet-note">{t('MetroListo 全地铁 · 灵感来自线格 · Built with TDesign')}</p>
        </div>
      </Popup>
      <Popup
        visible={!!journeyDetail}
        placement={isMobile ? 'bottom' : 'center'}
        onClose={() => setJourneyDetail(null)}
        destroyOnClose
        className="app-popup"
      >
        <div className="sheet">
          <div className="sheet-head">
            <div>
              <h2>{journeyDetail?.kind === 'trip' ? t('地铁旅程') : t('单站点亮')}</h2>
            </div>
            {closeButton(t('关闭行程详情'), () => setJourneyDetail(null))}
          </div>
          {journeyDetail && (
            <>
              <p className="detail-date">
                {new Date(journeyDetail.createdAt).toLocaleString(locale)}
              </p>
              <h3 className="detail-route">
                {displayName(journeyDetail.stationIds[0])}
                {journeyDetail.kind === 'trip' && (
                  <>
                    <ArrowRight size={16} />
                    {displayName(journeyDetail.stationIds.at(-1)!)}
                  </>
                )}
              </h3>
              {journeyDetail.kind === 'trip' ? (
                <div className="itinerary">
                  {routeGroups(journeyDetail).map((g, i) => (
                    <div className="leg" key={i}>
                      <i style={{ background: network.lineById.get(g.lineId)!.color }} />
                      <div>
                        <strong>{name(network.lineById.get(g.lineId)!)}</strong>
                        <p>{g.stationIds.map(displayName).join(' → ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="sheet-note" style={{ marginTop: 0, marginBottom: 16 }}>
                  {t('仅记录上下车，未点亮区间。')}
                </p>
              )}
              <Button
                block
                theme="primary"
                onClick={() => {
                  setPage('map');
                  setActiveLine(null);
                  setPreview(null);
                  setRouteError('');
                  setViewedJourney(journeyDetail.kind === 'trip' ? { ...journeyDetail } : null);
                  if (journeyDetail.kind === 'trip') {
                    setFrom(journeyDetail.stationIds[0]);
                    setTo(journeyDetail.stationIds.at(-1)!);
                    setVia([]);
                  }
                  setFocusStation(
                    journeyDetail.kind === 'station' ? journeyDetail.stationIds[0] : null,
                  );
                  setJourneyDetail(null);
                }}
              >
                {t('在地图上查看')}
              </Button>
            </>
          )}
        </div>
      </Popup>
      <Dialog
        visible={!!deleteId}
        title={t('撤销这条足迹？')}
        content={t('此条记录将被移除。其他旅程中已点亮的站点和区间会保留。')}
        confirmBtn={t('撤销记录')}
        cancelBtn={t('保留')}
        onConfirm={() => deleteId && removeJourney(deleteId)}
        onClose={() => setDeleteId(null)}
      />
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          <span>{t(toast.text)}</span>
          {toast.undoId && (
            <button onClick={() => removeJourney(toast.undoId!)}>{t('撤销')}</button>
          )}
          <button aria-label={t('关闭提示')} className="toast-close" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
