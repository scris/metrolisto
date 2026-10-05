export type Point = [number, number];

/** BCP 47 language tag and the name in that language, independent of script. */
export interface LocalisedName {
  language: string;
  value: string;
}

/** At least one name; the first is the fallback when the UI language is unavailable. */
export type Names = [LocalisedName, ...LocalisedName[]];

export interface Station {
  id: string;
  names: Names;
  aliases?: string[];
  x: number;
  y: number;
  label?: number;
}

export interface MetroLine {
  id: string;
  names: Names;
  shortNames: Names;
  color: string;
  kind: 'metro' | 'rail' | 'tram' | 'maglev' | 'cable-car';
  stationIds: string[];
  /** Ordered direct service paths; repeated stops model loops. Reverse unless oneWay. */
  services?: { id: string; stationIds: string[]; oneWay?: boolean }[];
}

/** Each physical section is explicit; optional city rules describe same-line train changes. */
export interface Segment {
  id: string;
  lineId: string;
  from: string;
  to: string;
  points?: Point[];
  /** Interpret points as cubic Bézier control/control/end triples after the start. */
  curve?: 'cubic';
  oneWay?: boolean;
}

export interface CityData {
  schemaVersion: 1;
  id: string;
  /** Required Chinese city name, regardless of the station naming language. */
  zhName: string;
  /** Required English city name. */
  enName: string;
  /** Optional local city name and its BCP 47 language tag, e.g. 서울 / ko. */
  localName?: { name: string; language: string };
  /** Representative city location in WGS 84 decimal degrees. */
  latitude: number;
  longitude: number;
  updatedAt: string;
  description: string;
  descriptionEn?: string;
  /** Official refers to MetroListo maintenance, not transport-operator endorsement. */
  attribution?: { kind: 'official' } | { kind: 'community'; name: string };
  center: Point;
  sources: { title: string; titleEn?: string; url: string }[];
  stations: Station[];
  lines: MetroLine[];
  segments: Segment[];
  /** Pairs of adjacent sections that require changing trains on the same line. */
  sameLineTransfers?: [string, string][];
}

export interface Route {
  stationIds: string[];
  segmentIds: string[];
  lineIds: string[];
  transferIds: string[];
}

export interface Journey extends Route {
  id: string;
  kind: 'trip' | 'station';
  createdAt: string;
}

export interface SavedData {
  version: 1;
  cities: Record<string, Journey[]>;
  /** Unusable source records are retained verbatim for recovery and export. */
  quarantined?: { cityId: string; value: unknown; reason: string }[];
}

export interface StationState {
  passed: boolean;
  transferred: boolean;
  visited: boolean;
}

export interface Progress {
  stations: Map<string, StationState>;
  segments: Set<string>;
  lines: Set<string>;
}
