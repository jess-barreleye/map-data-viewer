#!/usr/bin/env node
const { InfluxDB } = require('@influxdata/influxdb-client');

const INFLUXDB_URL = 'http://10.23.9.24:8086';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || 'YOUR_INFLUXDB_TOKEN';
const INFLUXDB_ORG = '834cb38b7a729cea';
const INFLUXDB_BUCKET = 'openrvdas';

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

// List all measurements in the bucket
const query = `
import "influxdata/influxdb/schema"

schema.measurements(bucket: "${INFLUXDB_BUCKET}")
`;

console.log('Querying InfluxDB for available measurements...\n');

queryApi.queryRows(query, {
    next(row, tableMeta) {
        const o = tableMeta.toObject(row);
        console.log(`Measurement: ${o._value}`);
    },
    error(error) {
        console.error('Query error:', error);
        process.exit(1);
    },
    complete() {
        console.log('\n✓ Query complete');
        process.exit(0);
    },
});
