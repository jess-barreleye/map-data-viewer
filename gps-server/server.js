const dgram = require('dgram');
const { WebSocketServer } = require('ws');

// Configuration
const UDP_PORT = parseInt(process.env.UDP_PORT || '12345');
const UDP_HOST = process.env.UDP_HOST || '0.0.0.0';
const WS_PORT = parseInt(process.env.WS_PORT || '8081');

// Create UDP socket for receiving Seapath GPS data
const udpServer = dgram.createSocket('udp4');

// Create WebSocket server for broadcasting to browser clients
const wss = new WebSocketServer({ port: WS_PORT });

// Store connected clients
const clients = new Set();

// Store latest GPS data for new clients
let latestGpsData = {};

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

// Handle UDP messages
udpServer.on('message', (msg, rinfo) => {
    const data = msg.toString().trim();
    console.log(`Received UDP data from ${rinfo.address}:${rinfo.port} - ${data}`);
    
    // Split by line in case multiple sentences are sent together
    const sentences = data.split(/\r?\n/).filter(s => s.trim());
    
    sentences.forEach(sentence => {
        if (sentence.startsWith('$')) {
            console.log(`Parsing sentence: ${sentence}`);
            const parsed = parseNMEA(sentence);
            
            if (parsed) {
                console.log(`Parsed data:`, parsed);
                // Merge with latest data (combine GGA, RMC, VTG info)
                latestGpsData = {
                    ...latestGpsData,
                    ...parsed,
                    raw: sentence,
                    source: 'seapath',
                    receivedAt: new Date().toISOString()
                };
                
                // Broadcast to all connected WebSocket clients
                const message = JSON.stringify(latestGpsData);
                clients.forEach(client => {
                    if (client.readyState === 1) { // WebSocket.OPEN
                        client.send(message);
                    }
                });
                
                console.log(`GPS Update: ${parsed.type} - Lat: ${parsed.lat?.toFixed(6)}, Lon: ${parsed.lon?.toFixed(6)}`);
            }
        }
    });
});

udpServer.on('error', (err) => {
    console.error('UDP Server error:', err);
});

udpServer.on('listening', () => {
    const address = udpServer.address();
    console.log(`UDP GPS Listener started on ${address.address}:${address.port}`);
});

// WebSocket server handlers
wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    clients.add(ws);
    
    // Send latest GPS data to new client
    if (Object.keys(latestGpsData).length > 0) {
        ws.send(JSON.stringify(latestGpsData));
    }
    
    ws.on('close', () => {
        console.log('WebSocket client disconnected');
        clients.delete(ws);
    });
    
    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        clients.delete(ws);
    });
});

// Start UDP server
udpServer.bind(UDP_PORT, UDP_HOST);

console.log(`WebSocket server started on ws://localhost:${WS_PORT}`);
console.log(`Waiting for Seapath GPS data on UDP ${UDP_HOST}:${UDP_PORT}...`);
console.log('Supported NMEA sentences: GGA, RMC, VTG');
