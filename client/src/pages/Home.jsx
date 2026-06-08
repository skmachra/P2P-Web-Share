import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Zap, Wifi, ArrowRight } from "lucide-react";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import FileDrop from "../components/FileDrop";
import { socket } from "../services/socket";

function Home() {
    const [connected, setConnected] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        socket.on("connect", () => {
            setConnected(true);
        });

        socket.on("disconnect", () => {
            setConnected(false);
        });

        socket.on("room-created", ({ roomId }) => {
            navigate(`/host/${roomId}`);
        });

        return () => {
            socket.off("connect");
            socket.off("disconnect");
            socket.off("room-created");
        };
    }, [navigate]);

    const createRoom = () => {
        socket.emit("create-room");
    };

    return (
    <div className="min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1 flex items-center justify-center px-6 py-10">
            <div className="w-full max-w-3xl">
                <div className="border rounded-2xl p-10 shadow-sm text-center bg-white">
                    <h1 className="text-5xl font-bold text-zinc-900">
                        P2P Share
                    </h1>

                    <p className="mt-4 text-zinc-600">
                        Secure browser-to-browser file transfer powered by
                        WebRTC.
                    </p>

                    <p className="mt-2 text-sm text-zinc-500">
                        No uploads • No storage • End-to-end encrypted
                    </p>

                    <div className="mt-8 border rounded-xl p-4">
                        <div className="flex items-center justify-center gap-2">
                            <span
                                className={
                                    connected
                                        ? "text-green-500"
                                        : "text-red-500"
                                }
                            >
                                ●
                            </span>

                            <span className="font-medium text-zinc-700">
                                {connected
                                    ? "Connected"
                                    : "Disconnected"}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={createRoom}
                        className="
                            mt-8
                            px-8
                            py-4
                            rounded-xl
                            bg-blue-600
                            text-white
                            font-semibold
                            cursor-pointer
                            transition-all
                            duration-200
                            hover:bg-blue-700
                            hover:-translate-y-0.5
                            active:scale-[0.98]
                        "
                    >
                        Create Share Room
                    </button>

                    <div className="grid md:grid-cols-3 gap-4 mt-10">
                        <div className="border rounded-xl p-4">
                            <h3 className="font-semibold text-zinc-900">
                                Direct P2P
                            </h3>

                            <p className="text-sm text-zinc-500 mt-2">
                                Browser-to-browser transfer using WebRTC.
                            </p>
                        </div>

                        <div className="border rounded-xl p-4">
                            <h3 className="font-semibold text-zinc-900">
                                Encrypted
                            </h3>

                            <p className="text-sm text-zinc-500 mt-2">
                                AES-GCM end-to-end encryption.
                            </p>
                        </div>

                        <div className="border rounded-xl p-4">
                            <h3 className="font-semibold text-zinc-900">
                                Verified
                            </h3>

                            <p className="text-sm text-zinc-500 mt-2">
                                SHA-256 integrity verification.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <Footer />
    </div>
);
}

export default Home;
