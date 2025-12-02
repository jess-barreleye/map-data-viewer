const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.geojson': 'application/geo+json',
    '.mbtiles': 'application/x-sqlite3'
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

    // Handle directory listing for /layers/
    if (req.url === '/layers/' || req.url === '/layers') {
        const layersDir = path.join(__dirname, 'layers');
        fs.readdir(layersDir, (err, files) => {
            if (err) {
                res.writeHead(500);
                res.end('Error reading directory');
                return;
            }
            
            // Generate simple HTML with links
            const html = files
                .filter(f => !f.startsWith('.'))
                .map(f => `<a href="${f}">${f}</a>`)
                .join('<br>\n');
            
            res.writeHead(200, {
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(`<!DOCTYPE html><html><body>${html}</body></html>`);
        });
        return;
    }

    // Parse URL and resolve file path
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    // Get file extension for MIME type
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Read and serve file
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache'
            });
            res.end(content);
        }
    });
});

server.on('clientError', (err, socket) => {
    // Gracefully handle client disconnections
    if (err.code === 'ECONNRESET' || !socket.writable) {
        return;
    }
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌊 MapLibre ROV Server`);
    console.log(`═══════════════════════════════════════`);
    console.log(`Local:   http://localhost:${PORT}`);
    console.log(`Network: http://192.168.0.153:${PORT}`);
    console.log(`═══════════════════════════════════════`);
    console.log(`Serving files from: ${__dirname}`);
    console.log(`\nPress Ctrl+C to stop\n`);
});
