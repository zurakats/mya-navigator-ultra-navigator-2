import { PrismaClient } from '@prisma/client';
import { RaptorData, Stop, RoutePattern, Trip, StopTime, Transfer } from './types';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function timeStrToSeconds(timeStr: string | null): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 3) return 0;
  return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
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

export class DataLoader {
  private prisma: PrismaClient;
  private maxFootpathDistanceMeter: number;
  private walkingSpeedMeterPerSecond: number;

  constructor(prisma: PrismaClient, maxFootpathDistanceMeter = 500) {
    this.prisma = prisma;
    this.maxFootpathDistanceMeter = maxFootpathDistanceMeter;
    this.walkingSpeedMeterPerSecond = 1.2;
  }

  async loadData(): Promise<RaptorData> {
    console.log('Loading RAPTOR data from database...');
    const startTime = Date.now();

    const dbStops = await this.prisma.stop.findMany();
    const dbTrips = await this.prisma.trip.findMany({
      include: { frequencies: true, route: true }
    });
    const dbStopTimes = await this.prisma.stopTime.findMany({
      orderBy: [
        { trip_id: 'asc' },
        { stop_sequence: 'asc' },
      ],
    });
    const dbFareAttributes = await this.prisma.fareAttribute.findMany();
    const dbFareRules = await this.prisma.fareRule.findMany();

    console.log(`Fetched ${dbStops.length} stops, ${dbTrips.length} trips, ${dbStopTimes.length} stop times, ${dbFareAttributes.length} fare attributes, ${dbFareRules.length} fare rules in ${Date.now() - startTime}ms.`);

    const fares = new Map<string, any>();
    for (const f of dbFareAttributes) {
      fares.set(f.fare_id, {
        fareId: f.fare_id,
        price: f.price,
        currencyType: f.currency_type,
        paymentMethod: f.payment_method,
        transfers: f.transfers,
        agencyId: f.agency_id,
        transferDuration: f.transfer_duration,
      });
    }

    const routeFares = new Map<string, string>();
    for (const r of dbFareRules) {
      routeFares.set(r.route_id, r.fare_id);
    }

    const stops = new Map<string, Stop>();
    for (const s of dbStops) {
      stops.set(s.id, {
        id: s.id,
        name: s.stop_name,
        lat: s.stop_lat,
        lon: s.stop_lon,
        routes: new Set<string>(),
      });
    }

    const stopTimesByTrip = new Map<string, typeof dbStopTimes>();
    for (const st of dbStopTimes) {
      if (!stopTimesByTrip.has(st.trip_id)) {
        stopTimesByTrip.set(st.trip_id, []);
      }
      stopTimesByTrip.get(st.trip_id)!.push(st);
    }

    const routes = new Map<string, RoutePattern>();
    const routeSignatureToPatternId = new Map<string, string>();
    let patternIdCounter = 0;

    for (const trip of dbTrips) {
      const tripStopTimes = stopTimesByTrip.get(trip.id);
      if (!tripStopTimes || tripStopTimes.length === 0) continue;

      const stopIds = tripStopTimes.map(st => st.stop_id);
      const signature = stopIds.join('|');

      let patternId = routeSignatureToPatternId.get(signature);
      let pattern: RoutePattern;

      if (!patternId) {
        patternId = `pattern_${patternIdCounter++}`;
        routeSignatureToPatternId.set(signature, patternId);
        pattern = {
          id: patternId,
          stops: stopIds,
          trips: [],
        };
        routes.set(patternId, pattern);

        for (const stopId of stopIds) {
          const stop = stops.get(stopId);
          if (stop) {
            stop.routes.add(patternId);
          }
        }
      } else {
        pattern = routes.get(patternId)!;
      }

      let routeGroup = 0;
      const desc = trip.route?.route_desc?.toLowerCase() || '';
      if (desc.includes('brt') || desc.includes('angkutan umum integrasi') || desc.includes('rusun')) {
        routeGroup = 1;
      } else if (desc.includes('royaltrans')) {
        routeGroup = 2;
      } else if (desc.includes('mikrotrans')) {
        routeGroup = 3;
      } else {
        routeGroup = 1;
      }

      const parsedTrip: Trip = {
        id: trip.id,
        routeId: patternId,
        realRouteId: trip.route_id,
        routeGroup,
        stopTimes: tripStopTimes.map(st => ({
          arrivalTime: timeStrToSeconds(st.arrival_time),
          departureTime: timeStrToSeconds(st.departure_time),
          stopId: st.stop_id,
        })),
        headwaySecs: (trip.frequencies && trip.frequencies.length > 0) ? trip.frequencies[0].headway_secs : undefined,
      };

      pattern.trips.push(parsedTrip);
    }

    for (const pattern of routes.values()) {
      pattern.trips.sort((a, b) => {
        return a.stopTimes[0].departureTime - b.stopTimes[0].departureTime;
      });
    }

    console.log(`Generated ${routes.size} unique route patterns.`);

    console.log(`Calculating footpaths (pre-filter ${this.maxFootpathDistanceMeter}m)...`);
    const transfers = new Map<string, Transfer[]>();

    let usePrecomputed = false;
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), 'data', 'osrm_transfers.json');
      if (fs.existsSync(filePath)) {
        console.log("Found precomputed OSRM transfers file! Loading it...");
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const precomputed = JSON.parse(rawData);
        for (const stopId of Object.keys(precomputed)) {
          const filtered = precomputed[stopId].filter((t: Transfer) => t.distanceMeter <= this.maxFootpathDistanceMeter);
          transfers.set(stopId, filtered);
        }
        usePrecomputed = true;
        console.log("Successfully loaded precomputed transfers.");
      }
    } catch (error) {
      console.warn("Could not load precomputed transfers, falling back to Haversine.");
    }

    if (!usePrecomputed) {
      console.log("Using Haversine distance for transfers (Fast Fallback)...");
      for (const stopA of stops.values()) {
        const stopATransfers: Transfer[] = [];
        for (const stopB of stops.values()) {
          if (stopA.id === stopB.id) continue;
          const dist = getDistance(stopA.lat, stopA.lon, stopB.lat, stopB.lon);
          if (dist <= this.maxFootpathDistanceMeter) {
            stopATransfers.push({
              targetStopId: stopB.id,
              distanceMeter: dist,
              durationSeconds: Math.ceil(dist / this.walkingSpeedMeterPerSecond),
            });
          }
        }
        transfers.set(stopA.id, stopATransfers);
      }
    }

    console.log(`Data loading complete. Total time: ${Date.now() - startTime}ms.`);

    return {
      stops,
      routes,
      transfers,
      fares,
      routeFares,
    };
  }
}
