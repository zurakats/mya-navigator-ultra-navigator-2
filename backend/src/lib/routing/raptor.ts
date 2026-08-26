import { RaptorData, RoutePattern, Trip, Stop } from './types';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getOsrmFootDistance(lat1: number, lon1: number, lat2: number, lon2: number): Promise<{ distance: number; duration: number } | null> {
  const url = `http://router.project-osrm.org/route/v1/foot/${lon1},${lat1};${lon2},${lat2}?overview=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      return {
        distance: data.routes[0].distance,
        duration: data.routes[0].duration,
      };
    }
  } catch (error) {
    console.error("OSRM Error:", error);
  }
  return null;
}

async function getOsrmTable(source: { lat: number, lon: number }, destinations: { lat: number, lon: number }[]): Promise<{ distances: number[], durations: number[] } | null> {
  if (destinations.length === 0) return { distances: [], durations: [] };
  const coords = [source, ...destinations].map(c => `${c.lon},${c.lat}`).join(';');
  const url = `http://router.project-osrm.org/table/v1/foot/${coords}?sources=0&annotations=distance,duration`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code === 'Ok' && data.distances && data.durations) {
      return {
        distances: data.distances[0].slice(1),
        durations: data.durations[0].slice(1),
      };
    }
  } catch (error) {
    console.error("OSRM Error:", error);
  }
  return null;
}

interface Pointer {
  type: 'trip' | 'footpath' | 'initial';
  prevStopId?: string;
  tripId?: string;
  routeId?: string;
  boardTime?: number;
  alightTime?: number;
  tripPointer?: Pointer;
}

interface WalkStop {
  stop: Stop;
  dist: number;
  duration?: number;
}

export class Raptor {
  private data: RaptorData;

  constructor(data: RaptorData) {
    this.data = data;
  }

  async findRoute(
    startLat: number,
    startLon: number,
    destLat: number,
    destLon: number,
    departureTimeSeconds: number,
    maxTransfers: number = 3,
    allowedRouteGroups: number[] = [1, 2, 3],
    maxWalkDist: number = 500
  ): Promise<{ arrivalTime?: number, journeys?: any[], error?: string } | null> {
    const K = maxTransfers + 1;

    const tau: Map<string, number>[] = Array.from({ length: K + 1 }, () => new Map<string, number>());
    const tau_star = new Map<string, number>();

    const pointers = new Map<string, Pointer>();

    const getTau = (k: number, p: string) => tau[k].has(p) ? tau[k].get(p)! : Infinity;
    const getTauStar = (p: string) => tau_star.has(p) ? tau_star.get(p)! : Infinity;
    const setTau = (k: number, p: string, time: number) => tau[k].set(p, time);
    const setTauStar = (p: string, time: number) => tau_star.set(p, time);

    let markedStops = new Set<string>();

    const startRadius = maxWalkDist;
    const destRadius = maxWalkDist;
    const walkingSpeed = 1.2;

    let sourceStops: WalkStop[] = Array.from(this.data.stops.values())
      .map(s => ({ stop: s, dist: getDistance(startLat, startLon, s.lat, s.lon) }));
    if (startRadius === -1) {
      sourceStops.sort((a, b) => a.dist - b.dist);
      sourceStops = sourceStops.slice(0, 15);
    } else {
      sourceStops = sourceStops.filter(s => s.dist <= startRadius);
    }

    let destStops: WalkStop[] = Array.from(this.data.stops.values())
      .map(s => ({ stop: s, dist: getDistance(destLat, destLon, s.lat, s.lon) }));
    if (destRadius === -1) {
      destStops.sort((a, b) => a.dist - b.dist);
      destStops = destStops.slice(0, 15);
    } else {
      destStops = destStops.filter(s => s.dist <= destRadius);
    }

    console.log(`Pre-filtered source stops: ${sourceStops.length}, dest stops: ${destStops.length}. Verifying with OSRM Table API...`);
    const validSourceStops = [];
    if (sourceStops.length > 0) {
      const osrmSources = await getOsrmTable(
        { lat: startLat, lon: startLon },
        sourceStops.map(s => ({ lat: s.stop.lat, lon: s.stop.lon }))
      );
      if (osrmSources) {
        for (let i = 0; i < sourceStops.length; i++) {
          const dist = osrmSources.distances[i];
          const dur = osrmSources.durations[i];
          if (dist !== null && dist !== undefined && (startRadius === -1 || dist <= startRadius)) {
            validSourceStops.push({ stop: sourceStops[i].stop, dist, duration: dur });
          } else {
            validSourceStops.push({ stop: sourceStops[i].stop, dist: sourceStops[i].dist, duration: sourceStops[i].dist / 1.2 });
          }
        }
      } else {
        for (const s of sourceStops) {
          validSourceStops.push({ stop: s.stop, dist: s.dist, duration: s.dist / 1.2 });
        }
      }
    }
    sourceStops = validSourceStops as any;

    const validDestStops = [];
    if (destStops.length > 0) {
      const osrmDests = await getOsrmTable(
        { lat: destLat, lon: destLon },
        destStops.map(s => ({ lat: s.stop.lat, lon: s.stop.lon }))
      );
      if (osrmDests) {
        for (let i = 0; i < destStops.length; i++) {
          const dist = osrmDests.distances[i];
          const dur = osrmDests.durations[i];
          if (dist !== null && dist !== undefined && (destRadius === -1 || dist <= destRadius)) {
            validDestStops.push({ stop: destStops[i].stop, dist, duration: dur });
          } else {
            validDestStops.push({ stop: destStops[i].stop, dist: destStops[i].dist, duration: destStops[i].dist / 1.2 });
          }
        }
      } else {
        for (const s of destStops) {
          validDestStops.push({ stop: s.stop, dist: s.dist, duration: s.dist / 1.2 });
        }
      }
    }
    destStops = validDestStops as any;

    const destStopIds = new Set(destStops.map(s => s.stop.id));

    console.log(`Found ${sourceStops.length} source stops and ${destStops.length} dest stops within radius`);

    if (sourceStops.length === 0 || destStops.length === 0) {
      return { error: 'No stops found near source or destination' };
    }

    for (const { stop, dist, duration } of sourceStops) {
      const walkTime = duration ? Math.ceil(duration) : Math.ceil(dist / walkingSpeed);
      const arrival = departureTimeSeconds + walkTime;
      setTau(0, stop.id, arrival);
      setTauStar(stop.id, arrival);
      markedStops.add(stop.id);
      pointers.set(`0_${stop.id}`, { type: 'initial' });
    }

    for (let k = 1; k <= K; k++) {
      const Q = new Map<string, string>();
      for (const p of markedStops) {
        const stop = this.data.stops.get(p);
        if (stop) {
          for (const routeId of stop.routes) {
            const pattern = this.data.routes.get(routeId);
            if (pattern) {
              const stopIndex = pattern.stops.indexOf(p);
              if (!Q.has(routeId)) {
                Q.set(routeId, p);
              } else {
                const existingStopId = Q.get(routeId)!;
                const existingIndex = pattern.stops.indexOf(existingStopId);
                if (stopIndex < existingIndex) {
                  Q.set(routeId, p);
                }
              }
            }
          }
        }
      }

      markedStops.clear();

      console.log(`Round ${k}: scanning ${Q.size} routes from marked stops...`);
      let improvements = 0;

      for (const [routeId, p] of Q.entries()) {
        const pattern = this.data.routes.get(routeId)!;
        let t: Trip | null = null;
        let boardTime: number | null = null;
        let boardStopId: string | null = null;

        const startIndex = pattern.stops.indexOf(p);

        for (let i = startIndex; i < pattern.stops.length; i++) {
          const pi = pattern.stops[i];

          if (t !== null && t.stopTimes[i] && boardTime !== null && boardStopId !== null) {
            const boardIndex = pattern.stops.indexOf(boardStopId);
            const relativeDuration = t.stopTimes[i].arrivalTime - t.stopTimes[boardIndex].departureTime;
            const arrivalTime = boardTime + relativeDuration;

            let destWalkTime = 0;
            if (destStopIds.has(pi)) {
              const dest = destStops.find(d => d.stop.id === pi);
              if (dest) destWalkTime = Math.ceil(dest.dist / walkingSpeed);
            }

            if (arrivalTime < getTau(k, pi) && arrivalTime < getTauStar(pi)) {
              setTau(k, pi, arrivalTime);
              setTauStar(pi, arrivalTime);
              markedStops.add(pi);
              improvements++;
              pointers.set(`${k}_${pi}`, {
                type: 'trip',
                prevStopId: boardStopId,
                tripId: t.id,
                routeId: routeId,
                boardTime: boardTime,
                alightTime: arrivalTime
              });
            }
          }

          const prevTauKMinus1 = getTau(k - 1, pi);
          if (pattern.trips.length > 0 && pattern.trips[0].stopTimes[i]) {
            const tripGrp = pattern.trips[0].routeGroup;
            if (allowedRouteGroups.includes(tripGrp)) {
              const headwaySecs = pattern.trips[0].headwaySecs || 300;
              const Ti = pattern.trips[0].stopTimes[i].departureTime;
              const tUser = prevTauKMinus1;

              const calculatedBoardTime = Ti + Math.ceil((tUser - Ti) / headwaySecs) * headwaySecs;

              if (t === null || calculatedBoardTime < boardTime!) {
                t = pattern.trips[0];
                boardStopId = pi;
                boardTime = calculatedBoardTime;
              }
            }
          }
        }
      }

      console.log(`Round ${k}: made ${improvements} improvements, processing footpaths...`);

      const stopsToProcess = Array.from(markedStops);

      const tau_k_trips = new Map<string, number>();
      const trip_pointers = new Map<string, any>();
      for (const p of stopsToProcess) {
        tau_k_trips.set(p, getTau(k, p));
        trip_pointers.set(p, pointers.get(`${k}_${p}`));
      }

      for (const p of stopsToProcess) {
        const transfers = this.data.transfers.get(p) || [];
        const arrivalAtP = tau_k_trips.get(p)!;
        const tripPtrAtP = trip_pointers.get(p);

        for (const tr of transfers) {
          if (maxWalkDist !== -1 && tr.distanceMeter > maxWalkDist) continue;

          const perceivedWalkDuration = Math.ceil(tr.durationSeconds * 1.5) + 180;
          const arrivalAtPPrime = arrivalAtP + perceivedWalkDuration;
          if (arrivalAtPPrime < getTau(k, tr.targetStopId) && arrivalAtPPrime < getTauStar(tr.targetStopId)) {
            setTau(k, tr.targetStopId, arrivalAtPPrime);
            setTauStar(tr.targetStopId, arrivalAtPPrime);
            markedStops.add(tr.targetStopId);
            pointers.set(`${k}_${tr.targetStopId}`, {
              type: 'footpath',
              prevStopId: p,
              boardTime: arrivalAtP,
              alightTime: arrivalAtPPrime,
              tripPointer: tripPtrAtP
            });
          }
        }
      }

      if (markedStops.size === 0) break;
    }

    const reconstructJourneyForK = (destStopId: string, finalK: number, finalTime: number) => {
      const journey = [];
      let currStop = destStopId;
      let currK = finalK;

      const finalDestData = destStops.find(d => d.stop.id === destStopId)!;
      journey.push({
        type: 'walk_to_destination',
        fromStop: this.data.stops.get(destStopId)!.name,
        duration: finalDestData.duration ? Math.ceil(finalDestData.duration) : Math.ceil(finalDestData.dist / walkingSpeed),
        arrivalTime: finalTime
      });

      while (currK >= 0) {
        const ptr = pointers.get(`${currK}_${currStop}`);
        if (!ptr) {
          let found = false;
          for (let k = currK - 1; k >= 0; k--) {
            if (pointers.has(`${k}_${currStop}`)) {
              currK = k;
              found = true;
              break;
            }
          }
          if (!found) break;
          continue;
        }

        if (ptr.type === 'initial') {
          journey.push({
            type: 'walk_from_source',
            toStop: this.data.stops.get(currStop)!.name,
            arrivalTime: getTauStar(currStop)
          });
          break;
        } else if (ptr.type === 'footpath') {
          journey.push({
            type: 'footpath',
            fromStopId: ptr.prevStopId!,
            toStopId: currStop,
            fromStop: this.data.stops.get(ptr.prevStopId!)!.name,
            toStop: this.data.stops.get(currStop)!.name,
            duration: ptr.alightTime! - ptr.boardTime!
          });

          const tripPtr = ptr.tripPointer;
          if (tripPtr && tripPtr.type === 'trip') {
            const pattern = this.data.routes.get(tripPtr.routeId!);
            const trip = pattern?.trips.find(t => t.id === tripPtr.tripId);
            journey.push({
              type: 'transit',
              fromStopId: tripPtr.prevStopId!,
              toStopId: ptr.prevStopId!,
              fromStop: this.data.stops.get(tripPtr.prevStopId!)!.name,
              toStop: this.data.stops.get(ptr.prevStopId!)!.name,
              tripId: tripPtr.tripId,
              routeId: tripPtr.routeId,
              realRouteId: trip?.realRouteId,
              boardTime: tripPtr.boardTime,
              alightTime: tripPtr.alightTime
            });
            currStop = tripPtr.prevStopId!;
            currK--;
          } else {
            currStop = ptr.prevStopId!;
          }
        } else if (ptr.type === 'trip') {
          const pattern = this.data.routes.get(ptr.routeId!);
          const trip = pattern?.trips.find(t => t.id === ptr.tripId);
          journey.push({
            type: 'transit',
            fromStopId: ptr.prevStopId!,
            toStopId: currStop,
            fromStop: this.data.stops.get(ptr.prevStopId!)!.name,
            toStop: this.data.stops.get(currStop)!.name,
            tripId: ptr.tripId,
            routeId: ptr.routeId,
            realRouteId: trip?.realRouteId,
            boardTime: ptr.boardTime,
            alightTime: ptr.alightTime
          });
          currStop = ptr.prevStopId!;
          currK--;
        } else if (ptr.type === 'initial') {
          break;
        }
      }
      journey.reverse();
      return journey;
    };

    const journeys = [];
    let absoluteBest = Infinity;

    for (let k = 1; k <= K; k++) {
      let bestDestForK: string | null = null;
      let bestTimeForK = Infinity;

      for (const dest of destStops) {
        const arrivalAtDestStop = getTau(k, dest.stop.id);
        const walkTimeToDest = dest.duration ? Math.ceil(dest.duration) : Math.ceil(dest.dist / walkingSpeed);

        const perceivedWalkTimeToDest = walkTimeToDest > 0 ? Math.ceil(walkTimeToDest * 1.5) + 180 : 0;
        const totalTime = arrivalAtDestStop + perceivedWalkTimeToDest;

        if (totalTime < bestTimeForK) {
          bestTimeForK = totalTime;
          bestDestForK = dest.stop.id;
        }
      }

      if (bestDestForK && bestTimeForK < Infinity) {
        if (bestTimeForK < absoluteBest) {
          absoluteBest = bestTimeForK;
          const journeyForK = reconstructJourneyForK(bestDestForK, k, bestTimeForK);

          let totalFare = 0;
          let currentSessionStartTime: number | null = null;
          let currentSessionFareId: string | null = null;
          let currentSessionTransfers = 0;

          for (const leg of journeyForK) {
            if (leg.type === 'transit' && leg.realRouteId) {
              const fareId = this.data.routeFares?.get(leg.realRouteId);
              const fareAttr = (fareId && this.data.fares) ? this.data.fares.get(fareId) : null;

              leg.fareId = fareId;
              leg.farePrice = 0;

              if (fareAttr) {

                let isNewSession = false;
                if (currentSessionStartTime === null) {
                  isNewSession = true;
                } else if ((leg.boardTime! - currentSessionStartTime) > (fareAttr.transferDuration || Infinity)) {
                  isNewSession = true;
                } else if (fareAttr.transfers !== null && currentSessionTransfers >= fareAttr.transfers) {
                  isNewSession = true;
                } else if (currentSessionFareId !== fareId && fareAttr.price > 0 && this.data.fares.get(currentSessionFareId!)?.price === 0) {
                  isNewSession = true;
                } else if (currentSessionFareId !== fareId && fareAttr.price > 0 && this.data.fares.get(currentSessionFareId!)?.price! > 0) {
                  isNewSession = true;
                }

                if (isNewSession) {
                  leg.farePrice = fareAttr.price;
                  totalFare += fareAttr.price;
                  currentSessionStartTime = leg.boardTime!;
                  currentSessionFareId = fareId;
                  currentSessionTransfers = 0;
                } else {
                  currentSessionTransfers++;
                }
              }
            }
          }

          journeys.push({ arrivalTime: bestTimeForK, totalFare, journey: journeyForK });
        }
      }
    }

    if (journeys.length === 0) {
      return { error: 'No route found' };
    }

    return {
      arrivalTime: absoluteBest,
      journeys
    };
  }
}
