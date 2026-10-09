# MetroListo · 全地铁

English | [简体中文](README.zh.md)

Collect a city through your everyday journeys. A responsive web app built with **pnpm + React 18 + TypeScript + Vite + TDesign Mobile React**, with iOS and Android support through **Capacitor**, inspired by [线格](https://apps.apple.com/cn/app/id6770010912).

## Local development

Node.js 22 or later is recommended. The project pins pnpm 12.8.1.

```sh
pnpm install
pnpm dev
```

Open the local URL shown in the terminal, which defaults to `http://localhost:5173`.

```sh
pnpm test          # Routing, data integrity, cumulative journey state and backup validation
pnpm build         # City data formatting, TypeScript checks and production build
pnpm preview       # Preview the dist output
pnpm format:check  # Check formatting
pnpm format:city   # Format city JSON with one record per line
```

Deploy `dist/` to any static hosting service. No API key, database or backend is required. Fonts are bundled with the app, so the browser does not depend on external map APIs or font services at runtime.

## iOS / Android

Capacitor 8.5.2 is already set up, with **全地铁** as the app name.

```sh
pnpm install
pnpm build              # Build the web app
pnpm sync:capacitor     # Sync the built web assets and plugins to iOS and Android
pnpm build:ios          # Build and sync both platforms, then open ios/App/App.xcodeproj in Xcode
pnpm build:android      # Build and sync both platforms, then open android/ in Android Studio
```

iOS uses Swift Package Manager. See [Native app development](docs/native-apps.en.md) for environment requirements, syncing a single platform, native builds and signing.

## Features

- English and Simplified Chinese interfaces, with automatic browser language detection and a saved language setting in Data management.
- Beijing, Shanghai, London and Paris are maintained by the app developer. Shenzhen and Guangzhou were contributed by [Hashmapw](https://github.com/Hashmapw); Hangzhou, Amsterdam, Lisbon, Valencia and Málaga were contributed by [scris](https://github.io/scris). Additional cities support named community contributors, and stations may provide only a local-language or English name.
- Cities must have both English and Chinese names and may include a local-language name, such as Seoul / 首尔 / 서울. Stations may provide only English, Chinese or a local-language name.
- Shanghai: **22 lines, 425 unique stations and 520 segments**, including the Airport Link Line, Maglev and Jinshan Railway, including Xinzhuang station.
- Beijing: **28 lines, 422 unique stations and 514 segments**, including Yizhuang T1 tram, Xijiao Line, Capital Airport Express and Daxing Airport Express; suburban railways are excluded.
- Shenzhen: **17 lines, 362 unique stations and 426 segments**, including the through-running Line 2/8, the Line 6 branch and Pingshan SkyShuttle; Longhua Tram is excluded.
- Guangzhou: **22 lines, 365 unique stations and 431 segments**, including APM, Knowledge City Line, Guangfo Line and Foshan Lines 2 and 3.
- Hangzhou: **15 lines, 311 unique stations and 347 segments**, including Shaoxing Lines 1 and 2 and the Hangzhou–Haining Intercity Railway, with the branches of Hangzhou Lines 3 and 6 and Shaoxing Line 1 fully preserved.
- London: **21 lines, 464 unique station complexes/stops and 616 segments**, covering all TfL modes on the Tube map: Underground, six Overground lines, Elizabeth line, DLR, Trams and Cable Car. Thameslink, buses and River Bus are excluded; station names are English only.
- Amsterdam: **5 lines, 39 unique stations and 71 segments**, covering GVB metro M50–M54 with Dutch station names. Trams, buses, ferries and NS rail are excluded.
- Lisbon: **4 lines, 50 unique stations and 52 segments**, covering the Blue, Yellow, Green and Red lines with Portuguese station names. CP rail, Fertagus, ferries and the Estrela–Santos section under construction are excluded.
- Valencia: **10 lines, 144 unique stations and 216 segments**, covering Metrovalencia metro Lines 1, 2, 3, 5, 7 and 9 and tram Lines 4, 6, 8 and 10 with Valencian station names, including the one-way Cabanyal–Malva-rosa tram loop. Renfe Cercanías and EMT buses are excluded; L10 is a separate operating component.
- Málaga: **2 lines, 19 unique stations and 19 segments**, covering Metro de Málaga Lines 1 and 2 with Spanish station names. Cercanías, buses and the Hospital Civil extension under construction are excluded.
- Paris: **21 lines, 541 unique station complexes and 641 segments**, covering Métro Lines 1–14, 3bis and 7bis and the complete RER A–E network with French station names. Trams, Transilien, Orlyval and buses are excluded; Line 15 and the RER E extension to Mantes-la-Jolie are not open yet.
- An SVG schematic network map with dragging, wheel zoom, pinch zoom, fit-to-network, line filters and station search. Station labels adjust to avoid overlap as you zoom.
- Choose boarding and alighting stations plus up to three ordered transfer stations. Each selected transfer station must involve an actual change of train. Choose between balanced recommendations and fewest transfers.
- Preview the complete route and its station lists by leg, then confirm to mark the endpoints, actual transfer stations and travelled segments, while recording stations passed through separately.
- Clicking a station records boarding or alighting there without marking any segments. Station details let you remove a single-station mark while keeping visits contributed by other journeys.
- Stations separately track passing through, transfers, and boarding or alighting. Transfer and boarding/alighting records can coexist; a solid blue mark with an orange indicator means both are present.
- City and line progress count only stations boarded or alighted at or used for an actual transfer, including individual station visits. Passing through does not count. Line percentages use the same station counts shown on each card.
- A journey timeline, line collection progress and record undo. Undo recalculates progress from the remaining records, preserving visits shared with other journeys.
- Persistence in localStorage, isolated by city, with updates across browser tabs, JSON backup export and merge restore. Invalid records are quarantined and retained in exports without blocking valid records; raw storage that cannot be parsed as a whole is never automatically overwritten.
- A two-column desktop layout and bottom navigation on mobile. Keyboard users can search and select stations, move the map with arrow keys, zoom with plus/minus, and mark stations with Enter or Space.

Station counts are deduplicated by unique network ID, so they differ from an operator’s sum of station counts across lines. Branches belong to the same line; parallel segments on different lines are counted separately.

## Adding cities

See the [City data schema](docs/city-data.en.md) for the complete format, a minimal example and the steps to add a city. Copy the [example JSON](docs/city.example.json), fill in stations, lines and adjacent segments, and register it in `src/data/index.ts`. The map, routing algorithm, journey statistics and backups need no changes.

Each city’s names, station names, lines, sources and contributor are maintained together in `src/data/<city>.json`, with no separate translation file. Data contributions must run `pnpm format:city` to use the required format of one station, line or segment record per line. Builds and PR workflows check every city JSON file; see the [required formatting rules](docs/city-data.en.md#required-json-format). Full station and line names use language-tagged `names` lists, while abbreviated line names use `shortNames`; each list needs at least one entry. Beijing and Shanghai use the same schema. Future city contributions do not need bilingual station names, but city names must include both Chinese and English.

## Data and limitations

The bundled data snapshot is dated **2026-10-03**, with additions for Hangzhou and Guangzhou on **2026-10-04**, London and Amsterdam on **2026-10-05**, and Lisbon, Valencia, Málaga and Paris on **2026-10-08**. The Chinese networks use Amap’s public metro data; London uses TfL maps and timetables, Amsterdam uses GVB maps and route information, Lisbon uses the Metropolitano de Lisboa network diagram, Valencia uses the FGV GTFS feed and official network map, Málaga uses Junta de Andalucía and operator information, and Paris uses the Île-de-France Mobilités GTFS feed and official maps. For supplemented official sources, see [Data sources](docs/data-sources.en.md). Stations that share a name but operate separately keep distinct IDs and are not automatically treated as interchanges.

This project records personal travel history. London’s Cable Car is a separate operating component because external walking links are not modeled. Service paths combine recurring ordinary patterns, without resolving their availability at a particular date or time. Routing uses adjacent segments, train-change costs and optional direct service paths, without train timetables, service frequencies, fares, capacity restrictions, service suspensions or precise walking times. The airport lines and Jinshan Railway are also shown as adjacent-station topology, which does not represent the stopping pattern of every train.

Data is stored in localStorage for **the current browser and site address**. Different devices, browsers or ports do not share records. Export a backup before clearing site data. Cloud sync and offline PWA installation are not yet available. iCloud sync on iOS devices will be developed later.

## Key files

```text
src/
  App.tsx                    Pages, journey records and interactions
  components/MetroMap.tsx    SVG network, zooming, dragging and state display
  components/StationPicker.tsx
  data/                      City JSON and registration entry point
  lib/network.ts             Graph structure and Dijkstra routing
  lib/storage.ts             Record aggregation, backup validation and persistence
  lib/validate.ts            Runtime city data validation
  types.ts                   City, segment and journey data types
  styles.css                 TDesign theme and responsive layout
scripts/import-amap.mjs       Development-time data converter
scripts/format-city-data.mjs  City data formatter and checks
capacitor.config.ts           Native app identifiers, web asset directory and platform settings
ios/                         Xcode project and Swift Package Manager configuration
android/                     Android Studio project and Gradle Wrapper
docs/                        Data schema, minimal city example and sources
```
