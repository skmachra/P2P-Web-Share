export const rtcConfig = {
    // Public STUN servers let peers discover network-facing addresses for WebRTC.
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302",
        },
        {
            urls: "stun:global.stun.twilio.com:3478",
        },
    ],
};
