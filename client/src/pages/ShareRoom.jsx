import { useParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Copy } from "lucide-react";

import { socket } from "../services/socket";
import { generateShareLink } from "../utils/room";
import { rtcConfig } from "../services/webrtc";
import { CHUNK_SIZE, getTotalChunks } from "../utils/chunks";
import { generateSHA256 } from "../utils/hash";
import {
    generateKey,
    exportKey,
    importKey,
    encryptData,
} from "../utils/encryption";

function ShareRoom() {
    const { roomId } = useParams();
    const [status, setStatus] = useState("Waiting");
    const [progress, setProgress] = useState(0);
    const [copied, setCopied] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [sending, setSending] = useState(false);
    const [speed, setSpeed] = useState(0);
    const [eta, setEta] = useState(0);
    const pcRef = useRef(null);
    const channelRef = useRef(null);
    const fileRef = useRef(null);
    const encryptionKeyRef = useRef(null);
    const ivRef = useRef(crypto.getRandomValues(new Uint8Array(12)));
    const [link, setLink] = useState("");
    const [roomExpired, setRoomExpired] = useState(false);

    useEffect(() => {
        const setupEncryption = async () => {
            let exportedKey = sessionStorage.getItem(`room-key-${roomId}`);

            let iv = sessionStorage.getItem(`room-iv-${roomId}`);

            if (!exportedKey || !iv) {
                const key = await generateKey();

                exportedKey = await exportKey(key);

                iv = btoa(String.fromCharCode(...ivRef.current));

                sessionStorage.setItem(`room-key-${roomId}`, exportedKey);

                sessionStorage.setItem(`room-iv-${roomId}`, iv);

                encryptionKeyRef.current = key;
            } else {
                encryptionKeyRef.current = await importKey(exportedKey);

                ivRef.current = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
            }

            setLink(
                `${window.location.origin}/share/${roomId}` +
                `#key=${encodeURIComponent(exportedKey)}` +
                `&iv=${encodeURIComponent(iv)}`,
            );
        };

        setupEncryption();
    }, [roomId]);

    const copyLink = async () => {
        await navigator.clipboard.writeText(link);

        setCopied(true);

        setTimeout(() => {
            setCopied(false);
        }, 2000);
    };

    const createPeerConnection = () => {
        const pc = new RTCPeerConnection(rtcConfig);

        pcRef.current = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", {
                    roomId,
                    candidate: event.candidate,
                });
            }
        };

        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;

            if (state === "connected") {
                setStatus("Connected");
            }

            if (
                state === "disconnected" ||
                state === "failed" ||
                state === "closed"
            ) {
                setStatus("Peer disconnected");
            }
        };

        return pc;
    };

    const sendFile = async () => {
        const file = fileRef.current?.files?.[0];

        if (!file) {
            alert("Select a file first");
            return;
        }

        const channel = channelRef.current;

        if (!channel || channel.readyState !== "open") {
            alert("Peer not connected");
            return;
        }

        setSending(true);
        setStatus("Sending...");
        const startTime = Date.now();

        try {
            channel.bufferedAmountLowThreshold = 1024 * 1024;

            const waitForBuffer = async () => {
                while (channel.bufferedAmount > 4 * 1024 * 1024) {
                    await new Promise((resolve) => {
                        channel.onbufferedamountlow = resolve;
                    });
                }
            };

            const fileBuffer = await file.arrayBuffer();

            const fileHash = await generateSHA256(fileBuffer);

            const totalChunks = getTotalChunks(file.size);

            const metadata = {
                type: "metadata",
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                totalChunks,
                fileHash,
            };

            channel.send(JSON.stringify(metadata));

            let offset = 0;
            let sentChunks = 0;

            while (offset < file.size) {
                const chunk = file.slice(offset, offset + CHUNK_SIZE);

                const buffer = await chunk.arrayBuffer();

                const chunkHash = await generateSHA256(buffer);

                await waitForBuffer();

                channel.send(
                    JSON.stringify({
                        type: "chunk-hash",
                        hash: chunkHash,
                    }),
                );

                const encrypted = await encryptData(
                    buffer,
                    encryptionKeyRef.current,
                    ivRef.current,
                );

                await waitForBuffer();

                channel.send(encrypted);

                offset += CHUNK_SIZE;
                sentChunks++;
                const sentBytes = Math.min(offset + CHUNK_SIZE, file.size);

                const elapsedSeconds = (Date.now() - startTime) / 1000;

                const currentSpeed =
                    sentBytes / 1024 / 1024 / Math.max(elapsedSeconds, 0.1);

                setSpeed(currentSpeed);

                const remainingBytes = file.size - sentBytes;

                const remainingSeconds = remainingBytes / (currentSpeed * 1024 * 1024);

                setEta(Math.max(0, Math.ceil(remainingSeconds)));

                setProgress(Math.floor((sentChunks / totalChunks) * 100));
            }

            channel.send(
                JSON.stringify({
                    type: "transfer-complete",
                }),
            );

            setStatus("Transfer Complete");
        } catch (err) {
            console.error(err);

            setStatus("Transfer Failed");
        } finally {
            setSending(false);
        }
    };

    useEffect(() => {
        socket.emit("rejoin-host", {
            roomId,
        });
        socket.on("host-rejoined", () => {
            setStatus("Connected");
        });
        socket.on("room-error", (data) => {
            if (data.message === "Room not found") {
                setRoomExpired(true);
            }
        });
        socket.on("peer-found", async () => {
            if (pcRef.current) {
                pcRef.current.close();
            }

            setStatus("Connecting");

            const pc = createPeerConnection();

            const channel = pc.createDataChannel("file-transfer");

            channelRef.current = channel;

            channel.onopen = () => {
                setStatus("Connected");
            };

            const offer = await pc.createOffer();

            await pc.setLocalDescription(offer);

            socket.emit("offer", {
                roomId,
                offer,
            });
        });

        socket.on("answer", async ({ answer }) => {
            await pcRef.current.setRemoteDescription(
                new RTCSessionDescription(answer),
            );
        });

        socket.on("peer-left", () => {
            setStatus("Peer disconnected");
        });

        socket.on("ice-candidate", async ({ candidate }) => {
            try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {
                setSending(false);
            }
        });

        return () => {
            socket.off("peer-found");
            socket.off("answer");
            socket.off("ice-candidate");
            socket.off("peer-left");
            socket.off("host-rejoined");
            socket.off("room-error");
        };
    }, [roomId]);

    if (roomExpired) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-3xl font-bold">Room Expired</h1>

                    <p className="mt-4 text-zinc-500">This room no longer exists.</p>

                    <button
                        onClick={() => (window.location.href = "/")}
                        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg"
                    >
                        Create New Room
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-6 py-10">
            <div className="w-full max-w-3xl">
                <div className="border rounded-2xl p-8 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold">Share Room</h1>

                            <p className="mt-1 text-zinc-500">
                                Share the link and start transferring files
                            </p>
                        </div>

                        <div className="px-3 py-1 rounded-full border text-sm text-green-600 font-medium">
                            🔒 Encrypted
                        </div>
                    </div>

                    <div className="mt-8">
                        <label className="block text-sm font-medium mb-2">Share Link</label>

                        <div className="flex gap-3">
                            <input
                                value={link}
                                readOnly
                                className="
                                flex-1
                                border
                                rounded-xl
                                px-4
                                py-3
                                outline-none
                                focus:ring-2
                                focus:ring-blue-500
                            "
                            />

                            <button
                                onClick={copyLink}
                                className="
        px-4
        border
        rounded-xl
        cursor-pointer
        transition
        hover:bg-zinc-100
    "
                            >
                                {copied ? "✓" : <Copy size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mt-8">
                        <div className="border rounded-xl p-4">
                            <p className="text-sm text-zinc-500">Connection Status</p>

                            <p
                                className={`mt-2 font-semibold ${status === "Connected"
                                        ? "text-green-600"
                                        : status === "Connecting"
                                            ? "text-yellow-600"
                                            : "text-zinc-500"
                                    }`}
                            >
                                {status}
                            </p>
                        </div>

                        <div className="border rounded-xl p-4">
                            <p className="text-sm text-zinc-500">Transfer Progress</p>

                            <p className="mt-2 font-semibold">{progress}%</p>
                        </div>
                    </div>

                    <div className="mt-8">
                        <label className="block text-sm font-medium mb-2">File</label>

                        <label
                            className="
            block
            border-2
            border-dashed
            rounded-xl
            p-8
            text-center
            cursor-pointer
            hover:border-blue-500
            transition
        "
                        >
                            <input
                                ref={fileRef}
                                type="file"
                                hidden
                                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            />

                            {selectedFile ? (
                                <>
                                    <p className="font-semibold">{selectedFile.name}</p>

                                    <p className="text-sm text-zinc-500 mt-2">
                                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="font-semibold">Choose File</p>

                                    <p className="text-sm text-zinc-500 mt-2">
                                        Click to browse or drag and drop
                                    </p>
                                </>
                            )}
                        </label>
                    </div>

                    {progress > 0 && (
                        <div className="mt-8">
                            <div className="flex justify-between text-sm mb-2">
                                <span>{sending ? "Sending" : "Transfer"}</span>

                                <span>{progress}%</span>
                            </div>

                            <div className="h-3 bg-zinc-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-600 transition-all duration-300"
                                    style={{
                                        width: `${progress}%`,
                                    }}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div className="border rounded-xl p-4">
                                    <p className="text-sm text-zinc-500">Speed</p>

                                    <p className="mt-2 text-lg font-semibold">
                                        {speed.toFixed(2)} MB/s
                                    </p>
                                </div>

                                <div className="border rounded-xl p-4">
                                    <p className="text-sm text-zinc-500">ETA</p>

                                    <p className="mt-2 text-lg font-semibold">{eta}s</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={sendFile}
                        disabled={sending}
                        className="
        mt-8
        w-full
        rounded-xl
        bg-blue-600
        text-white
        py-4
        font-semibold
        cursor-pointer
        transition-all
        duration-200
        hover:bg-blue-700
        disabled:opacity-50
        disabled:cursor-not-allowed
    "
                    >
                        {sending ? "Sending..." : "Send File"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ShareRoom;
