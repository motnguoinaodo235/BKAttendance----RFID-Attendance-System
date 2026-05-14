const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

const mqttClient = mqtt.connect('mqtt://broker.hivemq.com');
const TOPIC_FROM_ESP = 'test/vinh/mqtt/send'; 
const TOPIC_TO_ESP = 'test/vinh/mqtt/recv';   

mqttClient.on('connect', () => {
    console.log('✅ Đã kết nối HiveMQ Broker');
    mqttClient.subscribe(TOPIC_FROM_ESP);
});

mqttClient.on('message', (topic, message) => {
    if (topic === TOPIC_FROM_ESP) {
        const msgStr = message.toString();
        console.log(`[MQTT nhận]: ${msgStr}`);
        io.emit('new_data', msgStr);
    }
});

io.on('connection', (socket) => {
    socket.on('send_command', (msg) => {
        mqttClient.publish(TOPIC_TO_ESP, msg);
    });
});

server.listen(3000, () => {
    console.log('🌐 Web test đang chạy tại: http://localhost:3000');
});