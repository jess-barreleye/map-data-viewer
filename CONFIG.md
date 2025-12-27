# Configuration Setup

The Map Data Viewer uses a configuration file for server URLs and API keys.

## Initial Setup

1. Copy the example configuration:
   ```bash
   cp config.example.js config.js
   ```

2. Edit `config.js` with your settings:
   - Update server hostnames/IPs
   - Change ports if needed
   - Add API keys for external services (optional)

## Important

- `config.js` is in `.gitignore` and will NOT be committed to git
- `config.example.js` is the template that IS committed
- Never commit API keys or sensitive server information

## Default Configuration

The default configuration uses:
- Tile server: `http://localhost:8080`
- WebSocket ports: 8081-8086 on localhost

## Production Deployment

For production, update `config.js` with:
- Your server's public IP or domain name
- Use `https://` and `wss://` for secure connections
- Ensure firewall rules allow required ports
