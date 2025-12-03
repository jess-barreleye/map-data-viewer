const WebSocket = require('ws');
const http = require('http');

// Configuration
const WS_PORT = process.env.WS_PORT_MULTIBEAM || 8085;
const INFLUXDB_URL = process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || '';
const INFLUXDB_BUCKET = process.env.INFLUXDB_BUCKET || 'multibeam-data';
const QUERY_INTERVAL = parseInt(process.env.QUERY_INTERVAL || '1000'); // Query every 1 second
const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true' || true; // Default to mock data

console.log('=== Multibeam Swath Server ===');
console.log(`WebSocket Port: ${WS_PORT}`);
console.log(`InfluxDB URL: ${INFLUXDB_URL}`);
console.log(`InfluxDB Bucket: ${INFLUXDB_BUCKET}`);
console.log(`Query Interval: ${QUERY_INTERVAL}ms`);
console.log(`Mock Data Mode: ${USE_MOCK_DATA}`);
console.log('==============================\n');

// Multibeam system specifications (Kongsberg)
const MULTIBEAM_SYSTEMS = {
    EM124: {
        name: 'EM 124',
        frequency: '12 kHz',
        beamWidth: 150,        // Total swath width in degrees
        minDepth: 20,
        maxDepth: 11000,
        description: 'Deep water multibeam (20-11,000m)'
    },
    EM712: {
        name: 'EM 712',
        frequency: '40/70 kHz',
        beamWidth: 140,        // Total swath width in degrees
        minDepth: 3,
        maxDepth: 3000,
        description: 'Mid-water multibeam (3-3,000m)'
    },
    EM2040: {
        name: 'EM 2040',
        frequency: '200/400 kHz',
        beamWidth: 130,        // Total swath width in degrees
        minDepth: 0.5,
        maxDepth: 600,
        description: 'Shallow water multibeam (0.5-600m)'
    }
};

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            connections: wss.clients.size,
            mode: USE_MOCK_DATA ? 'mock' : 'influxdb',
            systems: Object.keys(MULTIBEAM_SYSTEMS)
        }));
    } else if (req.url === '/systems') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(MULTIBEAM_SYSTEMS));
    } else {
        res.writeHead(404);
        res.end();
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

let queryInterval = null;
let latestSwaths = {};

// Calculate swath line from ship position, heading, depth, and beam width
// Returns a line across the ship (perpendicular to heading) showing swath width
function calculateSwathLine(lat, lon, heading, depth, beamWidth, systemId) {
    const system = MULTIBEAM_SYSTEMS[systemId];
    if (!system) return null;
    
    // Check if depth is within system range
    if (depth < system.minDepth || depth > system.maxDepth) {
        return null;
    }
    
    // Calculate swath width on seafloor (simplified model)
    // Actual coverage = depth * tan(beamWidth/2) on each side
    const halfBeamAngle = (beamWidth / 2) * Math.PI / 180;
    const swathWidth = depth * Math.tan(halfBeamAngle) * 2; // total width in meters
    const portWidth = swathWidth / 2;
    const starboardWidth = swathWidth / 2;
    
    // Convert heading to radians
    const headingRad = heading * Math.PI / 180;
    
    // Calculate perpendicular direction for port/starboard (across the ship)
    // Port is to the left (-90°), Starboard is to the right (+90°)
    const portHeading = headingRad - Math.PI / 2;
    const starboardHeading = headingRad + Math.PI / 2;
    
    // Earth radius in meters
    const R = 6371000;
    
    // Helper function to calculate new point given distance and bearing
    function destination(lat0, lon0, bearing, distance) {
        const lat0Rad = lat0 * Math.PI / 180;
        const lon0Rad = lon0 * Math.PI / 180;
        
        const lat1Rad = Math.asin(
            Math.sin(lat0Rad) * Math.cos(distance / R) +
            Math.cos(lat0Rad) * Math.sin(distance / R) * Math.cos(bearing)
        );
        
        const lon1Rad = lon0Rad + Math.atan2(
            Math.sin(bearing) * Math.sin(distance / R) * Math.cos(lat0Rad),
            Math.cos(distance / R) - Math.sin(lat0Rad) * Math.sin(lat1Rad)
        );
        
        return {
            lat: lat1Rad * 180 / Math.PI,
            lon: lon1Rad * 180 / Math.PI
        };
    }
    
    // Calculate port and starboard endpoints (line across the ship)
    const portPoint = destination(lat, lon, portHeading, portWidth);
    const starboardPoint = destination(lat, lon, starboardHeading, starboardWidth);
    
    // Debug: log the bearings to verify they're perpendicular
    const portBearing = (portHeading * 180 / Math.PI + 360) % 360;
    const starboardBearing = (starboardHeading * 180 / Math.PI + 360) % 360;
    console.log(`[${systemId}] Ship at [${lat.toFixed(6)}, ${lon.toFixed(6)}], heading=${heading.toFixed(1)}°`);
    console.log(`[${systemId}] Port at [${portPoint.lat.toFixed(6)}, ${portPoint.lon.toFixed(6)}] (bearing ${portBearing.toFixed(1)}°)`);
    console.log(`[${systemId}] Starboard at [${starboardPoint.lat.toFixed(6)}, ${starboardPoint.lon.toFixed(6)}] (bearing ${starboardBearing.toFixed(1)}°)`);
    console.log(`[${systemId}] Swath width: ${swathWidth.toFixed(1)}m\n`);
    
    // Return line coordinates (GeoJSON uses [lon, lat] order)
    return [
        [portPoint.lon, portPoint.lat],
        [starboardPoint.lon, starboardPoint.lat]
    ];
}

// Mock data generator for testing
function generateMockSwaths(shipLat, shipLon, shipHeading, shipDepth) {
    const swaths = {};
    
    // Simulate different systems being active based on depth
    if (shipDepth >= 20 && shipDepth <= 11000) {
        // EM124 active in deep water
        swaths.EM124 = {
            system: 'EM124',
            lat: shipLat,
            lon: shipLon,
            heading: shipHeading,
            depth: shipDepth,
            swathWidth: shipDepth * Math.tan(75 * Math.PI / 180) * 2,
            line: calculateSwathLine(shipLat, shipLon, shipHeading, shipDepth, 150, 'EM124'),
            active: true,
            timestamp: new Date().toISOString()
        };
    }
    
    if (shipDepth >= 3 && shipDepth <= 3000) {
        // EM712 active in mid-water
        swaths.EM712 = {
            system: 'EM712',
            lat: shipLat,
            lon: shipLon,
            heading: shipHeading,
            depth: shipDepth,
            swathWidth: shipDepth * Math.tan(70 * Math.PI / 180) * 2,
            line: calculateSwathLine(shipLat, shipLon, shipHeading, shipDepth, 140, 'EM712'),
            active: true,
            timestamp: new Date().toISOString()
        };
    }
    
    if (shipDepth >= 0.5 && shipDepth <= 600) {
        // EM2040 active in shallow water
        swaths.EM2040 = {
            system: 'EM2040',
            lat: shipLat,
            lon: shipLon,
            heading: shipHeading,
            depth: shipDepth,
            swathWidth: shipDepth * Math.tan(65 * Math.PI / 180) * 2,
            line: calculateSwathLine(shipLat, shipLon, shipHeading, shipDepth, 130, 'EM2040'),
            active: true,
            timestamp: new Date().toISOString()
        };
    }
    
    return swaths;
}

// Store latest ship GPS data
let latestShipGPS = {
    lat: null,
    lon: null,
    heading: null
};

// Connect to ship GPS WebSocket to get real-time position
function connectToShipGPS() {
    const shipGPSUrl = 'ws://localhost:8081';
    console.log('Connecting to Ship GPS WebSocket...');
    
    const ws = new WebSocket(shipGPSUrl);
    
    ws.on('open', () => {
        console.log('[Ship GPS] Connected - will use real ship position for swath');
    });
    
    ws.on('message', (data) => {
        try {
            const gpsData = JSON.parse(data);
            if (gpsData.lat && gpsData.lon) {
                latestShipGPS.lat = gpsData.lat;
                latestShipGPS.lon = gpsData.lon;
                latestShipGPS.heading = gpsData.course || 0;
            }
        } catch (err) {
            console.error('[Ship GPS] Parse error:', err);
        }
    });
    
    ws.on('close', () => {
        console.log('[Ship GPS] Disconnected, reconnecting in 5s...');
        setTimeout(connectToShipGPS, 5000);
    });
    
    ws.on('error', (err) => {
        console.error('[Ship GPS] Error:', err.message);
    });
}

// Query InfluxDB for multibeam swath data
async function queryInfluxDB() {
    if (USE_MOCK_DATA) {
        // Generate mock data using real ship position if available
        const now = Date.now();
        
        // Use real ship GPS position if available, otherwise fallback to test position
        const testLat = latestShipGPS.lat || (21.0 + Math.sin(now / 30000) * 0.01);
        const testLon = latestShipGPS.lon || (-157.8 + Math.cos(now / 30000) * 0.01);
        // Use real heading from GPS, or a slowly changing test heading (changes every ~50 seconds)
        const testHeading = latestShipGPS.heading || ((now / 50000) % 360);
        const testDepth = 500 + Math.sin(now / 20000) * 400; // 100-900m depth
        
        console.log(`[Multibeam] Using position: ${testLat.toFixed(6)}, ${testLon.toFixed(6)}, heading: ${testHeading.toFixed(1)}°, depth: ${testDepth.toFixed(1)}m`);
        
        return generateMockSwaths(testLat, testLon, testHeading, testDepth);
    }
    
    try {
        const { InfluxDB } = require('@influxdata/influxdb-client');
        
        const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
        const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);
        
        // Query for latest multibeam data
        // Adjust measurement names and field keys based on your actual InfluxDB schema
        const query = `
            from(bucket: "${INFLUXDB_BUCKET}")
                |> range(start: -10s)
                |> filter(fn: (r) => r["_measurement"] == "multibeam")
                |> filter(fn: (r) => r["_field"] == "lat" or r["_field"] == "lon" or r["_field"] == "heading" or r["_field"] == "depth" or r["_field"] == "system")
                |> last()
        `;
        
        const result = {};
        
        return new Promise((resolve, reject) => {
            queryApi.queryRows(query, {
                next(row, tableMeta) {
                    const o = tableMeta.toObject(row);
                    const system = o.system || 'EM124';
                    if (!result[system]) result[system] = {};
                    result[system][o._field] = o._value;
                },
                error(error) {
                    console.error('InfluxDB query error:', error);
                    reject(error);
                },
                complete() {
                    // Calculate swath lines for each system
                    const swaths = {};
                    for (const [systemId, data] of Object.entries(result)) {
                        if (data.lat && data.lon && data.heading && data.depth) {
                            const line = calculateSwathLine(
                                data.lat, data.lon, data.heading, data.depth,
                                MULTIBEAM_SYSTEMS[systemId].beamWidth, systemId
                            );
                            swaths[systemId] = {
                                system: systemId,
                                lat: data.lat,
                                lon: data.lon,
                                heading: data.heading,
                                depth: data.depth,
                                swathWidth: data.depth * Math.tan(MULTIBEAM_SYSTEMS[systemId].beamWidth / 2 * Math.PI / 180) * 2,
                                line: line,
                                active: true,
                                timestamp: new Date().toISOString()
                            };
                        }
                    }
                    resolve(swaths);
                }
            });
        });
    } catch (error) {
        console.error('Error querying InfluxDB:', error);
        // Fall back to mock data on error
        const now = Date.now();
        return generateMockSwaths(21.0, -157.8, (now / 100) % 360, 500);
    }
}

// Broadcast swath data to all connected clients
function broadcastSwaths(swaths) {
    const message = JSON.stringify(swaths);
    let sentCount = 0;
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            sentCount++;
        }
    });
    
    if (sentCount > 0) {
        const activeSystems = Object.keys(swaths).filter(s => swaths[s].active);
        console.log(`[${new Date().toISOString()}] Broadcast swaths to ${sentCount} client(s): ${activeSystems.join(', ')}`);
    }
}

// Start querying swath data
function startSwathQuery() {
    if (queryInterval) {
        clearInterval(queryInterval);
    }
    
    queryInterval = setInterval(async () => {
        try {
            const swaths = await queryInfluxDB();
            
            // Only broadcast if we have clients and data has changed
            if (wss.clients.size > 0) {
                latestSwaths = swaths;
                broadcastSwaths(swaths);
            }
        } catch (error) {
            console.error('Error fetching swath data:', error);
        }
    }, QUERY_INTERVAL);
    
    console.log(`Started swath query (interval: ${QUERY_INTERVAL}ms)`);
}

// Stop querying when no clients are connected
function stopSwathQuery() {
    if (queryInterval) {
        clearInterval(queryInterval);
        queryInterval = null;
        console.log('Stopped swath query (no clients connected)');
    }
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[${new Date().toISOString()}] Client connected from ${clientIp} (total: ${wss.clients.size})`);
    
    // Send current swath data immediately
    if (Object.keys(latestSwaths).length > 0) {
        ws.send(JSON.stringify(latestSwaths));
    }
    
    // Start querying if this is the first client
    if (wss.clients.size === 1) {
        startSwathQuery();
    }
    
    ws.on('close', () => {
        console.log(`[${new Date().toISOString()}] Client disconnected from ${clientIp} (remaining: ${wss.clients.size})`);
        
        // Stop querying if no clients remain
        if (wss.clients.size === 0) {
            stopSwathQuery();
        }
    });
    
    ws.on('error', (error) => {
        console.error(`[${new Date().toISOString()}] WebSocket error for ${clientIp}:`, error);
    });
});

// Start the server
server.listen(WS_PORT, () => {
    console.log(`Multibeam Swath WebSocket server listening on port ${WS_PORT}`);
    console.log(`Health check available at http://localhost:${WS_PORT}/health`);
    console.log(`System info available at http://localhost:${WS_PORT}/systems\n`);
    
    // Connect to ship GPS for real-time position (in mock mode)
    if (USE_MOCK_DATA) {
        connectToShipGPS();
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    stopSwathQuery();
    wss.close(() => {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received, closing server...');
    stopSwathQuery();
    wss.close(() => {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
});
