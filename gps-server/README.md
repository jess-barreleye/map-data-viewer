# GPS Server - Dual GPS Feed (Ship & ROV)

Real-time GPS tracking server that receives NMEA sentences via UDP and broadcasts position data to browser clients via WebSocket. Supports simultaneous tracking of both the ship (Falkor-too) and ROV.

## Features

- **Dual GPS feeds**: Separate UDP/WebSocket ports for ship and ROV
- **NMEA parsing**: Supports GGA, RMC, and VTG sentence types
- **Real-time streaming**: WebSocket broadcasts to all connected clients
- **Coordinate conversion**: NMEA format (DDMM.MMMM) to decimal degrees
- **Connection persistence**: Stores latest GPS data for new clients
- **Auto-reconnection**: Clients automatically reconnect on disconnect

## Architecture

```
Ship (Seapath) → UDP (12345) → GPS Server → WebSocket (8081) → Browser
ROV Navigation → UDP (12346) → GPS Server → WebSocket (8082) → Browser
```

## Quick Start

### 1. Install Dependencies

```bash
cd gps-server
npm install
```

### 2. Start the GPS Server

```bash
node server.js
```

Expected output:
```
🌊 GPS Server Started
═══════════════════════════════════════
[SHIP] WebSocket: ws://localhost:8081
[SHIP] UDP Listener: 0.0.0.0:12345
[ROV]  WebSocket: ws://localhost:8082
[ROV]  UDP Listener: 0.0.0.0:12346
═══════════════════════════════════════
Supported NMEA sentences: GGA, RMC, VTG
```

### 3. Send Test GPS Data

**Option A: Using test scripts (Recommended)**

```bash
# Terminal 2: Send ship GPS test data
node test-ship-gps.js

# Terminal 3: Send ROV GPS test data
node test-rov-gps.js
```

**Option B: Using netcat (manual)**

```bash
# Ship GPS (port 12345)
echo '$GPRMC,123519,A,4807.038,N,01131.000,W,022.4,084.4,230394,003.1,W*6A' | nc -u localhost 12345

# ROV GPS (port 12346)
echo '$GPGGA,123519,4807.100,N,01131.100,W,1,08,0.9,545.4,M,46.9,M,,*47' | nc -u localhost 12346
```

**Option C: Using test-gps.js (legacy ship test)**

```bash
node test-gps.js
```

### 4. View on Map

Open the map viewer at **http://localhost:8000**

You should see:
- **Ship**: Red vessel marker with Falkor-too icon
- **ROV**: Green vehicle marker with ROV icon
- Both with heading arrows and colored track trails

## Test Scripts

### test-ship-gps.js

Sends realistic ship GPS data to port 12345 with:
- Moving position (simulates ship movement)
- Speed: 10 knots
- Course: 045° (Northeast)
- Sends every 1 second

**Usage:**
```bash
node test-ship-gps.js
```

**Sample output:**
```
🚢 Ship GPS Test Data Generator
═══════════════════════════════════════
Sending to: localhost:12345
Update interval: 1000ms
═══════════════════════════════════════

[Ship] Sent: $GPRMC,123519,A,4807.038,N,01131.000,W,10.0,045.0,291125,003.1,W*XX
[Ship] Sent: $GPGGA,123519,4807.038,N,01131.000,W,1,08,0.9,10.0,M,46.9,M,,*XX
[Ship] Position: 48.1173°N, 11.5167°W | Speed: 10.0 knots | Course: 45.0°
```

### test-rov-gps.js

Sends realistic ROV GPS data to port 12346 with:
- Moving position (simulates ROV movement)
- Speed: 2 knots (slower than ship)
- Course: 090° (East)
- Sends every 1 second

**Usage:**
```bash
node test-rov-gps.js
```

**Sample output:**
```
🤖 ROV GPS Test Data Generator
═══════════════════════════════════════
Sending to: localhost:12346
Update interval: 1000ms
═══════════════════════════════════════

[ROV] Sent: $GPRMC,123520,A,4807.100,N,01131.100,W,2.0,090.0,291125,003.1,W*XX
[ROV] Sent: $GPGGA,123520,4807.100,N,01131.100,W,1,08,0.9,545.4,M,46.9,M,,*XX
[ROV] Position: 48.1183°N, 11.5183°W | Speed: 2.0 knots | Course: 90.0°
```

### test-gps.js (Legacy)

Original ship GPS test script. Equivalent to `test-ship-gps.js`.

**Usage:**
```bash
node test-gps.js
```

## Configuration

Environment variables (optional, defaults shown):

```bash
# Ship GPS
UDP_PORT_SHIP=12345        # UDP port for ship NMEA input
WS_PORT_SHIP=8081          # WebSocket port for ship browser clients

# ROV GPS
UDP_PORT_ROV=12346         # UDP port for ROV NMEA input
WS_PORT_ROV=8082           # WebSocket port for ROV browser clients

# Network
UDP_HOST=0.0.0.0           # UDP bind address (0.0.0.0 = all interfaces)
```

**Example with custom ports:**
```bash
UDP_PORT_SHIP=5000 WS_PORT_SHIP=9000 node server.js
```

## Supported NMEA Sentences

### GGA - Global Positioning System Fix Data
```
$GPGGA,123519,4807.038,N,01131.000,W,1,08,0.9,545.4,M,46.9,M,,*47
```
**Parsed fields:**
- Time: 12:35:19 UTC
- Position: 48°07.038'N, 11°31.000'W → 48.1173°N, 11.5167°W
- Quality: 1 (GPS fix)
- Satellites: 8
- HDOP: 0.9
- Altitude: 545.4m

### RMC - Recommended Minimum Specific GNSS Data
```
$GPRMC,123519,A,4807.038,N,01131.000,W,022.4,084.4,230394,003.1,W*6A
```
**Parsed fields:**
- Time: 12:35:19 UTC
- Status: A (Active/Valid)
- Position: 48°07.038'N, 11°31.000'W → 48.1173°N, 11.5167°W
- Speed: 22.4 knots
- Course: 84.4° (East)
- Date: 23/03/1994

### VTG - Course Over Ground and Ground Speed
```
$GPVTG,054.7,T,034.4,M,005.5,N,010.2,K*48
```
**Parsed fields:**
- True track: 54.7°
- Magnetic track: 34.4°
- Speed: 5.5 knots / 10.2 km/h

## Connecting Production Navigation Systems

### Ship (Seapath)

Configure your Seapath navigation system to transmit NMEA sentences via UDP:

**Settings:**
- **Protocol**: UDP
- **Host**: Your server's IP address (use `ipconfig getifaddr en0` on macOS or `hostname -I` on Linux)
- **Port**: 12345
- **Sentences**: GGA, RMC, VTG (recommended)
- **Rate**: 1 Hz (1 update per second)

### ROV Navigation

Configure your ROV navigation system similarly:

**Settings:**
- **Protocol**: UDP
- **Host**: Your server's IP address
- **Port**: 12346
- **Sentences**: GGA, RMC, VTG (recommended)
- **Rate**: 1 Hz

## Testing with netcat

Send individual NMEA sentences manually:

```bash
# Ship position update
echo '$GPRMC,123519,A,4807.038,N,01131.000,W,022.4,084.4,230394,003.1,W*6A' | nc -u localhost 12345

# ROV position update
echo '$GPGGA,123520,4807.100,N,01131.100,W,1,08,0.9,545.4,M,46.9,M,,*47' | nc -u localhost 12346

# Ship with speed and course
echo '$GPVTG,054.7,T,034.4,M,005.5,N,010.2,K*48' | nc -u localhost 12345
```

## WebSocket Client Example

Connect to the GPS server from JavaScript:

```javascript
// Ship GPS
const shipWs = new WebSocket('ws://localhost:8081');
shipWs.onmessage = (event) => {
  const gpsData = JSON.parse(event.data);
  console.log('Ship:', gpsData.lat, gpsData.lon, gpsData.course, gpsData.speed);
};

// ROV GPS
const rovWs = new WebSocket('ws://localhost:8082');
rovWs.onmessage = (event) => {
  const gpsData = JSON.parse(event.data);
  console.log('ROV:', gpsData.lat, gpsData.lon, gpsData.course, gpsData.speed);
};
```

**GPS Data Format:**
```json
{
  "lat": 48.1173,
  "lon": -11.5167,
  "course": 84.4,
  "speed": 22.4,
  "altitude": 545.4,
  "satellites": 8,
  "quality": 1,
  "timestamp": "2024-11-29T12:35:19.000Z"
}
```

## Troubleshooting

### No GPS data appearing on map

1. **Check server is running:**
   ```bash
   lsof -i :8081 -i :8082
   ```
   Should show `node` processes on both ports.

2. **Check UDP ports are receiving data:**
   ```bash
   # Listen for ship GPS packets
   nc -ul 12345
   
   # Listen for ROV GPS packets
   nc -ul 12346
   ```

3. **Verify WebSocket connections:**
   Open browser console at http://localhost:8000 and look for:
   ```
   [Ship GPS] Connected to ws://localhost:8081
   [ROV GPS] Connected to ws://localhost:8082
   ```

4. **Test with provided scripts:**
   ```bash
   node test-ship-gps.js
   node test-rov-gps.js
   ```
   You should see position updates in the script output.

### Port already in use

Kill existing processes:
```bash
# Kill ship GPS WebSocket (8081)
lsof -ti :8081 | xargs kill -9

# Kill ROV GPS WebSocket (8082)
lsof -ti :8082 | xargs kill -9

# Kill ship UDP (12345)
lsof -ti udp:12345 | xargs kill -9

# Kill ROV UDP (12346)
lsof -ti udp:12346 | xargs kill -9
```

### NMEA checksum errors

The test scripts automatically calculate NMEA checksums. If sending manual sentences, ensure:
- Checksum is 2-digit hex XOR of all characters between `$` and `*`
- Sentence ends with `*XX` where XX is the checksum
- No spaces or extra characters

## Docker

The GPS server is included in the main `docker-compose.yml`:

```bash
# Start GPS server with Docker
cd ..
docker-compose up -d gps-server

# View logs
docker-compose logs -f gps-server

# Restart
docker-compose restart gps-server
```

## Files

- `server.js` - Main GPS server (both ship and ROV)
- `test-ship-gps.js` - Ship GPS test data generator
- `test-rov-gps.js` - ROV GPS test data generator
- `test-gps.js` - Legacy ship GPS test (equivalent to test-ship-gps.js)
- `package.json` - Dependencies (ws)
- `.env.example` - Environment variable template

## Dependencies

- **ws** (^8.14.2) - WebSocket server library
- **dgram** (Node.js built-in) - UDP socket support

Install with:
```bash
npm install
```

## API Reference

### UDP Input (NMEA)

**Ship GPS:**
- Port: 12345
- Format: NMEA 0183 sentences (GGA, RMC, VTG)
- Protocol: UDP

**ROV GPS:**
- Port: 12346
- Format: NMEA 0183 sentences (GGA, RMC, VTG)
- Protocol: UDP

### WebSocket Output (JSON)

**Ship GPS:**
- URL: `ws://localhost:8081`
- Format: JSON GPS data
- Update rate: Real-time (as NMEA sentences arrive)

**ROV GPS:**
- URL: `ws://localhost:8082`
- Format: JSON GPS data
- Update rate: Real-time (as NMEA sentences arrive)

**Message format:**
```json
{
  "lat": 48.1173,           // Latitude in decimal degrees
  "lon": -11.5167,          // Longitude in decimal degrees
  "course": 84.4,           // True course in degrees (0-360)
  "speed": 22.4,            // Speed in knots
  "altitude": 545.4,        // Altitude in meters (from GGA)
  "satellites": 8,          // Number of satellites (from GGA)
  "quality": 1,             // GPS quality indicator (from GGA)
  "timestamp": "2024-11-29T12:35:19.000Z"  // ISO 8601 timestamp
}
```

## License

Part of the MapLibre ROV visualization project.
