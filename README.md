# Schmidt Ocean 2D Interactive Map Viewer

An interactive web-based map viewer built with **MapLibre GL JS** for visualizing oceanographic survey data, including MBTiles raster layers, vector point data, and GeoJSON geometries.

## Features

- **MBTiles Raster Layer**: Display custom raster tiles from a local tile server with opacity control
- **MapTiler Basemap**: Ocean-themed basemap overlay (requires API key)
- **Point Layers**: Load CSV/TXT files with lat/long coordinates as toggleable point layers
- **Geometry Layers**: Load GeoJSON/ASCII files (LineStrings, Polygons) as toggleable geometry layers
- **Layer Controls**: Individual checkboxes and opacity sliders for each layer
- **Color Legend**: Dynamic legend showing only active layers with color swatches
- **Auto-Centering**: Automatically fits map to tile server data extent on load
- **Interactive Legend**: Click legend items to zoom to that layer's bounds
- **Responsive Design**: Floating panels on left and bottom-left for controls and legend

## Prerequisites

Before running the project, install:

1. **Node.js & npm** (optional, for tileserver-gl)
2. **TileServer GL** (to serve MBTiles):
   ```bash
   npm install -g tileserver-gl
   ```
3. **Python 3** (to serve the HTML/JSON files):
   - Usually pre-installed on macOS/Linux
   - Available from [python.org](https://www.python.org) on Windows

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

---

### Step 1: Start the Tile Server (TileServer GL)

This server reads your `map.mbtiles` and makes the vector tiles accessible via a web address (usually `http://localhost:8080`).

1.  Open your terminal and navigate to the folder containing the `maps` subdirectory.
2.  Run the `tileserver-gl` command, pointing directly to your MBTiles file:

    ```bash
    tileserver-gl ./maps/map.mbtiles
    ```

    *The server will typically start on **Port 8080**.*

    You can bring up the map here: http://localhost:8080

---

### Step 2: Configure Map Files (`style.json`)

The `style.json` file tells MapLibre where to find your tiles. This configuration assumes your TileServer GL is running on port 8080.

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

# Schmidt Ocean 2D Interactive Map Viewer

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

You should see a red vessel marker appear on the map! 🎯

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
└── gps-server/                 # GPS UDP listener and WebSocket relay
    ├── server.js              # GPS server implementation
    ├── package.json           # GPS server dependencies
    ├── Dockerfile             # GPS server container image
    ├── test-gps.js            # Test script for sending GPS data
    └── .env.example           # Environment configuration template
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

The project includes a GPS server that receives UDP transmissions from marine navigation systems (Seapath) and broadcasts vessel positions to the map in real-time.

### Architecture
```
Seapath Navigation → UDP (port 12345) → GPS Server (Node.js) → WebSocket (port 8081) → Browser
```

### GPS Server Features
- Receives NMEA sentences via UDP from Seapath navigation system
- Parses GGA (position), RMC (recommended minimum), and VTG (course/speed) sentence types
- Converts NMEA coordinate format (DDMM.MMMM) to decimal degrees
- Broadcasts parsed GPS data to connected browser clients via WebSocket
- Stores latest GPS data for new client connections
- Automatic reconnection on disconnect

### Supported NMEA Sentences
- **GGA**: Global Positioning System Fix Data (lat/lon, satellites, altitude, quality)
- **RMC**: Recommended Minimum Specific GNSS Data (lat/lon, speed, course, date/time)
- **VTG**: Course Over Ground and Ground Speed (course, speed in knots/km/h)

### Frontend GPS Display
- Real-time vessel marker with color-coded position indicator
- Heading arrow showing vessel course (from NMEA RMC/VTG)
- Track trail showing last 100 positions
- Interactive popup with vessel metadata (speed, course, satellites, quality)
- Toggle visibility and opacity controls
- Automatic reconnection with status indicator

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

### Running Standalone (Development)
For development or when Docker is not available:

```bash
# Terminal 1: Start GPS server
cd gps-server
npm install
node server.js

# Terminal 2: Send test data
echo '$GPRMC,123519,A,4807.038,N,01131.000,W,022.4,084.4,230394,003.1,W*6A' | nc -u localhost 12345

# Or use the test script
node test-gps.js
```

### Configuration
GPS server environment variables (set in `docker-compose.yml` or `.env`):
- `UDP_PORT`: UDP port for receiving Seapath GPS data (default: 12345)
- `UDP_HOST`: UDP bind address (default: 0.0.0.0)
- `WS_PORT`: WebSocket port for browser clients (default: 8081)

**Network Setup**: 
- By default, services run on `localhost`
- To access from network devices: Get your machine's IP with `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux)
- Update `index.html` to replace `localhost` with your IP address in the tile server and WebSocket URLs

### Connecting Seapath
Configure your Seapath navigation system to transmit NMEA sentences via UDP to:
- **Host**: Your machine's IP address (use `ipconfig getifaddr en0` or `hostname -I` to find it)
- **Port**: 12345 (or configured UDP_PORT)
- **Protocol**: UDP

The GPS server will automatically parse incoming NMEA sentences and broadcast position updates to connected browsers.

### Testing GPS Feed
Several ways to test the GPS feed:

```bash
# Method 1: Using netcat (nc)
echo '$GPRMC,123519,A,4807.038,N,01131.000,W,022.4,084.4,230394,003.1,W*6A' | nc -u localhost 12345

# Method 2: Using the test script
cd gps-server
node test-gps.js

# Method 3: Watch server logs
tail -f gps-server/gps-server.log
```

**Expected behavior**: Red vessel marker appears on map with heading arrow and track trail.
