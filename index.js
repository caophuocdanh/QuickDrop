const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the current directory
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Store active rooms and user data for recovery
const activeRooms = new Map();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('createRoom', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} created and joined room: ${roomId}`);
        
        // Store room info for recovery
        if (!activeRooms.has(roomId)) {
            activeRooms.set(roomId, { creator: socket.id, participants: [] });
        }
        activeRooms.get(roomId).participants.push(socket.id);
        
        socket.emit('roomCreated', roomId);
    });

    socket.on('joinRoom', (roomId) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room && room.size < 2) { // Limit to 2 participants for simplicity
            socket.join(roomId);
            console.log(`User ${socket.id} joined room: ${roomId}`);
            
            // Update room info
            if (activeRooms.has(roomId)) {
                activeRooms.get(roomId).participants.push(socket.id);
            }
            
            socket.emit('roomJoined', roomId);
            // Notify the other user in the room that a new user has joined
            socket.to(roomId).emit('otherUserJoined', socket.id);
        } else if (room && room.size >= 2) {
            socket.emit('roomFull', roomId);
        } else {
            socket.emit('roomNotFound', roomId);
        }
    });

    // Handle reconnection
    socket.on('reconnectToRoom', (roomId) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room && room.size < 2) {
            socket.join(roomId);
            console.log(`User ${socket.id} reconnected to room: ${roomId}`);
            socket.emit('reconnectedToRoom', roomId);
            socket.to(roomId).emit('userReconnected', socket.id);
        } else {
            socket.emit('reconnectionFailed', roomId);
        }
    });

    // WebRTC signaling
    socket.on('offer', (data) => {
        socket.to(data.roomId).emit('offer', data);
    });

    socket.on('answer', (data) => {
        socket.to(data.roomId).emit('answer', data);
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.roomId).emit('ice-candidate', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Clean up room data and notify other users
        for (const [roomId, roomData] of activeRooms.entries()) {
            const participantIndex = roomData.participants.indexOf(socket.id);
            if (participantIndex !== -1) {
                roomData.participants.splice(participantIndex, 1);
                socket.to(roomId).emit('userDisconnected', socket.id);
                
                // Remove room if empty
                if (roomData.participants.length === 0) {
                    activeRooms.delete(roomId);
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
