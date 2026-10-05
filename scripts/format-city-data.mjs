import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fields = {
  city: [
    'schemaVersion',
    'id',
    'zhName',
    'enName',
    'localName',
    'latitude',
    'longitude',
    'updatedAt',
    'description',
    'descriptionEn',
    'attribution',
    'center',
    'sources',
    'stations',
    'lines',
    'segments',
    'sameLineTransfers',
  ],
  stations: ['id', 'names', 'aliases', 'x', 'y', 'label'],
  lines: ['id', 'names', 'shortNames', 'color', 'kind', 'stationIds', 'services'],
  services: ['id', 'stationIds', 'oneWay'],
  segments: ['id', 'lineId', 'from', 'to', 'points', 'curve', 'oneWay'],
  sources: ['title', 'titleEn', 'url'],
  names: ['language', 'value'],
  shortNames: ['language', 'value'],
  localName: ['name', 'language'],
  attribution: ['kind', 'name'],
};
const collections = new Set(['sources', 'stations', 'lines', 'segments', 'sameLineTransfers']);

function keys(value, context) {
  const preferred = Object.hasOwn(fields, context) ? fields[context] : [];
  return [
    ...preferred.filter((key) => Object.hasOwn(value, key)),
    ...Object.keys(value)
      .filter((key) => !preferred.includes(key))
      .sort(),
  ];
}

// Serialize strings separately: whitespace inside names must never be reformatted.
function inline(value, context) {
  if (Array.isArray(value)) return `[${value.map((entry) => inline(entry, context)).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = keys(value, context).map(
      (key) => `${JSON.stringify(key)}: ${inline(value[key], key)}`,
    );
    return entries.length ? `{ ${entries.join(', ')} }` : '{}';
  }
  return JSON.stringify(value);
}

/** A record occupies one line regardless of its names, coordinates or path complexity. */
export function formatCityData(city) {
  if (!city || typeof city !== 'object' || Array.isArray(city))
    throw new Error('城市 JSON 顶层必须为对象');
  // Match JSON.stringify's handling of optional undefined fields from importers.
  city = JSON.parse(JSON.stringify(city));
  const properties = keys(city, 'city').map((key) => {
    const value = city[key];
    const prefix = `  ${JSON.stringify(key)}: `;
    if (collections.has(key) && Array.isArray(value) && value.length)
      return `${prefix}[\n${value.map((entry) => `    ${inline(entry, key)}`).join(',\n')}\n  ]`;
    return prefix + inline(value, key);
  });
  return `{\n${properties.join(',\n')}\n}\n`;
}

/** Discover future city files too, including cities not yet added to the registry. */
export function cityDataFiles(directory = root) {
  const walk = (folder) =>
    fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) return walk(file);
      return entry.isFile() && entry.name.endsWith('.json') ? [file] : [];
    });
  return [
    ...walk(path.join(directory, 'src/data')),
    path.join(directory, 'docs/city.example.json'),
  ].sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [mode, ...requested] = process.argv.slice(2);
    if (!['--write', '--check'].includes(mode))
      throw new Error('Usage: node scripts/format-city-data.mjs --write|--check [file.json ...]');
    const files = requested.length ? requested.map((file) => path.resolve(file)) : cityDataFiles();
    const changes = files
      .map((file) => {
        const original = fs.readFileSync(file, 'utf8');
        let city;
        try {
          city = JSON.parse(original);
        } catch (error) {
          throw new Error(`${path.relative(root, file)}: ${error.message}`);
        }
        return { file, original, formatted: formatCityData(city) };
      })
      .filter(({ original, formatted }) => original !== formatted);
    for (const { file, formatted } of changes) {
      if (mode === '--write') fs.writeFileSync(file, formatted);
      console.log(
        `${mode === '--write' ? 'Formatted' : 'Needs formatting'}: ${path.relative(root, file)}`,
      );
    }
    if (mode === '--check' && changes.length) {
      console.error('城市数据格式不符合约定，请运行 pnpm format:city。');
      process.exitCode = 1;
    } else console.log(`City data format: ${files.length} files checked.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
