#!/usr/bin/env node

/**
 * Test actual sensor measurements found in InfluxDB
 */

const { InfluxDB } = require('@influxdata/influxdb-client');

const url = 'http://10.23.9.24:8086';
const token = process.env.INFLUXDB_TOKEN || 'YOUR_INFLUXDB_TOKEN';
const org = '834cb38b7a729cea';
const bucket = 'openrvdas';

const client = new InfluxDB({ url, token });
const queryApi = client.getQueryApi(org);

// Measurements that likely contain oceanographic data
const MEASUREMENTS_TO_TEST = [
    'tsg_sbe45_1',       // Thermosalinograph
    'ctd_sbe911',        // CTD
    'fluorometer_1',     // Fluorescence
    'pH_sunburst_1',     // pH
    'sb_oxygen',         // Dissolved oxygen
    'transmissometer_1', // Turbidity
    'sb_ctd_sbe49',      // SeaBird CTD
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
    console.log('InfluxDB Actual Sensor Inspection');
    console.log('=================================');
    console.log(`URL: ${url}`);
    console.log(`Bucket: ${bucket}`);
    console.log();
    
    const results = {};
    
    for (const measurement of MEASUREMENTS_TO_TEST) {
        const fields = await inspectMeasurement(measurement);
        if (fields) {
            results[measurement] = fields;
        }
    }
    
    console.log('\n\n' + '='.repeat(60));
    console.log('SUMMARY - Available Sensors');
    console.log('='.repeat(60));
    
    const available = Object.keys(results);
    
    if (available.length === 0) {
        console.log('❌ No sensors found with recent data');
        console.log('\nPossible reasons:');
        console.log('  - Sensors not currently logging');
        console.log('  - Ship not collecting data');
        console.log('  - Different measurement names');
    } else {
        console.log(`✅ Found ${available.length} sensors with recent data:\n`);
        
        for (const measurement of available) {
            const fields = Object.keys(results[measurement]);
            console.log(`${measurement}:`);
            console.log(`  Fields: ${fields.join(', ')}`);
        }
        
        console.log('\n\nRecommended SENSORS configuration:');
        console.log('```javascript');
        console.log('const SENSORS = {');
        
        if (results['tsg_sbe45_1']) {
            const fields = Object.keys(results['tsg_sbe45_1']);
            const tempField = fields.find(f => f.includes('temp') || f.includes('Temp'));
            const salField = fields.find(f => f.includes('sal') || f.includes('Sal'));
            
            if (tempField) {
                console.log(`    temperature: {`);
                console.log(`        measurement: 'tsg_sbe45_1',`);
                console.log(`        field: '${tempField}',`);
                console.log(`        unit: '°C',`);
                console.log(`        range: [0, 35]`);
                console.log(`    },`);
            }
            
            if (salField) {
                console.log(`    salinity: {`);
                console.log(`        measurement: 'tsg_sbe45_1',`);
                console.log(`        field: '${salField}',`);
                console.log(`        unit: 'PSU',`);
                console.log(`        range: [30, 40]`);
                console.log(`    },`);
            }
        }
        
        if (results['fluorometer_1']) {
            const fields = Object.keys(results['fluorometer_1']);
            const chlField = fields.find(f => f.includes('chl') || f.includes('Chl') || f.includes('fluorescence'));
            
            if (chlField) {
                console.log(`    fluorescence: {`);
                console.log(`        measurement: 'fluorometer_1',`);
                console.log(`        field: '${chlField}',`);
                console.log(`        unit: 'mg/m³',`);
                console.log(`        range: [0, 10]`);
                console.log(`    },`);
            }
        }
        
        if (results['sb_oxygen']) {
            const fields = Object.keys(results['sb_oxygen']);
            const o2Field = fields.find(f => f.includes('oxygen') || f.includes('O2') || f.includes('value'));
            
            if (o2Field) {
                console.log(`    oxygen: {`);
                console.log(`        measurement: 'sb_oxygen',`);
                console.log(`        field: '${o2Field}',`);
                console.log(`        unit: 'mg/L',`);
                console.log(`        range: [0, 12]`);
                console.log(`    },`);
            }
        }
        
        if (results['pH_sunburst_1']) {
            const fields = Object.keys(results['pH_sunburst_1']);
            const phField = fields.find(f => f.includes('pH') || f.includes('ph') || f.includes('value'));
            
            if (phField) {
                console.log(`    ph: {`);
                console.log(`        measurement: 'pH_sunburst_1',`);
                console.log(`        field: '${phField}',`);
                console.log(`        unit: 'pH',`);
                console.log(`        range: [7.5, 8.5]`);
                console.log(`    },`);
            }
        }
        
        if (results['transmissometer_1']) {
            const fields = Object.keys(results['transmissometer_1']);
            const turbField = fields.find(f => f.includes('turb') || f.includes('transmission') || f.includes('value'));
            
            if (turbField) {
                console.log(`    turbidity: {`);
                console.log(`        measurement: 'transmissometer_1',`);
                console.log(`        field: '${turbField}',`);
                console.log(`        unit: 'NTU',`);
                console.log(`        range: [0, 50]`);
                console.log(`    },`);
            }
        }
        
        console.log('};');
        console.log('```');
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
