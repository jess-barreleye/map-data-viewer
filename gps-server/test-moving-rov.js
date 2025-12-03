const dgram = require('dgram');

// Configuration
const UDP_HOST = 'localhost';
const UDP_PORT = 12346; // ROV GPS port

// Starting position (slightly offset from ship)
let lat = 48.118000; // Start a bit north of ship
let lon = -11.517000; // Start a bit west of ship
const heading = 135.0; // Southeast heading (different from ship)
const speed = 2.0; // 2 knots (slower than ship)

// Calculate NMEA checksum
function calculateChecksum(sentence) {
    let checksum = 0;
    for (let i = 1; i < sentence.length; i++) {
        checksum ^= sentence.charCodeAt(i);
    }
    return checksum.toString(16).toUpperCase().padStart(2, '0');
}

// Convert decimal degrees to NMEA format (DDMM.MMMM)
function toNMEA(decimal, isLongitude) {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutes = (absolute - degrees) * 60;
    const formatted = isLongitude 
        ? `${degrees.toString().padStart(3, '0')}${minutes.toFixed(4).padStart(7, '0')}`
        : `${degrees.toString().padStart(2, '0')}${minutes.toFixed(4).padStart(7, '0')}`;
    return formatted;
}

// Send GPS position via UDP
function sendGPS() {
    const client = dgram.createSocket('udp4');
    
    // Format time as HHMMSS
    const now = new Date();
    const time = now.getUTCHours().toString().padStart(2, '0') +
                 now.getUTCMinutes().toString().padStart(2, '0') +
                 now.getUTCSeconds().toString().padStart(2, '0');
    
    // Format date as DDMMYY
    const date = now.getUTCDate().toString().padStart(2, '0') +
                 (now.getUTCMonth() + 1).toString().padStart(2, '0') +
                 now.getUTCFullYear().toString().substr(2, 2);
    
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    const latNMEA = toNMEA(lat, false);
    const lonNMEA = toNMEA(lon, true);
    
    // Create RMC sentence (includes position, speed, and course)
    const rmcData = `GPRMC,${time},A,${latNMEA},${latDir},${lonNMEA},${lonDir},${speed.toFixed(1)},${heading.toFixed(1)},${date},003.1,W`;
    const rmcChecksum = calculateChecksum(rmcData);
    const rmcSentence = `$${rmcData}*${rmcChecksum}`;
    
    // Send the sentence
    const message = Buffer.from(rmcSentence);
    client.send(message, UDP_PORT, UDP_HOST, (err) => {
        if (err) {
            console.error('[ROV] Error sending GPS data:', err);
        } else {
            console.log(`[ROV] Sent: ${rmcSentence}`);
            console.log(`[ROV]   Position: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
            console.log(`[ROV]   Heading: ${heading}°, Speed: ${speed} knots`);
        }
        client.close();
    });
    
    // Update position for next iteration (move ROV along heading)
    // Distance = speed (knots) * time (1 second) * conversion factor
    // 1 knot = 1 nautical mile/hour = 1852 meters/hour = 0.514444 m/s
    const distanceMeters = speed * 0.514444; // Distance moved in 1 second
    
    // Convert heading to radians
    const headingRad = heading * Math.PI / 180;
    
    // Calculate new position using simple flat-earth approximation (good for short distances)
    const R = 6371000; // Earth radius in meters
    const dLat = (distanceMeters * Math.cos(headingRad)) / R;
    const dLon = (distanceMeters * Math.sin(headingRad)) / (R * Math.cos(lat * Math.PI / 180));
    
    lat += dLat * 180 / Math.PI;
    lon += dLon * 180 / Math.PI;
}

// Send GPS data every 1 second
console.log('🤖 Starting ROV GPS simulator...');
console.log(`Initial position: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
console.log(`Heading: ${heading}°, Speed: ${speed} knots`);
console.log(`Sending to ${UDP_HOST}:${UDP_PORT}`);
console.log('Press Ctrl+C to stop\n');

sendGPS(); // Send immediately
setInterval(sendGPS, 1000); // Then every second
