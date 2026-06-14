import { io } from "socket.io-client";

const URL = "https://p2p-web-share-2ckz.onrender.com";

export const socket = io(URL);