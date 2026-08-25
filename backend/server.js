const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { prisma } = require('./lib/prisma.js');
const { signToken, verifyToken } = require('./lib/auth.js');
const { getRaptorData } = require('./lib/routing/raptor-instance.js');
const { Raptor } = require('./lib/routing/raptor.js');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

async function getSession(req) {
  const token = req.cookies.auth_token || req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  return await verifyToken(token);
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid credentials' });
    const token = await signToken({ userId: user.id, username: user.username });
    res.cookie('auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 * 1000 });
    res.json({ success: true, user: { id: user.id, username: user.username, name: user.name } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ authenticated: false });
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, username: true, name: true } });
    if (!user) return res.status(401).json({ authenticated: false });
    res.json({ authenticated: true, user });
  } catch (error) {
    res.status(500).json({ authenticated: false });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, name, password } = req.body;
    if (!username || !name || !password) return res.status(400).json({ error: 'All fields are required' });
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) return res.status(400).json({ error: 'Username already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { username, name, password: hashedPassword } });
    res.status(201).json({ success: true, user: { id: user.id, username: user.username, name: user.name } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.get('/api/bookmarks', async (req, res) => {
  try {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const bookmarks = await prisma.bookmark.findMany({ where: { userId: session.userId }, orderBy: { createdAt: 'desc' } });
    res.json({ bookmarks });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/bookmarks', async (req, res) => {
  try {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const { description, startLat, startLon, startName, destLat, destLon, destName, time, vehicle } = req.body;
    if (!description || !startLat || !startLon || !destLat || !destLon) return res.status(400).json({ error: 'Missing required fields' });
    const bookmark = await prisma.bookmark.create({ data: { userId: session.userId, description, startLat, startLon, startName, destLat, destLon, destName, time, vehicle } });
    res.status(201).json({ success: true, bookmark });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/bookmarks/:id', async (req, res) => {
  try {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const bookmark = await prisma.bookmark.findUnique({ where: { id } });
    if (!bookmark) return res.status(404).json({ error: 'Not found' });
    if (bookmark.userId !== session.userId) return res.status(403).json({ error: 'Forbidden' });
    await prisma.bookmark.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/bookmarks/:id', async (req, res) => {
  try {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { description } = req.body;
    
    if (!description) return res.status(400).json({ error: 'Description is required' });

    const bookmark = await prisma.bookmark.findUnique({ where: { id } });
    if (!bookmark) return res.status(404).json({ error: 'Not found' });
    if (bookmark.userId !== session.userId) return res.status(403).json({ error: 'Forbidden' });
    
    const updatedBookmark = await prisma.bookmark.update({
      where: { id },
      data: { description }
    });
    
    res.json({ success: true, bookmark: updatedBookmark });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'TestingProject2/1.0 (Skripsi Routing App)';

app.get('/api/geocode', async (req, res) => {
  const q = req.query.q;
  const lat = req.query.lat;
  const lon = req.query.lon;
  try {
    if (lat && lon) {
      const url = `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!response.ok) throw new Error('Nominatim API error');
      const data = await response.json();
      res.json(data);
    } else if (q) {
      const url = `${NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(q)}&format=json&countrycodes=id&limit=5`;
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!response.ok) throw new Error('Nominatim API error');
      const data = await response.json();
      res.json(data);
    } else {
      res.status(400).json({ error: 'Missing query parameters' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch geocoding data' });
  }
});
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

app.get('/api/navigate', async (req, res) => {
  const startLat = parseFloat(req.query.startLat || '0');
  const startLon = parseFloat(req.query.startLon || '0');
  const destLat = parseFloat(req.query.destLat || '0');
  const destLon = parseFloat(req.query.destLon || '0');
  let reqTime = req.query.time || '00:00:00';
  if (reqTime.length === 5) reqTime += ':00';
  const groupsParam = req.query.groups;
  const allowedGroups = groupsParam ? groupsParam.split(',').map(Number) : [1, 2, 3];
  const transitType = req.query.transitType || 'all';
  const maxWalkDist = parseInt(req.query.maxWalkDist || '-1');

  if (!startLat || !startLon || !destLat || !destLon) return res.status(400).json({ error: 'Missing coordinates' });

  try {
    const perfStart = performance.now();
    const timeParts = reqTime.split(':');
    let reqTimeSeconds = 0;
    if (timeParts.length === 3) reqTimeSeconds = parseInt(timeParts[0], 10) * 3600 + parseInt(timeParts[1], 10) * 60 + parseInt(timeParts[2], 10);

    const raptorData = await getRaptorData();
    const raptor = new Raptor(raptorData);

    const itineraries = [];
    const seenSignatures = new Set();

    const addItinerary = async (result) => {
      if (result.error || !result.journeys) return;
      for (const journeyData of result.journeys) {
        const transits = journeyData.journey.filter(leg => leg.type === 'transit');
        if (transits.length === 0) continue;
        const signature = transits.map(t => t.routeId).join('|');
        if (seenSignatures.has(signature)) continue;
        seenSignatures.add(signature);

        const parsedLegs = [];
        for (const leg of journeyData.journey) {
          if (leg.type === 'transit') {
            const route = await prisma.route.findFirst({ where: { trips: { some: { id: leg.tripId } } } });
            const startData = raptorData.stops.get(leg.fromStopId);
            const endData = raptorData.stops.get(leg.toStopId);
            const intermediateStops = [];
            const pattern = raptorData.routes.get(leg.routeId);
            if (pattern) {
              const boardIndex = pattern.stops.indexOf(leg.fromStopId);
              const alightIndex = pattern.stops.indexOf(leg.toStopId);
              if (boardIndex !== -1 && alightIndex !== -1 && boardIndex <= alightIndex) {
                const tripObj = pattern.trips.find(t => t.id === leg.tripId);
                if (tripObj) {
                  for (let i = boardIndex; i <= alightIndex; i++) {
                    const stopId = pattern.stops[i];
                    const stopData = raptorData.stops.get(stopId);
                    if (stopData && tripObj.stopTimes[i] && tripObj.stopTimes[boardIndex]) {
                      const relativeDuration = tripObj.stopTimes[i].arrivalTime - tripObj.stopTimes[boardIndex].departureTime;
                      const estimatedTime = leg.boardTime + relativeDuration;
                      intermediateStops.push({ id: stopData.id, stop_name: stopData.name, stop_lat: stopData.lat, stop_lon: stopData.lon, time: formatTime(estimatedTime) });
                    }
                  }
                }
              }
            }
            parsedLegs.push({ type: 'transit', route, startStop: startData ? { id: leg.fromStopId, stop_name: leg.fromStop, stop_lat: startData.lat, stop_lon: startData.lon } : null, endStop: endData ? { id: leg.toStopId, stop_name: leg.toStop, stop_lat: endData.lat, stop_lon: endData.lon } : null, startTime: formatTime(leg.boardTime), endTime: formatTime(leg.alightTime), intermediateStops });
          } else if (leg.type === 'footpath') {
            const startData = raptorData.stops.get(leg.fromStopId);
            const endData = raptorData.stops.get(leg.toStopId);
            parsedLegs.push({ type: 'walk', startStop: startData ? { id: leg.fromStopId, stop_name: leg.fromStop, stop_lat: startData.lat, stop_lon: startData.lon } : null, endStop: endData ? { id: leg.toStopId, stop_name: leg.toStop, stop_lat: endData.lat, stop_lon: endData.lon } : null, duration: leg.duration });
          }
        }
        const firstTransit = parsedLegs.find(l => l.type === 'transit');
        const lastTransit = parsedLegs.slice().reverse().find(l => l.type === 'transit');
        const mappedItinerary = { type: transits.length === 1 ? 'direct' : 'transfer', startTime: firstTransit?.startTime, endTime: lastTransit?.endTime, score: journeyData.arrivalTime - reqTimeSeconds, totalFare: journeyData.totalFare || 0, journey: journeyData.journey, legs: parsedLegs, transitsCount: transits.length };
        itineraries.push(mappedItinerary);
      }
    };

    const maxTransfers = transitType === 'direct' ? 0 : 3;
    const resPromise = await raptor.findRoute(startLat, startLon, destLat, destLon, reqTimeSeconds, maxTransfers, allowedGroups, maxWalkDist);
    if (resPromise) await addItinerary(resPromise);

    if (itineraries.length === 0) return res.json({ message: 'No route found', type: 'none' });

    itineraries.sort((a, b) => {
      const penaltyA = a.transitsCount * 15 * 60;
      const penaltyB = b.transitsCount * 15 * 60;
      const weightedScoreA = a.score + penaltyA;
      const weightedScoreB = b.score + penaltyB;
      if (Math.abs(weightedScoreA - weightedScoreB) <= 5 * 60) {
        if (a.transitsCount !== b.transitsCount) return a.transitsCount - b.transitsCount;
      }
      return weightedScoreA - weightedScoreB;
    });

    res.json({ itineraries: itineraries.slice(0, 6) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate route' });
  }
});
app.get('/api/navigate/raptor', async (req, res) => {
  const startLat = parseFloat(req.query.startLat || '0');
  const startLon = parseFloat(req.query.startLon || '0');
  const destLat = parseFloat(req.query.destLat || '0');
  const destLon = parseFloat(req.query.destLon || '0');
  let reqTime = req.query.time || '00:00:00';
  if (reqTime.length === 5) reqTime += ':00';
  if (!startLat || !startLon || !destLat || !destLon) return res.status(400).json({ error: 'Missing coordinates' });

  try {
    const timeParts = reqTime.split(':');
    let reqTimeSeconds = 0;
    if (timeParts.length === 3) reqTimeSeconds = parseInt(timeParts[0], 10) * 3600 + parseInt(timeParts[1], 10) * 60 + parseInt(timeParts[2], 10);
    const raptorData = await getRaptorData();
    const raptor = new Raptor(raptorData);
    const result = await raptor.findRoute(startLat, startLon, destLat, destLon, reqTimeSeconds, 3);
    if (!result) return res.json({ message: 'No route found', type: 'none' });
    if (result.error) return res.json({ message: result.error, type: 'none' });
    res.json({ itineraries: result.journeys?.map(j => ({ type: 'raptor', score: j.arrivalTime - reqTimeSeconds, arrivalTime: j.arrivalTime, journey: j.journey })) || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate route' });
  }
});

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

app.get('/api/route/:id/shape', async (req, res) => {
  const routeId = req.params.id;
  const startLatStr = req.query.startLat;
  const startLonStr = req.query.startLon;
  const endLatStr = req.query.endLat;
  const endLonStr = req.query.endLon;
  const dirIndexStr = req.query.dirIndex;

  const startLat = startLatStr ? parseFloat(startLatStr) : null;
  const startLon = startLonStr ? parseFloat(startLonStr) : null;
  const endLat = endLatStr ? parseFloat(endLatStr) : null;
  const endLon = endLonStr ? parseFloat(endLonStr) : null;
  const dirIndex = dirIndexStr ? parseInt(dirIndexStr) : 0;

  try {
    const route = await prisma.route.findUnique({ where: { id: routeId }, select: { route_color: true, route_short_name: true, route_long_name: true, route_desc: true } });
    if (!route) return res.status(404).json({ error: 'Route not found' });

    let trip = null;
    let finalSIdx = -1, finalEIdx = -1;
    let finalStopTimes = [];

    if (startLat !== null && startLon !== null && endLat !== null && endLon !== null) {
      const trips = await prisma.trip.findMany({ where: { route_id: routeId }, select: { id: true, shape_id: true } });
      let bestDist = Infinity;
      for (const t of trips) {
        const stopTimes = await prisma.stopTime.findMany({ where: { trip_id: t.id }, orderBy: { stop_sequence: 'asc' }, include: { stop: true } });
        if (stopTimes.length === 0) continue;
        let localSIdx = -1, localEIdx = -1, bestPairDist = Infinity;
        for (let i = 0; i < stopTimes.length; i++) {
          const d1 = getDistance(startLat, startLon, stopTimes[i].stop.stop_lat, stopTimes[i].stop.stop_lon);
          if (d1 > 2000) continue;
          for (let j = i; j < stopTimes.length; j++) {
            const d2 = getDistance(endLat, endLon, stopTimes[j].stop.stop_lat, stopTimes[j].stop.stop_lon);
            if (d1 + d2 < bestPairDist) { bestPairDist = d1 + d2; localSIdx = i; localEIdx = j; }
          }
        }
        if (localSIdx !== -1 && localEIdx !== -1 && localSIdx <= localEIdx && bestPairDist < bestDist) {
          bestDist = bestPairDist; trip = t; finalSIdx = localSIdx; finalEIdx = localEIdx; finalStopTimes = stopTimes;
        }
      }
    }

    if (!trip) {
      const allTrips = await prisma.trip.findMany({ where: { route_id: routeId }, select: { id: true, shape_id: true, trip_headsign: true } });
      const distinctTrips = [];
      const seen = new Set();
      for (const t of allTrips) {
        const key = t.shape_id || t.trip_headsign || t.id;
        if (!seen.has(key)) { seen.add(key); distinctTrips.push(t); }
      }
      if (distinctTrips.length > 0) {
        trip = distinctTrips[dirIndex % distinctTrips.length];
        finalStopTimes = await prisma.stopTime.findMany({ where: { trip_id: trip.id }, orderBy: { stop_sequence: 'asc' }, include: { stop: true } });
        if (startLat !== null && startLon !== null && endLat !== null && endLon !== null && finalStopTimes.length > 0) {
          let localSIdx = 0, localEIdx = finalStopTimes.length - 1;
          let minS = Infinity; finalStopTimes.forEach((st, i) => { let d = getDistance(startLat, startLon, st.stop.stop_lat, st.stop.stop_lon); if (d < minS) { minS = d; localSIdx = i; } });
          let minE = Infinity; finalStopTimes.forEach((st, i) => { let d = getDistance(endLat, endLon, st.stop.stop_lat, st.stop.stop_lon); if (d < minE) { minE = d; localEIdx = i; } });
          if (localSIdx <= localEIdx) { finalSIdx = localSIdx; finalEIdx = localEIdx; } else {
            finalStopTimes.reverse();
            const tempSIdx = finalStopTimes.length - 1 - localSIdx;
            const tempEIdx = finalStopTimes.length - 1 - localEIdx;
            finalSIdx = Math.min(tempSIdx, tempEIdx);
            finalEIdx = Math.max(tempSIdx, tempEIdx);
          }
        }
      }
    }

    if (!trip || !trip.shape_id) return res.status(404).json({ error: 'No shape found for this route' });
    if (finalSIdx !== -1 && finalEIdx !== -1 && finalSIdx <= finalEIdx) finalStopTimes = finalStopTimes.slice(finalSIdx, finalEIdx + 1);

    let shapePoints = await prisma.shape.findMany({ where: { shape_id: trip.shape_id }, orderBy: { shape_pt_sequence: 'asc' } });
    if (finalStopTimes.length > 0 && finalSIdx !== -1 && finalEIdx !== -1) {
      const firstStop = finalStopTimes[0].stop;
      const lastStop = finalStopTimes[finalStopTimes.length - 1].stop;
      let bestStartIdx = 0, bestEndIdx = shapePoints.length - 1, bestPairDist = Infinity;
      const candidateStarts = [], candidateEnds = [];
      shapePoints.forEach((pt, i) => {
        const d1 = getDistance(firstStop.stop_lat, firstStop.stop_lon, pt.shape_pt_lat, pt.shape_pt_lon);
        if (d1 < 1000) candidateStarts.push({ i, d: d1 });
        const d2 = getDistance(lastStop.stop_lat, lastStop.stop_lon, pt.shape_pt_lat, pt.shape_pt_lon);
        if (d2 < 1000) candidateEnds.push({ i, d: d2 });
      });
      for (const s of candidateStarts) {
        for (const e of candidateEnds) {
          if (s.i <= e.i && s.d + e.d < bestPairDist) { bestPairDist = s.d + e.d; bestStartIdx = s.i; bestEndIdx = e.i; }
        }
      }
      if (bestPairDist !== Infinity) shapePoints = shapePoints.slice(bestStartIdx, bestEndIdx + 1);
    }
    const stops = finalStopTimes.map(st => ({ id: st.stop.id, stop_name: st.stop.stop_name, stop_lat: st.stop.stop_lat, stop_lon: st.stop.stop_lon, location_type: st.stop.location_type }));
    res.json({ shapePoints, stops, routeInfo: route });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shape' });
  }
});
app.get('/api/routes', async (req, res) => {
  try {
    const routes = await prisma.route.findMany({ orderBy: { route_short_name: 'asc' }, include: { fare_rules: { include: { fare_attribute: true } } } });
    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

function calculateDistance(lat1, lon1, lat2, lon2) {
  const dx = lat1 - lat2;
  const dy = lon1 - lon2;
  return Math.sqrt(dx * dx + dy * dy);
}

function simplifyPoints(points, tolerance = 0.0002) {
  if (points.length <= 2) return points;
  const simplified = [points[0]];
  let lastPoint = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    if (calculateDistance(lastPoint[0], lastPoint[1], pt[0], pt[1]) > tolerance) {
      simplified.push(pt);
      lastPoint = pt;
    }
  }
  simplified.push(points[points.length - 1]);
  return simplified;
}

app.get('/api/shapes/all', async (req, res) => {
  try {
    const trips = await prisma.trip.findMany({ where: { shape_id: { not: null } }, select: { shape_id: true, route: { select: { route_color: true } } }, distinct: ['shape_id'] });
    const shapeColors = {};
    for (const trip of trips) {
      if (trip.shape_id) shapeColors[trip.shape_id] = trip.route.route_color ? `#${trip.route.route_color}` : '#94a3b8';
    }
    const shapes = await prisma.shape.findMany({ orderBy: [{ shape_id: 'asc' }, { shape_pt_sequence: 'asc' }], select: { shape_id: true, shape_pt_lat: true, shape_pt_lon: true } });
    const grouped = {};
    for (const pt of shapes) {
      if (!grouped[pt.shape_id]) grouped[pt.shape_id] = [];
      grouped[pt.shape_id].push([pt.shape_pt_lat, pt.shape_pt_lon]);
    }
    const polylines = Object.entries(grouped).map(([shapeId, points]) => ({ id: shapeId, color: shapeColors[shapeId] || '#94a3b8', points: simplifyPoints(points, 0.0002) }));
    res.json({ polylines });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch all shapes' });
  }
});

app.get('/api/stops', async (req, res) => {
  const limit = parseInt(req.query.limit || '500');
  try {
    const stops = await prisma.stop.findMany({ take: limit });
    res.json(stops);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stops' });
  }
});

app.get('/api/stops/search', async (req, res) => {
  const q = req.query.q || '';
  if (q.length < 2) return res.json([]);
  try {
    const stops = await prisma.stop.findMany({ where: { stop_name: { contains: q, mode: 'insensitive' } }, take: 10 });
    res.json(stops);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search stops' });
  }
});

  app.get('/api/test-db', async (req, res) => {
    try {
      const queryRes = await prisma.$queryRawUnsafe(`
        SELECT st1.trip_id, st1.arrival_time as start_time, st2.arrival_time as end_time, 
               st1.stop_id as start_stop, st2.stop_id as dest_stop, t.route_id
        FROM "StopTime" st1
        JOIN "StopTime" st2 ON st1.trip_id = st2.trip_id
        JOIN "Trip" t ON st1.trip_id = t.id
        WHERE st1.stop_id IN ('B02997P', 'G00168', 'H00184P', 'G00170')
          AND st2.stop_id IN ('B07454P', 'B07275P', 'B06944P', 'B03091P', 'G00514')
          AND st1.stop_sequence <= st2.stop_sequence
        ORDER BY 
          CASE WHEN st1.arrival_time >= '07:00' THEN 0 ELSE 1 END ASC,
          st1.arrival_time ASC,
          st2.arrival_time ASC
        LIMIT 10
      `);
      const serialize = (obj) => JSON.parse(JSON.stringify(obj, (key, value) => typeof value === 'bigint' ? value.toString() : value));
      res.json({ result: serialize(queryRes) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  getRaptorData().then(() => {
    console.log('RaptorData loaded successfully.');
  }).catch(err => {
    console.error('Failed to load RaptorData:', err);
  });
});