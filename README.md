# Map Data Viewer

A real-time web-based marine data visualization platform built with **MapLibre GL JS** for oceanographic survey data, including MBTiles raster layers, vector point data, GeoJSON geometries, and live sensor feeds from OpenRVDAS.

## Features

- **MBTiles Raster Layer**: Display custom raster tiles from a local tile server with opacity control
- **Live GPS Tracking**: Dual GPS feeds for ship and ROV with custom icons and tracklines
- **ADCP Current Vectors**: Real-time ocean current visualization with multi-depth support
- **ROV Telemetry**: Real-time depth and heading data from InfluxDB/OpenRVDAS
- **Oceanographic Sensors**: Temperature, salinity, fluorescence, oxygen, pH, turbidity, chlorophyll
- **Multibeam Swath**: Real-time seafloor mapping coverage visualization
- **Point Layers**: Load CSV/TXT files with lat/long coordinates as toggleable point layers with labels
- **Geometry Layers**: Load GeoJSON/ASCII files (LineStrings, Polygons) as toggleable geometry layers
- **Layer Controls**: Individual checkboxes and opacity sliders for each layer
- **Color Legend**: Dynamic legend showing only active layers with color swatches
- **Auto-Centering**: Automatically fits map to tile server data extent on load
- **Interactive Legend**: Click legend items to zoom to that layer's bounds
- **Responsive Design**: Floating panels on left and bottom-left for controls and legend


<img width="1229" height="942" alt="Screenshot_map" src="https://github.com/user-attachments/assets/9e961c39-f9a5-4120-b69d-ca37ad8627d1" />



## Prerequisites

Before running the project, install:

1. **Node.js & npm**
2. **TileServer GL** (to serve MBTiles):
   ```bash
   npm install -g tileserver-gl
   ```

## Initial Setup

### 1. Configuration

Copy the example configuration and customize for your environment:

```bash
cp config.example.js config.js
```

Edit `config.js` to set your server URLs and ports. See [CONFIG.md](CONFIG.md) for details.

**Important:** `config.js` is gitignored and will not be committed. This protects your local settings and API keys.

## Project Structure

```
mapLibre-rov/
├── index.html              # Main MapLibre viewer
├── style.json              # MapLibre style definition (tile sources & layers)
├── README.md               # This file
├── layers/                 # Data layers (auto-discovered)
│   ├── Bravo_dive-coordinates.csv    # Point layer example
│   └── Mapping-lines.json            # LineString layer example
└── maps/
    └── map.mbtiles         # MBTiles raster tiles
```

## Step-by-Step Setup and Execution

To view the map, you must run **two separate local servers**: one to serve the tiles and one to serve the HTML/JSON files.

### Server Overview

| Server | Port | Address | Purpose | Command |
|--------|------|---------|---------|---------|
| **TileServer GL** | 8080 | http://localhost:8080 | Serves MBTiles raster tiles | `tileserver-gl --mbtiles ./maps/*.mbtiles --port 8080` |
| **Frontend Server** | 8000 | http://localhost:8000 | Serves HTML/JS/CSS files | `node server.js` or `python -m http.server 8000` |
| **GPS Server (UDP)** | 8081, 8082 | ws://localhost:8081/8082 | Ship/ROV GPS (UDP/NMEA mode) | `cd gps-server && node server.js` |
| **GPS Server (InfluxDB)** | 8081, 8082 | ws://localhost:8081/8082 | Ship/ROV GPS (InfluxDB mode) | `cd gps-server && node server-influxdb.js` |
| **ADCP Server** | 8083 | ws://localhost:8083 | Ocean current vectors | `cd adcp-server && node server.js` |
| **Telemetry Server** | 8084 | ws://localhost:8084 | ROV depth/heading display | `cd rov-telemetry-server && npm start` |
| **Multibeam Server** | 8085 | ws://localhost:8085 | Sonar swath visualization | `cd multibeam-server && npm start` |
| **Oceanographic Server** | 8086 | ws://localhost:8086 | 8 sensor heatmap layers | `cd oceanographic-server && npm start` |

**Note**: Only TileServer GL (8080) and Frontend Server (8000) are required for basic map viewing. Additional servers (8081-8086) provide optional real-time data layers. GPS server runs in either UDP mode (testing) or InfluxDB mode (production), not both simultaneously.

---

### Step 1: Start the Tile Server (TileServer GL)

This server reads your `.mbtiles` files and makes the tiles accessible via a web address (usually `http://localhost:8080`).

**Option A: Serve ALL maps automatically (Recommended)**

Navigate to the project root and run:

```bash
tileserver-gl --mbtiles ./maps/*.mbtiles --port 8080
```

This automatically discovers and serves all `.mbtiles` files in the `maps/` folder.

**Option B: Use configuration file**

If you prefer explicit configuration:

```bash
tileserver-gl --config tileserver-config.json
```

Note: Make sure `tileserver-config.json` uses local paths (e.g., `./maps/map.mbtiles`) not Docker paths (e.g., `/data/mbtiles/map.mbtiles`).

**Option C: Single tileset only**

To serve just one specific tileset:

```bash
tileserver-gl ./maps/map.mbtiles
```

*The server will typically start on **Port 8080**.*

You can view the tile server UI at: http://localhost:8080

---

### Step 2: Configure Map Files (`style.json`)

The `style.json` file tells MapLibre where to find your tiles. This configuration assumes your TileServer GL is running on port 8080.

**Note:** This project uses MapTiler's free ocean basemap tiles. The included API key has usage limits. For production use or high-traffic deployments, please get your own free key at https://www.maptiler.com/ (100,000 free tile requests/month) and update the key in `style.json`.

**File: `style.json`**

### Step 3: Configure Map Files (index.html)
The index.html file sets up the MapLibre viewer and references the style.json file.

File: index.html

### Step 4: Start the Web Server (Python HTTP Server)
This server allows your browser to securely load the index.html and style.json files.

Open a second terminal window.

Navigate to your main project directory (mapLibre-rov/).

Run the Python HTTP server:
 ```bash
python -m http.server 8000
 ```

### Step 5: View the Map
Open your web browser.

# 2D Interactive Map Viewer

An interactive web-based map viewer built with MapLibre GL JS for visualizing oceanographic survey data. This project features:

- **MBTiles Raster Layers**: Served by TileServer GL with individual toggle controls and opacity sliders for each tileset
- **Vector Data Layers**: Auto-discovered from `layers/` folder with support for:
  - CSV/TXT point data (lat/long coordinates)
  - GeoJSON geometries (`.json`, `.geojson`)
  - Custom ASCII formats (`.ascii`, `.asciifile`)
- **Dynamic Layer Management**: All layers are individually toggleable with opacity controls
- **Layer Stacking**: Data layers (points, lines, polygons) render on top of MBTiles imagery
- **Interactive UI**: Click legend items to zoom to layer bounds, popups on point features

**Quick summary**
- Tile server (TileServer GL) runs on http://localhost:8080
- Frontend served over a static HTTP server (e.g. `python -m http.server`) on port 8000
- The frontend auto-discovers tilesets by requesting `http://localhost:8080/data.json` and creates individual controls for each `.mbtiles` file
- Vector layers are auto-discovered from the `layers/` directory and rendered on top

## Requirements
- Docker (and Docker Compose or docker CLI)

## Quick Start

### 1. Start the Tile Server (Docker)

```bash
# From project root
docker-compose up -d --build

# View logs
docker-compose logs -f
```

This starts:
- **TileServer GL** on port 8080 (serves MBTiles)
- **GPS Server** on ports 8081 (WebSocket) and 12345 (UDP)

### 2. Start the Frontend Server

```bash
# From project root - use Node.js server (recommended)
node server.js

# Or use Python if Node.js is not available
python -m http.server 8000
```

### 3. Open the Map

Navigate to: **http://localhost:8000**

To access from other devices on your network, use your machine's IP address (find it with `ipconfig getifaddr en0` on macOS or `hostname -I` on Linux).

### 4. Test Live GPS Feed

In a new terminal window:

```bash
# Send test NMEA sentence
echo '$GPRMC,123519,A,4807.038,N,01131.000,W,022.4,084.4,230394,003.1,W*6A' | nc -u localhost 12345

# Or use the Node.js test script
cd gps-server
node test-gps.js
```

You should see a red vessel marker appear on the map!

## How it works

### MBTiles Auto-Discovery
- The tile server exposes a JSON index at `http://localhost:8080/data.json` listing available tilesets
- `index.html` fetches that JSON and creates individual MapLibre sources and layers for each tileset
- Each MBTiles layer gets its own checkbox and opacity slider in the UI under "MBTiles Maps"
- Tileset `id` is the `.mbtiles` filename without the extension (e.g., `map.mbtiles` → `map`)
- Layers respect the tileset's min/max zoom levels to prevent 404 errors

### Vector Layer Auto-Discovery
- The frontend scans `./layers/` directory for data files
- Supported formats:
  - **Point layers**: `.csv`, `.txt` (must contain lat/long columns)
  - **Geometry layers**: `.json`, `.geojson`, `.ascii`, `.asciifile` (GeoJSON format)
- Each layer gets individual controls under "Data Layers" section
- Vector layers render on top of MBTiles imagery with colored markers/lines
- Click legend items to zoom to layer bounds

## Adding more maps and layers

### Adding MBTiles Maps
The current setup uses volume mounts for easy addition of new maps (no rebuild required):

1. Add your `.mbtiles` file to the `maps/` folder
2. Update `tileserver-config.json` to include the new tileset:
   ```json
   "your_map_name": {
     "mbtiles": "/data/mbtiles/your_map_name.mbtiles"
   }
   ```
3. Restart the tileserver:
   ```bash
   docker-compose restart tileserver
   ```
4. Refresh the frontend - the new map will appear with its own controls

### Adding Vector Data Layers
Simply drop supported files into the `layers/` folder:
- Point data: `.csv` or `.txt` with lat/long columns
- Geometry data: `.json`, `.geojson`, `.ascii`, or `.asciifile` in GeoJSON format

No restart needed - just refresh the browser at `http://localhost:8000/`

## Useful endpoints & checks
- TileServer UI: http://localhost:8080
- Tileset list (JSON): http://localhost:8080/data.json
- Individual tiles example: `http://localhost:8080/data/<tileset-id>/{z}/{x}/{y}.png`

## How the frontend uses tiles
- The `index.html` file loads `./style.json` for base layers and then, on `map.on('load')`, fetches `http://localhost:8080/data.json` to discover all tilesets and add them as raster sources/layers.
- Layer visibility and opacity are controlled by the small UI in the app.

## Naming / tileset ids
- The tileset id used by the frontend is typically the MBTiles filename without the `.mbtiles` suffix. For example `maps/area_100m_contour.mbtiles` becomes `area_100m_contour`.

## Troubleshooting
- If `http://localhost:8080/data.json` returns `[]`:
    - Check the container logs: `docker-compose logs -f`
    - Ensure the `.mbtiles` files are present in `/data` inside the container (if built into the image, re-run `docker-compose up --build`).
    - If using a volume mount, ensure the `docker-compose.yml` mounts `./maps` to `/data` and that the files are readable.
- If a tileset is present in `data.json` but tiles are 404, check the tile URL pattern in `index.html` (it should be `http://localhost:8080/data/{tileset_id}/{z}/{x}/{y}.png`).

## Commands Summary

```bash
# Docker (all services)
docker-compose up -d --build      # start all services in background
docker-compose logs -f            # view all logs
docker-compose logs -f gps-server # view GPS server logs only
docker-compose restart gps-server # restart GPS server
docker-compose down               # stop and remove containers

# Frontend server
node server.js                    # Node.js server (recommended)
python -m http.server 8000        # Python alternative

# GPS testing
cd gps-server && node test-gps.js                    # send test GPS data
echo '$GPRMC,...*6A' | nc -u localhost 12345         # manual test
tail -f gps-server/gps-server.log                    # watch logs
```

## Project Structure

```
mapLibre-rov/
├── index.html                  # MapLibre frontend with dynamic layer discovery
├── style.json                  # Base map style (ocean background + MapTiler basemap)
├── server.js                   # Node.js static file server for frontend
├── package.json                # Frontend server dependencies
├── docker-compose.yml          # Docker orchestration (tile + GPS servers)
├── Dockerfile                  # TileServer GL container image
├── tileserver-config.json      # Explicit tileset configuration
├── maps/                       # MBTiles raster files (mounted into container)
│   ├── map.mbtiles
│   └── area_100m_contour.mbtiles
├── layers/                     # Vector data layers (auto-discovered by frontend)
│   ├── *.csv / *.txt          # Point data files
│   ├── *.json / *.geojson     # GeoJSON geometry files
│   └── *.ascii / *.asciifile  # Custom ASCII format files
├── gps-server/                 # Dual GPS UDP listener and WebSocket relay
│   ├── server.js              # GPS server with ship + ROV feeds
│   ├── package.json           # GPS server dependencies
│   ├── Dockerfile             # GPS server container image
│   ├── test-gps.js            # Test script for ship GPS (port 12345)
│   ├── test-rov-gps.js        # Test script for ROV GPS (port 12346)
│   └── .env.example           # Environment configuration template
└── vehicles/                   # Custom vehicle icons
    ├── Falkor-too.png         # Ship icon (larger)
    └── rov.png                # ROV icon (smaller)
```

## Features

### UI Controls
- **MBTiles Maps Panel**: Individual checkboxes and opacity sliders for each tileset
- **Data Layers Panel**: Individual controls for vector layers from `layers/` folder
- **Live GPS Feeds Panel**: Real-time vessel tracking with toggle and opacity controls
- **Legend**: Dynamic legend showing active layers with color swatches (click to zoom to bounds)
- **Layer Stacking**: MBTiles render above basemap, vector layers render on top of MBTiles

### Layer Types Supported
- **Raster**: MBTiles served by TileServer GL
- **Points**: CSV/TXT files with lat/long coordinates
- **Lines**: GeoJSON LineStrings and MultiLineStrings
- **Polygons**: GeoJSON Polygons and MultiPolygons
- **Labels**: Automatic text labels for point features with name/id properties
- **Live GPS**: Real-time vessel tracking from Seapath navigation system via UDP

---

## Live GPS Tracking

The project includes dual GPS feeds for tracking both the **ship (Falkor-too)** and **ROV** simultaneously in real-time.

### GPS Server Modes

The GPS server operates in two modes depending on your data source:

**1. UDP Mode (Testing/Development)** - `server.js`
- Receives NMEA sentences via UDP from marine navigation systems
- Best for: Testing with synthetic data, development environments
- Use: `node server.js`

**2. InfluxDB Mode (Production/Shipboard)** - `server-influxdb.js`
- Queries real-time data from shipboard OpenRVDAS InfluxDB
- Best for: Production use on research vessels with existing data infrastructure
- Use: `node server-influxdb.js`

### Architecture

**UDP Mode (Testing)**:
```
Ship (Seapath) → UDP (port 12345) → GPS Server → WebSocket (port 8081) → Browser
ROV Navigation → UDP (port 12346) → GPS Server → WebSocket (port 8082) → Browser
ROV Telemetry → Mock Data → Telemetry Server → WebSocket (port 8084) → Browser (depth/heading)
```

**InfluxDB Mode (Production)**:
```
Ship (Seapath380) → OpenRVDAS → InfluxDB (10.23.9.24:8086) → GPS Server → WebSocket (port 8081) → Browser
ROV (SB Sprint) → OpenRVDAS → InfluxDB (10.23.9.24:8086) → GPS Server → WebSocket (port 8082) → Browser
ROV Telemetry → InfluxDB (sb_sprint) → Telemetry Server → WebSocket (port 8084) → Browser (depth/heading)
```

### GPS Server Features
- **Dual GPS feeds**: Simultaneous tracking of ship and ROV on separate WebSocket ports
- **UDP Mode**: Parses NMEA sentences (GGA/RMC/VTG), converts DDMM.MMMM to decimal degrees
- **InfluxDB Mode**: Queries seapath380 (ship) and sb_sprint (ROV) measurements every 1 second
- Broadcasts parsed GPS data to connected browser clients via WebSocket
- Stores latest GPS data for new client connections
- Automatic reconnection on disconnect for each feed independently
- **Upcoming**: Historical position queries (UTC time selector) and trackline date range filtering

### Supported NMEA Sentences
- **GGA**: Global Positioning System Fix Data (lat/lon, satellites, altitude, quality)
- **RMC**: Recommended Minimum Specific GNSS Data (lat/lon, speed, course, date/time)
- **VTG**: Course Over Ground and Ground Speed (course, speed in knots/km/h)

### Frontend GPS Display
- **Ship marker**: Red vessel marker with Falkor-too icon (scales 80-200px with zoom)
- **ROV marker**: Green vehicle marker with ROV icon (scales 40-120px, smaller than ship)
- Heading arrows showing vessel/ROV course (from NMEA RMC/VTG)
- Separate track trails for each vehicle showing last 100 positions
- Color-coded trails: Ship = red, ROV = green
- Interactive popups with vehicle metadata (speed, course, satellites, quality)
- Independent toggle visibility and opacity controls for each vehicle
- Separate trackline toggles for ship and ROV trails
- Automatic reconnection with status indicators for each feed

### Running with Docker (Production)
The GPS server is included in `docker-compose.yml`:

```bash
# Start all services (tile server + GPS server)
docker-compose up -d --build

# View GPS server logs
docker-compose logs -f gps-server

# Restart GPS server
docker-compose restart gps-server
```

**Note**: Docker uses UDP mode by default. For InfluxDB mode in Docker, update `docker-compose.yml` to:
- Mount `.env` file with InfluxDB credentials
- Change command from `node server.js` to `node server-influxdb.js`

### Running Standalone (Development)

#### UDP Mode (Testing with NMEA sentences)
For development or testing with synthetic NMEA data:

```bash
# Terminal 1: Start GPS server (UDP mode)
cd gps-server
npm install
node server.js

# Terminal 2: Send test ship data
echo '$GPRMC,123519,A,4807.038,N,01131.000,W,022.4,084.4,230394,003.1,W*6A' | nc -u localhost 12345
# Or use the test script
node test-moving-ship.js

# Terminal 3: Send test ROV data
echo '$GPGGA,123519,4807.100,N,01131.100,W,1,08,0.9,545.4,M,46.9,M,,*47' | nc -u localhost 12346
# Or use the test script
node test-moving-rov.js
```

#### InfluxDB Mode (Production with OpenRVDAS)
For production use with shipboard InfluxDB:

```bash
# Terminal 1: Configure InfluxDB connection
cd gps-server
cat > .env << EOF
INFLUXDB_URL=http://10.23.9.24:8086
INFLUXDB_TOKEN=your_token_here
INFLUXDB_ORG=your_org_id_here
INFLUXDB_BUCKET=openrvdas
WS_PORT_SHIP=8081
WS_PORT_ROV=8082
QUERY_INTERVAL=1000
EOF

# Start GPS server (InfluxDB mode)
npm install
node server-influxdb.js

# The server will query InfluxDB every 1 second for:
# - Ship: seapath380 measurement (Seapath_Latitude, Seapath_Longitude, Seapath_HeadingTrue, etc.)
# - ROV: sb_sprint measurement (SB_Sprint_Latitude, SB_Sprint_Longitude, SB_Sprint_Depth_Corr, etc.)
```

**InfluxDB Measurements Used**:
- `seapath380`: Ship GPS data (Latitude, Longitude, HeadingTrue, CourseTrue, SpeedKt, NumSats, FixQuality)
- `sb_sprint`: ROV navigation (Latitude, Longitude, Depth_Corr, HeadingTrue, Altitude_m, Pitch, Roll)

**Testing InfluxDB Connection**:
```bash
cd gps-server
node test-seapath.js  # List seapath380 available fields
node test-usbl.js     # Query USBL positioning data
```

### Configuration

#### UDP Mode Configuration
GPS server environment variables (set in `docker-compose.yml` or `.env`):
- `UDP_PORT_SHIP`: UDP port for receiving ship GPS data (default: 12345)
- `UDP_PORT_ROV`: UDP port for receiving ROV GPS data (default: 12346)
- `UDP_HOST`: UDP bind address (default: 0.0.0.0)
- `WS_PORT_SHIP`: WebSocket port for ship browser clients (default: 8081)
- `WS_PORT_ROV`: WebSocket port for ROV browser clients (default: 8082)

#### InfluxDB Mode Configuration
GPS server environment variables (required in `.env` file):
- `INFLUXDB_URL`: InfluxDB server URL (e.g., http://10.23.9.24:8086)
- `INFLUXDB_TOKEN`: InfluxDB authentication token
- `INFLUXDB_ORG`: InfluxDB organization ID (not name - use orgID from API)
- `INFLUXDB_BUCKET`: InfluxDB bucket name (e.g., openrvdas)
- `WS_PORT_SHIP`: WebSocket port for ship browser clients (default: 8081)
- `WS_PORT_ROV`: WebSocket port for ROV browser clients (default: 8082)
- `QUERY_INTERVAL`: InfluxDB query interval in milliseconds (default: 1000)

**Finding your InfluxDB Org ID**:
```bash
curl -H "Authorization: Token YOUR_TOKEN" http://10.23.9.24:8086/api/v2/buckets | grep orgID
```

**Network Setup**: 
- By default, services run on `localhost`
- To access from network devices: Get your machine's IP with `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux)
- Update `index.html` to replace `localhost` with your IP address in the tile server and WebSocket URLs

### Connecting Navigation Systems

**Ship (Seapath)**:
Configure your Seapath navigation system to transmit NMEA sentences via UDP to:
- **Host**: Your machine's IP address (use `ipconfig getifaddr en0` or `hostname -I` to find it)
- **Port**: 12345 (or configured UDP_PORT_SHIP)
- **Protocol**: UDP

**ROV Navigation**:
Configure your ROV navigation system to transmit NMEA sentences via UDP to:
- **Host**: Your machine's IP address 
- **Port**: 12346 (or configured UDP_PORT_ROV)
- **Protocol**: UDP

The GPS server will automatically parse incoming NMEA sentences and broadcast position updates to connected browsers on their respective WebSocket ports.

### Testing GPS Feeds
Several ways to test both GPS feeds:

```bash
# Method 1: Using netcat (nc) - Ship
echo '$GPRMC,123519,A,4807.038,N,01131.000,W,022.4,084.4,230394,003.1,W*6A' | nc -u localhost 12345

# Method 1: Using netcat (nc) - ROV
echo '$GPGGA,123519,4807.100,N,01131.100,W,1,08,0.9,545.4,M,46.9,M,,*47' | nc -u localhost 12346

# Method 2: Using test scripts
cd gps-server
node test-gps.js          # Send ship GPS data to port 12345
node test-rov-gps.js      # Send ROV GPS data to port 12346

# Method 3: Watch server logs (Docker)
docker-compose logs -f gps-server

# Method 3: Watch server logs (standalone)
tail -f gps-server/gps-server.log
```

**Expected behavior**: 
- **Ship**: Red vessel marker (Falkor-too icon) appears on map with heading arrow and red track trail
- **ROV**: Green vehicle marker (ROV icon) appears on map, smaller than ship, with green track trail
- Both markers scale with zoom level (ship larger than ROV)
- Independent visibility controls and opacity sliders for each vehicle

### Historical Position Features (InfluxDB Mode)

When using InfluxDB mode, the GPS server can query historical position data in addition to real-time streaming:

#### 1. UTC Time Selector (Time Travel)
View ship and ROV positions at any specific time in the past:

**Features**:
- DateTime picker to select any UTC timestamp
- Queries InfluxDB for exact position at selected time
- Displays historical position markers with different styling
- "Back to Live" button to resume real-time streaming
- Useful for: Post-dive analysis, incident review, waypoint verification

**Usage** (Frontend controls - upcoming):
- Click "Time Travel" button to open DateTime picker
- Select date and time in UTC
- Click "Go to Time" to query historical positions
- Map displays ship and ROV positions at that exact moment
- Click "Back to Live" to resume real-time tracking

#### 2. Historical Trackline Date Range Filter
Display complete track history between two dates:

**Features**:
- Start and end DateTime pickers for date range selection
- Queries all position data within selected range
- Renders as colored paths on map (separate from live tracklines)
- Automatic downsampling for long date ranges (performance)
- Toggle visibility, opacity, and color controls
- Useful for: Mission planning, dive track review, environmental studies

**Usage** (Frontend controls - upcoming):
- Click "Load Historical Track" button
- Select start date/time in UTC
- Select end date/time in UTC
- Choose vehicle (ship/ROV/both)
- Click "Load" to query and display track
- Historical tracks shown in different colors from live tracks
- Export to GeoJSON option for external analysis

**Query Performance Notes**:
- Date ranges < 24 hours: Full resolution (1-second intervals)
- Date ranges 1-7 days: 10-second aggregation
- Date ranges > 7 days: 1-minute aggregation
- Large queries may take 5-10 seconds to load

**InfluxDB Flux Query Example**:
```flux
from(bucket: "openrvdas")
  |> range(start: 2025-01-15T00:00:00Z, stop: 2025-01-15T23:59:59Z)
  |> filter(fn: (r) => r["_measurement"] == "seapath380")
  |> filter(fn: (r) => r["_field"] == "Seapath_Latitude" or r["_field"] == "Seapath_Longitude")
  |> aggregateWindow(every: 10s, fn: mean)  // Downsampling for performance
```

---

## ROV Telemetry (Depth & Heading)

ROV depth and heading data is displayed at the top center of the map when the ROV GPS feed is active. This data comes from a separate **telemetry server** that queries **InfluxDB** for sensor data.

### Architecture
```
ROV Sensors → NMEA Feed → InfluxDB → Telemetry Server → WebSocket (port 8084) → Browser
```

### Features
- **Real-time depth and heading display** at top center of map
- **InfluxDB integration** for production sensor data
- **Mock data mode** for testing without InfluxDB
- **Automatic connection management** - starts when ROV GPS connects, stops when disconnected
- **Health check endpoint** for monitoring

### Data Sources
The telemetry server can operate in two modes:

1. **Production Mode (InfluxDB)**: Queries real sensor data from InfluxDB
   - Depth from ROV pressure/depth sensor
   - Heading from ROV compass/gyro
   - Additional fields: altitude, pitch, roll

2. **Mock Data Mode**: Generates simulated telemetry for testing
   - Depth: 20-100m range with slow variations
   - Heading: Continuous 0-360° rotation
   - Altitude: 1-10m above seafloor
   - Pitch/Roll: Small realistic movements

### Configuration

**Telemetry Server** (`rov-telemetry-server/.env`):
- `WS_PORT_TELEMETRY`: WebSocket port (default: 8084)
- `INFLUXDB_URL`: InfluxDB server URL (e.g., http://10.23.9.24:8086)
- `INFLUXDB_TOKEN`: InfluxDB authentication token
- `INFLUXDB_ORG`: InfluxDB organization ID (not name - use orgID from API)
- `INFLUXDB_BUCKET`: InfluxDB bucket name (e.g., openrvdas)
- `QUERY_INTERVAL`: Query frequency in ms (default: 1000)
- `USE_MOCK_DATA`: Set to `false` when InfluxDB is configured (default: true)

**InfluxDB Configuration Example**:
```bash
cd rov-telemetry-server
cat > .env << EOF
WS_PORT_TELEMETRY=8084
INFLUXDB_URL=http://10.23.9.24:8086
INFLUXDB_TOKEN=your_token_here
INFLUXDB_ORG=your_org_id_here
INFLUXDB_BUCKET=openrvdas
QUERY_INTERVAL=1000
USE_MOCK_DATA=false
EOF
```

### Running with Docker (Production)
```bash
# Configure InfluxDB credentials in .env or docker-compose.yml
docker-compose up -d rov-telemetry-server

# View telemetry server logs
docker-compose logs -f rov-telemetry-server

# Check health
curl http://localhost:8084/health
```

### Running Standalone (Development)
```bash
# Terminal: Start telemetry server with mock data
cd rov-telemetry-server
npm install
npm run dev  # Uses mock data

# Or with InfluxDB (production)
cp .env.example .env
# Edit .env with your InfluxDB credentials
npm start
```

### InfluxDB Schema
The telemetry server queries the following InfluxDB schema:

**Production Mode (OpenRVDAS)**:
- **Measurement**: `sb_sprint` (ROV navigation system)
- **Fields**: 
  - `SB_Sprint_Depth_Corr` (float) - Corrected depth in meters
  - `SB_Sprint_HeadingTrue` (float) - True heading in degrees (0-360)
  - `SB_Sprint_Altitude_m` (float) - Altitude above seafloor in meters
  - `SB_Sprint_Pitch` (float) - Pitch angle in degrees
  - `SB_Sprint_Roll` (float) - Roll angle in degrees
  - `SB_Sprint_Latitude` (float) - ROV latitude
  - `SB_Sprint_Longitude` (float) - ROV longitude

**Testing Mode (Mock Data)**:
- **Measurement**: `rov_telemetry` (if using custom InfluxDB for testing)
- **Fields**: Same as above but without `SB_Sprint_` prefix

**Testing InfluxDB Connection**:
```bash
cd rov-telemetry-server
node test-influx.js        # List all measurements in bucket
node test-sb-mechs.js      # List sb_sprint field names
```

See `rov-telemetry-server/README.md` for detailed setup and customization instructions.

### Testing ROV Telemetry

**With Mock Data** (no InfluxDB required):
```bash
# Terminal 1: Start telemetry server with mock data
cd rov-telemetry-server
npm install
npm run dev

# Terminal 2: Start GPS server (if not already running)
cd ../gps-server
npm install
node server.js

# Terminal 3: Send test ROV GPS data to trigger telemetry display
echo '$GPGGA,123519,4807.100,N,01131.100,W,1,08,0.9,545.4,M,46.9,M,,*47' | nc -u localhost 12346

# Open browser to http://localhost:8000
# The ROV marker will appear, and depth/heading will display at top center
```

**With InfluxDB** (production):
```bash
# Configure InfluxDB in rov-telemetry-server/.env
cd rov-telemetry-server
cp .env.example .env
# Edit .env with your InfluxDB credentials and set USE_MOCK_DATA=false

# Install InfluxDB client
npm install @influxdata/influxdb-client

# Start server
npm start

# Check health
curl http://localhost:8084/health
```

**Expected Display:**
- When ROV GPS connects: "Depth: XX.Xm | Heading: XXX.X°" appears at top center
- Mock mode: Values change smoothly (depth 20-100m, heading 0-360°)
- InfluxDB mode: Real-time sensor data from ROV
- When ROV GPS disconnects: Display automatically hides

---

## Multibeam Swath Visualization

The project visualizes real-time multibeam sonar coverage from three Kongsberg systems aboard the ship, showing the swath footprint as colored polygons on the map.

### Supported Systems

| System | Frequency | Depth Range | Swath Width | Color | Application |
|--------|-----------|-------------|-------------|-------|-------------|
| **EM 124** | 12 kHz | 20-11,000m | 150° | Blue | Deep water mapping |
| **EM 712** | 40/70 kHz | 3-3,000m | 140° | Green | Mid-water mapping |
| **EM 2040** | 200/400 kHz | 0.5-600m | 130° | Yellow/Orange | Shallow water/high-resolution |

### Architecture
```
Ship Position/Heading → InfluxDB → Multibeam Server → WebSocket (8085) → Browser
                            ↓
                    Calculate swath geometry
                    Based on depth & beam angle
```

### Features
- **Real-time swath polygons** showing current multibeam coverage footprint on map
- **Multi-system support** - displays all active systems simultaneously based on depth
- **Depth-adaptive** - automatically shows appropriate system(s) for current water depth
- **Color-coded visualization** - blue (deep), green (mid), yellow (shallow)
- **Semi-transparent overlays** - see bathymetry underneath the swath
- **Interactive popups** - click swath for system info, depth, swath width, and timestamp
- **Independent controls** - toggle visibility and opacity for each system
- **InfluxDB integration** for production data or mock mode for testing

### How Swath Calculation Works

The server calculates swath geometry based on:
1. **Ship position** (lat/lon) from GPS
2. **Ship heading** - direction of survey line
3. **Water depth** - determines which system is active and swath width
4. **Beam angle** - system-specific (130-150°)

**Swath width formula**: `width = depth × tan(beam_angle/2) × 2`

The polygon is projected perpendicular to the ship's heading, creating a coverage footprint.

### Configuration

**Multibeam Server** (`multibeam-server/.env`):
- `WS_PORT_MULTIBEAM`: WebSocket port (default: 8085)
- `INFLUXDB_URL`: InfluxDB server URL
- `INFLUXDB_TOKEN`: InfluxDB authentication token
- `INFLUXDB_ORG`: InfluxDB organization name
- `INFLUXDB_BUCKET`: InfluxDB bucket name (default: multibeam-data)
- `QUERY_INTERVAL`: Query frequency in ms (default: 1000)
- `USE_MOCK_DATA`: Set to `false` when InfluxDB is configured (default: true)

### Running with Docker (Production)
```bash
# Start multibeam service
docker-compose up -d multibeam-server

# View logs
docker-compose logs -f multibeam-server

# Check health
curl http://localhost:8085/health
```

### Running Standalone (Development)
```bash
# Terminal: Start multibeam server with mock data
cd multibeam-server
npm install
npm run dev  # Uses mock data

# Or with InfluxDB (production)
cp .env.example .env
# Edit .env with your InfluxDB credentials
npm start
```

### Testing Multibeam Visualization

**With Mock Data** (no InfluxDB required):
```bash
# Terminal 1: Start multibeam server
cd multibeam-server
npm install
npm run dev

# Open browser to http://localhost:8000
# The "Multibeam Swath" layer group will show active systems
# Mock data simulates ship moving through 100-900m depth range
```

**Expected Display:**
- **Blue polygon (EM 124)**: Active in deep water (20-11,000m)
- **Green polygon (EM 712)**: Active in mid-water (3-3,000m)
- **Yellow polygon (EM 2040)**: Active in shallow water (0.5-600m)
- Systems automatically activate/deactivate based on depth
- Click any swath polygon for details (system, depth, width, time)
- Use opacity sliders to adjust transparency

### InfluxDB Schema

The server expects this schema (customizable in `server.js`):

**Measurement:** `multibeam`

**Fields:**
- `lat` (float) - Ship latitude
- `lon` (float) - Ship longitude
- `heading` (float) - Ship heading in degrees (0-360)
- `depth` (float) - Water depth in meters
- `system` (string) - System identifier (EM124, EM712, EM2040)

See `multibeam-server/README.md` for detailed setup and customization instructions.

---

## ADCP Current Vectors

The project includes visualization of ocean current data from ADCP (Acoustic Doppler Current Profiler) systems running UHDAS software. Current vectors are displayed as dark blue arrows where arrow length represents current speed.

### Architecture
```
NetCDF Database → Python Reader → WebSocket (8083) → Browser
                      ↓
                 Query every 5 minutes
                 Parse u, v, lat, lon, depth
                 Calculate speed & direction
```

### ADCP Features
- **Real-time updates**: Automatically queries database every 5 minutes
- **Historical data**: User-selectable time intervals (1, 3, 6, 12, or 24 hours)
- **Multi-instrument support**: 
  - **WH 300kHz**: 0-25m, 25-50m depth ranges
  - **EC 150kHz**: 50-150m, 150-300m depth ranges
  - **OS 38kHz**: 300-500m, >500m depth ranges
- **Arrow visualization**: Dark blue arrows scaled by velocity (longer = faster)
- **Interactive popups**: Click arrows for detailed current data (u, v, speed, direction, depth, time, quality)
- **Quality filtering**: Uses percent-good and editing flags from NetCDF data

### ADCP Data Format
Reads NetCDF files with COARDS/CF conventions:
- **Variables**: time, lat, lon, depth, u (eastward), v (northward), pg (percent good), pflag (editing flags)
- **Units**: velocities in m/s, depth in meters, time in days since yearbase
- **Standard**: CF-compliant trajectoryProfile featureType

### Running ADCP Server

**With Docker (Recommended):**
```bash
# All services including ADCP
docker-compose up -d

# View ADCP server logs
docker-compose logs -f adcp-server

# Restart ADCP server
docker-compose restart adcp-server
```

**Standalone:**
```bash
cd adcp-server
npm install
pip3 install netCDF4 numpy
node server.js
```

### Connecting to ADCP Database

**Update docker-compose.yml** to mount your NetCDF data directory:
```yaml
adcp-server:
  volumes:
    - /path/to/your/adcp/data:/data/adcp:ro
  environment:
    - NETCDF_PATH=/data/adcp/os38nb.nc
```

**Or set environment variable** when running standalone:
```bash
export NETCDF_PATH=/path/to/adcp/os38nb.nc
node server.js
```

### Testing ADCP Visualization

```bash
# Test Python NetCDF reader
cd adcp-server
python3 test_adcp.py

# Start ADCP server (uses mock data until database connected)
node server.js
```

**Expected behavior**:
- Dark blue arrows appear on map along ship track
- Arrow length scales with current speed
- Arrows point in direction of current flow (0°=North, 90°=East)
- UI shows: "Last update: [timestamp] | [N] vectors | [depth]m ([instrument])"
- Changing time interval or depth range requests new data

### ADCP Configuration

Environment variables (set in `docker-compose.yml` or `.env`):
- `WS_PORT_ADCP`: WebSocket port for browser clients (default: 8083)
- `NETCDF_PATH`: Path to ADCP NetCDF file(s)
- `AUTO_REFRESH_INTERVAL`: Auto-query interval in ms (default: 300000 = 5 minutes)

---

## Data Layers (Oceanographic Sensors)

The project visualizes oceanographic sensor data from shipboard instruments via **OpenRVDAS** (Open Research Vessel Data Acquisition System) and **InfluxDB**. Sensor data is displayed as interactive heatmaps showing spatial patterns over time.

### Supported Sensors

| Sensor | Unit | Measurement | Color | Source |
|--------|------|-------------|-------|--------|
| **Water Temperature** | °C | `tsg_temperature` | Red | TSG (Thermosalinograph) |
| **Salinity** | PSU | `tsg_salinity` | Teal | TSG |
| **Fluorescence** | mg/m³ | `fluorometer_chl` | Light Blue | Fluorometer |
| **Dissolved Oxygen** | mg/L | `ctd_oxygen` | Green | CTD |
| **pH** | pH | `ctd_ph` | Yellow | CTD |
| **Turbidity** | NTU | `ctd_turbidity` | Gray | CTD |
| **Chlorophyll** | µg/L | `fluorometer_chl_a` | Bright Green | Fluorometer |

### Architecture
```
Shipboard Sensors → OpenRVDAS → InfluxDB ← Oceanographic Server → WebSocket (8086) → Browser
      ↓                                           ↓
  TSG, CTD, Fluorometer                   Correlate with GPS via timestamp
  Real-time NMEA data                     Generate spatial data points
                                          Real-time + Historical queries
```

### Features
- **Real-time heatmaps**: Live sensor data displayed as colored heat layers
- **Historical data**: Query 1-48 hours of historical data for pattern analysis
- **Spatial correlation**: Sensor readings matched with GPS coordinates via timestamp
- **Multi-sensor visualization**: Display multiple parameters simultaneously
- **Interactive controls**: Toggle sensors, adjust opacity, select time ranges
- **Color-coded heatmaps**: Each sensor has distinct color gradient
- **Density-based rendering**: Heatmap intensity based on data point density

### How It Works

1. **Data Acquisition**: OpenRVDAS collects sensor data from shipboard instruments
2. **Storage**: Data logged to InfluxDB with timestamps
3. **GPS Correlation**: Server joins sensor readings with Seapath GPS data by timestamp
4. **Real-time Streaming**: Live data points broadcast via WebSocket
5. **Historical Queries**: On-demand queries for time-series heatmap generation
6. **Heatmap Rendering**: MapLibre GL renders data as density-based heat layers

### Running Oceanographic Server

**With Docker (Recommended):**
```bash
# Start all services including oceanographic
docker-compose up -d

# View oceanographic server logs
docker-compose logs -f oceanographic-server

# Check health
curl http://localhost:8086/health
```

**Standalone (Development):**
```bash
cd oceanographic-server
npm install
USE_MOCK_DATA=true npm start  # Uses mock data
```

**With InfluxDB (Production):**
```bash
cd oceanographic-server
cp .env.example .env
# Edit .env with your InfluxDB credentials and set USE_MOCK_DATA=false
npm install
npm start
```

### Testing Oceanographic Visualization

```bash
# Start oceanographic server with mock data
cd oceanographic-server
npm install
USE_MOCK_DATA=true npm start

# Open browser to http://localhost:8000
# The "Data Layers" section will show all 8 sensors
# Toggle sensors on to see heatmaps with simulated data
```

**Expected Display:**
- **Colored heatmaps** showing sensor distribution along ship track
- **Real-time updates** as new data arrives (every 2 seconds in mock mode)
- **Historical patterns** when selecting time ranges (1-48 hours)
- **Density gradients** - brighter colors = higher data density
- **Multiple layers** can be displayed simultaneously
- Use opacity sliders to blend multiple sensor heatmaps

### OpenRVDAS Integration

This system integrates with your shipboard OpenRVDAS installation. See **[OPENRVDAS_INTEGRATION.md](OPENRVDAS_INTEGRATION.md)** for detailed setup instructions including:

- InfluxDB schema configuration
- OpenRVDAS logger setup
- Timestamp synchronization with Seapath GPS
- Flux query examples for joining sensor + GPS data
- Data quality filtering
- Production deployment guide
- Troubleshooting tips

### Configuration

**Oceanographic Server** (`oceanographic-server/.env`):
```bash
INFLUXDB_URL=http://shipboard-influxdb:8086
INFLUXDB_TOKEN=your-token-here
INFLUXDB_ORG=schmidt-ocean
INFLUXDB_BUCKET=openrvdas

PORT=8086
USE_MOCK_DATA=false
QUERY_INTERVAL_MS=2000
HISTORICAL_RANGE_HOURS=24
```

### InfluxDB Schema

The server expects sensor data and GPS position to be logged separately and joins them by timestamp:

**Sensor Data:**
```
Measurement: tsg_temperature, tsg_salinity, fluorometer_chl, ctd_oxygen, ctd_ph, ctd_turbidity, fluorometer_chl_a
Fields: value (float)
Tags: instrument_id, quality_flag (optional)
Time: UTC timestamp
```

**GPS Position:**
```
Measurement: seapath_position
Fields: latitude (float), longitude (float), heading (float)
Tags: device_id
Time: UTC timestamp
```

The server uses Flux queries to join sensor readings with GPS coordinates by matching timestamps.

### Historical Data Time Ranges

Select from dropdown in UI:
- **1 Hour**: Recent patterns, high detail
- **6 Hours**: Half-day trends
- **12 Hours**: Daily patterns (default)
- **24 Hours**: Full day coverage
- **48 Hours**: Two-day trends

### Performance Notes

- **Point limit**: Frontend stores max 1000 points per sensor to prevent memory issues
- **Downsampling**: For large time ranges, consider adding downsampling in Flux queries
- **Heatmap intensity**: Automatically scales with zoom level (1x at zoom 0, 3x at zoom 15)
- **Radius**: Heat point radius increases from 2px to 40px based on zoom level

---

## Complete System Overview

This MapLibre visualization system integrates 6 backend services providing real-time and historical oceanographic data:

| Service | Port | Purpose | Data Source |
|---------|------|---------|-------------|
| **TileServer GL** | 8080 | MBTiles basemaps | Local `.mbtiles` files |
| **GPS Server** | 8081/82 | Ship & ROV tracking | Seapath NMEA (UDP) |
| **ADCP Server** | 8083 | Ocean currents | NetCDF database |
| **Telemetry Server** | 8084 | ROV depth/heading | InfluxDB |
| **Multibeam Server** | 8085 | Sonar swath coverage | InfluxDB |
| **Oceanographic Server** | 8086 | 8 sensor heatmaps | InfluxDB + OpenRVDAS |

All services can run in **mock data mode** for testing without requiring production databases.

