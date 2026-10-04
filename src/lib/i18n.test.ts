import { describe, expect, it } from 'vitest';
import { cities } from '../data';
import example from '../../docs/city.example.json';
import { contributionLabel, localisedName, nameInLanguage, resolveLocale, translate } from './i18n';
import { validateCity } from './validate';
import { createNetwork, findRoute, searchStations } from './network';
import { emptyData, validateBackup } from './storage';

describe('language and city data', () => {
  it('honours saved choices and negotiates supported browser languages', () => {
    expect(resolveLocale('en-GB', ['zh-CN'])).toBe('en-GB');
    expect(resolveLocale('zh-CN', ['en-GB'])).toBe('zh-CN');
    expect(resolveLocale(null, ['en-US'])).toBe('en-GB');
    expect(resolveLocale(null, ['fr-FR', 'zh-Hant'])).toBe('zh-CN');
    expect(resolveLocale('invalid', ['fr-FR'])).toBe('en-GB');
  });
  it('accepts single-language stations through validation, search, routes and backup import', () => {
    const city = validateCity(structuredClone(example));
    const network = createNetwork(city);
    const englishOnly = city.stations[0],
      localOnly = city.stations[1];
    expect(localisedName(englishOnly, 'zh-CN')).toBe('West Gate');
    expect(localisedName(englishOnly, 'en-GB')).toBe('West Gate');
    expect(localisedName(localOnly, 'en-GB')).toBe('中央公园');
    expect(searchStations(network, 'westgate')[0].id).toBe(englishOnly.id);
    expect(searchStations(network, '中央公园')[0].id).toBe(localOnly.id);
    const route = findRoute(network, englishOnly.id, localOnly.id)!;
    expect(route.stationIds).toEqual([englishOnly.id, localOnly.id]);
    const data = emptyData();
    data.cities[city.id] = [
      { ...route, id: 'english-only-trip', kind: 'trip', createdAt: '2026-10-03T12:00:00Z' },
    ];
    expect(validateBackup(data, [city])).toEqual(data);
  });
  it('accepts optional local city names independently of station languages', () => {
    const city = validateCity({
      ...structuredClone(example),
      zhName: '首尔',
      enName: 'Seoul',
      localName: { name: '서울', language: 'ko' },
    });
    expect(localisedName(city, 'zh-CN')).toBe('首尔');
    expect(localisedName(city, 'en-GB')).toBe('Seoul');
    expect(localisedName(city.stations[0], 'zh-CN')).toBe('West Gate');
    expect(localisedName(city.stations[1], 'en-GB')).toBe('中央公园');
    expect(validateCity(example).localName).toBeUndefined();
  });
  it.each([
    { zhName: undefined },
    { zhName: '' },
    { zhName: 42 },
    { enName: undefined },
    { enName: ' ' },
    { enName: null },
  ])('requires Chinese and English city names even when a local name exists: %j', (names) => {
    expect(() =>
      validateCity({ ...example, localName: { name: '서울', language: 'ko' }, ...names }),
    ).toThrow();
  });
  it.each([
    null,
    '서울',
    {},
    { name: ' ', language: 'ko' },
    { name: '서울' },
    { name: '서울', language: 42 },
    { name: '서울', language: ' ' },
    { name: '서울', language: 'ko_KR' },
  ])('rejects incomplete or malformed local city names: %j', (localName) => {
    expect(() => validateCity({ ...example, localName })).toThrow();
  });
  it.each([
    undefined,
    null,
    [],
    { en: 'Station' },
    [null],
    [{ language: 'en', value: ' ' }],
    [{ language: 'en', value: 42 }],
    [{ value: 'Station' }],
    [{ language: 'en_US', value: 'Station' }],
    [
      { language: 'en-GB', value: 'Station' },
      { language: 'EN-gb', value: 'Other' },
    ],
  ])('rejects invalid station and line name lists: %j', (names) => {
    const city = structuredClone(example);
    const station = city.stations[0] as Record<string, unknown>;
    station.names = names;
    expect(() => validateCity(city)).toThrow();
    for (const field of ['names', 'shortNames']) {
      const invalidLineCity = structuredClone(example);
      (invalidLineCity.lines[0] as Record<string, unknown>)[field] = names;
      expect(() => validateCity(invalidLineCity)).toThrow();
    }
  });
  it.each([
    ['en', 'Baker Street', 'Bakerloo line', 'Bakerloo'],
    ['zh-CN', '中央公园', '一号线', '1'],
    ['fr', 'République', 'Ligne 3', '3'],
    ['ko', '서울역', '1호선', '1'],
  ])('supports %s as the only station and line language', (language, station, line, short) => {
    const raw = structuredClone(example);
    raw.stations[0].names = [{ language, value: station }];
    raw.lines[0].names = [{ language, value: line }];
    raw.lines[0].shortNames = [{ language, value: short }];
    const city = validateCity(raw);
    for (const locale of ['zh-CN', 'en-GB'] as const) {
      expect(localisedName(city.stations[0], locale)).toBe(station);
      expect(localisedName(city.lines[0], locale)).toBe(line);
      expect(nameInLanguage(city.lines[0].shortNames, locale)).toBe(short);
    }
    const network = createNetwork(city);
    expect(searchStations(network, station)[0].id).toBe(city.stations[0].id);
    expect(findRoute(network, city.stations[0].id, city.stations[1].id)?.stationIds).toEqual([
      city.stations[0].id,
      city.stations[1].id,
    ]);
  });
  it('prefers exact language matches and otherwise uses the explicitly ordered fallback', () => {
    const names = [
      { language: 'fr', value: 'Nom local' },
      { language: 'en-US', value: 'US name' },
      { language: 'en-GB', value: 'UK name' },
    ];
    expect(nameInLanguage(names, 'en-GB')).toBe('UK name');
    expect(nameInLanguage(names, 'en-AU')).toBe('US name');
    expect(nameInLanguage(names, 'zh-CN')).toBe('Nom local');
    expect(nameInLanguage([...names].reverse(), 'zh-CN')).toBe('UK name');
    const city = structuredClone(example);
    city.stations[0].names = names;
    const network = createNetwork(validateCity(city));
    for (const { value } of names)
      expect(searchStations(network, value)[0].id).toBe(city.stations[0].id);
  });
  it('requires explicit name lists instead of the former name/en fields', () => {
    const city = structuredClone(example);
    const station = city.stations[0] as Record<string, unknown>;
    delete station.names;
    station.name = '中文站';
    station.en = 'Station';
    expect(() => validateCity(city)).toThrow();
  });
  it('does not require community contributors to supply English station names', () => {
    const city = validateCity({
      ...structuredClone(example),
      attribution: { kind: 'community', name: 'Alice' },
    });
    expect(contributionLabel(city, 'zh-CN')).toBe('由 Alice 贡献');
    expect(contributionLabel(city, 'en-GB')).toBe('Contributed by Alice');
    expect(contributionLabel({ attribution: undefined }, 'en-GB')).toBe(
      'Contributor not specified',
    );
  });
  it.each([{ kind: 'community' }, { kind: 'community', name: ' ' }, { kind: 'other' }, null])(
    'rejects invalid attribution: %j',
    (attribution) => {
      expect(() => validateCity({ ...example, attribution })).toThrow();
    },
  );
  it('supplies English names and official credits for both bundled cities', () => {
    for (const city of cities.filter((city) => ['shanghai', 'beijing'].includes(city.id))) {
      expect(city.attribution).toEqual({ kind: 'official' });
      expect(contributionLabel(city, 'en-GB')).toBe('Officially maintained');
      for (const names of [
        ...city.stations.map((s) => s.names),
        ...city.lines.flatMap((l) => [l.names, l.shortNames]),
      ]) {
        expect(names.some((n) => n.language === 'zh-CN' && n.value.trim())).toBe(true);
        expect(names.some((n) => n.language === 'en' && n.value.trim())).toBe(true);
      }
      expect(city.sources.every((s) => s.titleEn?.trim())).toBe(true);
    }
  });
  it('uses official station names and keeps earlier names searchable', () => {
    const sh = createNetwork(cities.find((c) => c.id === 'shanghai')!);
    const bj = createNetwork(cities.find((c) => c.id === 'beijing')!);
    expect(localisedName(searchStations(sh, 'Jinshanyuanqu')[0], 'zh-CN')).toBe('金山园区');
    expect(localisedName(searchStations(bj, 'Qu Zhuang')[0], 'zh-CN')).toBe('屈庄');
    expect(localisedName(searchStations(bj, 'Terminal 3')[0], 'en-GB')).toBe(
      '3 Hao Hangzhanlou (Terminal 3)',
    );
    expect(localisedName(searchStations(sh, 'East Nanjing Road')[0], 'en-GB')).toBe(
      'Nanjing Rd.(E)',
    );
  });
  it('substitutes values without interpreting contributor names as templates', () => {
    expect(translate('en-GB', '由 {0} 贡献', 'Alice {1}')).toBe('Contributed by Alice {1}');
    expect(
      localisedName(
        {
          names: [
            { language: 'zh-CN', value: '人民广场' },
            { language: 'en', value: 'People’s Square' },
          ],
        },
        'en-GB',
      ),
    ).toBe('People’s Square');
  });
});
