export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  routes: Set<string>;
}

export interface StopTime {
  arrivalTime: number;
  departureTime: number;
  stopId: string;
}

export interface Trip {
  id: string;
  routeId: string;
  realRouteId: string;
  routeGroup: number;
  stopTimes: StopTime[];
  headwaySecs?: number;
}

export interface RoutePattern {
  id: string;
  stops: string[];
  trips: Trip[];
}

export interface Transfer {
  targetStopId: string;
  distanceMeter: number;
  durationSeconds: number;
}

export interface FareAttribute {
  fareId: string;
  price: number;
  currencyType: string;
  paymentMethod: number;
  transfers: number | null;
  agencyId: string | null;
  transferDuration: number | null;
}

export interface RaptorData {
  stops: Map<string, Stop>;
  routes: Map<string, RoutePattern>;
  transfers: Map<string, Transfer[]>;
  fares: Map<string, FareAttribute>;
  routeFares: Map<string, string>;
}
