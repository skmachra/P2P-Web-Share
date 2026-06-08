export async function generateKey() {
    return crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"],
    );
}

export async function exportKey(key) {
    const raw = await crypto.subtle.exportKey(
        "raw",
        key,
    );

    return btoa(
        String.fromCharCode(
            ...new Uint8Array(raw),
        ),
    );
}

export async function importKey(base64Key) {
    const bytes = Uint8Array.from(
        atob(base64Key),
        (c) => c.charCodeAt(0),
    );

    return crypto.subtle.importKey(
        "raw",
        bytes,
        {
            name: "AES-GCM",
        },
        true,
        ["encrypt", "decrypt"],
    );
}

export async function encryptData(
    buffer,
    key,
    iv,
) {
    return crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv,
        },
        key,
        buffer,
    );
}

export async function decryptData(
    buffer,
    key,
    iv,
) {
    return crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv,
        },
        key,
        buffer,
    );
}