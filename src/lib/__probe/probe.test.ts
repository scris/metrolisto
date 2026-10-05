import { it } from 'vitest';
import { cities } from '../../data';
import { createNetwork, findRoute, isTransferStation, routeGroups } from '../network';

const city = cities.find((c) => c.id === 'london')!;
const net = createNetwork(city);
const id = (name: string) => {
  const s = city.stations.find((s) => s.names[0].value === name);
  if (!s) throw new Error('no station ' + name);
  return s.id;
};
const nm = (i: string) => net.stationById.get(i)!.names[0].value;
const show = (a: string, b: string, via: string[] = [], pref: 'balanced' | 'transfers' = 'balanced') => {
  const t = performance.now();
  const r = findRoute(net, id(a), id(b), via.map(id), pref);
  const ms = (performance.now() - t).toFixed(1);
  if (!r) return console.log(`${a} -> ${b} [${pref}]: null (${ms}ms)`);
  console.log(
    `${a} -> ${b} [${pref}] ${ms}ms segs=${r.segmentIds.length} transfers=[${r.transferIds.map(nm)}]\n   ` +
      routeGroups(r, city)
        .map((g) => `${g.lineId.replace('london-', '')}: ${nm(g.from)}→${nm(g.to)}(${g.stops})`)
        .join(' | '),
  );
};
it('probe', () => {
  show('Camden Town', 'Warren Street');
  show("King's Cross St Pancras", 'Mornington Crescent');
  show('Heathrow Terminals 2 & 3', 'Heathrow Terminal 4');
  show('Heathrow Terminal 5', 'Heathrow Terminal 4');
  show('Reading', 'Upminster');
  show('Reading', 'Upminster', [], 'transfers');
  show('Amersham', 'New Addington', [], 'transfers');
  show('Chesham', 'Beckenham Junction');
  show('Epping', 'Heathrow Terminal 4', [], 'transfers');
  show('Wimbledon', 'Elmers End', ['Dundonald Road']);
  show('Wimbledon', 'Avenue Road', ['Beckenham Road']);
  show('Highbury & Islington', 'Clapham Junction');
  show('Highbury & Islington', 'Clapham Junction', [], 'transfers');
  show('Royal Docks', 'Greenwich Peninsula');
  show('Hammersmith (Circle / Hammersmith & City)', 'Bayswater');
  show('Edgware Road (Circle / District / Hammersmith & City)', 'Paddington');
  show('Aldgate', 'Aldgate East');
  show('Kensington (Olympia)', 'Upminster');
  show('Watford', 'Amersham');
  show('Mill Hill East', 'High Barnet');
  show('Stratford', 'Beckton');
  show('Woolwich Arsenal', 'Beckton');
  show('Lewisham', 'West India Quay');
  show('Canary Wharf (DLR)', 'Westferry');
  show('Westferry', 'West India Quay');
  show('Uxbridge', 'Heathrow Terminal 5');
  show('Ealing Broadway', 'Richmond');
  show('Shenfield', 'Reading');
  show('Shenfield', 'Abbey Wood');
  show('Chingford', 'Cheshunt');
  show('Hainault', 'Epping');
  show('Wandle Park', 'Wimbledon');
  show('Elmers End', 'Beckenham Junction');
  show('New Addington', 'New Addington' );
  const extra = city.stations.filter(
    (s) => isTransferStation(net, s.id) && net.stationLines.get(s.id)!.length === 1,
  );
  console.log('single-line "transfer" stations:', extra.length, extra.map((s) => s.names[0].value).join(', '));
  console.log('multi-line stations:', city.stations.filter((s) => net.stationLines.get(s.id)!.length > 1).length);
  // dead vias
  const dead: string[] = [];
  for (const s of city.stations) {
    if (!isTransferStation(net, s.id)) continue;
    const line = net.stationLines.get(s.id)!;
    let ok = false;
    outer: for (const l of line)
      for (const a of l.stationIds)
        for (const l2 of line)
          for (const b of l2.stationIds) {
            if (a === s.id || b === s.id || a === b) continue;
            if (findRoute(net, a, b, [s.id])) { ok = true; break outer; }
          }
    if (!ok) dead.push(s.names[0].value);
  }
  console.log('transfer stations that can never be a via (same-line endpoints):', dead.join(', '));
}, 600000);
