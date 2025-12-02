FROM node:20-alpine

WORKDIR /app

COPY package.json .
RUN npm install

COPY server.js .

# UDP port for Seapath GPS data (configurable via environment)
EXPOSE 12345/udp

# WebSocket port for browser clients
EXPOSE 8081

CMD ["npm", "start"]
