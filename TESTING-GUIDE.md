# Quick Start Guide: Testing Time-Travel Features

## Prerequisites

1. **InfluxDB Running:**
   - URL: http://10.23.9.24:8086
   - Bucket: openrvdas
   - Data available for ship (seapath380) and ROV (sb_sprint)

2. **Services Started:**
   ```bash
   # Terminal 1: Tile Server
   tileserver-gl --mbtiles ./maps/*.mbtiles --port 8080
   
   # Terminal 2: Frontend Server
   node server.js
   
   # Terminal 3: GPS Server (InfluxDB mode)
   cd gps-server
   node server-influxdb.js
   
   # Terminal 4: Telemetry Server (optional)
   cd rov-telemetry-server
   npm start
   ```

3. **Browser Open:**
   - Navigate to http://localhost:8000
   - Open browser DevTools console (F12) to see logs

## Feature 1: UTC Time Selector (Time Travel)

### Purpose
View ship and ROV positions at any specific moment in the past.

### Steps

1. **Locate the Control:**
   - Left sidebar → Expand "🕐 Historical Position"

2. **Select a Time:**
   - Click the "Select UTC Time" datetime picker
   - Choose a recent date/time (recommend within last 24 hours)
   - Example: Today at 12:00 PM

3. **Query Position:**
   - Click the blue "Go to Time" button
   - Watch console for: `[HISTORICAL] Querying position at...`

4. **View Results:**
   - Two blue circular markers should appear:
     - Ship (S) - at ship's position at selected time
     - ROV (R) - at ROV's position at selected time
   - Map automatically zooms to show both
   - Click markers to see popup with:
     - Exact timestamp
     - Coordinates
     - Heading, speed (ship) or depth (ROV)

5. **Return to Live:**
   - Click green "Back to Live" button
   - Historical markers disappear
   - Real-time red/green markers resume updating

### Expected Console Output
```
[HISTORICAL] Querying position at 2025-01-15T12:00:00.000Z
[SHIP HISTORICAL] InfluxDB query completed
[ROV HISTORICAL] InfluxDB query completed
[HISTORICAL] Sent data for 2025-01-15T12:00:00.000Z
[HISTORICAL] Displayed positions {ship: {...}, rov: {...}}
```

### Troubleshooting
- **No markers appear:** Check that selected time has data in InfluxDB
- **"GPS WebSocket not connected":** Wait for connection or restart server-influxdb.js
- **Only one marker:** Normal if only one vehicle had data at that time

## Feature 2: Historical Trackline Date Range

### Purpose
Display complete vessel tracks between two dates, with automatic downsampling for performance.

### Steps

1. **Locate the Control:**
   - Left sidebar → Expand "📊 Historical Tracklines"

2. **Set Date Range:**
   - **Start Time:** Click picker, select start date/time (UTC)
   - **End Time:** Click picker, select end date/time (UTC)
   - Recommendation: Start with 1-6 hour range for testing

3. **Select Vehicles:**
   - Check ☑ "Load Ship Track" (orange line)
   - Check ☑ "Load ROV Track" (green line)
   - Can load individually or together

4. **Load Track:**
   - Click blue "Load Historical Track" button
   - Watch status message:
     ```
     Loading ship track: 1/5
     Loading ship track: 2/5
     ...
     Loaded 4,237 points for ship
     ```

5. **View Results:**
   - Colored lines appear showing complete path
   - Map zooms to fit entire track
   - Track colors:
     - Ship: Orange (#FF6600) by default
     - ROV: Green (#00CC66) by default

6. **Customize Display:**
   - **Visibility:** Uncheck boxes to hide tracks
   - **Opacity:** Drag sliders (0 = transparent, 1 = solid)
   - **Color:** Click color boxes to change line colors

7. **Export Data:**
   - Click purple "Export as GeoJSON" button
   - File downloads: `historical-tracklines-2025-01-15.geojson`
   - Open in QGIS, ArcGIS, or text editor

8. **Clear Tracks:**
   - Click red "Clear Tracks" button
   - All historical tracks removed from map

### Expected Console Output
```
[TRACKLINE] Querying ship, rov from 2025-01-15T00:00:00.000Z to 2025-01-15T06:00:00.000Z
[TRACKLINE] Received ship chunk 1/5 (1000 points)
[TRACKLINE] Received ship chunk 2/5 (1000 points)
...
[SHIP TRACKLINE] Retrieved 4,237 points (5s resolution)
[TRACKLINE] ship complete: 4,237 points
[TRACKLINE] Rendered ship track: 4,237 points
[ROV TRACKLINE] Retrieved 2,891 points (5s resolution)
[TRACKLINE] rov complete: 2,891 points
[TRACKLINE] Rendered rov track: 2,891 points
```

### Downsampling Behavior

The system automatically adjusts resolution based on time range:

| Date Range | Aggregation | Expected Points (24hrs) |
|------------|-------------|-------------------------|
| < 1 hour | 1 second | ~3,600 points |
| 1-24 hours | 5 seconds | ~17,280 points |
| 1-7 days | 10 seconds | ~8,640 per day |
| > 7 days | 1 minute | ~1,440 per day |

**Example:**
- 1 hour query: Full resolution, ~3,600 points
- 6 hour query: 5-second aggregation, ~4,320 points
- 24 hour query: 5-second aggregation, ~17,280 points
- 7 day query: 10-second aggregation, ~60,480 points

### Troubleshooting
- **"Please select both start and end times":** Fill in both datetime pickers
- **"End time must be after start time":** Check date order
- **Status stuck on "Loading...":** Check server-influxdb.js console for errors
- **No tracks appear:** Verify data exists for selected date range
- **Very slow loading:** Normal for >7 day ranges; wait 30-60 seconds

## Testing Checklist

### Basic Functionality
- [ ] Time travel displays historical ship marker
- [ ] Time travel displays historical ROV marker
- [ ] Back to Live button removes historical markers
- [ ] Trackline loads ship track successfully
- [ ] Trackline loads ROV track successfully
- [ ] Trackline loads both tracks together
- [ ] Progress indicator updates during loading

### UI Controls
- [ ] Ship historical track visibility toggle works
- [ ] ROV historical track visibility toggle works
- [ ] Ship opacity slider changes transparency
- [ ] ROV opacity slider changes transparency
- [ ] Ship color picker changes line color
- [ ] ROV color picker changes line color
- [ ] Clear Tracks button removes all historical tracks
- [ ] Export GeoJSON button downloads file

### Edge Cases
- [ ] Query with no data returns gracefully
- [ ] Future timestamp returns no results
- [ ] Very short range (1 minute) works
- [ ] Long range (7 days) shows downsampling
- [ ] Switching modes rapidly doesn't break
- [ ] Loading trackline while in historical mode works

### Performance
- [ ] 1-hour trackline loads in < 5 seconds
- [ ] 6-hour trackline loads in < 10 seconds
- [ ] 24-hour trackline loads in < 30 seconds
- [ ] 7-day trackline loads in < 60 seconds
- [ ] Browser remains responsive during loading
- [ ] Map renders tracks smoothly

## Common Issues & Solutions

### Issue: "GPS WebSocket not connected"
**Solution:** 
```bash
cd gps-server
node server-influxdb.js
# Wait for "[SHIP] WebSocket server listening on port 8081"
# Refresh browser
```

### Issue: No historical data appears
**Diagnosis:**
```bash
# Test InfluxDB connection
cd gps-server
node test-seapath.js
# Should show field names
```
**Solution:** Verify InfluxDB credentials in `.env` file

### Issue: Trackline loading takes forever
**Diagnosis:** Check date range duration
**Solution:** 
- For testing, start with 1-6 hour ranges
- Long ranges (>7 days) can take 30-60 seconds
- Check server console for query progress

### Issue: Exported GeoJSON is empty
**Diagnosis:** Tracks must be loaded before export
**Solution:**
1. Load tracklines first
2. Wait for "Loaded X points" status
3. Then click Export

### Issue: Historical markers hard to see
**Solution:**
- Zoom in closer to markers
- Blue markers are 40px circles with white border
- Click markers to see popups
- Markers appear on top of live markers

## Data Verification

### Check Historical Position Accuracy
1. Note timestamp from historical popup
2. Query InfluxDB directly:
   ```bash
   curl -G 'http://10.23.9.24:8086/api/v2/query' \
     -H "Authorization: Token YOUR_TOKEN" \
     --data-urlencode "org=834cb38b7a729cea" \
     --data-urlencode 'query=from(bucket: "openrvdas")
       |> range(start: 2025-01-15T12:00:00Z, stop: 2025-01-15T12:00:02Z)
       |> filter(fn: (r) => r["_measurement"] == "seapath380")
       |> filter(fn: (r) => r["_field"] == "Seapath_Latitude" or r["_field"] == "Seapath_Longitude")'
   ```
3. Compare coordinates with map popup

### Check Trackline Point Count
1. Load 1-hour trackline
2. Note point count: "Loaded X points"
3. Expected: ~3,600 points for 1 second resolution
4. If much lower: Check for data gaps in InfluxDB

## Browser Console Debugging

Useful commands to run in browser console:

```javascript
// Check WebSocket connection status
console.log('Ship GPS:', gpsWebSocketShip?.readyState); // 1 = OPEN

// Manual historical query
gpsWebSocketShip.send(JSON.stringify({
  type: 'queryHistorical',
  timestamp: '2025-01-15T12:00:00Z',
  vehicles: ['ship', 'rov']
}));

// Manual trackline query
gpsWebSocketShip.send(JSON.stringify({
  type: 'queryTrackline',
  startTime: '2025-01-15T00:00:00Z',
  endTime: '2025-01-15T06:00:00Z',
  vehicles: ['ship'],
  downsample: 'auto'
}));

// Check historical mode state
console.log('Historical mode:', isHistoricalMode);

// Check stored trackline data
console.log('Ship points:', historicalTracklines.ship.length);
console.log('ROV points:', historicalTracklines.rov.length);
```

## Success Criteria

The implementation is working correctly when:

1. ✅ Historical position query returns data for times with InfluxDB entries
2. ✅ Blue markers appear at correct coordinates
3. ✅ Trackline renders complete path between dates
4. ✅ Downsampling occurs automatically for long ranges
5. ✅ UI controls (visibility, opacity, color) work
6. ✅ Export produces valid GeoJSON file
7. ✅ No console errors during normal operation
8. ✅ Can switch between live and historical modes smoothly

## Demo Script

For showing the feature to others:

**Part 1: Time Travel (2 minutes)**
1. "Let me show you where the ship was at noon yesterday"
2. Open Historical Position panel
3. Select yesterday at 12:00 PM
4. Click Go to Time
5. "See the blue markers? These show exact positions at that moment"
6. Click markers to show popups
7. Click Back to Live
8. "And we're back to real-time tracking"

**Part 2: Historical Tracks (3 minutes)**
1. "Now let's see the complete dive track from this morning"
2. Open Historical Tracklines panel
3. Set start: Today 06:00
4. Set end: Today 12:00
5. Check both vehicles
6. Click Load Historical Track
7. "Watch the progress as it loads 20,000 data points"
8. "There's the complete 6-hour path"
9. Change colors to show customization
10. Click Export as GeoJSON
11. "Now you can analyze this in any GIS tool"

## Contact

For issues or questions about the time-travel features:
- Check server logs in Terminal
- Review browser console for errors
- Verify InfluxDB data availability
- See IMPLEMENTATION-SUMMARY.md for technical details
