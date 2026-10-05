import type { CityData, MetroLine, Route, Segment, Station } from '../types';

export interface Network {
  city: CityData;
  stationById: Map<string, Station>;
  lineById: Map<string, MetroLine>;
  segmentById: Map<string, Segment>;
  stationLines: Map<string, MetroLine[]>;
  adjacency: Map<string, { to: string; segment: Segment }[]>;
}

type ServiceIndex = {
  legs: Map<string, string[]>;
  continuations: Map<string, string>;
};
const serviceIndexes = new WeakMap<CityData, ServiceIndex>();

function serviceIndex(city: CityData): ServiceIndex {
  const cached = serviceIndexes.get(city);
  if (cached) return cached;
  const index: ServiceIndex = { legs: new Map(), continuations: new Map() };
  for (const line of city.lines) {
    for (const service of line.services ?? []) {
      for (const reverse of service.oneWay ? [false] : [false, true]) {
        const stops = reverse ? [...service.stationIds].reverse() : service.stationIds;
        for (let i = 1; i < stops.length; i++) {
          const token = `${line.id}|${service.id}|${reverse}|${i}`;
          if (i < stops.length - 1)
            index.continuations.set(token, `${line.id}|${service.id}|${reverse}|${i + 1}`);
          for (const edge of city.segments) {
            if (edge.lineId !== line.id) continue;
            if (
              (edge.from === stops[i - 1] && edge.to === stops[i]) ||
              (!edge.oneWay && edge.to === stops[i - 1] && edge.from === stops[i])
            ) {
              const key = `${edge.id}|${stops[i - 1]}`;
              index.legs.set(key, [...(index.legs.get(key) ?? []), token]);
            }
          }
        }
      }
    }
  }
  serviceIndexes.set(city, index);
  return index;
}

const legServices = (city: CityData, edge: Segment, from: string) =>
  serviceIndex(city).legs.get(`${edge.id}|${from}`) ?? [''];

const changesService = (city: CityData, previous: string, next: string) =>
  (previous !== '' || next !== '') && serviceIndex(city).continuations.get(previous) !== next;

export function createNetwork(city: CityData): Network {
  const adjacency: Network['adjacency'] = new Map(city.stations.map((s) => [s.id, []]));
  city.segments.forEach((segment) => {
    adjacency.get(segment.from)!.push({ to: segment.to, segment });
    if (!segment.oneWay) adjacency.get(segment.to)!.push({ to: segment.from, segment });
  });
  return {
    city,
    adjacency,
    stationById: new Map(city.stations.map((s) => [s.id, s])),
    lineById: new Map(city.lines.map((l) => [l.id, l])),
    segmentById: new Map(city.segments.map((s) => [s.id, s])),
    stationLines: new Map(
      city.stations.map((s) => [s.id, city.lines.filter((l) => l.stationIds.includes(s.id))]),
    ),
  };
}

export function requiresTransfer(city: CityData, incoming: Segment | undefined, outgoing: Segment) {
  return (
    !!incoming &&
    (incoming.lineId !== outgoing.lineId ||
      (city.sameLineTransfers ?? []).some(
        ([a, b]) =>
          (incoming.id === a && outgoing.id === b) || (incoming.id === b && outgoing.id === a),
      ))
  );
}

export function isTransferStation(network: Network, id: string) {
  return (
    (network.stationLines.get(id)?.length ?? 0) > 1 ||
    (network.city.sameLineTransfers ?? []).some(([a, b]) =>
      [a, b].every((edgeId) => {
        const edge = network.segmentById.get(edgeId)!;
        return edge.from === id || edge.to === id;
      }),
    ) ||
    network.city.lines.some(
      (line) =>
        (line.services?.filter((service) => service.stationIds.includes(id)).length ?? 0) > 1,
    )
  );
}

function routeTransferIndices(city: CityData, route: Route) {
  const edges = new Map(city.segments.map((edge) => [edge.id, edge]));
  type Choice = { service: string; indices: number[]; matches: boolean };
  let choices = new Map<string, Choice>([['', { service: '', indices: [], matches: true }]]);
  route.segmentIds.forEach((id, i) => {
    const edge = edges.get(id)!;
    const incoming = i ? edges.get(route.segmentIds[i - 1]) : undefined;
    const next = new Map<string, Choice>();
    for (const service of legServices(city, edge, route.stationIds[i])) {
      for (const previous of choices.values()) {
        const transfer =
          requiresTransfer(city, incoming, edge) ||
          (!!incoming && changesService(city, previous.service, service));
        const indices = transfer ? [...previous.indices, i] : previous.indices;
        const matches =
          previous.matches &&
          (!transfer || route.transferIds[previous.indices.length] === route.stationIds[i]);
        // Preserve ordered recorded changes without forcing a change on every visit to a stop.
        const key = `${service}|${matches ? indices.length : -1}`;
        if (!next.has(key) || indices.length < next.get(key)!.indices.length)
          next.set(key, { service, indices, matches });
      }
    }
    choices = next;
  });
  const all = [...choices.values()].sort((a, b) => a.indices.length - b.indices.length);
  return (
    (
      all.find((choice) => choice.matches && choice.indices.length === route.transferIds.length) ??
      all[0]
    )?.indices ?? []
  );
}

export function routeTransfers(city: CityData, route: Route) {
  return routeTransferIndices(city, route).map((i) => route.stationIds[i]);
}

type Step = {
  key: string;
  station: string;
  via: number;
  cost: number;
  previous?: Step;
  edge?: Segment;
  service?: string;
  transfer?: boolean;
};

/** Dijkstra over (station, incoming section, direct service, transfer waypoint index).
 * A requested transfer station is satisfied only by changing trains there.
 */
export function findRoute(
  network: Network,
  from: string,
  to: string,
  via: string[] = [],
  preference: 'balanced' | 'transfers' = 'balanced',
): Route | null {
  if (
    !network.stationById.has(from) ||
    !network.stationById.has(to) ||
    from === to ||
    via.includes(from) ||
    via.includes(to) ||
    new Set(via).size !== via.length ||
    via.some((id) => !isTransferStation(network, id))
  )
    return null;
  const start: Step = { key: `${from}||0`, station: from, via: 0, cost: 0 };
  const costs = new Map([[start.key, 0]]),
    queue: Step[] = [start];
  const transferCost = preference === 'transfers' ? network.city.segments.length + 1 : 4;
  while (queue.length) {
    queue.sort((a, b) => b.cost - a.cost);
    const current = queue.pop()!;
    if (current.cost !== costs.get(current.key)) continue;
    if (current.station === to && current.via === via.length) {
      const stationIds: string[] = [],
        segmentIds: string[] = [],
        lineIds: string[] = [],
        transferIds: string[] = [];
      let step: Step | undefined = current;
      while (step) {
        stationIds.unshift(step.station);
        if (step.edge) {
          segmentIds.unshift(step.edge.id);
          lineIds.unshift(step.edge.lineId);
          if (step.transfer) transferIds.unshift(step.previous!.station);
        }
        step = step.previous;
      }
      return { stationIds, segmentIds, lineIds, transferIds };
    }
    for (const { to: next, segment } of network.adjacency.get(current.station) ?? []) {
      // Reversing over the same section cannot bypass a branch change of train.
      if (current.edge?.id === segment.id) continue;
      for (const service of legServices(network.city, segment, current.station)) {
        const transfer =
          requiresTransfer(network.city, current.edge, segment) ||
          (!!current.edge && changesService(network.city, current.service ?? '', service));
        let nextVia = current.via;
        if (current.station === via[current.via]) {
          if (!transfer) continue;
          nextVia++;
        }
        const cost = current.cost + 1 + (transfer ? transferCost : 0);
        const key = `${next}|${segment.id}|${nextVia}|${service}`;
        if (cost >= (costs.get(key) ?? Infinity)) continue;
        costs.set(key, cost);
        queue.push({
          key,
          station: next,
          via: nextVia,
          cost,
          previous: current,
          edge: segment,
          service,
          transfer,
        });
      }
    }
  }
  return null;
}

export function searchStations(network: Network, query: string, transferOnly = false) {
  const normalized = query.toLowerCase().replace(/\s/g, '');
  return network.city.stations.filter(
    (s) =>
      (!transferOnly || isTransferStation(network, s.id)) &&
      (!normalized ||
        [...s.names.map((name) => name.value), ...(s.aliases ?? [])].some((v) =>
          v.toLowerCase().replace(/\s/g, '').includes(normalized),
        )),
  );
}

export function routeGroups(route: Route, city: CityData) {
  const changes = new Set(routeTransferIndices(city, route));
  const groups: {
    lineId: string;
    from: string;
    to: string;
    stops: number;
    stationIds: string[];
  }[] = [];
  route.lineIds.forEach((lineId, i) => {
    const last = groups.at(-1);
    if (last?.lineId === lineId && !changes.has(i)) {
      last.to = route.stationIds[i + 1];
      last.stops++;
      last.stationIds.push(route.stationIds[i + 1]);
    } else
      groups.push({
        lineId,
        from: route.stationIds[i],
        to: route.stationIds[i + 1],
        stops: 1,
        stationIds: [route.stationIds[i], route.stationIds[i + 1]],
      });
  });
  return groups;
}
