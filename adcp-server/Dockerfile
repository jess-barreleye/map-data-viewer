FROM node:18-alpine

# Install Python and pip for NetCDF reading
RUN apk add --no-cache python3 py3-pip python3-dev build-base

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Install Python dependencies
RUN pip3 install --no-cache-dir netCDF4 numpy

# Copy application files
COPY . .

# Expose WebSocket port
EXPOSE 8083

CMD ["node", "server.js"]
