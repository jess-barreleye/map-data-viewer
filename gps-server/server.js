const dgram = require('dgram');
const { WebSocketServer } = require('ws');

// Configuration
const UDP_PORT_SHIP = parseInt(process.env.UDP_PORT_SHIP || '12345');
const UDP_PORT_ROV = parseInt(process.env.UDP_PORT_ROV || '12346');
const UDP_HOST = process.env.UDP_HOST || '0.0.0.0';
const WS_PORT_SHIP = parseInt(process.env.WS_PORT_SHIP || '8081');
const WS_PORT_ROV = parseInt(process.env.WS_PORT_ROV || '8082');

// Create UDP socket for receiving Seapath GPS data (ship)
const udpServerShip = dgram.createSocket('udp4');

// Create UDP socket for receiving ROV GPS data
const udpServerROV = dgram.createSocket('udp4');

// Create WebSocket servers for broadcasting to browser clients
const wssShip = new WebSocketServer({ port: WS_PORT_SHIP });
const wssROV = new WebSocketServer({ port: WS_PORT_ROV });

// Store connected clients
const clientsShip = new Set();
const clientsROV = new Set();

// Store latest GPS data for new clients
let latestGpsDataShip = {};
let latestGpsDataROV = {};

// NMEA sentence parser
function parseNMEA(sentence) {
    try {
        const parts = sentence.trim().split(',');
        const sentenceType = parts[0];

        // Parse GGA (Global Positioning System Fix Data)
        if (sentenceType.endsWith('GGA')) {
            const lat = parseCoordinate(parts[2], parts[3]);
            const lon = parseCoordinate(parts[4], parts[5]);
            const time = parts[1];
            const quality = parseInt(parts[6]);
            const satellites = parseInt(parts[7]);
            const altitude = parseFloat(parts[9]);

            if (isFinite(lat) && isFinite(lon)) {
                return {
                    type: 'GGA',
                    timestamp: new Date().toISOString(),
                    time,
                    lat,
                    lon,
                    quality,
                    satellites,
                    altitude
                };
            }
        }

        // Parse RMC (Recommended Minimum Specific GNSS Data)
        if (sentenceType.endsWith('RMC')) {
            const time = parts[1];
            const status = parts[2];
            const lat = parseCoordinate(parts[3], parts[4]);
            const lon = parseCoordinate(parts[5], parts[6]);
            const speed = parseFloat(parts[7]); // knots
            const course = parseFloat(parts[8]); // degrees
            const date = parts[9];

            if (status === 'A' && isFinite(lat) && isFinite(lon)) {
                return {
                    type: 'RMC',
                    timestamp: new Date().toISOString(),
                    time,
                    date,
                    lat,
                    lon,
                    speed,
                    course,
                    status
                };
            }
        }

        // Parse VTG (Course Over Ground and Ground Speed)
        if (sentenceType.endsWith('VTG')) {
            const courseTrue = parseFloat(parts[1]);
            const speedKnots = parseFloat(parts[5]);
            const speedKmh = parseFloat(parts[7]);

            return {
                type: 'VTG',
                timestamp: new Date().toISOString(),
                courseTrue,
                speedKnots,
                speedKmh
            };
        }

    } catch (err) {
        console.error('NMEA parse error:', err.message);
    }
    return null;
}

// Parse NMEA coordinate format (DDMM.MMMM) to decimal degrees
function parseCoordinate(coord, direction) {
    if (!coord || !direction) return NaN;
    
    const value = parseFloat(coord);
    const degrees = Math.floor(value / 100);
    const minutes = value - (degrees * 100);
    let decimal = degrees + (minutes / 60);
    
    if (direction === 'S' || direction === 'W') {
        decimal = -decimal;
    }
    
    return decimal;
}

// Handle Ship UDP messages
udpServerShip.on('message', (msg, rinfo) => {
    const data = msg.toString().trim();
    console.log(`[SHIP] Received UDP data from ${rinfo.address}:${rinfo.port} - ${data}`);
    
    // Split by line in case multiple sentences are sent together
    const sentences = data.split(/\r?\n/).filter(s => s.trim());
    
    sentences.forEach(sentence => {
        if (sentence.startsWith('$')) {
            console.log(`[SHIP] Parsing sentence: ${sentence}`);
            const parsed = parseNMEA(sentence);
            
            if (parsed) {
                console.log(`[SHIP] Parsed data:`, parsed);
                // Merge with latest data (combine GGA, RMC, VTG info)
                latestGpsDataShip = {
                    ...latestGpsDataShip,
                    ...parsed,
                    raw: sentence,
                    source: 'ship',
                    vehicle: 'Falkor-too',
                    receivedAt: new Date().toISOString()
                };
                
                // Broadcast to all connected WebSocket clients
                const message = JSON.stringify(latestGpsDataShip);
                clientsShip.forEach(client => {
                    if (client.readyState === 1) { // WebSocket.OPEN
                        client.send(message);
                    }
                });
                
                console.log(`[SHIP] GPS Update: ${parsed.type} - Lat: ${parsed.lat?.toFixed(6)}, Lon: ${parsed.lon?.toFixed(6)}`);
            }
        }
    });
});

// Handle ROV UDP messages
udpServerROV.on('message', (msg, rinfo) => {
    const data = msg.toString().trim();
    console.log(`[ROV] Received UDP data from ${rinfo.address}:${rinfo.port} - ${data}`);
    
    // Split by line in case multiple sentences are sent together
    const sentences = data.split(/\r?\n/).filter(s => s.trim());
    
    sentences.forEach(sentence => {
        if (sentence.startsWith('$')) {
            console.log(`[ROV] Parsing sentence: ${sentence}`);
            const parsed = parseNMEA(sentence);
            
            if (parsed) {
                console.log(`[ROV] Parsed data:`, parsed);
                // Merge with latest data (combine GGA, RMC, VTG info)
                latestGpsDataROV = {
                    ...latestGpsDataROV,
                    ...parsed,
                    raw: sentence,
                    source: 'rov',
                    vehicle: 'ROV',
                    receivedAt: new Date().toISOString()
                };
                
                // Broadcast to all connected WebSocket clients
                const message = JSON.stringify(latestGpsDataROV);
                clientsROV.forEach(client => {
                    if (client.readyState === 1) { // WebSocket.OPEN
                        client.send(message);
                    }
                });
                
                console.log(`[ROV] GPS Update: ${parsed.type} - Lat: ${parsed.lat?.toFixed(6)}, Lon: ${parsed.lon?.toFixed(6)}`);
            }
        }
    });
});

udpServerShip.on('error', (err) => {
    console.error('[SHIP] UDP Server error:', err);
});

udpServerShip.on('listening', () => {
    const address = udpServerShip.address();
    console.log(`[SHIP] UDP GPS Listener started on ${address.address}:${address.port}`);
});

udpServerROV.on('error', (err) => {
    console.error('[ROV] UDP Server error:', err);
});

udpServerROV.on('listening', () => {
    const address = udpServerROV.address();
    console.log(`[ROV] UDP GPS Listener started on ${address.address}:${address.port}`);
});

// WebSocket server handlers for Ship
wssShip.on('connection', (ws) => {
    console.log('[SHIP] WebSocket client connected');
    clientsShip.add(ws);
    
    // Send latest GPS data to new client
    if (Object.keys(latestGpsDataShip).length > 0) {
        ws.send(JSON.stringify(latestGpsDataShip));
    }
    
    ws.on('close', () => {
        console.log('[SHIP] WebSocket client disconnected');
        clientsShip.delete(ws);
    });
    
    ws.on('error', (err) => {
        console.error('[SHIP] WebSocket error:', err);
        clientsShip.delete(ws);
    });
});

// WebSocket server handlers for ROV
wssROV.on('connection', (ws) => {
    console.log('[ROV] WebSocket client connected');
    clientsROV.add(ws);
    
    // Send latest GPS data to new client
    if (Object.keys(latestGpsDataROV).length > 0) {
        ws.send(JSON.stringify(latestGpsDataROV));
    }
    
    ws.on('close', () => {
        console.log('[ROV] WebSocket client disconnected');
        clientsROV.delete(ws);
    });
    
    ws.on('error', (err) => {
        console.error('[ROV] WebSocket error:', err);
        clientsROV.delete(ws);
    });
});

// Start UDP servers
udpServerShip.bind(UDP_PORT_SHIP, UDP_HOST);
udpServerROV.bind(UDP_PORT_ROV, UDP_HOST);

console.log(`\n🌊 GPS Server Started`);
console.log(`═══════════════════════════════════════`);
console.log(`[SHIP] WebSocket: ws://localhost:${WS_PORT_SHIP}`);
console.log(`[SHIP] UDP Listener: ${UDP_HOST}:${UDP_PORT_SHIP}`);
console.log(`[ROV]  WebSocket: ws://localhost:${WS_PORT_ROV}`);
console.log(`[ROV]  UDP Listener: ${UDP_HOST}:${UDP_PORT_ROV}`);
console.log(`═══════════════════════════════════════`);
console.log('Supported NMEA sentences: GGA, RMC, VTG\n');
