#!/usr/bin/env node

const dgram = require('dgram');

const UDP_HOST = process.argv[2] || 'localhost';
const UDP_PORT = parseInt(process.argv[3]) || 12345;
const message = process.argv[4] || '$GPRMC,123519,A,4807.038,N,01131.000,W,022.4,084.4,230394,003.1,W*6A';

const client = dgram.createSocket('udp4');

console.log(`Sending GPS test data to ${UDP_HOST}:${UDP_PORT}`);
console.log(`Message: ${message}`);

client.send(message, UDP_PORT, UDP_HOST, (err) => {
    if (err) {
        console.error('Error sending:', err);
    } else {
        console.log('✓ Message sent successfully');
    }
    client.close();
});
