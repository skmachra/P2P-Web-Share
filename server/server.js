const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(
    cors({
        origin: "*",
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
        origin: "*",
    },
});

require("./socket")(io);

const PORT = 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
