# Time-Travel Features Design Document

## Overview
Add historical position querying capabilities to the InfluxDB-based GPS system, allowing users to view ship/ROV positions at specific times and display complete tracklines for date ranges.

## Feature 1: UTC Time Selector (Time Travel)

### User Story
As a researcher, I want to select any UTC timestamp and see where the ship and ROV were at that exact moment, so I can review specific incidents or waypoints post-mission.

### Frontend UI Design

#### Location
Add a new collapsible section in the layers panel (left sidebar) below "Live GPS Feeds"

#### Components
```html
<div class="layer-group" id="historical-position-group">
    <div class="layer-group-header">
        <span class="layer-group-title">🕐 Historical Position</span>
    </div>
    <div class="layer-content">
        <div class="layer-item">
            <label>Select UTC Time:</label>
            <input type="datetime-local" id="historical-time-picker" />
            <button id="go-to-time-btn">Go to Time</button>
            <button id="back-to-live-btn" style="display: none;">Back to Live</button>
        </div>
        <div class="layer-item">
            <input type="checkbox" id="show-ship-historical" checked>
            <label>Show Ship Position</label>
        </div>
        <div class="layer-item">
            <input type="checkbox" id="show-rov-historical" checked>
            <label>Show ROV Position</label>
        </div>
    </div>
</div>
```

### Backend API Design

#### New WebSocket Message Protocol
Extend the existing WebSocket to support request/response pattern:

**Client Request**:
```json
{
    "type": "queryHistorical",
    "timestamp": "2025-01-15T14:30:00Z",
    "vehicles": ["ship", "rov"]
}
```

**Server Response**:
```json
{
    "type": "historicalData",
    "timestamp": "2025-01-15T14:30:00Z",
    "ship": {
        "lat": -41.28,
        "lon": -56.96,
        "heading": 185.0,
        "course": 185.0,
        "speed": 2.3,
        "satellites": 12,
        "quality": 1
    },
    "rov": {
        "lat": -41.28001,
        "lon": -56.96002,
        "heading": 190.0,
        "depth": 850.5,
        "altitude": 3.2
    }
}
```

#### New Server Functions (server-influxdb.js)

```javascript
async function queryHistoricalShipPosition(timestamp) {
    const isoTime = new Date(timestamp).toISOString();
    const query = `
        from(bucket: "${INFLUXDB_BUCKET}")
            |> range(start: ${isoTime}, stop: ${isoTime + 1s})
            |> filter(fn: (r) => r["_measurement"] == "seapath380")
            |> filter(fn: (r) => 
                r["_field"] == "Seapath_Latitude" or
                r["_field"] == "Seapath_Longitude" or
                r["_field"] == "Seapath_HeadingTrue" or
                r["_field"] == "Seapath_CourseTrue" or
                r["_field"] == "Seapath_SpeedKt" or
                r["_field"] == "Seapath_NumSats" or
                r["_field"] == "Seapath_FixQuality"
            )
            |> first()
    `;
    // Parse and return position data
}

async function queryHistoricalROVPosition(timestamp) {
    // Similar query for sb_sprint measurement
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(ws, message) {
    const data = JSON.parse(message);
    
    if (data.type === 'queryHistorical') {
        const shipData = await queryHistoricalShipPosition(data.timestamp);
        const rovData = await queryHistoricalROVPosition(data.timestamp);
        
        ws.send(JSON.stringify({
            type: 'historicalData',
            timestamp: data.timestamp,
            ship: shipData,
            rov: rovData
        }));
    }
}
```

### Frontend State Management

```javascript
// Global state
let isHistoricalMode = false;
let historicalMarkerShip = null;
let historicalMarkerROV = null;

function goToHistoricalTime() {
    const timeInput = document.getElementById('historical-time-picker').value;
    if (!timeInput) return;
    
    isHistoricalMode = true;
    
    // Stop live updates
    clearInterval(liveUpdateInterval);
    
    // Send query to server
    gpsWebSocketShip.send(JSON.stringify({
        type: 'queryHistorical',
        timestamp: new Date(timeInput).toISOString(),
        vehicles: ['ship', 'rov']
    }));
    
    // Update UI
    document.getElementById('go-to-time-btn').style.display = 'none';
    document.getElementById('back-to-live-btn').style.display = 'block';
}

function backToLive() {
    isHistoricalMode = false;
    
    // Remove historical markers
    if (historicalMarkerShip) {
        historicalMarkerShip.remove();
        historicalMarkerShip = null;
    }
    if (historicalMarkerROV) {
        historicalMarkerROV.remove();
        historicalMarkerROV = null;
    }
    
    // Resume live updates
    startLiveUpdates();
    
    // Update UI
    document.getElementById('go-to-time-btn').style.display = 'block';
    document.getElementById('back-to-live-btn').style.display = 'none';
}

function displayHistoricalPosition(data) {
    // Create distinct markers for historical positions (e.g., blue color)
    if (data.ship) {
        historicalMarkerShip = createMarker(
            data.ship.lat, 
            data.ship.lon, 
            'ship-historical',
            '#0066CC'  // Blue color to distinguish from live
        );
    }
    
    if (data.rov) {
        historicalMarkerROV = createMarker(
            data.rov.lat,
            data.rov.lon,
            'rov-historical',
            '#0099FF'
        );
    }
    
    // Zoom to historical positions
    const bounds = calculateBounds([data.ship, data.rov]);
    map.fitBounds(bounds, { padding: 50 });
}
```

## Feature 2: Historical Trackline Date Range

### User Story
As a researcher, I want to load and display the complete track history between two dates so I can visualize mission paths and analyze vessel movements.

### Frontend UI Design

#### Location
Add another collapsible section below "Historical Position"

#### Components
```html
<div class="layer-group" id="historical-trackline-group">
    <div class="layer-group-header">
        <span class="layer-group-title">📊 Historical Tracklines</span>
    </div>
    <div class="layer-content">
        <div class="layer-item">
            <label>Start Time (UTC):</label>
            <input type="datetime-local" id="trackline-start-time" />
        </div>
        <div class="layer-item">
            <label>End Time (UTC):</label>
            <input type="datetime-local" id="trackline-end-time" />
        </div>
        <div class="layer-item">
            <input type="checkbox" id="load-ship-trackline" checked>
            <label>Load Ship Track</label>
        </div>
        <div class="layer-item">
            <input type="checkbox" id="load-rov-trackline" checked>
            <label>Load ROV Track</label>
        </div>
        <div class="layer-item">
            <button id="load-trackline-btn">Load Historical Track</button>
            <span id="trackline-status"></span>
        </div>
        
        <!-- Loaded tracklines controls -->
        <div id="loaded-tracklines" style="display: none;">
            <hr>
            <div class="layer-item">
                <label>Ship Historical Track</label>
                <input type="checkbox" id="show-ship-hist-track" checked>
                <input type="range" id="ship-hist-track-opacity" min="0" max="1" step="0.01" value="0.7">
                <input type="color" id="ship-hist-track-color" value="#FF6600">
            </div>
            <div class="layer-item">
                <label>ROV Historical Track</label>
                <input type="checkbox" id="show-rov-hist-track" checked>
                <input type="range" id="rov-hist-track-opacity" min="0" max="1" step="0.01" value="0.7">
                <input type="color" id="rov-hist-track-color" value="#00CC66">
            </div>
            <button id="clear-historical-tracks-btn">Clear Tracks</button>
            <button id="export-geojson-btn">Export as GeoJSON</button>
        </div>
    </div>
</div>
```

### Backend API Design

#### New WebSocket Message Protocol

**Client Request**:
```json
{
    "type": "queryTrackline",
    "startTime": "2025-01-15T00:00:00Z",
    "endTime": "2025-01-15T23:59:59Z",
    "vehicles": ["ship", "rov"],
    "downsample": "auto"  // or specific interval like "10s"
}
```

**Server Response** (streaming chunks):
```json
{
    "type": "tracklineData",
    "vehicle": "ship",
    "startTime": "2025-01-15T00:00:00Z",
    "endTime": "2025-01-15T23:59:59Z",
    "chunk": 1,
    "totalChunks": 5,
    "points": [
        {
            "time": "2025-01-15T00:00:00Z",
            "lat": -41.28,
            "lon": -56.96,
            "heading": 185.0
        },
        // ... up to 1000 points per chunk
    ]
}
```

#### New Server Functions (server-influxdb.js)

```javascript
async function queryHistoricalTrackline(startTime, endTime, vehicle, downsample = 'auto') {
    // Calculate appropriate downsampling based on time range
    const durationHours = (new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60);
    let aggregateInterval = '1s';  // Full resolution
    
    if (downsample === 'auto') {
        if (durationHours > 168) {  // > 7 days
            aggregateInterval = '1m';
        } else if (durationHours > 24) {  // > 1 day
            aggregateInterval = '10s';
        } else if (durationHours > 1) {  // > 1 hour
            aggregateInterval = '5s';
        }
    } else {
        aggregateInterval = downsample;
    }
    
    const measurement = vehicle === 'ship' ? 'seapath380' : 'sb_sprint';
    const latField = vehicle === 'ship' ? 'Seapath_Latitude' : 'SB_Sprint_Latitude';
    const lonField = vehicle === 'ship' ? 'Seapath_Longitude' : 'SB_Sprint_Longitude';
    const headingField = vehicle === 'ship' ? 'Seapath_HeadingTrue' : 'SB_Sprint_HeadingTrue';
    
    const query = `
        from(bucket: "${INFLUXDB_BUCKET}")
            |> range(start: ${startTime}, stop: ${endTime})
            |> filter(fn: (r) => r["_measurement"] == "${measurement}")
            |> filter(fn: (r) => 
                r["_field"] == "${latField}" or
                r["_field"] == "${lonField}" or
                r["_field"] == "${headingField}"
            )
            |> aggregateWindow(every: ${aggregateInterval}, fn: mean, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    `;
    
    // Execute query and return points
    const points = [];
    for await (const row of queryApi.iterateRows(query)) {
        points.push({
            time: row._time,
            lat: row[latField],
            lon: row[lonField],
            heading: row[headingField]
        });
    }
    
    return points;
}

// Send trackline data in chunks to avoid WebSocket message size limits
async function sendTracklineInChunks(ws, vehicle, points, startTime, endTime) {
    const CHUNK_SIZE = 1000;
    const totalChunks = Math.ceil(points.length / CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
        const chunk = points.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        
        ws.send(JSON.stringify({
            type: 'tracklineData',
            vehicle: vehicle,
            startTime: startTime,
            endTime: endTime,
            chunk: i + 1,
            totalChunks: totalChunks,
            points: chunk
        }));
        
        // Small delay between chunks to prevent overwhelming client
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Send completion message
    ws.send(JSON.stringify({
        type: 'tracklineComplete',
        vehicle: vehicle,
        totalPoints: points.length
    }));
}
```

### Frontend Rendering

```javascript
// Store historical trackline data
const historicalTracklines = {
    ship: [],
    rov: []
};

function loadHistoricalTrackline() {
    const startTime = document.getElementById('trackline-start-time').value;
    const endTime = document.getElementById('trackline-end-time').value;
    
    if (!startTime || !endTime) {
        alert('Please select both start and end times');
        return;
    }
    
    // Update status
    document.getElementById('trackline-status').textContent = 'Loading...';
    
    // Clear existing historical tracks
    clearHistoricalTracks();
    
    // Send query
    const vehicles = [];
    if (document.getElementById('load-ship-trackline').checked) vehicles.push('ship');
    if (document.getElementById('load-rov-trackline').checked) vehicles.push('rov');
    
    gpsWebSocketShip.send(JSON.stringify({
        type: 'queryTrackline',
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        vehicles: vehicles,
        downsample: 'auto'
    }));
}

function handleTracklineData(data) {
    // Accumulate points for each vehicle
    historicalTracklines[data.vehicle].push(...data.points);
    
    // Update progress
    const progress = `${data.chunk}/${data.totalChunks}`;
    document.getElementById('trackline-status').textContent = 
        `Loading ${data.vehicle} track: ${progress}`;
}

function handleTracklineComplete(data) {
    document.getElementById('trackline-status').textContent = 
        `Loaded ${data.totalPoints} points for ${data.vehicle}`;
    
    // Render the trackline on map
    renderHistoricalTrackline(data.vehicle);
    
    // Show controls
    document.getElementById('loaded-tracklines').style.display = 'block';
}

function renderHistoricalTrackline(vehicle) {
    const points = historicalTracklines[vehicle];
    if (points.length === 0) return;
    
    // Convert to GeoJSON LineString
    const coordinates = points.map(p => [p.lon, p.lat]);
    
    const sourceId = `historical-track-${vehicle}`;
    const layerId = `historical-track-${vehicle}-line`;
    
    // Add source
    map.addSource(sourceId, {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            },
            properties: {
                vehicle: vehicle,
                startTime: points[0].time,
                endTime: points[points.length - 1].time
            }
        }
    });
    
    // Add layer
    const color = vehicle === 'ship' ? '#FF6600' : '#00CC66';
    map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
            'line-color': color,
            'line-width': 3,
            'line-opacity': 0.7
        }
    });
    
    // Zoom to trackline
    const bounds = calculateBoundsFromCoordinates(coordinates);
    map.fitBounds(bounds, { padding: 50 });
}

function exportToGeoJSON() {
    const geojson = {
        type: 'FeatureCollection',
        features: []
    };
    
    // Add ship track
    if (historicalTracklines.ship.length > 0) {
        geojson.features.push({
            type: 'Feature',
            properties: {
                vehicle: 'ship',
                name: 'Falkor-too'
            },
            geometry: {
                type: 'LineString',
                coordinates: historicalTracklines.ship.map(p => [p.lon, p.lat])
            }
        });
    }
    
    // Add ROV track
    if (historicalTracklines.rov.length > 0) {
        geojson.features.push({
            type: 'Feature',
            properties: {
                vehicle: 'rov',
                name: 'ROV'
            },
            geometry: {
                type: 'LineString',
                coordinates: historicalTracklines.rov.map(p => [p.lon, p.lat])
            }
        });
    }
    
    // Download as file
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'historical-tracklines.geojson';
    a.click();
}
```

## Performance Considerations

### Backend
- Use InfluxDB aggregateWindow for automatic downsampling
- Stream results in chunks to avoid memory issues
- Limit maximum query duration (e.g., 30 days)
- Add rate limiting to prevent excessive queries

### Frontend
- Simplify geometries for long tracklines (e.g., Douglas-Peucker algorithm)
- Use MapLibre's built-in clustering for dense points
- Implement pagination for very long tracks
- Cache historical queries client-side

## Implementation Priority

1. **Phase 1**: Backend historical query functions
   - Add queryHistoricalShipPosition()
   - Add queryHistoricalROVPosition()
   - Add WebSocket message handling for historical queries

2. **Phase 2**: Frontend UTC time selector
   - Add UI controls to layers panel
   - Implement state management (live vs historical mode)
   - Add historical marker display

3. **Phase 3**: Backend trackline queries
   - Add queryHistoricalTrackline()
   - Implement chunked streaming
   - Add downsampling logic

4. **Phase 4**: Frontend trackline rendering
   - Add UI controls for date range
   - Implement GeoJSON LineString rendering
   - Add export functionality

## Testing Strategy

1. **Unit Tests**:
   - Test Flux query generation
   - Test downsampling calculations
   - Test coordinate conversion

2. **Integration Tests**:
   - Query InfluxDB with known time ranges
   - Verify chunked data transmission
   - Test WebSocket message protocol

3. **UI Tests**:
   - Test datetime picker input handling
   - Test mode switching (live ↔ historical)
   - Test trackline visibility controls

4. **Performance Tests**:
   - Query 24-hour trackline (expected: ~86,400 points)
   - Query 7-day trackline with 10s aggregation (expected: ~60,480 points)
   - Measure WebSocket throughput and rendering time
