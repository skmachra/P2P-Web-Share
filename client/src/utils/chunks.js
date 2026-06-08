export const CHUNK_SIZE = 32 * 1024;
export function getTotalChunks(size) {
    return Math.ceil(size / CHUNK_SIZE);
}