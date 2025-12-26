#!/usr/bin/env node
const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = 'http://10.23.9.24:8086';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || 'YOUR_INFLUXDB_TOKEN';
const INFLUXDB_ORG = '834cb38b7a729cea';
const INFLUXDB_BUCKET = 'openrvdas';

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

// Query latest USBL data - get all fields to see what's available
const query = `
from(bucket: "${INFLUXDB_BUCKET}")
    |> range(start: -7d)
    |> filter(fn: (r) => r["_measurement"] == "usbl")
    |> last()
`;

console.log('Querying latest USBL data...\n');

const result = {};

queryApi.queryRows(query, {
    next(row, tableMeta) {
        const o = tableMeta.toObject(row);
        console.log(`Field: ${o._field} = ${o._value} (time: ${o._time})`);
        result[o._field] = o._value;
    },
    error(error) {
        console.error('Query error:', error);
        process.exit(1);
    },
    complete() {
        console.log('\n✓ Query complete');
        console.log('\nLatest ROV position:');
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    },
});
