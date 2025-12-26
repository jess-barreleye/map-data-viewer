/**
 * Oceanographic Data Server
 * 
 * Streams oceanographic sensor data from InfluxDB (OpenRVDAS) to MapLibre frontend
 * Supports real-time and historical data with GPS coordinate mapping
 * 
 * Data Sources:
 * - Water Temperature (TSG - Thermosalinograph)
 * - Salinity (TSG)
 * - Fluorescence (CTD/Fluorometer)
 * - Dissolved Oxygen (CTD)
 * - pH (CTD)
 * - Turbidity (CTD)
 * - Chlorophyll (Fluorometer)
 * 
 * Each sensor reading is joined with Seapath GPS data via timestamp
 */

const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

// Load environment variables
const PORT = process.env.PORT || 8086;
const USE_MOCK_DATA = process.env.USE_MOCK_DATA !== 'false';

let influxClient = null;
let queryApi = null;

// Try to load InfluxDB client if not in mock mode
if (!USE_MOCK_DATA) {
    try {
        const { InfluxDB } = require('@influxdata/influxdb-client');
        const url = process.env.INFLUXDB_URL || 'http://localhost:8086';
        const token = process.env.INFLUXDB_TOKEN;
        const org = process.env.INFLUXDB_ORG;
        const bucket = process.env.INFLUXDB_BUCKET || 'openrvdas';
        
        if (token && org) {
            influxClient = new InfluxDB({ url, token });
            queryApi = influxClient.getQueryApi(org);
            console.log(`InfluxDB client initialized: ${url}, bucket: ${bucket}`);
        } else {
            console.warn('InfluxDB credentials not found, using mock data');
        }
    } catch (err) {
        console.warn('InfluxDB module not found, using mock data:', err.message);
    }
}

// Create HTTP server
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            mode: USE_MOCK_DATA || !influxClient ? 'mock' : 'influxdb',
            timestamp: new Date().toISOString()
        }));
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

// Sensor definitions with InfluxDB measurement mappings
// Viridis color palette (low to high values: yellow to purple)
const VIRIDIS_COLORS = ['#fde724', '#5ec962', '#21918c', '#3b528b', '#440154'];

const SENSORS = {
    temperature: {
        name: 'Temperature',
        unit: '°C',
        measurement: 'tsg_sbe45_1',
        field: 'TSG_SBE45_1_SBE38_Temperature',
        color: '#fde724',
        colorScheme: VIRIDIS_COLORS,
        range: [0, 35]
    },
    salinity: {
        name: 'Salinity',
        unit: 'PSU',
        measurement: 'tsg_sbe45_1',
        field: 'TSG_SBE45_1_Salinity',
        color: '#5ec962',
        colorScheme: VIRIDIS_COLORS,
        range: [30, 40]
    },
    fluorescence: {
        name: 'Fluorescence',
        unit: 'mg/m³',
        measurement: 'fluorometer_1',
        field: 'Fluoro_1_ChlSig',
        color: '#21918c',
        colorScheme: VIRIDIS_COLORS,
        range: [0, 10]
    },
    turbidity: {
        name: 'Turbidity',
        unit: 'NTU',
        measurement: 'transmissometer_1',
        field: 'SBE_CST_1_CalcBeams',
        color: '#3b528b',
        colorScheme: VIRIDIS_COLORS,
        range: [0, 1]
    },
    ph: {
        name: 'pH',
        unit: 'pH',
        measurement: 'pH_sunburst_1',
        field: 'pH_sunburst_1_pH_ConstSal',
        color: '#440154',
        colorScheme: VIRIDIS_COLORS,
        range: [7.5, 8.5]
    },
};

// Mock data generator
function generateMockReading(sensorType, basePosition) {
    const sensor = SENSORS[sensorType];
    const [min, max] = sensor.range;
    const range = max - min;
    
    // Generate value with some variation
    const value = min + Math.random() * range;
    
    // Generate position near base (ship position with slight offset for visualization)
    const latOffset = (Math.random() - 0.5) * 0.01; // ~1km variation
    const lonOffset = (Math.random() - 0.5) * 0.01;
    
    return {
        sensor: sensorType,
        value: parseFloat(value.toFixed(3)),
        unit: sensor.unit,
        lat: basePosition.lat + latOffset,
        lon: basePosition.lon + lonOffset,
        timestamp: new Date().toISOString()
    };
}

// Generate mock historical data for heatmap
function generateMockHistoricalData(sensorType, hoursBack = 1) {
    const sensor = SENSORS[sensorType];
    const [min, max] = sensor.range;
    const range = max - min;
    
    const points = [];
    const numPoints = 100; // Generate 100 historical points
    
    // Base position (around ship's typical location)
    const baseLat = 48.117300;
    const baseLon = -11.516667;
    
    for (let i = 0; i < numPoints; i++) {
        // Create a path pattern (simulate ship track)
        const t = i / numPoints;
        const lat = baseLat + Math.sin(t * Math.PI * 2) * 0.05;
        const lon = baseLon + Math.cos(t * Math.PI * 2) * 0.05;
        
        // Add some randomness to values (simulate sensor readings)
        const baseValue = min + (max - min) * (0.3 + Math.sin(t * Math.PI * 4) * 0.3 + Math.random() * 0.4);
        
        points.push({
            sensor: sensorType,
            value: parseFloat(baseValue.toFixed(3)),
            unit: sensor.unit,
            lat: lat,
            lon: lon,
            timestamp: new Date(Date.now() - (hoursBack * 3600000) + (t * hoursBack * 3600000)).toISOString()
        });
    }
    
    return points;
}

// Query InfluxDB for real-time data
async function queryRealtimeData(sensorType) {
    if (!queryApi) return null;
    
    const sensor = SENSORS[sensorType];
    const bucket = process.env.INFLUXDB_BUCKET || 'openrvdas';
    
    try {
        // First get the latest sensor reading
        const sensorQuery = `
            from(bucket: "${bucket}")
            |> range(start: -1m)
            |> filter(fn: (r) => r._measurement == "${sensor.measurement}")
            |> filter(fn: (r) => r._field == "${sensor.field}")
            |> last()
        `;
        
        let sensorValue = null;
        let sensorTime = null;
        
        for await (const { values, tableMeta } of queryApi.iterateRows(sensorQuery)) {
            const row = tableMeta.toObject(values);
            sensorValue = parseFloat(row._value);
            sensorTime = row._time;
        }
        
        if (sensorValue === null || !sensorTime) {
            return null;
        }
        
        // Now get GPS position at approximately the same time (within 10 seconds)
        const gpsQuery = `
            from(bucket: "${bucket}")
            |> range(start: -1m)
            |> filter(fn: (r) => r._measurement == "seapath380")
            |> filter(fn: (r) => r._field == "Seapath_Latitude" or r._field == "Seapath_Longitude")
            |> last()
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        `;
        
        let lat = null;
        let lon = null;
        
        for await (const { values, tableMeta } of queryApi.iterateRows(gpsQuery)) {
            const row = tableMeta.toObject(values);
            if (row.Seapath_Latitude !== undefined) lat = row.Seapath_Latitude;
            if (row.Seapath_Longitude !== undefined) lon = row.Seapath_Longitude;
        }
        
        if (lat !== null && lon !== null) {
            return {
                sensor: sensorType,
                value: sensorValue,
                unit: sensor.unit,
                lat: lat,
                lon: lon,
                timestamp: sensorTime
            };
        }
    } catch (err) {
        console.error(`Error querying InfluxDB for ${sensorType}:`, err.message);
    }
    
    return null;
}

// Query InfluxDB for historical data with specific time range
async function queryHistoricalDataWithRange(sensorType, startTime, endTime) {
    if (!queryApi) return [];
    
    const sensor = SENSORS[sensorType];
    const bucket = process.env.INFLUXDB_BUCKET || 'openrvdas';
    
    try {
        // Format times for Flux query (RFC3339 format)
        const start = new Date(startTime).toISOString();
        const end = new Date(endTime).toISOString();
        
        // Calculate dynamic window period like Grafana (aim for ~3000 points)
        const timeDiffMs = new Date(endTime).getTime() - new Date(startTime).getTime();
        const targetPoints = 3000;
        const windowMs = Math.max(1000, Math.floor(timeDiffMs / targetPoints));
        
        // Convert to Flux duration format
        let windowPeriod;
        if (windowMs < 60000) {
            windowPeriod = `${Math.ceil(windowMs / 1000)}s`;
        } else if (windowMs < 3600000) {
            windowPeriod = `${Math.ceil(windowMs / 60000)}m`;
        } else {
            windowPeriod = `${Math.ceil(windowMs / 3600000)}h`;
        }
        
        console.log(`Querying GPS data from ${start} to ${end} with window ${windowPeriod}...`);
        
        // First, get GPS positions with dynamic downsampling
        const gpsQuery = `
            from(bucket: "${bucket}")
            |> range(start: time(v: "${start}"), stop: time(v: "${end}"))
            |> filter(fn: (r) => r._measurement == "seapath380")
            |> filter(fn: (r) => r._field == "Seapath_Latitude" or r._field == "Seapath_Longitude")
            |> aggregateWindow(every: ${windowPeriod}, fn: last, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        `;
        
        const gpsData = new Map();
        
        console.log(`Querying GPS data from ${start} to ${end}...`);
        
        for await (const { values, tableMeta } of queryApi.iterateRows(gpsQuery)) {
            const row = tableMeta.toObject(values);
            if (row.Seapath_Latitude && row.Seapath_Longitude && row._time) {
                const timeKey = new Date(row._time).toISOString();
                gpsData.set(timeKey, { lat: row.Seapath_Latitude, lon: row.Seapath_Longitude });
            }
        }
        
        if (gpsData.size === 0) {
            console.log(`No GPS data found for time range ${start} to ${end}`);
            return [];
        }
        
        console.log(`Retrieved ${gpsData.size} GPS positions for ${sensorType}`);
        
        // Now get sensor data with same dynamic downsampling
        const sensorQuery = `
            from(bucket: "${bucket}")
            |> range(start: time(v: "${start}"), stop: time(v: "${end}"))
            |> filter(fn: (r) => r._measurement == "${sensor.measurement}")
            |> filter(fn: (r) => r._field == "${sensor.field}")
            |> aggregateWindow(every: ${windowPeriod}, fn: last, createEmpty: false)
        `;
        
        const points = [];
        
        for await (const { values, tableMeta } of queryApi.iterateRows(sensorQuery)) {
            const row = tableMeta.toObject(values);
            
            if (row._value !== undefined && row._time) {
                const timeKey = new Date(row._time).toISOString();
                
                let gps = gpsData.get(timeKey);
                
                if (!gps) {
                    const sensorTime = new Date(row._time).getTime();
                    let closestGps = null;
                    let minDiff = 30000;
                    
                    for (const [gpsTimeKey, gpsPos] of gpsData.entries()) {
                        const gpsTime = new Date(gpsTimeKey).getTime();
                        const diff = Math.abs(sensorTime - gpsTime);
                        
                        if (diff < minDiff) {
                            minDiff = diff;
                            closestGps = gpsPos;
                        }
                    }
                    
                    gps = closestGps;
                }
                
                if (gps) {
                    points.push({
                        sensor: sensorType,
                        value: parseFloat(row._value),
                        unit: sensor.unit,
                        lat: gps.lat,
                        lon: gps.lon,
                        timestamp: row._time
                    });
                }
            }
        }
        
        console.log(`Retrieved ${points.length} ${sensorType} points with GPS positions`);
        return points;
    } catch (error) {
        console.error(`Error querying historical data for ${sensorType}:`, error);
        return [];
    }
}

// Query InfluxDB for historical data (hours back from now)
async function queryHistoricalData(sensorType, hoursBack = 24) {
    if (!queryApi) return [];
    
    const sensor = SENSORS[sensorType];
    const bucket = process.env.INFLUXDB_BUCKET || 'openrvdas';
    
    try {
        // Calculate dynamic window period (aim for ~3000 points)
        const timeDiffMs = hoursBack * 60 * 60 * 1000;
        const targetPoints = 3000;
        const windowMs = Math.max(1000, Math.floor(timeDiffMs / targetPoints));
        
        let windowPeriod;
        if (windowMs < 60000) {
            windowPeriod = `${Math.ceil(windowMs / 1000)}s`;
        } else if (windowMs < 3600000) {
            windowPeriod = `${Math.ceil(windowMs / 60000)}m`;
        } else {
            windowPeriod = `${Math.ceil(windowMs / 3600000)}h`;
        }
        
        console.log(`Querying GPS data for -${hoursBack}h with window ${windowPeriod}...`);
        
        // First, get GPS positions with dynamic downsampling
        const gpsQuery = `
            from(bucket: "${bucket}")
            |> range(start: -${hoursBack}h)
            |> filter(fn: (r) => r._measurement == "seapath380")
            |> filter(fn: (r) => r._field == "Seapath_Latitude" or r._field == "Seapath_Longitude")
            |> aggregateWindow(every: ${windowPeriod}, fn: last, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        `;
        
        const gpsData = new Map(); // timestamp (as string) -> {lat, lon}
        
        console.log(`Querying GPS data for -${hoursBack}h...`);
        
        for await (const { values, tableMeta } of queryApi.iterateRows(gpsQuery)) {
            const row = tableMeta.toObject(values);
            if (row.Seapath_Latitude && row.Seapath_Longitude && row._time) {
                const timeKey = new Date(row._time).toISOString();
                gpsData.set(timeKey, { lat: row.Seapath_Latitude, lon: row.Seapath_Longitude });
            }
        }
        
        if (gpsData.size === 0) {
            console.log(`No GPS data found for time range -${hoursBack}h`);
            return [];
        }
        
        console.log(`Retrieved ${gpsData.size} GPS positions for ${sensorType}`);
        
        // Now get sensor data with same dynamic downsampling
        const sensorQuery = `
            from(bucket: "${bucket}")
            |> range(start: -${hoursBack}h)
            |> filter(fn: (r) => r._measurement == "${sensor.measurement}")
            |> filter(fn: (r) => r._field == "${sensor.field}")
            |> aggregateWindow(every: ${windowPeriod}, fn: last, createEmpty: false)
        `;
        
        const points = [];
        
        for await (const { values, tableMeta } of queryApi.iterateRows(sensorQuery)) {
            const row = tableMeta.toObject(values);
            
            if (row._value !== undefined && row._time) {
                const timeKey = new Date(row._time).toISOString();
                
                // Match exact timestamp, or find closest GPS position within 30 seconds
                let gps = gpsData.get(timeKey);
                
                if (!gps) {
                    // Find closest GPS timestamp within 30 seconds
                    const sensorTime = new Date(row._time).getTime();
                    let closestGps = null;
                    let minDiff = 30000; // 30 seconds max
                    
                    for (const [gpsTimeKey, gpsPos] of gpsData.entries()) {
                        const gpsTime = new Date(gpsTimeKey).getTime();
                        const diff = Math.abs(sensorTime - gpsTime);
                        
                        if (diff < minDiff) {
                            minDiff = diff;
                            closestGps = gpsPos;
                        }
                    }
                    
                    gps = closestGps;
                }
                
                // Only include point if we found a GPS position within time tolerance
                if (gps) {
                    points.push({
                        sensor: sensorType,
                        value: parseFloat(row._value),
                        unit: sensor.unit,
                        lat: gps.lat,
                        lon: gps.lon,
                        timestamp: row._time
                    });
                }
            }
        }
        
        console.log(`Retrieved ${points.length} historical points for ${sensorType} with GPS coordinates`);
        return points;
    } catch (err) {
        console.error(`Error querying historical data for ${sensorType}:`, err.message);
        return [];
    }
}

// Current ship position for mock data
let currentShipPosition = { lat: 48.117300, lon: -11.516667 };

// Listen for ship GPS updates (from GPS server)
let shipGPSSocket = null;

function connectToShipGPS() {
    try {
        shipGPSSocket = new WebSocket('ws://localhost:8081');
        
        shipGPSSocket.on('open', () => {
            console.log('Connected to ship GPS server for position tracking');
        });
        
        shipGPSSocket.on('message', (data) => {
            try {
                const gpsData = JSON.parse(data);
                if (gpsData.lat && gpsData.lon) {
                    currentShipPosition = { lat: gpsData.lat, lon: gpsData.lon };
                }
            } catch (err) {
                // Ignore parse errors
            }
        });
        
        shipGPSSocket.on('error', (err) => {
            console.error('Ship GPS WebSocket error:', err.message);
        });
        
        shipGPSSocket.on('close', () => {
            console.log('Ship GPS WebSocket closed, will retry...');
            setTimeout(connectToShipGPS, 5000);
        });
    } catch (err) {
        console.error('Failed to connect to ship GPS:', err.message);
        setTimeout(connectToShipGPS, 5000);
    }
}

// Start GPS position tracking
connectToShipGPS();

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('Client connected to oceanographic data stream');
    clients.add(ws);
    
    // Send sensor definitions
    ws.send(JSON.stringify({
        type: 'config',
        sensors: SENSORS
    }));
    
    ws.on('message', async (message) => {
        try {
            const request = JSON.parse(message);
            
            if (request.type === 'subscribe') {
                // Client subscribing to real-time data for specific sensors
                ws.sensors = request.sensors || Object.keys(SENSORS);
                console.log(`Client subscribed to: ${ws.sensors.join(', ')}`);
            } else if (request.type === 'historical') {
                // Client requesting historical data for heatmap
                const sensorType = request.sensor;
                
                let historicalData;
                
                if (request.startTime && request.endTime) {
                    // Use actual time range
                    console.log(`Historical data requested: ${sensorType}, ${request.startTime} to ${request.endTime}`);
                    
                    if (USE_MOCK_DATA || !queryApi) {
                        const start = new Date(request.startTime);
                        const end = new Date(request.endTime);
                        const hoursBack = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60)));
                        historicalData = generateMockHistoricalData(sensorType, hoursBack);
                    } else {
                        historicalData = await queryHistoricalDataWithRange(sensorType, request.startTime, request.endTime);
                    }
                } else if (request.hours) {
                    // Legacy hours format
                    const hoursBack = request.hours;
                    console.log(`Historical data requested: ${sensorType}, ${hoursBack} hours`);
                    
                    if (USE_MOCK_DATA || !queryApi) {
                        historicalData = generateMockHistoricalData(sensorType, hoursBack);
                    } else {
                        historicalData = await queryHistoricalData(sensorType, hoursBack);
                    }
                } else {
                    // Default to 24 hours
                    const hoursBack = 24;
                    console.log(`Historical data requested: ${sensorType}, ${hoursBack} hours (default)`);
                    
                    if (USE_MOCK_DATA || !queryApi) {
                        historicalData = generateMockHistoricalData(sensorType, hoursBack);
                    } else {
                        historicalData = await queryHistoricalData(sensorType, hoursBack);
                    }
                }
                
                ws.send(JSON.stringify({
                    type: 'historical',
                    sensor: sensorType,
                    data: historicalData
                }));
            }
        } catch (err) {
            console.error('Message handling error:', err);
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
});

// Broadcast real-time data to subscribed clients
async function broadcastRealtimeData() {
    for (const sensorType of Object.keys(SENSORS)) {
        let reading;
        
        if (USE_MOCK_DATA || !queryApi) {
            reading = generateMockReading(sensorType, currentShipPosition);
        } else {
            reading = await queryRealtimeData(sensorType);
        }
        
        if (reading) {
            const message = JSON.stringify({
                type: 'realtime',
                data: reading
            });
            
            // Send to subscribed clients
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    if (!client.sensors || client.sensors.includes(sensorType)) {
                        client.send(message);
                    }
                }
            });
        }
    }
}

// Start broadcasting real-time data
const BROADCAST_INTERVAL = parseInt(process.env.QUERY_INTERVAL_MS) || 2000;
setInterval(broadcastRealtimeData, BROADCAST_INTERVAL);

// Start server
server.listen(PORT, () => {
    console.log(`Oceanographic Data Server running on port ${PORT}`);
    console.log(`Mode: ${USE_MOCK_DATA || !influxClient ? 'MOCK DATA' : 'INFLUXDB'}`);
    console.log(`WebSocket: ws://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log('\nSupported sensors:', Object.keys(SENSORS).join(', '));
});
