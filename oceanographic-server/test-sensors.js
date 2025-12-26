#!/usr/bin/env node

/**
 * Test script to verify oceanographic sensor measurements in InfluxDB
 * This helps identify which measurements exist and their field names
 */

const { InfluxDB } = require('@influxdata/influxdb-client');

// InfluxDB configuration
const url = 'http://10.23.9.24:8086';
const token = process.env.INFLUXDB_TOKEN || 'YOUR_INFLUXDB_TOKEN';
const org = '834cb38b7a729cea';
const bucket = 'openrvdas';

// Sensor measurements to test
const SENSORS = {
    temperature: 'tsg_temperature',
    salinity: 'tsg_salinity',
    fluorescence: 'fluorometer_chl',
    oxygen: 'ctd_oxygen',
    ph: 'ctd_ph',
    turbidity: 'ctd_turbidity',
    chlorophyll: 'fluorometer_chl_a'
};

const client = new InfluxDB({ url, token });
const queryApi = client.getQueryApi(org);

async function testMeasurement(name, measurement) {
    console.log(`\n--- Testing ${name} (${measurement}) ---`);
    
    const fluxQuery = `
        from(bucket: "${bucket}")
        |> range(start: -24h)
        |> filter(fn: (r) => r._measurement == "${measurement}")
        |> last()
    `;
    
    try {
        let found = false;
        const fields = new Set();
        
        for await (const { values, tableMeta } of queryApi.iterateRows(fluxQuery)) {
            const row = tableMeta.toObject(values);
            found = true;
            fields.add(row._field);
            
            console.log(`  Field: ${row._field}`);
            console.log(`  Value: ${row._value}`);
            console.log(`  Time: ${row._time}`);
        }
        
        if (!found) {
            console.log(`  ❌ No data found for measurement: ${measurement}`);
            console.log(`  (May not exist or no data in last 24 hours)`);
        } else {
            console.log(`  ✅ Found fields: ${Array.from(fields).join(', ')}`);
        }
        
        return found;
    } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
        return false;
    }
}

async function listAllMeasurements() {
    console.log('\n=== Listing all measurements in bucket ===');
    
    const fluxQuery = `
        import "influxdata/influxdb/schema"
        
        schema.measurements(bucket: "${bucket}")
    `;
    
    try {
        const measurements = [];
        
        for await (const { values, tableMeta } of queryApi.iterateRows(fluxQuery)) {
            const row = tableMeta.toObject(values);
            measurements.push(row._value);
        }
        
        console.log(`Found ${measurements.length} measurements:`);
        measurements.sort().forEach(m => console.log(`  - ${m}`));
        
        return measurements;
    } catch (err) {
        console.log(`Error listing measurements: ${err.message}`);
        return [];
    }
}

async function testSensorWithGPS(name, measurement) {
    console.log(`\n--- Testing ${name} with GPS join ---`);
    
    const fluxQuery = `
        from(bucket: "${bucket}")
        |> range(start: -5m)
        |> filter(fn: (r) => r._measurement == "${measurement}")
        |> last()
        |> limit(n: 1)
    `;
    
    try {
        let sensorData = null;
        
        for await (const { values, tableMeta } of queryApi.iterateRows(fluxQuery)) {
            const row = tableMeta.toObject(values);
            sensorData = { field: row._field, value: row._value, time: row._time };
        }
        
        if (sensorData) {
            console.log(`  Sensor: ${sensorData.field} = ${sensorData.value} at ${sensorData.time}`);
            
            // Now query GPS at same time
            const gpsQuery = `
                from(bucket: "${bucket}")
                |> range(start: -5m)
                |> filter(fn: (r) => r._measurement == "seapath380")
                |> filter(fn: (r) => r._field == "latitude" or r._field == "longitude")
                |> last()
            `;
            
            let lat = null, lon = null;
            
            for await (const { values, tableMeta } of queryApi.iterateRows(gpsQuery)) {
                const row = tableMeta.toObject(values);
                if (row._field === 'latitude') lat = row._value;
                if (row._field === 'longitude') lon = row._value;
            }
            
            if (lat && lon) {
                console.log(`  GPS: ${lat}, ${lon}`);
                console.log(`  ✅ Can correlate sensor data with GPS`);
            } else {
                console.log(`  ⚠️  No GPS data available`);
            }
        }
    } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
    }
}

async function main() {
    console.log('InfluxDB Oceanographic Sensor Test');
    console.log('==================================');
    console.log(`URL: ${url}`);
    console.log(`Org: ${org}`);
    console.log(`Bucket: ${bucket}`);
    
    // List all available measurements
    await listAllMeasurements();
    
    // Test each sensor measurement
    console.log('\n\n=== Testing configured sensor measurements ===');
    const results = {};
    
    for (const [name, measurement] of Object.entries(SENSORS)) {
        results[name] = await testMeasurement(name, measurement);
    }
    
    // Test GPS correlation for sensors with data
    console.log('\n\n=== Testing sensor + GPS correlation ===');
    for (const [name, measurement] of Object.entries(SENSORS)) {
        if (results[name]) {
            await testSensorWithGPS(name, measurement);
        }
    }
    
    // Summary
    console.log('\n\n=== SUMMARY ===');
    const available = Object.entries(results).filter(([_, found]) => found);
    const missing = Object.entries(results).filter(([_, found]) => !found);
    
    console.log(`Available sensors (${available.length}):`);
    available.forEach(([name]) => console.log(`  ✅ ${name}`));
    
    if (missing.length > 0) {
        console.log(`\nMissing sensors (${missing.length}):`);
        missing.forEach(([name, _]) => console.log(`  ❌ ${name}`));
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
