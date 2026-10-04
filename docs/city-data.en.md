# City data schema v1

English | [简体中文](city-data.zh.md)

MetroListo’s map and routing use the same provider-independent `CityData`. The TypeScript definitions are in `src/types.ts`, and the runtime validator is `validateCity` in `src/lib/validate.ts`.

## Adding a city

1. Copy `docs/city.example.json` to `src/data/your-city.json` and fill in real data using the tables below.
2. Import the JSON in `src/data/index.ts` and add it to the registry:

```ts
import yourCity from './your-city.json';
export const cities: CityData[] = [shanghai, beijing, shenzhen, yourCity].map(validateCity);
```

3. Run `pnpm format:city`, followed by `pnpm format:check`, `pnpm test` and `pnpm build`. Select the new city and check its lines, interchanges, termini, branches and loop geometry.

No changes are needed to the map, algorithms, storage keys or page logic. Assertions for specific bundled lines apply only to their respective cities; network connectivity tests automatically cover new cities.

## Required JSON format

All `src/data/**/*.json` files, including new cities not yet registered, and `docs/city.example.json` must use the repository’s dedicated formatter. Do not submit a whole file compressed onto a single line or with every nested structure fully expanded.

- Top-level fields use two-space indentation, with one field per line and separate groups for data collections.
- Each element of `stations`, `lines`, `segments`, `sources` and `sameLineTransfers` occupies one line, with spaces after commas and colons.
- Name lists, station ID lists, coordinates and path points stay compact inside their containing object and do not wrap based on length. Each record occupies one line, so changing a station name usually affects only one line.
- Fields follow schema order, with extension fields sorted by name. All array orders are preserved, including name fallback order, station order, coordinate order and endpoints of one-way segments.
- Use LF line endings and a final newline. Formatting does not alter string contents or network data.

Example:

<!-- prettier-ignore -->
```json
{
  "stations": [
    { "id": "example-west", "names": [{ "language": "en", "value": "West Gate" }], "x": 500, "y": 900 },
    { "id": "example-central", "names": [{ "language": "zh-CN", "value": "中央公园" }], "x": 1000, "y": 900 }
  ]
}
```

```sh
pnpm format:city        # Format all city data and the example
pnpm format:city:check  # Check only; exit with code 1 on a formatting violation
pnpm format            # Format city data and the rest of the project
pnpm format:check      # Check city data and the rest of the project
```

The formatter is `scripts/format-city-data.mjs` and has no third-party dependencies. The Amap importer reuses it. City JSON files are excluded from general Prettier formatting to prevent the formatters from overwriting each other. Do not manually use other formatters to expand these files.

`pnpm build` checks city formatting first and stops if it fails. Every PR and push runs the **City data format** check in GitHub Actions, regardless of whether contributors run the local command. To block non-compliant PRs from merging on GitHub, repository administrators should make **City data format** a required status check in the target branch’s protection rules. The workflow file does not change remote branch protection settings itself.

This rule reduces misleading line counts caused by expanded multilingual names and path points. Git line additions and deletions do not measure a contribution’s value; reviews should also consider the number of stations, lines and segments added or corrected, and the work done to verify the data.

## Top-level fields

| Field               | Type                       | Description                                                                                      |
| ------------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| `schemaVersion`     | `1`                        | Schema version                                                                                   |
| `id`                | string                     | Stable identifier using lowercase letters, digits and hyphens, such as `shanghai`                |
| `zhName` / `enName` | string                     | Chinese and English city names; both are required                                                |
| `localName`         | `{name, language}`?        | Optional local-language city name and BCP 47 language tag, such as `서울` / `ko`                 |
| `latitude`          | number                     | Required WGS 84 latitude of a representative city location in decimal degrees, from −90 to 90    |
| `longitude`         | number                     | Required WGS 84 longitude of a representative city location in decimal degrees, from −180 to 180 |
| `updatedAt`         | string                     | Data date, such as `2026-10-03`                                                                  |
| `description`       | string                     | Description of the service coverage                                                              |
| `descriptionEn`     | string?                    | English description of the service coverage                                                      |
| `attribution`       | object?                    | App developer maintenance or a named community contributor; see below                            |
| `center`            | `[number, number]`         | Default map view centre in schematic coordinates                                                 |
| `sources`           | `{title, titleEn?, url}[]` | Data sources with optional English titles and HTTP(S) URLs                                       |
| `stations`          | Station[]                  | Deduplicated stations                                                                            |
| `lines`             | MetroLine[]                | Lines                                                                                            |
| `segments`          | Segment[]                  | All segments between adjacent stations                                                           |

## Names, languages and contributors

The city selector uses the currently open city as its origin and sorts cities from nearest to farthest by great-circle distance between their representative locations, with the current city first. It reorders after switching cities. `latitude` / `longitude` are independent of the schematic map `center` and station `x/y` coordinates. Supply real geographic coordinates for new cities; the example’s `0, 0` is only a placeholder.

The app supports `zh-CN` and `en-GB`. On first launch, it selects a supported language from the browser’s language list; other languages fall back to `en-GB`. Users can switch manually in “Data management → Language”. The choice is saved separately in `metrolisto.locale.v1` and does not change journey records or the backup format.

**City names must include both Chinese `zhName` and English `enName`**, regardless of the languages used for station names. Optional `localName` supplies a local-language name, with a non-empty `name` and a valid BCP 47 `language` tag. It cannot replace either required city name. The validator checks field completeness; contributors must verify the actual language and accuracy of the names.

Use conventional capitalisation for English city names in `enName`, such as `Hangzhou`, `Guangzhou` and `Shenzhen`, rather than all capitals.

For example, Seoul’s city name fields could be written as follows. This illustrates the schema and does not mean a Seoul network is provided:

```json
{
  "zhName": "首尔",
  "enName": "Seoul",
  "localName": { "name": "서울", "language": "ko" }
}
```

The Chinese interface uses “首尔” as the primary name, and the English interface uses “Seoul”. The city selector and data information also show the name in the other interface language and “서울”, displaying duplicate names only once. Omitting `localName` is valid. This field only supplies a name; it does not add a Korean interface.

Stations and lines use **`names` lists**. Each entry has a BCP 47 `language` tag and a non-empty `value`, and each list needs at least one entry. The tag explicitly identifies the language, rather than grouping names by Chinese or Latin script. A local language written in Latin script, such as English or French, can also be the only name. There is no need to add another language or duplicate a name simply to satisfy the field format.

Display selects names in this order: an exact match for the interface language → the first name with the same base language, such as `en` for `en-GB` → the first list entry. Put the preferred fallback name first. Search matches all `names[].value` entries and `aliases`, regardless of the current interface language. A name’s language tag does not mean the app interface supports that language.

Each of the following is a valid station or line name field:

```json
{ "names": [{ "language": "en", "value": "Baker Street" }] }
```

```json
{ "names": [{ "language": "zh-CN", "value": "人民广场" }] }
```

```json
{ "names": [{ "language": "fr", "value": "République" }] }
```

A bilingual station can provide two entries in the same list:

```json
{
  "names": [
    { "language": "zh-CN", "value": "人民广场" },
    { "language": "en", "value": "People's Square" }
  ]
}
```

Language tags must be unique within each list, checked case-insensitively after normalisation. Empty lists, empty names and invalid tags are rejected. Stations and lines use this structure directly; the old `name` / `en` fields are no longer read. Top-level city fields `zhName`, `enName` and optional `localName` follow the city name rules above.

Optional `descriptionEn` supplies English service coverage, and `sources[].titleEn` supplies English source titles. A line’s `shortNames` list uses the same structure and fallback rules as `names`, and also needs only one language.

Neither `description` nor `descriptionEn` should end with a full stop: do not append the Chinese `。` or English `.`.

Optional `attribution` identifies who provided or maintains the data:

```json
{ "kind": "official" }
```

This displays “Maintained by the app developer” and is used for Beijing and Shanghai, which are maintained directly by MetroListo. **It does not indicate endorsement of the app by a transport operator.**

```json
{ "kind": "community", "name": "Alice" }
```

This displays “Contributed by Alice”. `name` must be a non-empty string, and the interface does not label community users as maintainers. Older data without this field displays “Contributor not specified” and is not automatically classified as official.

**Maintain just one `src/data/<city>.json` per city.** Put English station names directly in each `stations[]` object’s `names` list with `language: "en"`. Line names, city names, contributors and sources belong in the same file, without an extra translation directory or generation step. JSON must use the one-record-per-line format above; run `pnpm format:city` or `pnpm format` to apply it.

Beijing and Shanghai must provide official English station and line names. See [Data sources](data-sources.en.md) for the official bilingual maps. This is a data quality requirement for those two bundled cities, rather than a schema requirement for all cities. When updating them, the converter reads verified names from the existing city JSON. Add official English names for new stations directly to the output city JSON before running tests; Pinyin search aliases are not used as English station names.

## Stations

```ts
interface LocalisedName {
  language: string; // BCP 47, such as zh-CN, en, fr or ko
  value: string;
}
type Names = [LocalisedName, ...LocalisedName[]];

interface Station {
  id: string;
  names: Names; // At least one entry; the first is the fallback when the interface language is absent
  aliases?: string[];
  x: number;
  y: number;
  label?: number;
}
```

`x/y` are planar coordinates for the schematic map, **not latitude and longitude**. A canvas of about 3000×2400 with station spacing of roughly 50–100 units is recommended. Prefer horizontal, vertical and 45° segments.

Lines with a real interchange share the same station ID. Separate stations that merely share a name without a direct interchange use different IDs; you may add the line to their names. `aliases` can include former names or Pinyin; search ignores spaces and case. Optional `label` uses odd/even values to choose the preferred initial station label placement direction, with automatic adjustment to avoid other text.

## Lines

```ts
interface MetroLine {
  id: string;
  names: Names; // Full line names in at least one language
  shortNames: Names; // Abbreviated line names in at least one language
  color: string; // #RRGGBB
  kind: 'metro' | 'rail' | 'tram' | 'maglev';
  stationIds: string[];
}
```

`stationIds` only describes which stations belong to a line, for filtering and statistics. **Its array order does not implicitly create connections.** Explicitly define every connection in `segments` below, so loops, branches and one-way lines need no special plugins.

Branches of the same line share a `lineId` and are not treated as transfers between different lines. Declare any required train changes within a line using `sameLineTransfers` below.

## Segments

```ts
interface Segment {
  id: string;
  lineId: string;
  from: string;
  to: string;
  points?: [number, number][];
  oneWay?: boolean;
}
```

- Segments are bidirectional by default. `oneWay: true` permits travel only from `from` to `to`.
- `points` contains the segment’s SVG polyline coordinates, including both endpoints. Without it, the station coordinates are connected directly.
- A loop must explicitly include a segment from the last station to the first.
- Branches must include separate segments from the junction to each branch. Do not invent connections between branch termini.
- Write shared trunk segments on the same line only once. When different lines share tracks, retain each line’s own segments; travel progress is counted separately.
- Keep IDs stable. Do not arbitrarily change station, line or segment IDs when renaming stations or adjusting geometry, or old records and backups will no longer match.

## Routing and state

Routing uses Dijkstra’s algorithm, with state comprising the current station, the arrival segment and the ordered transfer constraints already satisfied. Balanced recommendations assign a cost of 1 per segment and an extra cost of 4 per train change. Fewest-transfers mode uses a train-change cost greater than the network’s total segment count. Selected transfer stations must involve an actual train change; merely passing through does not satisfy the constraint.

Each journey stores ordered `stationIds`, `segmentIds`, `lineIds` and `transferIds`. The endpoints count as boarding or alighting, actual train-change stations count as transfers, and the rest count as passing through. Multiple records are combined by union, with transfer and boarding/alighting states retained separately.

Built-in validation rejects duplicate IDs, invalid coordinates, missing references, invalid colours, segments inconsistent with line membership, and similar errors. Tests also check that all stations are reachable in both directions. If a new city has genuinely disconnected operating networks, such as Shenzhen’s Pingshan SkyShuttle, assert connectivity by connected component in the connectivity tests. Routes between networks correctly return “No route found”.

Optional `sameLineTransfers` is an array of segment ID pairs. Each pair must identify two adjacent segments on the same line and means that changing trains between them also counts as a transfer. For example, it can represent travel between the two branch directions at Longxi Road on Shanghai Line 10, while trunk-to-branch journeys still count as direct. Line collection progress remains grouped by `lineId`; route search retains the arrival segment in its state to detect train changes.

Backups may include a `quarantined` array, with each entry storing `cityId`, the original `value` and a validation failure `reason`. Reading and importing isolate invalid records, unknown cities and invalid city record lists so that other valid records remain usable and can be saved. Quarantined data is retained in exports and deduplicated on repeated import, but does not count towards travel progress. Unparseable JSON or an incorrect overall version still prevents overwriting the original storage.

Segments may set `curve: "cubic"` to use cubic Bézier curves. The first `points` entry is the start point; each subsequent group of three contains two control points and an endpoint. Without this setting, a polyline is drawn. Curves only affect the schematic shape, not segment endpoints or travel direction.
