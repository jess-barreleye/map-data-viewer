#!/usr/bin/env node

const WebSocket = require('ws');
const { spawn } = require('child_process');

const WS_PORT = parseInt(process.env.WS_PORT_ADCP) || 8083;

// WebSocket server for broadcasting ADCP data to browser clients
const wss = new WebSocket.Server({ port: WS_PORT });

let clients = new Set();
let latestADCPData = null;

wss.on('connection', (ws) => {
    console.log('[ADCP] WebSocket client connected');
    clients.add(ws);
    
    // Send latest data to new client if available
    if (latestADCPData) {
        ws.send(JSON.stringify(latestADCPData));
    }
    
    // Handle client requests for specific time intervals or depths
    ws.on('message', (message) => {
        try {
            const request = JSON.parse(message);
            console.log('[ADCP] Client request:', request);
            
            // Request format: { timeStart, timeEnd, depthRange, instrument }
            if (request.type === 'query') {
                queryADCPData(request.timeStart, request.timeEnd, request.depthRange, request.instrument);
            }
        } catch (err) {
            console.error('[ADCP] Error parsing client message:', err);
        }
    });
    
    ws.on('close', () => {
        console.log('[ADCP] WebSocket client disconnected');
        clients.delete(ws);
    });
    
    ws.on('error', (err) => {
        console.error('[ADCP] WebSocket error:', err);
        clients.delete(ws);
    });
});

// Broadcast ADCP data to all connected clients
function broadcastADCPData(data) {
    latestADCPData = data;
    const message = JSON.stringify(data);
    
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Query ADCP data from NetCDF files using Python script
function queryADCPData(timeStart, timeEnd, depthRange, instrument) {
    console.log(`[ADCP] Querying data: ${timeStart} to ${timeEnd}, depth: ${depthRange}, instrument: ${instrument}`);
    
    // Call Python script to read NetCDF data
    // This will be implemented when database path is provided
    const pythonScript = spawn('python3', [
        'read_adcp.py',
        '--time-start', timeStart,
        '--time-end', timeEnd,
        '--depth-range', depthRange,
        '--instrument', instrument
    ]);
    
    let dataBuffer = '';
    
    pythonScript.stdout.on('data', (data) => {
        dataBuffer += data.toString();
    });
    
    pythonScript.stderr.on('data', (data) => {
        console.error(`[ADCP] Python error: ${data}`);
    });
    
    pythonScript.on('close', (code) => {
        if (code === 0 && dataBuffer) {
            try {
                const adcpData = JSON.parse(dataBuffer);
                console.log(`[ADCP] Retrieved ${adcpData.vectors ? adcpData.vectors.length : 0} vectors`);
                broadcastADCPData(adcpData);
            } catch (err) {
                console.error('[ADCP] Error parsing Python output:', err);
            }
        } else {
            console.error(`[ADCP] Python script exited with code ${code}`);
        }
    });
}

// Auto-refresh every 5 minutes (300000 ms)
// This will query the latest data automatically
setInterval(() => {
    console.log('[ADCP] Auto-refresh: querying latest data...');
    // Default query: last 6 hours, surface layer (0-25m), WH300
    const now = Date.now();
    const sixHoursAgo = now - (6 * 60 * 60 * 1000);
    queryADCPData(sixHoursAgo, now, '0-25', 'WH300');
}, 5 * 60 * 1000);

console.log('');
console.log('🌊 ADCP Server Started');
console.log('═════════════════════════════════════');
console.log(`[ADCP] WebSocket: ws://localhost:${WS_PORT}`);
console.log('═════════════════════════════════════');
console.log('Auto-refresh: Every 5 minutes');
console.log('Depth ranges:');
console.log('  - WH 300kHz: 0-25m, 25-50m');
console.log('  - EC 150kHz: 50-150m, 150-300m');
console.log('  - OS 38kHz:  300-500m, >500m');
console.log('');

// Initial query on startup
console.log('[ADCP] Initial data query...');
const now = Date.now();
const sixHoursAgo = now - (6 * 60 * 60 * 1000);
queryADCPData(sixHoursAgo, now, '0-25', 'WH300');
