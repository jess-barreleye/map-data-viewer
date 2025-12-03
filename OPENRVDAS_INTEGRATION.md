# OpenRVDAS Integration Guide

## Overview

This MapLibre visualization system integrates with Schmidt Ocean Institute's shipboard OpenRVDAS (Open Research Vessel Data Acquisition System) to display real-time and historical oceanographic data as interactive heatmaps.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   OpenRVDAS     │────────▶│    InfluxDB      │────────▶│  Oceanographic  │
│  (Shipboard)    │         │   Time Series    │         │     Server      │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                                                    │
                                                                    │ WebSocket
                                                                    ▼
                            ┌──────────────────┐         ┌─────────────────┐
                            │   Seapath GPS    │────────▶│   GPS Server    │
                            │   (NMEA Feed)    │         │                 │
                            └──────────────────┘         └─────────────────┘
                                                                    │
                                                                    │
                                                                    ▼
                                                          ┌─────────────────┐
                                                          │  MapLibre GL    │
                                                          │   Frontend      │
                                                          │  (Heatmaps)     │
                                                          └─────────────────┘
```

## Data Flow

### 1. Data Acquisition (OpenRVDAS)

OpenRVDAS collects sensor data from various instruments:
- **TSG (Thermosalinograph)**: Temperature, Salinity
- **CTD**: Dissolved Oxygen, pH, Turbidity
- **Fluorometer**: Fluorescence, Chlorophyll
- **Seapath**: GPS position (latitude, longitude, heading)

### 2. Data Storage (InfluxDB)

OpenRVDAS writes measurements to InfluxDB with:
- **Measurement**: Sensor type (e.g., `tsg_temperature`)
- **Field**: Sensor value (e.g., `value: 15.2`)
- **Timestamp**: UTC timestamp from data logger
- **Tags**: Instrument ID, quality flags

### 3. Spatial Correlation

The oceanographic server:
1. Queries sensor data from InfluxDB
2. Queries GPS position data from Seapath
3. Joins data by timestamp to create spatially-referenced points
4. Streams to frontend via WebSocket

### 4. Visualization (MapLibre)

Frontend displays:
- **Real-time data**: Live sensor readings as they arrive
- **Historical data**: Heatmaps showing patterns over time (1-48 hours)
- **Interactive controls**: Toggle sensors, adjust opacity, change time range

## InfluxDB Schema

### Sensor Measurements

Expected InfluxDB schema for sensor data:

```
Measurement: tsg_temperature
  Fields:
    - value: float (°C)
  Tags:
    - instrument_id: string (e.g., "SBE45")
    - quality_flag: string (e.g., "good", "suspect", "bad")
  Time: UTC timestamp

Measurement: tsg_salinity
  Fields:
    - value: float (PSU - Practical Salinity Units)
  Tags:
    - instrument_id: string
    - quality_flag: string
  Time: UTC timestamp

Measurement: fluorometer_chl
  Fields:
    - value: float (mg/m³)
  Tags:
    - instrument_id: string
  Time: UTC timestamp

Measurement: ctd_oxygen
  Fields:
    - value: float (mg/L)
  Tags:
    - instrument_id: string
    - quality_flag: string
  Time: UTC timestamp

Measurement: ctd_ph
  Fields:
    - value: float (pH units)
  Tags:
    - instrument_id: string
    - quality_flag: string
  Time: UTC timestamp

Measurement: ctd_turbidity
  Fields:
    - value: float (NTU - Nephelometric Turbidity Units)
  Tags:
    - instrument_id: string
  Time: UTC timestamp

Measurement: fluorometer_chl_a
  Fields:
    - value: float (µg/L)
  Tags:
    - instrument_id: string
  Time: UTC timestamp
```

### GPS Position Measurement

```
Measurement: seapath_position
  Fields:
    - latitude: float (decimal degrees)
    - longitude: float (decimal degrees)
    - heading: float (degrees, 0-360)
  Tags:
    - device_id: string (e.g., "seapath_320")
  Time: UTC timestamp
```

## Flux Query Examples

### Real-time Data with GPS

```flux
import "join"

// Get latest temperature reading
sensor = from(bucket: "openrvdas")
  |> range(start: -1m)
  |> filter(fn: (r) => r._measurement == "tsg_temperature")
  |> filter(fn: (r) => r._field == "value")
  |> last()

// Get latest GPS position
gps = from(bucket: "openrvdas")
  |> range(start: -1m)
  |> filter(fn: (r) => r._measurement == "seapath_position")
  |> filter(fn: (r) => r._field == "latitude" or r._field == "longitude")
  |> last()
  |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")

// Join by timestamp
join.time(left: sensor, right: gps, as: (l, r) => ({
    _time: l._time,
    value: l._value,
    lat: r.latitude,
    lon: r.longitude
}), method: "inner")
```

### Historical Data for Heatmap

```flux
import "join"

// Get 24 hours of temperature data
sensor = from(bucket: "openrvdas")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "tsg_temperature")
  |> filter(fn: (r) => r._field == "value")
  |> filter(fn: (r) => r.quality_flag == "good")  // Filter by quality

// Get GPS positions for same time range
gps = from(bucket: "openrvdas")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "seapath_position")
  |> filter(fn: (r) => r._field == "latitude" or r._field == "longitude")
  |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")

// Join and create spatial dataset
join.time(left: sensor, right: gps, as: (l, r) => ({
    _time: l._time,
    value: l._value,
    lat: r.latitude,
    lon: r.longitude
}), method: "inner")
|> yield()
```

## Configuration Steps

### 1. OpenRVDAS Configuration

Ensure your OpenRVDAS loggers are configured to write to InfluxDB:

**Example Logger Config** (`/opt/openrvdas/local/devices.yaml`):

```yaml
devices:
  - device: Seapath
    loggers:
      - name: SeapathLogger
        readers:
          - class: SerialReader
            kwargs:
              baudrate: 9600
              port: /dev/ttyUSB0
        transforms:
          - class: ParseNMEATransform
        writers:
          - class: InfluxDBWriter
            kwargs:
              url: http://localhost:8086
              token: ${INFLUXDB_TOKEN}
              org: schmidt-ocean
              bucket: openrvdas
              measurement: seapath_position

  - device: TSG
    loggers:
      - name: TSGLogger
        readers:
          - class: SerialReader
            kwargs:
              baudrate: 9600
              port: /dev/ttyUSB1
        transforms:
          - class: ParseSBE45Transform
        writers:
          - class: InfluxDBWriter
            kwargs:
              url: http://localhost:8086
              token: ${INFLUXDB_TOKEN}
              org: schmidt-ocean
              bucket: openrvdas
              measurement: tsg_temperature
```

### 2. InfluxDB Setup

Create bucket and retention policy:

```bash
# Create bucket
influx bucket create \
  --name openrvdas \
  --org schmidt-ocean \
  --retention 30d

# Create token with read access
influx auth create \
  --org schmidt-ocean \
  --read-bucket openrvdas \
  --description "MapLibre visualization token"
```

### 3. Oceanographic Server Configuration

Create `.env` file in `oceanographic-server/`:

```bash
INFLUXDB_URL=http://shipboard-influxdb:8086
INFLUXDB_TOKEN=your-actual-token-here
INFLUXDB_ORG=schmidt-ocean
INFLUXDB_BUCKET=openrvdas

PORT=8086
USE_MOCK_DATA=false
QUERY_INTERVAL_MS=2000
HISTORICAL_RANGE_HOURS=24
```

### 4. Network Configuration

Ensure connectivity between components:

```bash
# Allow oceanographic server to access InfluxDB
firewall-cmd --add-port=8086/tcp --permanent

# Allow frontend to access WebSocket
firewall-cmd --add-port=8086/tcp --permanent

# Reload firewall
firewall-cmd --reload
```

## Data Quality Considerations

### Timestamp Synchronization

**Critical**: Ensure all systems use synchronized time (NTP):

```bash
# On shipboard systems
systemctl status chronyd
timedatectl status
```

GPS timestamps and sensor timestamps must align for proper spatial correlation.

### Quality Filtering

Filter data by quality flags in Flux queries:

```flux
|> filter(fn: (r) => r.quality_flag == "good")
```

### Data Gaps

Handle gaps in GPS or sensor data:
- Server interpolates position if GPS dropout < 10 seconds
- Missing sensor values are excluded from heatmap
- Frontend shows "Last update" timestamp to indicate data freshness

## Troubleshooting

### No Data Displayed

1. **Check InfluxDB connectivity:**
   ```bash
   curl http://localhost:8086/health
   ```

2. **Verify data is being logged:**
   ```bash
   influx query 'from(bucket:"openrvdas") |> range(start: -5m) |> count()'
   ```

3. **Check server logs:**
   ```bash
   docker-compose logs oceanographic-server
   ```

### GPS Coordinates Missing

1. **Verify Seapath data in InfluxDB:**
   ```bash
   influx query 'from(bucket:"openrvdas") 
     |> range(start: -5m) 
     |> filter(fn: (r) => r._measurement == "seapath_position")'
   ```

2. **Check timestamp alignment:**
   - Sensor and GPS timestamps should be within seconds of each other
   - Use NTP to synchronize clocks

### Performance Issues

1. **Reduce time range:**
   - Use shorter historical periods (1-6 hours)
   - Frontend limits to 1000 points per sensor

2. **Add downsampling:**
   ```flux
   |> aggregateWindow(every: 10s, fn: mean)
   ```

3. **Check query performance:**
   ```bash
   influx query --profilers query,operator 'your-query'
   ```

## Testing

### Mock Data Mode

Test without OpenRVDAS:

```bash
cd oceanographic-server
USE_MOCK_DATA=true npm start
```

### Send Test Data to InfluxDB

```bash
# Write test temperature reading
influx write \
  --bucket openrvdas \
  --org schmidt-ocean \
  --precision s \
  "tsg_temperature,instrument_id=test value=15.2 $(date +%s)"

# Write test GPS position
influx write \
  --bucket openrvdas \
  --org schmidt-ocean \
  --precision s \
  "seapath_position latitude=48.117,longitude=-11.517,heading=84.4 $(date +%s)"
```

## Production Deployment

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# Check oceanographic server
docker-compose logs -f oceanographic-server
```

### Environment Variables

Production `.env`:

```bash
INFLUXDB_URL=http://shipboard-influxdb.local:8086
INFLUXDB_TOKEN=<secure-token>
INFLUXDB_ORG=schmidt-ocean
INFLUXDB_BUCKET=openrvdas
USE_MOCK_DATA=false
```

### Monitoring

Check health endpoint:

```bash
curl http://localhost:8086/health
```

Expected response:
```json
{
  "status": "ok",
  "mode": "influxdb",
  "timestamp": "2024-03-15T12:34:56.789Z"
}
```

## Data Retention

Configure InfluxDB retention policies based on storage capacity:

```bash
# 7 days full resolution
influx bucket create --name openrvdas-full --retention 7d

# 30 days downsampled (1 minute averages)
influx bucket create --name openrvdas-downsampled --retention 30d

# Create continuous query for downsampling
influx task create --file downsample-task.flux
```

## Support

For issues specific to:
- **OpenRVDAS**: Contact shore-side support
- **InfluxDB**: Check InfluxDB documentation
- **MapLibre visualization**: Check application logs and browser console
