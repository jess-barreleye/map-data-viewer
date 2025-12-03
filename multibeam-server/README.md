# Multibeam Swath Visualization Server

WebSocket server that streams real-time multibeam sonar swath coverage from Kongsberg systems (EM124, EM712, EM2040) to the frontend map viewer.

## Supported Systems

| System | Frequency | Depth Range | Swath Width | Application |
|--------|-----------|-------------|-------------|-------------|
| **EM 124** | 12 kHz | 20-11,000m | 150° | Deep water mapping |
| **EM 712** | 40/70 kHz | 3-3,000m | 140° | Mid-water mapping |
| **EM 2040** | 200/400 kHz | 0.5-600m | 130° | Shallow water/high-res |

## Features

- **Real-time swath polygons** showing current multibeam coverage footprint
- **Multi-system support** - displays all active systems simultaneously
- **Depth-adaptive** - automatically shows appropriate system(s) based on water depth
- **Color-coded visualization** - different colors for each system
- **InfluxDB integration** for production data
- **Mock data mode** for testing without InfluxDB
- **Dynamic swath calculation** based on ship position, heading, and depth

## How It Works

The server:
1. Receives ship position, heading, and water depth (from InfluxDB or mock data)
2. Determines which multibeam systems are active based on depth range
3. Calculates swath polygon geometry:
   - Swath width = depth × tan(beam_angle/2) × 2
   - Projects port/starboard coverage perpendicular to heading
   - Creates polygon showing coverage footprint
4. Broadcasts swath polygons via WebSocket to frontend

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_PORT_MULTIBEAM` | `8085` | WebSocket server port |
| `INFLUXDB_URL` | `http://localhost:8086` | InfluxDB server URL |
| `INFLUXDB_TOKEN` | - | InfluxDB authentication token |
| `INFLUXDB_ORG` | - | InfluxDB organization name |
| `INFLUXDB_BUCKET` | `multibeam-data` | InfluxDB bucket name |
| `QUERY_INTERVAL` | `1000` | Query frequency in ms |
| `USE_MOCK_DATA` | `true` | Use mock data mode |

## Running the Server

### Development (Mock Data)

```bash
npm install
npm run dev
```

### Production (InfluxDB)

1. Configure your InfluxDB credentials in `.env`
2. Set `USE_MOCK_DATA=false`
3. Start the server:
   ```bash
   npm start
   ```

### Docker

```bash
docker build -t multibeam-server .
docker run -p 8085:8085 --env-file .env multibeam-server
```

## InfluxDB Schema

The server expects the following schema (customizable in `server.js`):

**Measurement:** `multibeam`

**Fields:**
- `lat` (float) - Ship latitude
- `lon` (float) - Ship longitude  
- `heading` (float) - Ship heading in degrees
- `depth` (float) - Water depth in meters
- `system` (string) - System identifier (EM124, EM712, EM2040)

**Tags:**
- `system` - Multibeam system name (for filtering)

## WebSocket Protocol

### Connection

```javascript
const ws = new WebSocket('ws://localhost:8085');
```

### Message Format

The server sends JSON messages with swath data for all active systems:

```json
{
  "EM712": {
    "system": "EM712",
    "lat": 21.0123,
    "lon": -157.8456,
    "heading": 45.5,
    "depth": 450.2,
    "swathWidth": 1890.5,
    "polygon": [
      [-157.846, 21.013],
      [-157.847, 21.014],
      [-157.845, 21.015],
      [-157.844, 21.014],
      [-157.846, 21.013]
    ],
    "active": true,
    "timestamp": "2025-11-29T12:34:56.789Z"
  },
  "EM2040": {
    "system": "EM2040",
    ...
  }
}
```

### Health Check

```bash
curl http://localhost:8085/health
```

Response:
```json
{
  "status": "ok",
  "connections": 1,
  "mode": "mock",
  "systems": ["EM124", "EM712", "EM2040"]
}
```

### System Information

```bash
curl http://localhost:8085/systems
```

Returns specifications for all supported multibeam systems.

## Frontend Integration

The frontend displays swath polygons as semi-transparent colored overlays:
- **EM124**: Blue (deep water)
- **EM712**: Green (mid-water)
- **EM2040**: Yellow (shallow water)

Swaths update in real-time as the ship moves and depth changes.

## Customization

### Adding New Systems

Edit `MULTIBEAM_SYSTEMS` in `server.js`:

```javascript
const MULTIBEAM_SYSTEMS = {
    YOUR_SYSTEM: {
        name: 'System Name',
        frequency: '100 kHz',
        beamWidth: 120,
        minDepth: 10,
        maxDepth: 1000,
        description: 'Description'
    }
};
```

### Adjusting Swath Calculation

Modify the `calculateSwathPolygon()` function to:
- Change forward distance (currently 100m)
- Add beam steering angles
- Account for roll/pitch
- Use actual ping rate for segment length

## Troubleshooting

### Mock data not working
- Check console logs for errors
- Verify `USE_MOCK_DATA=true` in `.env`

### InfluxDB connection fails
- Verify credentials and connection
- Check InfluxDB health: `curl http://localhost:8086/health`
- Ensure InfluxDB client is installed

### Swaths not displaying
- Check WebSocket connection in browser console
- Verify server is running: `curl http://localhost:8085/health`
- Confirm ship depth is within system range
