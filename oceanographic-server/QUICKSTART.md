# Quick Start Guide - Data Layers (Oceanographic)

This guide will help you test the new oceanographic sensor heatmap visualization.

## Step 1: Install Dependencies

```bash
cd oceanographic-server
npm install
```

## Step 2: Start the Oceanographic Server (Mock Data Mode)

```bash
# From oceanographic-server directory
USE_MOCK_DATA=true npm start
```

You should see:
```
Oceanographic Data Server running on port 8086
Mode: MOCK DATA
WebSocket: ws://localhost:8086
Health check: http://localhost:8086/health

Supported sensors: temperature, salinity, fluorescence, oxygen, ph, turbidity, chlorophyll
```

## Step 3: Start the Frontend

Open a new terminal:

```bash
# From project root
node server.js
```

Or if Node.js is not available:
```bash
python -m http.server 8000
```

## Step 4: Open the Map

Navigate to: **http://localhost:8000**

## Step 5: Enable Data Layers

1. Look for the **"Data Layers"** section in the left panel
2. You'll see 8 sensors listed:
   - Temperature (red)
   - Salinity (teal)
   - Fluorescence (light blue)
   - Dissolved Oxygen (green)
   - pH (yellow)
   - Turbidity (gray)
   - Chlorophyll (bright green)

3. **Check the box** next to "Temperature" to enable the first heatmap

## Step 6: View the Heatmap

You should see:
- A **red heatmap** appear showing temperature distribution
- Data points following a circular pattern (simulated ship track)
- Brighter colors where data density is higher
- The heatmap updates in real-time (every 2 seconds)

## Step 7: Try Multiple Sensors

1. Enable "Salinity" (teal heatmap)
2. Enable "Fluorescence" (light blue heatmap)
3. Use the **opacity sliders** to blend the layers

## Step 8: View Historical Data

1. Find the **"Historical Range"** dropdown at the bottom of Data Layers
2. Select "**Last 24 Hours**" (default is 12 hours)
3. The heatmaps will reload with more historical data points

## Step 9: Test Different Time Ranges

Try these options:
- **1 Hour**: Very recent data, high detail
- **6 Hours**: Half-day trends
- **24 Hours**: Full day coverage
- **48 Hours**: Two-day trends (most data points)

## What You Should See

### Temperature Heatmap (Red)
- Values: 0-35°C range
- Pattern: Warm and cool patches along ship track
- Brightness: Denser where ship has spent more time

### Salinity Heatmap (Teal)
- Values: 30-40 PSU
- Pattern: Subtle variations in ocean salinity
- Shows mixing zones and water masses

### Fluorescence Heatmap (Light Blue)
- Values: 0-10 mg/m³
- Pattern: Bright patches indicate phytoplankton blooms
- Follows biological productivity patterns

## Troubleshooting

**No heatmaps appear:**
- Check browser console for errors (F12)
- Verify oceanographic server is running: `curl http://localhost:8086/health`
- Check that you've enabled at least one sensor checkbox

**Server won't start:**
```bash
# Check if port 8086 is already in use
lsof -i :8086

# Kill any process using it
kill -9 <PID>
```

**Heatmaps look blocky:**
- Zoom in closer - heatmap radius increases with zoom
- At zoom 0-5: Small radius (2-10px)
- At zoom 10-15: Larger radius (20-40px)

## Next Steps

### Test All Sensors

Enable all 8 sensors one by one to see different oceanographic parameters:
1. Temperature (red) - water temperature patterns
2. Salinity (teal) - ocean salinity distribution
3. Fluorescence (light blue) - phytoplankton/chlorophyll proxy
4. Dissolved Oxygen (green) - oxygen levels
5. pH (yellow) - ocean acidity
6. Turbidity (gray) - water clarity/suspended particles
7. Chlorophyll (bright green) - chlorophyll-a concentration

### Production Setup

When ready to connect to real OpenRVDAS data:

1. Copy environment template:
   ```bash
   cd oceanographic-server
   cp .env.example .env
   ```

2. Edit `.env` with your InfluxDB credentials:
   ```bash
   INFLUXDB_URL=http://your-influxdb-server:8086
   INFLUXDB_TOKEN=your-actual-token
   INFLUXDB_ORG=your-org
   INFLUXDB_BUCKET=openrvdas
   USE_MOCK_DATA=false
   ```

3. Restart the server:
   ```bash
   npm start
   ```

4. See **[OPENRVDAS_INTEGRATION.md](../OPENRVDAS_INTEGRATION.md)** for complete production setup guide

## Docker Deployment

To run all services together:

```bash
# From project root
docker-compose up -d

# View logs
docker-compose logs -f oceanographic-server

# Test
curl http://localhost:8086/health
```

## Tips

- **Opacity**: Lower opacity (0.3-0.5) works well for viewing multiple layers
- **Zoom**: Zoom in to see individual data points more clearly
- **Time Range**: Start with shorter ranges (1-6 hours) for faster loading
- **Combination**: Temperature + Salinity shows water mass boundaries
- **Comparison**: Enable/disable layers to compare patterns

## Mock Data Behavior

The mock data generator:
- Creates 100 historical points per sensor (when historical data requested)
- Follows a circular ship track pattern
- Updates real-time every 2 seconds
- Uses realistic value ranges for each sensor
- Correlates position with ship GPS (if GPS server is running)

This simulates real oceanographic data collection along a survey track!
