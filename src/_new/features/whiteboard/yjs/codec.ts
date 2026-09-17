/**
 * codec.ts
 *
 * Konwersja Uint8Array (binarne update'y Yjs) <-> base64
 * (Supabase Broadcast - wysyła JSON, nie binaria).
 *
 * Dodatkowo chunking - dzieli/składa duże payloady w kawałki
 * (Supabase Broadcast ma twardy limit 256 KB/wiadomość).
 */

/** Liczba znaków na wywołanie fromCharCode - spread całej dużej tablicy wysadza stack */
const FROM_CHAR_CODE_CHUNK = 0x8000;

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += FROM_CHAR_CODE_CHUNK) {
    const slice = bytes.subarray(i, i + FROM_CHAR_CODE_CHUNK);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Dzieli string na kawałki o zadanej długiści */
export function splitIntoChunks(value: string, chunkSize: number): string[] {
  if (value.length === 0) return [''];
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += chunkSize) chunks.push(value.slice(i, i + chunkSize));
  return chunks;
}

export interface ChunkedPayload {
  transmissionId: string;
  chunkIndex: number;
  totalChunks: number;
  data: string;
}

/** Składacz chunków z wielu transmisji */
export function createChunkCollector() {
  const buffers = new Map<string, (string | undefined)[]>();

  return {
    collect(payload: ChunkedPayload): string | null {
      let parts = buffers.get(payload.transmissionId);
      if (!parts) {
        parts = new Array(payload.totalChunks).fill(undefined);
        buffers.set(payload.transmissionId, parts);
      }
      parts[payload.chunkIndex] = payload.data;
      if (parts.every((p) => p !== undefined)) {
        buffers.delete(payload.transmissionId);
        return parts.join('');
      }
      return null;
    },
    clear(): void {
      buffers.clear();
    },
  };
}
