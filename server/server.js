const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

// Allow the local Vite client and deployed frontend to reach this server.
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "https://p2-p-web-share-nine.vercel.app",
        ],
    }),
);

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Server Running",
    });
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5173",
            "https://p2-p-web-share-nine.vercel.app",
        ],
    },
});

// Register all room and WebRTC signaling event handlers.
require("./socket")(io);

const PORT = 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
