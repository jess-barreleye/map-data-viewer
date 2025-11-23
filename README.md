# Map Project: 2D Interactive Viewer

This project implements a basic 2D interactive web map using **MapLibre GL JS** to visualize custom oceanographic data from a local MBTiles file.

## Project Overview

The goal of this phase was to set up the core MapLibre framework and successfully serve and display custom vector tiles (`.pbf` format) contained within a local MBTiles file (`map.mbtiles`).

## Prerequisites

Before starting the server and viewing the map, ensure you have the following software installed:

1.  **Node.js & npm:** Required to install and run the tile server.
2.  **TileServer GL:** The server used to read the `map.mbtiles` file and serve its contents as web-ready vector tiles.
    ```bash
    npm install -g tileserver-gl
    ```
3.  **Python:** (Optional) Used to run a simple HTTP server for the `index.html` and `style.json` files.

## Project Structure

Your project directory should contain:
maplive/
 ├── index.html # The main HTML file (MapLibre setup) 
 ├── style.json # The MapLibre style definition (references the tiles) 
 └── maps/ 
   └── map.mbtiles # Your custom vector tile file (contains the data)

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

Navigate to your main project directory (project4upload/).

Run the Python HTTP server:
 ```bash
python -m http.server 8000
 ```

### Step 5: View the Map
Open your web browser.

Navigate to the local server address:

http://localhost:8000/

You should now see the MapLibre map loaded with your custom data from the map.mbtiles file!
