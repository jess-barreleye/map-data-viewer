const { WebSocketServer } = require('ws');
const { InfluxDB } = require('@influxdata/influxdb-client');

// Configuration
const INFLUXDB_URL = process.env.INFLUXDB_URL || 'http://10.23.9.24:8086';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || 'YOUR_INFLUXDB_TOKEN';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || '834cb38b7a729cea';
const INFLUXDB_BUCKET = process.env.INFLUXDB_BUCKET || 'openrvdas';

const WS_PORT_SHIP = parseInt(process.env.WS_PORT_SHIP || '8081');
const WS_PORT_ROV = parseInt(process.env.WS_PORT_ROV || '8082');
const QUERY_INTERVAL = parseInt(process.env.QUERY_INTERVAL || '1000'); // Query every 1 second

console.log('=== GPS Server (InfluxDB Mode - Simple) ===');
console.log(`InfluxDB URL: ${INFLUXDB_URL}`);
console.log(`InfluxDB Bucket: ${INFLUXDB_BUCKET}`);
console.log(`Ship WebSocket Port: ${WS_PORT_SHIP}`);
console.log(`ROV WebSocket Port: ${WS_PORT_ROV}`);
console.log(`Query Interval: ${QUERY_INTERVAL}ms`);
console.log('============================\n');

// Create WebSocket servers for broadcasting to browser clients
const wssShip = new WebSocketServer({ port: WS_PORT_SHIP });
const wssROV = new WebSocketServer({ port: WS_PORT_ROV });

// Store connected clients
const clientsShip = new Set();
const clientsROV = new Set();

// Store latest GPS data for new clients
let latestGpsDataShip = {};
let latestGpsDataROV = {};

// Initialize InfluxDB client
const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);

// Query ship GPS from Seapath
async function queryShipGPS() {
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
    
    return new Promise((resolve, reject) => {
        queryApi.queryRows(query, {
            next(row, tableMeta) {
                const o = tableMeta.toObject(row);
                result[o._field] = o._value;
                result.timestamp = o._time;
            },
            error(error) {
                console.error('[SHIP] InfluxDB query error:', error);
                reject(error);
            },
            complete() {
                if (result['Seapath_Latitude'] && result['Seapath_Longitude']) {
                    resolve({
                        type: 'position',
                        timestamp: new Date(result.timestamp).toISOString(),
                        lat: result['Seapath_Latitude'],
                        lon: result['Seapath_Longitude'],
                        heading: result['Seapath_HeadingTrue'] || null,
                        course: result['Seapath_CourseTrue'] || null,
                        speed: result['Seapath_SpeedKt'] || null,
                        satellites: result['Seapath_NumSats'] || null,
                        quality: result['Seapath_FixQuality'] || null
                    });
                } else {
                    resolve(null);
                }
            }
        });
    });
}

// Query ROV GPS from sb_sprint
async function queryROVGPS() {
    const query = `
        from(bucket: "${INFLUXDB_BUCKET}")
            |> range(start: -30s)
            |> filter(fn: (r) => r["_measurement"] == "sb_sprint")
            |> filter(fn: (r) => 
                r["_field"] == "SB_Sprint_Latitude" or 
                r["_field"] == "SB_Sprint_Longitude" or 
                r["_field"] == "SB_Sprint_HeadingTrue" or
                r["_field"] == "SB_Sprint_Depth_Corr" or
                r["_field"] == "SB_Sprint_Altitude_m"
            )
            |> last()
    `;

    const result = {};
    
    return new Promise((resolve, reject) => {
        queryApi.queryRows(query, {
            next(row, tableMeta) {
                const o = tableMeta.toObject(row);
                result[o._field] = o._value;
                result.timestamp = o._time;
            },
            error(error) {
                console.error('[ROV] InfluxDB query error:', error);
                reject(error);
            },
            complete() {
                if (result['SB_Sprint_Latitude'] && result['SB_Sprint_Longitude']) {
                    resolve({
                        type: 'position',
                        timestamp: new Date(result.timestamp).toISOString(),
                        lat: result['SB_Sprint_Latitude'],
                        lon: result['SB_Sprint_Longitude'],
                        heading: result['SB_Sprint_HeadingTrue'] || null,
                        depth: result['SB_Sprint_Depth_Corr'] || null,
                        altitude: result['SB_Sprint_Altitude_m'] || null
                    });
                } else {
                    resolve(null);
                }
            }
        });
    });
}

// Broadcast GPS data to WebSocket clients
function broadcast(wss, clients, data, label) {
    if (!data) return;
    
    const message = JSON.stringify(data);
    let sentCount = 0;
    
    clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
            sentCount++;
        }
    });
    
    if (sentCount > 0) {
        console.log(`[${label}] Broadcast to ${sentCount} client(s): ${data.lat.toFixed(6)}, ${data.lon.toFixed(6)}`);
    }
}

// Query and broadcast ship GPS every interval
setInterval(async () => {
    try {
        const shipGPS = await queryShipGPS();
        if (shipGPS) {
            latestGpsDataShip = shipGPS;
            broadcast(wssShip, clientsShip, shipGPS, 'SHIP');
        }
    } catch (error) {
        console.error('[SHIP] Query error:', error.message);
    }
}, QUERY_INTERVAL);

// Query and broadcast ROV GPS every interval
setInterval(async () => {
    try {
        const rovGPS = await queryROVGPS();
        if (rovGPS) {
            latestGpsDataROV = rovGPS;
            broadcast(wssROV, clientsROV, rovGPS, 'ROV');
        }
    } catch (error) {
        console.error('[ROV] Query error:', error.message);
    }
}, QUERY_INTERVAL);

// WebSocket connection handlers
wssShip.on('connection', (ws) => {
    console.log('[SHIP] New WebSocket client connected');
    clientsShip.add(ws);
    
    // Send latest data to new client
    if (Object.keys(latestGpsDataShip).length > 0) {
        ws.send(JSON.stringify(latestGpsDataShip));
    }
    
    ws.on('close', () => {
        console.log('[SHIP] WebSocket client disconnected');
        clientsShip.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('[SHIP] WebSocket error:', error);
        clientsShip.delete(ws);
    });
});

wssROV.on('connection', (ws) => {
    console.log('[ROV] New WebSocket client connected');
    clientsROV.add(ws);
    
    // Send latest data to new client
    if (Object.keys(latestGpsDataROV).length > 0) {
        ws.send(JSON.stringify(latestGpsDataROV));
    }
    
    ws.on('close', () => {
        console.log('[ROV] WebSocket client disconnected');
        clientsROV.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('[ROV] WebSocket error:', error);
        clientsROV.delete(ws);
    });
});

console.log('[SHIP] WebSocket server listening on port', WS_PORT_SHIP);
console.log('[ROV] WebSocket server listening on port', WS_PORT_ROV);
console.log('Querying InfluxDB for GPS data...\n');

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n[SHUTDOWN] Closing servers...');
    wssShip.close();
    wssROV.close();
    process.exit(0);
});
