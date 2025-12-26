#!/usr/bin/env node

/**
 * Test underway sensor measurements in InfluxDB
 * These sensors continuously log while ship is operating
 */

const { InfluxDB } = require('@influxdata/influxdb-client');

const url = 'http://10.23.9.24:8086';
const token = process.env.INFLUXDB_TOKEN || 'YOUR_INFLUXDB_TOKEN';
const org = '834cb38b7a729cea';
const bucket = 'openrvdas';

const client = new InfluxDB({ url, token });
const queryApi = client.getQueryApi(org);

// Underway sensors only
const UNDERWAY_SENSORS = [
    'tsg_sbe45_1',
    'tsg_sbe45_2',
    'fluorometer_1',
    'fluorometer_2',
    'transmissometer_1',
    'transmissometer_2',
    'pH_sunburst_1',
    'pH_sunburst_2'
];

async function inspectMeasurement(measurement) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Measurement: ${measurement}`);
    console.log('='.repeat(60));
    
    const fluxQuery = `
        from(bucket: "${bucket}")
        |> range(start: -5m)
        |> filter(fn: (r) => r._measurement == "${measurement}")
        |> last()
    `;
    
    try {
        const fields = {};
        
        for await (const { values, tableMeta } of queryApi.iterateRows(fluxQuery)) {
            const row = tableMeta.toObject(values);
            
            if (!fields[row._field]) {
                fields[row._field] = {
                    value: row._value,
                    time: row._time
                };
            }
        }
        
        if (Object.keys(fields).length === 0) {
            console.log('  ❌ No recent data (last 5 minutes)');
            return null;
        }
        
        console.log(`  ✅ Found ${Object.keys(fields).length} fields:`);
        for (const [field, data] of Object.entries(fields)) {
            console.log(`    • ${field}: ${data.value}`);
        }
        console.log(`  Last updated: ${fields[Object.keys(fields)[0]].time}`);
        
        return fields;
    } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
        return null;
    }
}

async function main() {
    console.log('InfluxDB Underway Sensors Inspection');
    console.log('====================================');
    console.log(`URL: ${url}`);
    console.log(`Bucket: ${bucket}`);
    console.log();
    
    const results = {};
    
    for (const measurement of UNDERWAY_SENSORS) {
        const fields = await inspectMeasurement(measurement);
        if (fields) {
            results[measurement] = fields;
        }
    }
    
    console.log('\n\n' + '='.repeat(60));
    console.log('SUMMARY - Available Underway Sensors');
    console.log('='.repeat(60));
    
    const available = Object.keys(results);
    
    if (available.length === 0) {
        console.log('❌ No underway sensors found with recent data');
        console.log('\nThis likely means the ship is not currently underway');
        console.log('or sensors are not logging.');
    } else {
        console.log(`✅ Found ${available.length} sensors with recent data:\n`);
        
        for (const measurement of available) {
            const fields = Object.keys(results[measurement]);
            console.log(`${measurement}:`);
            console.log(`  Fields: ${fields.join(', ')}`);
        }
        
        console.log('\n\nRecommended SENSORS configuration for server.js:');
        console.log('```javascript');
        console.log('const SENSORS = {');
        
        // TSG sensors (temperature & salinity)
        if (results['tsg_sbe45_1'] || results['tsg_sbe45_2']) {
            const tsgMeasurement = results['tsg_sbe45_1'] ? 'tsg_sbe45_1' : 'tsg_sbe45_2';
            const fields = Object.keys(results[tsgMeasurement]);
            const tempField = fields.find(f => f.toLowerCase().includes('temp'));
            const salField = fields.find(f => f.toLowerCase().includes('sal'));
            
            if (tempField) {
                console.log(`    temperature: {`);
                console.log(`        name: 'Temperature',`);
                console.log(`        measurement: '${tsgMeasurement}',`);
                console.log(`        field: '${tempField}',`);
                console.log(`        unit: '°C',`);
                console.log(`        range: [0, 35],`);
                console.log(`        color: '#fde724',`);
                console.log(`        colorScheme: VIRIDIS_COLORS`);
                console.log(`    },`);
            }
            
            if (salField) {
                console.log(`    salinity: {`);
                console.log(`        name: 'Salinity',`);
                console.log(`        measurement: '${tsgMeasurement}',`);
                console.log(`        field: '${salField}',`);
                console.log(`        unit: 'PSU',`);
                console.log(`        range: [30, 40],`);
                console.log(`        color: '#5ec962',`);
                console.log(`        colorScheme: VIRIDIS_COLORS`);
                console.log(`    },`);
            }
        }
        
        // Fluorometer
        if (results['fluorometer_1'] || results['fluorometer_2']) {
            const fluorMeasurement = results['fluorometer_1'] ? 'fluorometer_1' : 'fluorometer_2';
            const fields = Object.keys(results[fluorMeasurement]);
            const fluorField = fields[0]; // Usually just one field
            
            console.log(`    fluorescence: {`);
            console.log(`        name: 'Fluorescence',`);
            console.log(`        measurement: '${fluorMeasurement}',`);
            console.log(`        field: '${fluorField}',`);
            console.log(`        unit: 'mg/m³',`);
            console.log(`        range: [0, 10],`);
            console.log(`        color: '#21918c',`);
            console.log(`        colorScheme: VIRIDIS_COLORS`);
            console.log(`    },`);
        }
        
        // pH
        if (results['pH_sunburst_1'] || results['pH_sunburst_2']) {
            const phMeasurement = results['pH_sunburst_1'] ? 'pH_sunburst_1' : 'pH_sunburst_2';
            const fields = Object.keys(results[phMeasurement]);
            const phField = fields.find(f => f.toLowerCase().includes('ph')) || fields[0];
            
            console.log(`    ph: {`);
            console.log(`        name: 'pH',`);
            console.log(`        measurement: '${phMeasurement}',`);
            console.log(`        field: '${phField}',`);
            console.log(`        unit: 'pH',`);
            console.log(`        range: [7.5, 8.5],`);
            console.log(`        color: '#440154',`);
            console.log(`        colorScheme: VIRIDIS_COLORS`);
            console.log(`    },`);
        }
        
        // Transmissometer (turbidity)
        if (results['transmissometer_1'] || results['transmissometer_2']) {
            const transMeasurement = results['transmissometer_1'] ? 'transmissometer_1' : 'transmissometer_2';
            const fields = Object.keys(results[transMeasurement]);
            const transField = fields[0];
            
            console.log(`    turbidity: {`);
            console.log(`        name: 'Turbidity',`);
            console.log(`        measurement: '${transMeasurement}',`);
            console.log(`        field: '${transField}',`);
            console.log(`        unit: 'NTU',`);
            console.log(`        range: [0, 100],`);
            console.log(`        color: '#3b528b',`);
            console.log(`        colorScheme: VIRIDIS_COLORS`);
            console.log(`    }`);
        }
        
        console.log('};');
        console.log('```');
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
