# Oceanographic Data Server

Streams oceanographic sensor data from InfluxDB (OpenRVDAS) to MapLibre for heatmap visualization.

## Features

- Real-time sensor data streaming via WebSocket
- Historical data queries for heatmap generation
- GPS coordinate mapping via timestamp correlation with Seapath data
- Support for multiple oceanographic sensors:
  - Water Temperature (TSG)
  - Salinity (TSG)
  - Fluorescence
  - Dissolved Oxygen
  - pH
  - Turbidity
  - Chlorophyll

## OpenRVDAS Integration

This server integrates with the shipboard OpenRVDAS (Open Research Vessel Data Acquisition System):

### Data Sources

1. **InfluxDB** (Primary): Real-time and historical sensor data logged by OpenRVDAS
2. **Seapath GPS**: Position data for spatial mapping

### InfluxDB Schema

Expected measurements in InfluxDB:

```
Measurement: tsg_temperature
  Field: value (°C)
  Tags: instrument_id, quality_flag

Measurement: tsg_salinity
  Field: value (PSU)
  Tags: instrument_id, quality_flag

Measurement: fluorometer_chl
  Field: value (mg/m³)
  Tags: instrument_id

Measurement: ctd_oxygen
  Field: value (mg/L)
  Tags: instrument_id

Measurement: ctd_ph
  Field: value (pH)
  Tags: instrument_id

Measurement: seapath_position
  Fields: latitude, longitude, heading
  Tags: device_id
```

### Timestamp Correlation

The server joins sensor readings with GPS coordinates by matching timestamps:
- Each sensor reading has a `_time` field
- GPS positions from Seapath have corresponding `_time` fields
- Flux queries perform time-based joins to create spatial data points

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# InfluxDB connection for OpenRVDAS
INFLUXDB_URL=http://openrvdas-server:8086
INFLUXDB_TOKEN=your-token
INFLUXDB_ORG=schmidt-ocean
INFLUXDB_BUCKET=openrvdas

# Server settings
PORT=8086
USE_MOCK_DATA=false

# Query settings
QUERY_INTERVAL_MS=2000
HISTORICAL_RANGE_HOURS=24
```

### Mock Data Mode

For development/testing without OpenRVDAS:
```bash
USE_MOCK_DATA=true
```

## Installation

```bash
cd oceanographic-server
npm install
```

## Running

### With OpenRVDAS/InfluxDB:
```bash
npm start
```

### With Mock Data:
```bash
USE_MOCK_DATA=true npm start
```

### With Docker:
```bash
docker-compose up oceanographic-server
```

## API

### WebSocket Protocol

**Connect:**
```
ws://localhost:8086
```

**Subscribe to real-time data:**
```json
{
  "type": "subscribe",
  "sensors": ["temperature", "salinity", "fluorescence"]
}
```

**Request historical data:**
```json
{
  "type": "historical",
  "sensor": "temperature",
  "hours": 24
}
```

**Real-time data message:**
```json
{
  "type": "realtime",
  "data": {
    "sensor": "temperature",
    "value": 15.234,
    "unit": "°C",
    "lat": 48.1173,
    "lon": -11.5167,
    "timestamp": "2024-03-15T12:34:56.789Z"
  }
}
```

**Historical data response:**
```json
{
  "type": "historical",
  "sensor": "temperature",
  "hours": 24,
  "data": [
    {
      "sensor": "temperature",
      "value": 15.234,
      "unit": "°C",
      "lat": 48.1173,
      "lon": -11.5167,
      "timestamp": "2024-03-15T12:34:56.789Z"
    },
    ...
  ]
}
```

## OpenRVDAS Setup Notes

### InfluxDB Configuration

Ensure your OpenRVDAS logger is configured to write to InfluxDB:

1. Edit OpenRVDAS logger config to include InfluxDB writer
2. Configure measurement names to match server expectations
3. Ensure Seapath GPS data is logged to `seapath_position` measurement
4. Set up retention policies for historical data

### Data Quality

- Sensor readings should include quality flags when available
- Invalid/outlier data should be filtered at the source
- GPS timestamps must be synchronized with sensor timestamps

### Network Access

Ensure the oceanographic server can access:
- InfluxDB: Port 8086 (default)
- Ship GPS Server: Port 8081
- Frontend: WebSocket port must be accessible

## Troubleshooting

**No GPS coordinates in historical data:**
- Verify Seapath data is being logged to InfluxDB
- Check timestamp synchronization between sensors and GPS
- Ensure Flux join query is matching correctly

**Missing sensor data:**
- Verify measurement names match OpenRVDAS configuration
- Check InfluxDB bucket and retention policies
- Confirm sensor is actively logging data

**Performance issues with large historical queries:**
- Reduce time range (hours parameter)
- Add downsampling in Flux query
- Consider pre-aggregating data for longer time periods
