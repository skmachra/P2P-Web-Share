# P2P Share

A secure browser-to-browser file sharing application built using WebRTC, React, Node.js, and Socket.io.

P2P Share allows users to transfer files directly between browsers without uploading them to a server. The signaling server is used only to establish the WebRTC connection and never stores or processes file data.

---

## Features

### Core Features

* Share Room Creation with unique invite links
* Direct browser-to-browser file transfer using WebRTC DataChannels
* Socket.io signaling server for connection establishment
* Chunk-based file transfer
* SHA-256 chunk verification
* SHA-256 file verification
* Real-time transfer progress tracking
* Transfer speed monitoring (MB/s)
* Estimated remaining time (ETA)
* Active connection status indicators
* Graceful disconnect handling
* Automatic file download after successful verification

### Advanced Feature Implemented

#### Zero-Knowledge End-to-End Encryption

* AES-GCM encryption performed entirely in the browser
* Encryption key shared through URL fragments
* Signaling server never has access to encryption keys
* Signaling server never has access to file contents

---

## Architecture

```text
Sender Browser
      |
      | Signaling
      v
Socket.io Server
      ^
      |
Receiver Browser

After Handshake

Sender Browser
      <---- WebRTC P2P ---->
Receiver Browser
```

The server is only responsible for exchanging:

* Offers
* Answers
* ICE Candidates

All file data flows directly between peers.

---

## Tech Stack

### Frontend

* React
* Vite
* Tailwind CSS
* Socket.io Client
* WebRTC API

### Backend

* Node.js
* Express.js
* Socket.io

---

## Security

### End-to-End Encryption

Files are encrypted using AES-GCM before transmission.

The encryption key is embedded in the URL fragment:

```text
/share/<room-id>#key=<encryption-key>
```

URL fragments are never sent to the server, ensuring that the server cannot access encryption keys.

### Integrity Verification

Each file chunk is verified using SHA-256.

After transfer completion:

* Receiver reconstructs the file
* Receiver computes final SHA-256 hash
* Hash is compared with sender hash
* Download proceeds only if hashes match

---

## Project Structure

```text
frontend/
├── src
│   ├── components
│   ├── pages
│   ├── services
│   ├── utils
│   └── App.jsx

backend/
├── server.js
├── socket.js
├── rooms.js
└── package.json
```

---

## Local Setup

### Clone Repository

```bash
git clone <repository-url>
cd p2p-web-share
```

---

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

Server starts on:

```text
http://localhost:5000
```

---

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend starts on:

```text
http://localhost:5173
```

---

## Usage

### Sender

1. Open homepage
2. Click "Create Share Room"
3. Copy generated invite link
4. Send link to recipient
5. Select file
6. Click "Send File"

### Receiver

1. Open shared link
2. Connection establishes automatically
3. File transfer begins
4. File integrity is verified
5. File downloads automatically

---

## Deployment

### Frontend

Vercel Deployment:

```text
https://your-frontend-url.vercel.app
```

### Backend

Render Deployment:

```text
https://your-backend-url.onrender.com
```

---

## Testing

### Successful Transfers Tested

* 1 MB
* 10 MB
* 25 MB
* 50 MB

### Validation Scenarios

* Successful transfer
* Invalid room link
* Peer disconnect during transfer
* Wrong encryption key
* Corrupted chunk detection
* Automatic download after verification

---

## Future Improvements

* Multi-peer transfers
* Large file support using OPFS / IndexedDB
* Connection recovery and transfer resume
* Transfer history
* Multiple simultaneous file transfers

---

## Authors

Developed for MARS Open Projects 2026.

Built using WebRTC, React, Node.js, Socket.io, AES-GCM, and SHA-256.
