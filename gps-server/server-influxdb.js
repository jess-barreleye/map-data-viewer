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

console.log('=== GPS Server (InfluxDB Mode) ===');
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

// Query historical ship GPS at specific timestamp
async function queryHistoricalShipPosition(timestamp) {
    const isoTime = new Date(timestamp).toISOString();
    const query = `
        from(bucket: "${INFLUXDB_BUCKET}")
            |> range(start: ${isoTime}, stop: ${new Date(new Date(timestamp).getTime() + 2000).toISOString()})
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
            |> first()
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
                console.error('[SHIP HISTORICAL] InfluxDB query error:', error);
                reject(error);
            },
            complete() {
                if (result['Seapath_Latitude'] && result['Seapath_Longitude']) {
                    resolve({
                        lat: result['Seapath_Latitude'],
                        lon: result['Seapath_Longitude'],
                        heading: result['Seapath_HeadingTrue'] || null,
                        course: result['Seapath_CourseTrue'] || null,
                        speed: result['Seapath_SpeedKt'] || null,
                        satellites: result['Seapath_NumSats'] || null,
                        quality: result['Seapath_FixQuality'] || null,
                        timestamp: new Date(result.timestamp).toISOString()
                    });
                } else {
                    resolve(null);
                }
            }
        });
    });
}

// Query historical ROV GPS at specific timestamp
async function queryHistoricalROVPosition(timestamp) {
    const isoTime = new Date(timestamp).toISOString();
    const query = `
        from(bucket: "${INFLUXDB_BUCKET}")
            |> range(start: ${isoTime}, stop: ${new Date(new Date(timestamp).getTime() + 2000).toISOString()})
            |> filter(fn: (r) => r["_measurement"] == "sb_sprint")
            |> filter(fn: (r) => 
                r["_field"] == "SB_Sprint_Latitude" or 
                r["_field"] == "SB_Sprint_Longitude" or 
                r["_field"] == "SB_Sprint_HeadingTrue" or
                r["_field"] == "SB_Sprint_Depth_Corr" or
                r["_field"] == "SB_Sprint_Altitude_m"
            )
            |> first()
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
                console.error('[ROV HISTORICAL] InfluxDB query error:', error);
                reject(error);
            },
            complete() {
                if (result['SB_Sprint_Latitude'] && result['SB_Sprint_Longitude']) {
                    resolve({
                        lat: result['SB_Sprint_Latitude'],
                        lon: result['SB_Sprint_Longitude'],
                        heading: result['SB_Sprint_HeadingTrue'] || null,
                        depth: result['SB_Sprint_Depth_Corr'] || null,
                        altitude: result['SB_Sprint_Altitude_m'] || null,
                        timestamp: new Date(result.timestamp).toISOString()
                    });
                } else {
                    resolve(null);
                }
            }
        });
    });
}

// Query historical trackline between two timestamps
async function queryHistoricalTrackline(startTime, endTime, vehicle, downsample = 'auto') {
    // Calculate appropriate downsampling based on time range
    const durationHours = (new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60);
    let aggregateInterval = '1s';  // Full resolution
    
    if (downsample === 'auto') {
        if (durationHours > 168) {  // > 7 days
            aggregateInterval = '1m';
        } else if (durationHours > 24) {  // > 1 day
            aggregateInterval = '10s';
        } else if (durationHours > 1) {  // > 1 hour
            aggregateInterval = '5s';
        }
    } else {
        aggregateInterval = downsample;
    }
    
    const measurement = vehicle === 'ship' ? 'seapath380' : 'sb_sprint';
    const latField = vehicle === 'ship' ? 'Seapath_Latitude' : 'SB_Sprint_Latitude';
    const lonField = vehicle === 'ship' ? 'Seapath_Longitude' : 'SB_Sprint_Longitude';
    const headingField = vehicle === 'ship' ? 'Seapath_HeadingTrue' : 'SB_Sprint_HeadingTrue';
    
    const startISO = new Date(startTime).toISOString();
    const endISO = new Date(endTime).toISOString();
    
    const query = `
        from(bucket: "${INFLUXDB_BUCKET}")
            |> range(start: ${startISO}, stop: ${endISO})
            |> filter(fn: (r) => r["_measurement"] == "${measurement}")
            |> filter(fn: (r) => 
                r["_field"] == "${latField}" or
                r["_field"] == "${lonField}" or
                r["_field"] == "${headingField}"
            )
            |> aggregateWindow(every: ${aggregateInterval}, fn: mean, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    `;
    
    const points = [];
    
    return new Promise((resolve, reject) => {
        queryApi.queryRows(query, {
            next(row, tableMeta) {
                const o = tableMeta.toObject(row);
                if (o[latField] !== undefined && o[lonField] !== undefined) {
                    points.push({
                        time: new Date(o._time).toISOString(),
                        lat: o[latField],
                        lon: o[lonField],
                        heading: o[headingField] || null
                    });
                }
            },
            error(error) {
                console.error(`[${vehicle.toUpperCase()} TRACKLINE] InfluxDB query error:`, error);
                reject(error);
            },
            complete() {
                console.log(`[${vehicle.toUpperCase()} TRACKLINE] Retrieved ${points.length} points (${aggregateInterval} resolution)`);
                resolve(points);
            }
        });
    });
}

// Send trackline data in chunks to avoid WebSocket message size limits
async function sendTracklineInChunks(ws, vehicle, points, startTime, endTime) {
    const CHUNK_SIZE = 1000;
    const totalChunks = Math.ceil(points.length / CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
        const chunk = points.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        
        ws.send(JSON.stringify({
            type: 'tracklineData',
            vehicle: vehicle,
            startTime: startTime,
            endTime: endTime,
            chunk: i + 1,
            totalChunks: totalChunks,
            points: chunk
        }));
        
        console.log(`[${vehicle.toUpperCase()} TRACKLINE] Sent chunk ${i + 1}/${totalChunks} (${chunk.length} points)`);
        
        // Small delay between chunks to prevent overwhelming client
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Send completion message
    ws.send(JSON.stringify({
        type: 'tracklineComplete',
        vehicle: vehicle,
        totalPoints: points.length
    }));
    
    console.log(`[${vehicle.toUpperCase()} TRACKLINE] Transfer complete: ${points.length} total points`);
}

// Broadcast GPS data to WebSocket clients
function broadcast(wss, clients, data, label) {
    if (!data) return;
    
    const message = JSON.stringify(data);
    let sentCount = 0;
    
    clients.forEach((client) => {
        if (client.readyState === 1) { // OPEN
            client.send(message);
            sentCount++;
        }
    });
    
    if (sentCount > 0) {
        console.log(`[${label}] Broadcast to ${sentCount} client(s): ${data.lat.toFixed(6)}, ${data.lon.toFixed(6)}`);
    }
}

// Start querying GPS data
setInterval(async () => {
    try {
        // Query and broadcast ship GPS
        const shipGPS = await queryShipGPS();
        if (shipGPS) {
            latestGpsDataShip = shipGPS;
            broadcast(wssShip, clientsShip, shipGPS, 'SHIP');
        }
    } catch (error) {
        console.error('[SHIP] Query error:', error.message);
    }
}, QUERY_INTERVAL);

setInterval(async () => {
    try {
        // Query and broadcast ROV GPS
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
    
    // Handle incoming messages from client
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log(`[SHIP] Received message:`, data.type);
            
            if (data.type === 'queryHistorical') {
                // Query historical position for both ship and ROV
                const shipData = await queryHistoricalShipPosition(data.timestamp);
                const rovData = await queryHistoricalROVPosition(data.timestamp);
                
                ws.send(JSON.stringify({
                    type: 'historicalData',
                    timestamp: data.timestamp,
                    ship: shipData,
                    rov: rovData
                }));
                
                console.log(`[HISTORICAL] Sent data for ${data.timestamp}`);
            }
            else if (data.type === 'queryTrackline') {
                // Query historical trackline for requested vehicles
                const vehicles = data.vehicles || [];
                
                for (const vehicle of vehicles) {
                    console.log(`[TRACKLINE] Querying ${vehicle} from ${data.startTime} to ${data.endTime}`);
                    const points = await queryHistoricalTrackline(
                        data.startTime,
                        data.endTime,
                        vehicle,
                        data.downsample || 'auto'
                    );
                    
                    if (points.length > 0) {
                        await sendTracklineInChunks(ws, vehicle, points, data.startTime, data.endTime);
                    } else {
                        ws.send(JSON.stringify({
                            type: 'tracklineComplete',
                            vehicle: vehicle,
                            totalPoints: 0
                        }));
                    }
                }
            }
        } catch (error) {
            console.error('[SHIP] Message handling error:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: error.message
            }));
        }
    });
    
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
