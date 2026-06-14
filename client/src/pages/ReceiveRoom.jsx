import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { socket } from "../services/socket";
import { rtcConfig } from "../services/webrtc";
import { generateSHA256 } from "../utils/hash";
import { importKey, decryptData } from "../utils/encryption";

function ReceiveRoom() {
    const { roomId } = useParams();

    const [status, setStatus] = useState("Joining...");
    const [progress, setProgress] = useState(0);
    const [speed, setSpeed] = useState(0);
    const [eta, setEta] = useState(0);
    const pcRef = useRef(null);
    const transferStartRef = useRef(null);
    const metadataRef = useRef(null);

    const receivedChunksRef = useRef([]);
    const receivedCountRef = useRef(0);

    const keyRef = useRef(null);
    const ivRef = useRef(null);
    const expectedChunkHashRef = useRef(null);

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

    const verifyAndDownload = async () => {
        try {
            setStatus("Verifying File...");

            const blob = new Blob(receivedChunksRef.current, {
                type: metadataRef.current.fileType,
            });

            const buffer = await blob.arrayBuffer();

            const receiverHash = await generateSHA256(buffer);

            const senderHash = metadataRef.current.fileHash;

            if (receiverHash !== senderHash) {
                setStatus("Transfer Corrupted");
                return;
            }

            setStatus("Verified ✓ Downloading...");

            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");

            a.href = url;
            a.download = metadataRef.current.fileName;

            document.body.appendChild(a);

            a.click();

            a.remove();

            URL.revokeObjectURL(url);

            setStatus("Completed ✓");
        } catch (err) {
            console.error(err);
            setStatus("Verification Failed");
        }
    };

    useEffect(() => {
        const initEncryption = async () => {
            try {
                // Read the shared key and IV from the URL fragment for decryption.
                const hash = window.location.hash;

                const params = new URLSearchParams(hash.replace("#", ""));

                const key = params.get("key");

                const iv = params.get("iv");

                if (!key || !iv) {
                    console.log("No encryption key found");
                    return;
                }

                keyRef.current = await importKey(key);

                ivRef.current = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));

                console.log("Encryption initialized");
            } catch (err) {
                console.error(err);
            }
        };

        initEncryption();
    }, []);

    useEffect(() => {
        socket.emit("join-room", {
            roomId,
        });

        socket.on("room-error", (data) => {
            if (data.message === "Room not found") {
                setStatus("Room expired. Please ask the sender to create a new room.");
            } else {
                setStatus(data.message);
            }
        });

        socket.on("offer", async ({ offer }) => {
            const pc = createPeerConnection();

            pc.ondatachannel = (event) => {
                const channel = event.channel;

                // Handle control messages as JSON and file chunks as encrypted bytes.
                channel.onmessage = async (event) => {
                    if (typeof event.data === "string") {
                        const data = JSON.parse(event.data);
                        if (data.type === "chunk-hash") {
                            expectedChunkHashRef.current = data.hash;

                            return;
                        }
                        if (data.type === "metadata") {
                            transferStartRef.current = Date.now();
                            metadataRef.current = data;

                            receivedChunksRef.current = [];

                            receivedCountRef.current = 0;

                            setStatus("Receiving...");
                        }

                        if (data.type === "transfer-complete") {
                            await verifyAndDownload();
                        }

                        return;
                    }

                    try {
                        const decrypted = await decryptData(
                            event.data,
                            keyRef.current,
                            ivRef.current,
                        );

                        const actualChunkHash = await generateSHA256(decrypted);

                        if (actualChunkHash !== expectedChunkHashRef.current) {
                            console.error("Chunk hash mismatch");

                            setStatus("Transfer Corrupted");

                            return;
                        }

                        receivedChunksRef.current.push(decrypted);

                        receivedCountRef.current++;
                        // Estimate speed and ETA from received chunks and elapsed time.
                        const receivedBytes =
                            (receivedCountRef.current * metadataRef.current.fileSize) /
                            metadataRef.current.totalChunks;

                        const elapsedSeconds =
                            (Date.now() - transferStartRef.current) / 1000;

                        const currentSpeed =
                            receivedBytes / 1024 / 1024 / Math.max(elapsedSeconds, 0.1);

                        setSpeed(currentSpeed);

                        const remainingBytes = metadataRef.current.fileSize - receivedBytes;

                        const remainingSeconds =
                            remainingBytes / (currentSpeed * 1024 * 1024);

                        setEta(Math.max(0, Math.ceil(remainingSeconds)));

                        const total = metadataRef.current?.totalChunks || 1;

                        setProgress(Math.floor((receivedCountRef.current / total) * 100));
                    } catch (err) {
                        console.error("Decrypt Failed", err);

                        setStatus("Transfer Corrupted");
                    }
                };
            };

            await pc.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await pc.createAnswer();

            await pc.setLocalDescription(answer);

            socket.emit("answer", {
                roomId,
                answer,
            });
        });

        socket.on("ice-candidate", async ({ candidate }) => {
            try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.error(err);
            }
        });
        socket.on("host-left", () => {
            setStatus("Host disconnected");
        });

        return () => {
            socket.off("offer");
            socket.off("ice-candidate");
            socket.off("host-left");
            socket.off("room-error");
        };
    }, [roomId]);

    return (
        <div className="min-h-screen flex items-center justify-center px-6 py-10">
            <div className="w-full max-w-3xl">
                <div className="border rounded-2xl p-8 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold">Receive File</h1>

                            <p className="mt-1 text-zinc-500">
                                Secure browser-to-browser transfer
                            </p>
                        </div>

                        <div className="px-3 py-1 rounded-full border text-sm text-green-600 font-medium">
                            🔒 End-to-End Encrypted
                        </div>
                    </div>

                    {metadataRef.current && (
                        <div className="mt-8 border rounded-xl p-4">
                            <p className="text-sm text-zinc-500">Incoming File</p>

                            <p className="mt-2 font-semibold break-all">
                                {metadataRef.current.fileName}
                            </p>

                            <p className="text-sm text-zinc-500 mt-1">
                                {(metadataRef.current.fileSize / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4 mt-8">
                        <div className="border rounded-xl p-4">
                            <p className="text-sm text-zinc-500">Status</p>

                            <p
                                className={`mt-2 font-semibold ${status.includes("Completed")
                                        ? "text-green-600"
                                        : status.includes("Corrupted")
                                            ? "text-red-600"
                                            : status.includes("Verifying")
                                                ? "text-yellow-600"
                                                : "text-blue-600"
                                    }`}
                            >
                                {status}
                            </p>
                            {status.includes("Room expired") && (
                                <div className="mt-8">
                                    <div className="mt-4">
                                        <Link
                                            to="/"
                                            className="
                    inline-block
                    px-4
                    py-2
                    bg-blue-600
                    text-white
                    rounded-lg
                    hover:bg-blue-700
                    transition
                "
                                        >
                                            Go Home
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="border rounded-xl p-4">
                            <p className="text-sm text-zinc-500">Progress</p>

                            <p className="mt-2 font-semibold">{progress}%</p>
                        </div>
                    </div>

                    {(progress > 0 || status === "Receiving...") && (
                        <div className="mt-8">
                            <div className="flex justify-between text-sm mb-2">
                                <span>Receiving</span>

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

                    {status.includes("Completed") && (
                        <div className="mt-8 border border-green-200 bg-green-50 text-green-700 rounded-xl p-4">
                            ✓ File verified and downloaded successfully
                        </div>
                    )}

                    {status.includes("Corrupted") && (
                        <div className="mt-8 border border-red-200 bg-red-50 text-red-700 rounded-xl p-4">
                            ✗ Transfer failed integrity verification
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ReceiveRoom;
