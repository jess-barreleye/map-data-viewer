# Background Map Setup for Web Tiles
This guide explains how to prepare and export a custom background map as web tiles, primarily using QGIS. This process involves reprojecting your map data and then exporting it into a web-ready format.

## 1. Reprojecting Raster Layers to Web Mercator (EPSG:3857)
Before exporting, you must reproject your raster data to Web Mercator (EPSG:3857). If you skip this, the export process will automatically reproject using a "nearest neighbor" method, which often causes undesirable grid-like artifacts in the final map.

### Steps in QGIS:
Select the raster layer you want to reproject.

Go to Raster → Projections → Warp (Reproject).

Set the Source CRS (Coordinate Reference System) to the layer's original projection.

Set the Target CRS to EPSG:3857 - WGS 84 / Pseudo-Mercator.

For the Resampling method, choose Cubic B-Spline. This usually provides the smoothest and highest-quality result for continuous data like imagery.

Save the output. It's best to save it to a permanent file, as you will likely need this reprojected layer again.

## 2. Exporting the Reprojected Map as Web Tiles
Once your map scene is set up with the reprojected layer, you can export it into a tile set that a web server can use.

### Steps in QGIS:
Open the Processing Toolbox by going to View → Panels → Processing Toolbox.

In the toolbox, navigate to Raster tools → Generate XYZ tiles.

Key Export Options:
Output Format: Choose one of the following:

Directory: Outputs a folder structure containing many individual image files (tiles). This is good for granular updates, as you can re-export and overwrite a subset of tiles later.

MBTiles: Packages all the tiles into a single file (.mbtiles), which is often simpler to manage and serve.

Extent: This defines the geographic area to be exported. It's often most reliable to choose Draw on Map Canvas and manually select the area to avoid potential errors that can occur when setting the extent from a layer.

Zoom Levels:

Minimum zoom: Determines the largest area covered by a single image (tile). 0 represents the entire Earth. Be mindful that if the minimum zoom covers a much larger area than your selected Extent, you might see odd behavior when zooming out.

Maximum zoom: Determines the smallest coverage tiles to export, which corresponds to the highest level of detail when zoomed in. Higher maximum zoom results in more detail but will significantly increase export time and file size.

Output directory or file: Select where to save the generated tiles.

## 3. Serving the Tiles
The generated tiles (whether in a directory structure or an MBTiles file) must be served by a web server so a web mapping application can access them. A convenient setup is to use a web server with a shared filesystem where you can directly export the tiles.

