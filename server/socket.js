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
                receiver: null,
            });

            socket.join(roomId);

            socket.emit("room-created", {
                roomId,
            });
        });

        socket.on("join-room", ({ roomId }) => {
            const room = rooms.get(roomId);

            if (!room) {
                socket.emit("room-error", {
                    message: "Room not found",
                });

                return;
            }

            if (room.receiver && room.receiver !== socket.id) {
                socket.emit("room-error", {
                    message: "Room full",
                });

                return;
            }

            room.receiver = socket.id;

            socket.join(roomId);

            socket.emit("room-joined", {
                roomId,
            });

            io.to(room.host).emit("peer-found", {
                peerId: socket.id,
            });

            console.log(`${socket.id} joined ${roomId}`);
        });

        socket.on("leave-room", ({ roomId }) => {
            const room = rooms.get(roomId);

            if (!room) return;

            if (room.host === socket.id) {
                rooms.delete(roomId);
            }

            if (room.receiver === socket.id) {
                room.receiver = null;
            }

            socket.leave(roomId);
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
                if (room.host === socket.id) {
                    io.to(roomId).emit("host-left");

                    rooms.delete(roomId);

                    continue;
                }

                if (room.receiver === socket.id) {
                    room.receiver = null;

                    io.to(room.host).emit("peer-left");
                }
            }

            console.log(`Socket Disconnected: ${socket.id}`);
        });
    });
};
