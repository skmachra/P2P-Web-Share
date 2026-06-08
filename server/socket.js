const rooms = require("./rooms");
const crypto = require("crypto");

module.exports = (io) => {
    io.on("connection", (socket) => {
        console.log(`Socket Connected: ${socket.id}`);

        socket.emit("welcome", {
            message: "Connected to signaling server",
        });

        socket.on("create-room", () => {
            const roomId = crypto.randomBytes(4).toString("hex");

            rooms.set(roomId, {
                host: socket.id,
                peers: [socket.id],
            });

            socket.join(roomId);

            socket.emit("room-created", {
                roomId,
            });

            console.log(`Room Created: ${roomId}`);
        });

        socket.on("join-room", ({ roomId }) => {
            const room = rooms.get(roomId);

            if (!room) {
                socket.emit("room-error", {
                    message: "Room not found",
                });
                return;
            }

            if (room.peers.length >= 2) {
                socket.emit("room-error", {
                    message: "Room full",
                });
                return;
            }

            room.peers.push(socket.id);

            socket.join(roomId);

            socket.emit("room-joined", {
                roomId,
            });
            console.log("Sending peer-found to host");
            io.to(room.host).emit("peer-found", {
                peerId: socket.id,
            });
            console.log("peer-found event received");

            console.log(`${socket.id} joined ${roomId}`);
        });

        socket.on("leave-room", ({ roomId }) => {
            const room = rooms.get(roomId);

            if (!room) return;

            room.peers = room.peers.filter((id) => id !== socket.id);

            socket.leave(roomId);

            if (room.peers.length === 0) {
                rooms.delete(roomId);
            }
        });

        socket.on("offer", ({ roomId, offer }) => {
            socket.to(roomId).emit("offer", {
                offer,
            });
            console.log("offer received");
        });

        socket.on("answer", ({ roomId, answer }) => {
            socket.to(roomId).emit("answer", {
                answer,
            });
            console.log("answer received");
        });

        socket.on("ice-candidate", ({ roomId, candidate }) => {
            socket.to(roomId).emit("ice-candidate", {
                candidate,
            });
        });

        socket.on("disconnect", () => {
            for (const [roomId, room] of rooms.entries()) {
                if (room.peers.includes(socket.id)) {
                    room.peers = room.peers.filter((id) => id !== socket.id);

                    if (room.host === socket.id) {
                        io.to(roomId).emit("host-left");
                        rooms.delete(roomId);
                    } else {
                        io.to(room.host).emit("peer-left");
                    }
                }
            }

            console.log(`Socket Disconnected: ${socket.id}`);
        });
    });
};
