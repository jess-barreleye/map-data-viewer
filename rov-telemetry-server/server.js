const WebSocket = require('ws');
const http = require('http');

// Configuration
const WS_PORT = process.env.WS_PORT_TELEMETRY || 8084;
const INFLUXDB_URL = process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || '';
const INFLUXDB_BUCKET = process.env.INFLUXDB_BUCKET || 'rov-data';
const QUERY_INTERVAL = parseInt(process.env.QUERY_INTERVAL || '1000'); // Query every 1 second
const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true' || true; // Default to mock data until InfluxDB is configured

console.log('=== ROV Telemetry Server ===');
console.log(`WebSocket Port: ${WS_PORT}`);
console.log(`InfluxDB URL: ${INFLUXDB_URL}`);
console.log(`InfluxDB Bucket: ${INFLUXDB_BUCKET}`);
console.log(`Query Interval: ${QUERY_INTERVAL}ms`);
console.log(`Mock Data Mode: ${USE_MOCK_DATA}`);
console.log('============================\n');

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            connections: wss.clients.size,
            mode: USE_MOCK_DATA ? 'mock' : 'influxdb'
        }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

let queryInterval = null;
let latestTelemetry = {
    depth: null,
    heading: null,
    altitude: null,
    pitch: null,
    roll: null,
    timestamp: null
};

// Mock data generator for testing
function generateMockTelemetry() {
    const now = Date.now();
    
    // Simulate realistic ROV depth changes (20-100m range)
    const baseDepth = 50;
    const depthVariation = Math.sin(now / 10000) * 30;
    const depth = baseDepth + depthVariation;
    
    // Simulate heading changes (0-360°)
    const heading = (now / 100) % 360;
    
    // Simulate altitude above seafloor (1-10m)
    const altitude = 5 + Math.sin(now / 5000) * 4;
    
    // Simulate small pitch/roll movements
    const pitch = Math.sin(now / 3000) * 10;
    const roll = Math.cos(now / 4000) * 8;
    
    return {
        depth: parseFloat(depth.toFixed(1)),
        heading: parseFloat(heading.toFixed(1)),
        altitude: parseFloat(altitude.toFixed(1)),
        pitch: parseFloat(pitch.toFixed(1)),
        roll: parseFloat(roll.toFixed(1)),
        timestamp: new Date().toISOString()
    };
}

// Query InfluxDB for latest telemetry data
async function queryInfluxDB() {
    if (USE_MOCK_DATA) {
        return generateMockTelemetry();
    }
    
    try {
        const { InfluxDB } = require('@influxdata/influxdb-client');
        
        const influxDB = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
        const queryApi = influxDB.getQueryApi(INFLUXDB_ORG);
        
        // Query for the most recent telemetry values from sb_sprint (ROV navigation)
        const query = `
            from(bucket: "${INFLUXDB_BUCKET}")
                |> range(start: -30s)
                |> filter(fn: (r) => r["_measurement"] == "sb_sprint")
                |> filter(fn: (r) => 
                    r["_field"] == "SB_Sprint_Depth_Corr" or 
                    r["_field"] == "SB_Sprint_HeadingTrue" or 
                    r["_field"] == "SB_Sprint_Altitude_m" or 
                    r["_field"] == "SB_Sprint_Pitch" or 
                    r["_field"] == "SB_Sprint_Roll" or
                    r["_field"] == "SB_Sprint_Latitude" or
                    r["_field"] == "SB_Sprint_Longitude"
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
                    console.error('InfluxDB query error:', error);
                    reject(error);
                },
                complete() {
                    resolve({
                        depth: result['SB_Sprint_Depth_Corr'] || null,
                        heading: result['SB_Sprint_HeadingTrue'] || null,
                        altitude: result['SB_Sprint_Altitude_m'] || null,
                        pitch: result['SB_Sprint_Pitch'] || null,
                        roll: result['SB_Sprint_Roll'] || null,
                        lat: result['SB_Sprint_Latitude'] || null,
                        lon: result['SB_Sprint_Longitude'] || null,
                        timestamp: result.timestamp || new Date().toISOString()
                    });
                }
            });
        });
    } catch (error) {
        console.error('Error querying InfluxDB:', error);
        // Fall back to mock data on error
        return generateMockTelemetry();
    }
}

// Broadcast telemetry data to all connected clients
function broadcastTelemetry(data) {
    const message = JSON.stringify(data);
    let sentCount = 0;
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            sentCount++;
        }
    });
    
    if (sentCount > 0) {
        console.log(`[${new Date().toISOString()}] Broadcast telemetry to ${sentCount} client(s): Depth=${data.depth}m, Heading=${data.heading}°`);
    }
}

// Start querying telemetry data
function startTelemetryQuery() {
    if (queryInterval) {
        clearInterval(queryInterval);
    }
    
    queryInterval = setInterval(async () => {
        try {
            const telemetry = await queryInfluxDB();
            
            // Only broadcast if data has changed or if we have clients
            if (wss.clients.size > 0 && 
                (latestTelemetry.depth !== telemetry.depth || 
                 latestTelemetry.heading !== telemetry.heading)) {
                latestTelemetry = telemetry;
                broadcastTelemetry(telemetry);
            }
        } catch (error) {
            console.error('Error fetching telemetry:', error);
        }
    }, QUERY_INTERVAL);
    
    console.log(`Started telemetry query (interval: ${QUERY_INTERVAL}ms)`);
}

// Stop querying when no clients are connected
function stopTelemetryQuery() {
    if (queryInterval) {
        clearInterval(queryInterval);
        queryInterval = null;
        console.log('Stopped telemetry query (no clients connected)');
    }
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[${new Date().toISOString()}] Client connected from ${clientIp} (total: ${wss.clients.size})`);
    
    // Send current telemetry immediately
    if (latestTelemetry.depth !== null) {
        ws.send(JSON.stringify(latestTelemetry));
    }
    
    // Start querying if this is the first client
    if (wss.clients.size === 1) {
        startTelemetryQuery();
    }
    
    ws.on('close', () => {
        console.log(`[${new Date().toISOString()}] Client disconnected from ${clientIp} (remaining: ${wss.clients.size})`);
        
        // Stop querying if no clients remain
        if (wss.clients.size === 0) {
            stopTelemetryQuery();
        }
    });
    
    ws.on('error', (error) => {
        console.error(`[${new Date().toISOString()}] WebSocket error for ${clientIp}:`, error);
    });
});

// Start the server
server.listen(WS_PORT, () => {
    console.log(`ROV Telemetry WebSocket server listening on port ${WS_PORT}`);
    console.log(`Health check available at http://localhost:${WS_PORT}/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    stopTelemetryQuery();
    wss.close(() => {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received, closing server...');
    stopTelemetryQuery();
    wss.close(() => {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
});
