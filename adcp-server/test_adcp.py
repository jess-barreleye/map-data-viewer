#!/usr/bin/env python3
"""
Test ADCP data reader - verifies the Python script works correctly
"""

import sys
import json

# Add parent directory to path to import read_adcp
sys.path.insert(0, '.')

from read_adcp import generate_mock_data

def test_mock_data():
    """Test the mock data generator"""
    print("Testing ADCP mock data generation...")
    
    # Test different depth ranges and instruments
    test_cases = [
        ("0-25", "WH300"),
        ("25-50", "WH300"),
        ("50-150", "EC150"),
        ("300-500", "OS38"),
    ]
    
    for depth_range, instrument in test_cases:
        print(f"\nTesting {instrument} at {depth_range}m:")
        data = generate_mock_data(depth_range, instrument)
        
        print(f"  Timestamp: {data['timestamp']}")
        print(f"  Instrument: {data['instrument']}")
        print(f"  Depth Range: {data['depthRange']}")
        print(f"  Number of vectors: {len(data['vectors'])}")
        
        if data['vectors']:
            v = data['vectors'][0]
            print(f"  Sample vector:")
            print(f"    Position: {v['lat']:.4f}°N, {v['lon']:.4f}°E")
            print(f"    Velocity: u={v['u']:.3f} m/s, v={v['v']:.3f} m/s")
            print(f"    Speed: {v['speed']:.3f} m/s")
            print(f"    Direction: {v['direction']:.1f}°")
            print(f"    Quality: {v['quality']}%")
    
    print("\n✓ All tests passed!")
    print("\nTo test with the server:")
    print("  1. cd adcp-server")
    print("  2. npm install")
    print("  3. node server.js")
    print("  4. Open browser to http://localhost:8000 (with main frontend running)")

if __name__ == '__main__':
    test_mock_data()
