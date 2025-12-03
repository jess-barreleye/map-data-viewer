#!/usr/bin/env python3
"""
ADCP NetCDF Data Reader
Reads ADCP current data from NetCDF files and outputs JSON for the Node.js server
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
import numpy as np

# When netCDF4 is available, use it:
try:
    from netCDF4 import Dataset
    HAS_NETCDF = True
except ImportError:
    HAS_NETCDF = False
    print("Warning: netCDF4 not installed. Install with: pip install netCDF4", file=sys.stderr)

def parse_args():
    parser = argparse.ArgumentParser(description='Read ADCP data from NetCDF files')
    parser.add_argument('--time-start', type=int, required=True, help='Start time (Unix timestamp ms)')
    parser.add_argument('--time-end', type=int, required=True, help='End time (Unix timestamp ms)')
    parser.add_argument('--depth-range', type=str, required=True, help='Depth range (e.g., "0-25", "25-50")')
    parser.add_argument('--instrument', type=str, required=True, help='Instrument name (WH300, EC150, OS38)')
    parser.add_argument('--netcdf-path', type=str, help='Path to NetCDF file (optional, uses env var if not set)')
    return parser.parse_args()

def read_adcp_data(netcdf_path, time_start_ms, time_end_ms, depth_range, instrument):
    """
    Read ADCP data from NetCDF file and return vectors as JSON
    
    Returns:
        {
            "timestamp": ISO timestamp,
            "instrument": instrument name,
            "depthRange": depth range string,
            "vectors": [
                {
                    "lat": float,
                    "lon": float,
                    "u": float (m/s, eastward),
                    "v": float (m/s, northward),
                    "speed": float (m/s),
                    "direction": float (degrees, 0=North, 90=East),
                    "depth": float (meters),
                    "time": ISO timestamp,
                    "quality": int (percent good)
                },
                ...
            ]
        }
    """
    
    if not HAS_NETCDF:
        # Return mock data for testing
        return generate_mock_data(depth_range, instrument)
    
    try:
        # TODO: Replace with actual NetCDF file path when database is available
        # nc = Dataset(netcdf_path, 'r')
        
        # Parse depth range
        depth_min, depth_max = map(float, depth_range.split('-')) if '-' in depth_range else (float(depth_range.replace('>', '')), 10000)
        
        # Convert Unix timestamps (ms) to days since yearbase
        # time_start = (time_start_ms / 1000 - yearbase_unix) / 86400
        # time_end = (time_end_ms / 1000 - yearbase_unix) / 86400
        
        # Read data from NetCDF
        # time = nc.variables['time'][:]
        # lat = nc.variables['lat'][:]
        # lon = nc.variables['lon'][:]
        # depth = nc.variables['depth'][:]
        # u = nc.variables['u'][:]  # Zonal velocity
        # v = nc.variables['v'][:]  # Meridional velocity
        # pg = nc.variables['pg'][:]  # Percent good
        
        # Filter by time range and depth range
        # ... filtering logic ...
        
        # Calculate speed and direction for each vector
        # speed = np.sqrt(u**2 + v**2)
        # direction = np.degrees(np.arctan2(u, v)) % 360  # 0=North, 90=East
        
        # nc.close()
        
        # For now, return mock data until NetCDF path is provided
        return generate_mock_data(depth_range, instrument)
        
    except Exception as e:
        print(f"Error reading NetCDF: {e}", file=sys.stderr)
        return generate_mock_data(depth_range, instrument)

def generate_mock_data(depth_range, instrument):
    """Generate mock ADCP data for testing"""
    
    # Generate sample vectors along a track
    vectors = []
    
    # Sample location: Pacific Ocean near the example in NetCDF header
    base_lat = 43.9
    base_lon = -125.1
    
    # Generate 20 vectors along a track
    for i in range(20):
        lat = base_lat + (i * 0.02)
        lon = base_lon + (i * 0.01)
        
        # Vary velocity to show different arrow lengths
        speed = 0.2 + (i % 5) * 0.15  # 0.2 to 0.8 m/s
        direction = 45 + (i * 5) % 360  # Rotating directions
        
        # Convert to u, v components
        u = speed * np.sin(np.radians(direction))
        v = speed * np.cos(np.radians(direction))
        
        vectors.append({
            "lat": lat,
            "lon": lon,
            "u": round(u, 4),
            "v": round(v, 4),
            "speed": round(speed, 3),
            "direction": round(direction, 1),
            "depth": float(depth_range.split('-')[0]) if '-' in depth_range else 300,
            "time": datetime.utcnow().isoformat() + 'Z',
            "quality": 95
        })
    
    return {
        "timestamp": datetime.utcnow().isoformat() + 'Z',
        "instrument": instrument,
        "depthRange": depth_range,
        "vectors": vectors
    }

def main():
    args = parse_args()
    
    # Read ADCP data
    data = read_adcp_data(
        args.netcdf_path,
        args.time_start,
        args.time_end,
        args.depth_range,
        args.instrument
    )
    
    # Output as JSON to stdout (Node.js will read this)
    print(json.dumps(data))

if __name__ == '__main__':
    main()
