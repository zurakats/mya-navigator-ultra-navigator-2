const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const GTFS_DIR = path.join(__dirname, '../../temp_gtfs');

async function parseCSV(fileName) {
  const results = [];
  const filePath = path.join(GTFS_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    console.warn(`File ${fileName} not found. Skipping.`);
    return [];
  }

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

async function chunkAndInsert(data, insertFunction, chunkSize = 5000) {
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    await insertFunction(chunk);
    console.log(`Inserted ${Math.min(i + chunkSize, data.length)} / ${data.length}`);
  }
}

async function main() {
  console.log('Starting GTFS Import...');

  try {
    console.log('Clearing old data...');
    await prisma.fareRule.deleteMany({});
    await prisma.fareAttribute.deleteMany({});
    await prisma.stopTime.deleteMany({});
    await prisma.trip.deleteMany({});
    await prisma.route.deleteMany({});
    await prisma.stop.deleteMany({});
    await prisma.shape.deleteMany({});

    console.log('Importing Fare Attributes...');
    const fareAttributes = await parseCSV('fare_attributes.txt');
    const fareAttrData = fareAttributes.map((f) => ({
      fare_id: f.fare_id,
      price: parseFloat(f.price),
      currency_type: f.currency_type,
      payment_method: parseInt(f.payment_method),
      transfers: f.transfers ? parseInt(f.transfers) : null,
      agency_id: f.agency_id || null,
      transfer_duration: f.transfer_duration ? parseInt(f.transfer_duration) : null,
    }));
    await chunkAndInsert(fareAttrData, (chunk) => prisma.fareAttribute.createMany({ data: chunk, skipDuplicates: true }));

    console.log('Importing Routes...');
    const routes = await parseCSV('routes.txt');
    const routeData = routes.map((r) => ({
      id: r.route_id,
      route_short_name: r.route_short_name || null,
      route_long_name: r.route_long_name || null,
      route_desc: r.route_desc || null,
      route_type: parseInt(r.route_type) || null,
      route_color: r.route_color || null,
      route_text_color: r.route_text_color || null,
    }));
    await chunkAndInsert(routeData, (chunk) => prisma.route.createMany({ data: chunk, skipDuplicates: true }));

    console.log('Importing Fare Rules...');
    const fareRules = await parseCSV('fare_rules.txt');
    const fareRuleData = fareRules.map((f) => ({
      fare_id: f.fare_id,
      route_id: f.route_id,
    }));
    await chunkAndInsert(fareRuleData, (chunk) => prisma.fareRule.createMany({ data: chunk, skipDuplicates: true }));

    console.log('Importing Stops...');
    const stops = await parseCSV('stops.txt');
    const stopData = stops.map((s) => ({
      id: s.stop_id,
      stop_name: s.stop_name,
      stop_lat: parseFloat(s.stop_lat),
      stop_lon: parseFloat(s.stop_lon),
      location_type: (parseInt(s.location_type) === 1 || s.parent_station) ? 1 : 0,
    }));
    await chunkAndInsert(stopData, (chunk) => prisma.stop.createMany({ data: chunk, skipDuplicates: true }));

    console.log('Importing Trips...');
    const trips = await parseCSV('trips.txt');
    const tripData = trips.map((t) => ({
      id: t.trip_id,
      route_id: t.route_id,
      service_id: t.service_id || null,
      trip_headsign: t.trip_headsign || null,
      direction_id: parseInt(t.direction_id) || null,
      shape_id: t.shape_id || null,
    }));
    await chunkAndInsert(tripData, (chunk) => prisma.trip.createMany({ data: chunk, skipDuplicates: true }));

    console.log('Importing Stop Times...');
    const stopTimes = await parseCSV('stop_times.txt');
    const stopTimeData = stopTimes.map((st) => ({
      trip_id: st.trip_id,
      arrival_time: st.arrival_time || null,
      departure_time: st.departure_time || null,
      stop_id: st.stop_id,
      stop_sequence: parseInt(st.stop_sequence),
    }));
    await chunkAndInsert(stopTimeData, (chunk) => prisma.stopTime.createMany({ data: chunk, skipDuplicates: true }), 10000);

    console.log('Importing Shapes...');
    const shapes = await parseCSV('shapes.txt');
    const shapeData = shapes.map((s) => ({
      shape_id: s.shape_id,
      shape_pt_lat: parseFloat(s.shape_pt_lat),
      shape_pt_lon: parseFloat(s.shape_pt_lon),
      shape_pt_sequence: parseInt(s.shape_pt_sequence),
    }));
    await chunkAndInsert(shapeData, (chunk) => prisma.shape.createMany({ data: chunk, skipDuplicates: true }), 10000);

    console.log('Importing Frequencies...');
    const frequencies = await parseCSV('frequencies.txt');
    if (frequencies.length > 0) {
      const frequencyData = frequencies.map((f) => ({
        trip_id: f.trip_id,
        start_time: f.start_time,
        end_time: f.end_time,
        headway_secs: parseInt(f.headway_secs),
        exact_times: f.exact_times ? parseInt(f.exact_times) : null,
      }));
      await chunkAndInsert(frequencyData, (chunk) => prisma.frequency.createMany({ data: chunk, skipDuplicates: true }), 10000);
    }

    console.log('GTFS Import Completed Successfully!');
  } catch (error) {
    console.error('Error importing GTFS data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
