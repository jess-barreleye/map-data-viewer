const { InfluxDB } = require('@influxdata/influxdb-client');

// Configuration
const INFLUXDB_URL = 'http://10.23.9.24:8086';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || 'YOUR_INFLUXDB_TOKEN';
const INFLUXDB_ORG = '834cb38b7a729cea';
const INFLUXDB_BUCKET = 'openrvdas';

const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

async function testShipGPS() {
    console.log('Testing ship GPS query...\n');
    
    const query = `
        from(bucket: "${INFLUXDB_BUCKET}")
            |> range(start: -30s)
            |> filter(fn: (r) => r["_measurement"] == "seapath380")
            |> filter(fn: (r) => 
                r["_field"] == "Seapath_Latitude" or 
                r["_field"] == "Seapath_Longitude" or 
                r["_field"] == "Seapath_HeadingTrue" or 
                r["_field"] == "Seapath_CourseTrue" or
                r["_field"] == "Seapath_SpeedKt" or
                r["_field"] == "Seapath_NumSats" or
                r["_field"] == "Seapath_FixQuality"
            )
            |> last()
    `;

    const result = {};
    let rowCount = 0;
    
    return new Promise((resolve, reject) => {
        queryApi.queryRows(query, {
            next(row, tableMeta) {
                const o = tableMeta.toObject(row);
                console.log(`Row ${++rowCount}:`, o._field, '=', o._value, 'at', o._time);
                result[o._field] = o._value;
                result.timestamp = o._time;
            },
            error(error) {
                console.error('InfluxDB query error:', error);
                reject(error);
            },
            complete() {
                console.log('\nQuery complete!');
                console.log('Result:', JSON.stringify(result, null, 2));
                
                if (result['Seapath_Latitude'] && result['Seapath_Longitude']) {
                    const gpsData = {
                        type: 'position',
                        timestamp: new Date(result.timestamp).toISOString(),
                        lat: result['Seapath_Latitude'],
                        lon: result['Seapath_Longitude'],
                        heading: result['Seapath_HeadingTrue'] || null,
                        course: result['Seapath_CourseTrue'] || null,
                        speed: result['Seapath_SpeedKt'] || null,
                        satellites: result['Seapath_NumSats'] || null,
                        quality: result['Seapath_FixQuality'] || null
                    };
                    console.log('\nFormatted GPS data:');
                    console.log(JSON.stringify(gpsData, null, 2));
                    resolve(gpsData);
                } else {
                    console.log('\n⚠️  No latitude/longitude found in result');
                    resolve(null);
                }
            }
        });
    });
}

testShipGPS()
    .then(() => {
        console.log('\n✅ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
