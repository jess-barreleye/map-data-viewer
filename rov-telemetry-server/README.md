# ROV Telemetry Server

WebSocket server that streams ROV telemetry data (depth, heading, altitude, pitch, roll) from InfluxDB to the frontend.

## Features

- **Real-time telemetry streaming** via WebSocket
- **InfluxDB integration** for production data
- **Mock data mode** for testing without InfluxDB
- **Automatic client management** - starts/stops querying based on connected clients
- **Health check endpoint** for monitoring

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_PORT_TELEMETRY` | `8084` | WebSocket server port |
| `INFLUXDB_URL` | `http://localhost:8086` | InfluxDB server URL |
| `INFLUXDB_TOKEN` | - | InfluxDB authentication token |
| `INFLUXDB_ORG` | - | InfluxDB organization name |
| `INFLUXDB_BUCKET` | `rov-data` | InfluxDB bucket name |
| `QUERY_INTERVAL` | `1000` | How often to query InfluxDB (ms) |
| `USE_MOCK_DATA` | `true` | Use mock data instead of InfluxDB |

## Running the Server

### Development (Mock Data)

```bash
npm install
npm run dev
```

### Production (InfluxDB)

1. Configure your InfluxDB credentials in `.env`
2. Set `USE_MOCK_DATA=false`
3. Install the InfluxDB client (if not already installed):
   ```bash
   npm install @influxdata/influxdb-client
   ```
4. Start the server:
   ```bash
   npm start
   ```

### Docker

```bash
docker build -t rov-telemetry-server .
docker run -p 8084:8084 --env-file .env rov-telemetry-server
```

## InfluxDB Schema

The server expects the following InfluxDB schema (adjust in `server.js` if needed):

**Measurement:** `rov_telemetry`

**Fields:**
- `depth` (float) - ROV depth in meters
- `heading` (float) - ROV heading in degrees (0-360)
- `altitude` (float) - Altitude above seafloor in meters
- `pitch` (float) - Pitch angle in degrees
- `roll` (float) - Roll angle in degrees

**Example InfluxDB Line Protocol:**
```
rov_telemetry depth=45.2,heading=127.5,altitude=3.8,pitch=2.1,roll=-1.3 1638360000000000000
```

## WebSocket Protocol

### Connection

```javascript
const ws = new WebSocket('ws://localhost:8084');
```

### Message Format

The server sends JSON messages with the following structure:

```json
{
  "depth": 45.2,
  "heading": 127.5,
  "altitude": 3.8,
  "pitch": 2.1,
  "roll": -1.3,
  "timestamp": "2025-11-29T12:34:56.789Z"
}
```

### Health Check

```bash
curl http://localhost:8084/health
```

Response:
```json
{
  "status": "ok",
  "connections": 1,
  "mode": "mock"
}
```

## Integration with Frontend

The frontend automatically connects to this server when the ROV GPS feed is active. See the main `index.html` for implementation details.

## Customization

### Adjusting InfluxDB Query

If your InfluxDB schema differs, modify the query in `server.js`:

```javascript
const query = `
    from(bucket: "${INFLUXDB_BUCKET}")
        |> range(start: -10s)
        |> filter(fn: (r) => r["_measurement"] == "your_measurement_name")
        |> filter(fn: (r) => r["_field"] == "your_field_names")
        |> last()
`;
```

### Adding More Telemetry Fields

1. Update the query to include additional fields
2. Add fields to the result object in `queryInfluxDB()`
3. Update mock data generator if needed
4. Modify frontend to display new fields

## Troubleshooting

### Mock data not working
- Check console logs for errors
- Verify `USE_MOCK_DATA=true` in `.env`

### InfluxDB connection fails
- Verify InfluxDB URL, token, org, and bucket
- Check InfluxDB server is running: `curl http://localhost:8086/health`
- Ensure InfluxDB client is installed: `npm install @influxdata/influxdb-client`

### No data received in frontend
- Check WebSocket connection in browser console
- Verify server is running: `curl http://localhost:8084/health`
- Check CORS settings if accessing from different domain
