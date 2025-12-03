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
        name: 'Water Temperature',
        unit: '°C',
        measurement: 'tsg_temperature',
        field: 'value',
        color: '#fde724',
        colorScheme: VIRIDIS_COLORS,
        range: [0, 35]
    },
    salinity: {
        name: 'Salinity',
        unit: 'PSU',
        measurement: 'tsg_salinity',
        field: 'value',
        color: '#21918c',
        colorScheme: VIRIDIS_COLORS,
        range: [30, 40]
    },
    fluorescence: {
        name: 'Fluorescence',
        unit: 'mg/m³',
        measurement: 'fluorometer_chl',
        field: 'value',
        color: '#5ec962',
        colorScheme: VIRIDIS_COLORS,
        range: [0, 10]
    },
    oxygen: {
        name: 'Dissolved Oxygen',
        unit: 'mg/L',
        measurement: 'ctd_oxygen',
        field: 'value',
        color: '#3b528b',
        colorScheme: VIRIDIS_COLORS,
        range: [0, 12]
    },
    ph: {
        name: 'pH',
        unit: 'pH',
        measurement: 'ctd_ph',
        field: 'value',
        color: '#440154',
        colorScheme: VIRIDIS_COLORS,
        range: [7.5, 8.5]
    },
    turbidity: {
        name: 'Turbidity',
        unit: 'NTU',
        measurement: 'ctd_turbidity',
        field: 'value',
        color: '#21918c',
        colorScheme: VIRIDIS_COLORS,
        range: [0, 50]
    },
    chlorophyll: {
        name: 'Chlorophyll',
        unit: 'µg/L',
        measurement: 'fluorometer_chl_a',
        field: 'value',
        color: '#5ec962',
        colorScheme: VIRIDIS_COLORS,
        range: [0, 5]
    }
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
    
    // Flux query to get latest sensor reading with GPS coordinates
    // Assumes GPS data is in 'seapath_position' measurement
    const fluxQuery = `
        from(bucket: "${bucket}")
        |> range(start: -1m)
        |> filter(fn: (r) => r._measurement == "${sensor.measurement}")
        |> filter(fn: (r) => r._field == "${sensor.field}")
        |> last()
        |> yield(name: "sensor_data")
        
        gps = from(bucket: "${bucket}")
        |> range(start: -1m)
        |> filter(fn: (r) => r._measurement == "seapath_position")
        |> filter(fn: (r) => r._field == "latitude" or r._field == "longitude")
        |> last()
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> yield(name: "gps_data")
    `;
    
    try {
        const result = { sensor: sensorType, value: null, lat: null, lon: null, timestamp: null };
        
        for await (const { values, tableMeta } of queryApi.iterateRows(fluxQuery)) {
            const row = tableMeta.toObject(values);
            
            if (row._value !== undefined) {
                result.value = parseFloat(row._value);
                result.timestamp = row._time;
            }
            if (row.latitude !== undefined) result.lat = row.latitude;
            if (row.longitude !== undefined) result.lon = row.longitude;
        }
        
        if (result.value !== null && result.lat !== null && result.lon !== null) {
            result.unit = sensor.unit;
            return result;
        }
    } catch (err) {
        console.error(`Error querying InfluxDB for ${sensorType}:`, err.message);
    }
    
    return null;
}

// Query InfluxDB for historical data
async function queryHistoricalData(sensorType, hoursBack = 24) {
    if (!queryApi) return [];
    
    const sensor = SENSORS[sensorType];
    const bucket = process.env.INFLUXDB_BUCKET || 'openrvdas';
    
    // Flux query to join sensor data with GPS coordinates by timestamp
    const fluxQuery = `
        import "join"
        
        sensor = from(bucket: "${bucket}")
        |> range(start: -${hoursBack}h)
        |> filter(fn: (r) => r._measurement == "${sensor.measurement}")
        |> filter(fn: (r) => r._field == "${sensor.field}")
        
        gps = from(bucket: "${bucket}")
        |> range(start: -${hoursBack}h)
        |> filter(fn: (r) => r._measurement == "seapath_position")
        |> filter(fn: (r) => r._field == "latitude" or r._field == "longitude")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        
        join.time(left: sensor, right: gps, as: (l, r) => ({
            _time: l._time,
            value: l._value,
            lat: r.latitude,
            lon: r.longitude
        }), method: "inner")
        |> yield()
    `;
    
    try {
        const points = [];
        
        for await (const { values, tableMeta } of queryApi.iterateRows(fluxQuery)) {
            const row = tableMeta.toObject(values);
            
            if (row.value !== undefined && row.lat !== undefined && row.lon !== undefined) {
                points.push({
                    sensor: sensorType,
                    value: parseFloat(row.value),
                    unit: sensor.unit,
                    lat: row.lat,
                    lon: row.lon,
                    timestamp: row._time
                });
            }
        }
        
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
                const hoursBack = request.hours || 24;
                
                console.log(`Historical data requested: ${sensorType}, ${hoursBack} hours`);
                
                let historicalData;
                if (USE_MOCK_DATA || !queryApi) {
                    historicalData = generateMockHistoricalData(sensorType, hoursBack);
                } else {
                    historicalData = await queryHistoricalData(sensorType, hoursBack);
                }
                
                ws.send(JSON.stringify({
                    type: 'historical',
                    sensor: sensorType,
                    data: historicalData,
                    hours: hoursBack
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
