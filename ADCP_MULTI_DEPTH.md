# ADCP Multi-Depth Visualization

## Overview
The ADCP visualization system has been updated to support displaying multiple depth ranges simultaneously, each with distinct colors for easy differentiation on the blue map background.

## Features

### Multiple Depth Ranges
Users can now display ADCP velocity vectors from multiple depth ranges at the same time:

- **0-25m** (WH 300kHz) - Red (#ff6b6b)
- **25-50m** (WH 300kHz) - Orange (#ffa502)
- **50-150m** (EC 150kHz) - Green (#2ed573)
- **150-300m** (EC 150kHz) - Dodger Blue (#1e90ff)
- **300-500m** (OS 38kHz) - Light Purple (#a29bfe)
- **>500m** (OS 38kHz) - Pink (#fd79a8)

### Color Selection
Colors were specifically chosen to be easily visible against the blue ocean map background:
- High contrast with blue (#1e3a8a background)
- Distinct from each other for easy differentiation
- Span the color spectrum for maximum visual separation

### User Interface
Each depth range has:
- Color swatch indicator
- Checkbox to enable/disable
- Opacity slider (0-100%)
- Label showing depth range and instrument

### Workflow
1. Check the desired depth ranges
2. Select time range using datetime pickers
3. Click "Apply Time Range" to fetch data
4. Adjust opacity for each layer individually
5. Uncheck to hide layers

## Technical Implementation

### Data Structure
```javascript
// Color mapping
const ADCP_DEPTH_COLORS = {
    '0-25': '#ff6b6b',
    '25-50': '#ffa502',
    '50-150': '#2ed573',
    '150-300': '#1e90ff',
    '300-500': '#a29bfe',
    '>500': '#fd79a8'
};

// Depth configurations
const depthCheckboxes = [
    { id: 'adcp-depth-0-25-chk', depth: '0-25', instrument: 'WH300' },
    { id: 'adcp-depth-25-50-chk', depth: '25-50', instrument: 'WH300' },
    { id: 'adcp-depth-50-150-chk', depth: '50-150', instrument: 'EC150' },
    { id: 'adcp-depth-150-300-chk', depth: '150-300', instrument: 'EC150' },
    { id: 'adcp-depth-300-500-chk', depth: '300-500', instrument: 'OS38' },
    { id: 'adcp-depth-plus500-chk', depth: '>500', instrument: 'OS38' }
];

// Data storage by depth
let adcpVectorsByDepth = {};
```

### MapLibre Layers
Each depth range creates a separate MapLibre layer:
- **Source ID**: `adcp-vectors-{depth}` (e.g., `adcp-vectors-0-25`)
- **Layer ID**: `adcp-arrows-{depth}` (e.g., `adcp-arrows-0-25`)
- **Icon Color**: Applied via `icon-color` paint property
- **Arrow Image**: Uses SVG with `currentColor` for dynamic coloring

### Key Functions

#### `updateADCPLayerForDepth(depthRange)`
Creates or updates a MapLibre layer for a specific depth range:
- Creates GeoJSON source with vector data
- Applies color from ADCP_DEPTH_COLORS
- Scales arrow size based on current speed
- Makes layer visible

#### `requestADCPDataForDepth(depthRange, instrument)`
Requests ADCP data for a specific depth range:
- Reads datetime picker values
- Calculates binning (5min/30min/1hr)
- Sends WebSocket request with depth and instrument parameters

#### `hideADCPLayer(depthRange)`
Hides a specific depth range layer:
- Sets MapLibre layer visibility to 'none'
- Does not clear data, allowing quick re-display

#### `updateADCPLayerOpacity(depthRange, opacity)`
Adjusts opacity for a specific depth range layer:
- Updates icon-opacity paint property
- Range: 0.0 to 1.0

### WebSocket Communication

#### Request Format
```json
{
    "type": "request",
    "startTime": "2024-01-01T00:00:00Z",
    "endTime": "2024-01-01T06:00:00Z",
    "depthRange": "0-25",
    "instrument": "WH300",
    "binning": "5min"
}
```

#### Response Format
```json
{
    "type": "data",
    "depthRange": "0-25",
    "vectors": [
        {
            "lat": 12.345,
            "lon": -67.890,
            "u": 0.15,
            "v": -0.23,
            "direction": 123.45,
            "speed": 0.27,
            "depth": 12.5,
            "quality": 98,
            "time": "2024-01-01T00:05:00Z"
        }
    ],
    "timestamp": "2024-01-01T06:00:00Z"
}
```

### Event Handling

#### Checkbox Change
- **Checked**: No immediate action (user must click Apply)
- **Unchecked**: Immediately hides layer

#### Apply Button
- Validates datetime range
- Calculates binning
- Requests data for all checked depth ranges
- Updates all layers when data arrives

#### Opacity Slider
- Immediately updates layer opacity
- Independent control for each depth range

## Server Requirements

The ADCP server must support:
1. Per-depth data requests with `depthRange` and `instrument` parameters
2. Datetime range filtering with `startTime` and `endTime`
3. Binning parameter (`5min`, `30min`, or `1hr`)
4. Response includes `depthRange` field for routing data to correct layer

## Benefits

1. **Comprehensive View**: See currents at multiple depths simultaneously
2. **Vertical Structure**: Understand how currents change with depth
3. **Easy Comparison**: Color coding makes depth comparison intuitive
4. **Flexible Display**: Enable/disable depths as needed
5. **Independent Control**: Each depth has its own opacity control
6. **Performance**: Only request and display needed depth ranges

## Usage Example

To view surface and deep currents:
1. Check "0-25m" (red) and ">500m" (pink)
2. Select "Last 6 hours" preset
3. Click "Apply Time Range"
4. Adjust opacity if arrows overlap
5. Red arrows show surface currents
6. Pink arrows show deep currents

## Notes

- Arrow size scales with current speed (larger = faster)
- Arrow direction shows current direction
- All layers use same datetime range (set once, applies to all)
- Colors optimized for ocean map background
- SVG arrows ensure crisp display at any zoom level
