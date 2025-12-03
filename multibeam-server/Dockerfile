FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY server.js .

# Expose WebSocket port
EXPOSE 8085

# Start the server
CMD ["node", "server.js"]
