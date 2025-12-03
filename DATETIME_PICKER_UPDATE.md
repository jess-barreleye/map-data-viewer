# DateTime Range Picker Update

## Overview

Updated the time interval selectors for both **ADCP** and **Oceanographic** data layers to use calendar-based datetime range pickers with intelligent binning based on the selected time range.

---

## Features

### 1. **Calendar-Based DateTime Selection**

Both ADCP and oceanographic data layers now have:
- **Start Date/Time Picker**: Select exact start date and time
- **End Date/Time Picker**: Select exact end date and time
- **Preset Buttons**: Quick selection for common time ranges
  - 1 hour
  - 6 hours
  - 12 hours
  - 24 hours
  - 3 days
  - 7 days

### 2. **Intelligent Data Binning**

Data is automatically binned based on the selected time range to optimize performance and visualization:

#### Oceanographic Data Binning:
- **Up to 12 hours**: 5-minute bins
- **12 hours to 3 days**: 30-minute bins
- **Over 3 days**: 1-hour bins

#### ADCP Data Binning:
- **Up to 12 hours**: 5-minute bins
- **12 hours to 3 days**: 30-minute bins
- **Over 3 days**: 1-hour bins

The binning interval is automatically calculated and displayed below the datetime pickers.

### 3. **User Interface**

#### Oceanographic Data Layers Section:
```
Time Range:
┌─────────────────┬─────────────────┐
│ Start:          │ End:            │
│ [datetime input]│ [datetime input]│
└─────────────────┴─────────────────┘
[1h] [6h] [12h] [24h] [3d] [7d]  ← Preset buttons
[    Apply Time Range    ]        ← Apply button
Binning: 5 min                    ← Auto-calculated binning
```

#### ADCP Section:
Same layout as oceanographic, with identical functionality.

---

## How to Use

### Method 1: Use Preset Buttons
1. Click any preset button (1h, 6h, 12h, 24h, 3d, 7d)
2. The datetime pickers automatically update to show the selected range
3. Binning is calculated and displayed
4. Active preset is highlighted in blue

### Method 2: Manual DateTime Selection
1. Click on the **Start** datetime picker
2. Select your desired start date and time from the calendar
3. Click on the **End** datetime picker
4. Select your desired end date and time
5. The binning info updates automatically as you change the dates
6. Click **Apply Time Range** to fetch data

### Method 3: Fine-tune a Preset
1. Click a preset button to set approximate range
2. Manually adjust the start/end times using the datetime pickers
3. Click **Apply Time Range**

---

## Technical Details

### Data Request Format

#### Oceanographic Server Request:
```json
{
  "type": "historical",
  "sensor": "temperature",
  "startTime": "2025-12-01T06:00:00.000Z",
  "endTime": "2025-12-01T18:00:00.000Z",
  "binning": "5min"
}
```

#### ADCP Server Request:
```json
{
  "type": "request",
  "startTime": "2025-12-01T06:00:00.000Z",
  "endTime": "2025-12-01T18:00:00.000Z",
  "depthRange": "0-25",
  "binning": "5min"
}
```

### Binning Calculation Logic

The binning is calculated automatically based on the time difference:

```javascript
function calculateBinning(startTime, endTime) {
    const diffMs = endTime - startTime;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;
    
    if (diffHours <= 12) {
        return '5min';  // Up to 12 hours: 5 min bins
    } else if (diffDays <= 3) {
        return '30min'; // 12 hours to 3 days: 30 min bins
    } else {
        return '1hr';   // Over 3 days: 1 hour bins
    }
}
```

### Server-Side Implementation

The servers (oceanographic and ADCP) need to handle the new request format:

1. Accept `startTime` and `endTime` as ISO 8601 strings
2. Use the `binning` parameter to aggregate data appropriately
3. Query InfluxDB or file repository with the datetime range
4. Bin data according to the specified interval
5. Return binned data to the client

---

## Backend Integration Requirements

### Oceanographic Server (`oceanographic-server/server.js`)

Update the message handler to support datetime ranges:

```javascript
case 'historical':
    const { sensor, startTime, endTime, binning } = message;
    
    // Query InfluxDB with datetime range
    const query = `
        from(bucket: "${INFLUXDB_BUCKET}")
            |> range(start: ${startTime}, stop: ${endTime})
            |> filter(fn: (r) => r["_measurement"] == "${sensor.measurement}")
            |> aggregateWindow(every: ${binningToDuration(binning)}, fn: mean)
            |> join(queries: {gps: gpsQuery})
    `;
    
    // Execute query and return data
    break;
```

### ADCP Server

ADCP data is file-based, so the server needs to:

1. Parse the `startTime` and `endTime` from the request
2. Load appropriate NetCDF files covering that time range
3. Extract data and bin according to the `binning` parameter
4. Return binned current vectors to the client

Example binning logic:
```javascript
function binADCPData(data, binning) {
    switch(binning) {
        case '5min':
            return binEvery(data, 5 * 60 * 1000);
        case '30min':
            return binEvery(data, 30 * 60 * 1000);
        case '1hr':
            return binEvery(data, 60 * 60 * 1000);
    }
}
```

---

## Benefits

### 1. **Flexible Time Selection**
- Access any historical date range, not just recent hours
- Perfect for comparing different time periods
- Useful for analyzing specific events or cruises

### 2. **Performance Optimization**
- Automatic binning prevents overwhelming the browser with too much data
- Longer time ranges automatically use coarser bins
- Maintains smooth map performance even with weeks of data

### 3. **Database Integration Ready**
- Designed for InfluxDB integration with full historical access
- Supports OpenRVDAS data archive
- Compatible with ADCP NetCDF file repositories

### 4. **Better User Experience**
- Visual calendar interface is intuitive
- Preset buttons for common use cases
- Real-time binning feedback
- Active preset highlighting

---

## Default Values

### Oceanographic Data
- **Default Range**: Last 12 hours
- **Default Binning**: 5 min
- **Active Preset**: 12h button

### ADCP Data
- **Default Range**: Last 6 hours
- **Default Binning**: 5 min
- **Active Preset**: 6h button

---

## Future Enhancements

Potential additions for future versions:

1. **Custom Binning Override**: Allow users to manually select binning interval
2. **Saved Ranges**: Store frequently-used datetime ranges
3. **Export Data**: Download binned data for the selected range
4. **Range Validation**: Warn if requesting very large datasets
5. **Loading Indicator**: Show progress when fetching historical data
6. **Max Range Limit**: Prevent extremely large requests that could impact performance

---

## Notes for Server Developers

### InfluxDB Query Example

```flux
from(bucket: "rov-data")
    |> range(start: 2025-12-01T00:00:00Z, stop: 2025-12-01T12:00:00Z)
    |> filter(fn: (r) => r["_measurement"] == "tsg_temperature")
    |> aggregateWindow(every: 5m, fn: mean)
    |> yield(name: "mean")
```

### ADCP File Selection

For ADCP data stored in 5-minute NetCDF files:
1. Calculate which files fall within the requested range
2. Load only those files
3. Extract relevant timestamps and data
4. Apply additional binning if needed (30min or 1hr)
5. Return current vectors with timestamps

---

## Testing

### Test Cases

1. **Preset Buttons**: Click each preset and verify correct range is set
2. **Manual Selection**: Select arbitrary dates and verify binning calculation
3. **Validation**: Try invalid ranges (end before start) and verify error message
4. **Binning Thresholds**: 
   - 11 hours → should show "5 min"
   - 13 hours → should show "30 min"
   - 3 days → should show "1 hr"
5. **Apply Button**: Verify data request is sent with correct parameters
6. **Active Layer Integration**: Ensure only checked layers request data

---

## Browser Compatibility

The `datetime-local` input type is supported in:
- ✅ Chrome 20+
- ✅ Edge 12+
- ✅ Firefox 57+
- ✅ Safari 14.1+
- ✅ Opera 15+

For older browsers, the input falls back to a text field.

---

**Last Updated**: December 1, 2025
