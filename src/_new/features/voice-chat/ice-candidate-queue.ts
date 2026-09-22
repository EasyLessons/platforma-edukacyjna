/**
 * Kolejka kandydatow ICE, ktorzy przyszli zanim polaczenie mialo remoteDescription
 * (druga strona wysyla kandydatow zaraz po ofercie, wiec na wolnym telefonie
 * wyprzedzaja jej obsluge). Wydzielone z useWebRTCConnections (bez Reacta).
 */

export const MAX_QUEUED_ICE = 50;

export interface IceCandidateQueue {
  /** Dodaj kandydata, jesli pc jeszcze nie ma remoteDescription (limit MAX_QUEUED_ICE). */
  enqueue(userId: number, candidate: RTCIceCandidateInit): void;
  /** Doklada kandydatow z kolejki do pc (juz z remoteDescription); bledy tylko logowane. */
  flush(userId: number, pc: RTCPeerConnection): Promise<void>;
  /** Czysci kolejke jednego usera albo wszystkich. */
  clear(userId?: number): void;
}

export function createIceCandidateQueue(maxPerUser = MAX_QUEUED_ICE): IceCandidateQueue {
  const pending = new Map<number, RTCIceCandidateInit[]>();

  return {
    enqueue(userId, candidate) {
      const queue = pending.get(userId) ?? [];
      if (queue.length < maxPerUser) queue.push(candidate);
      pending.set(userId, queue);
    },
    async flush(userId, pc) {
      const queued = pending.get(userId);
      if (!queued?.length) return;
      pending.delete(userId);
      for (const candidate of queued) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (error) {
          console.warn('🎤 [VOICE] Pominięty kandydat ICE z kolejki:', error);
        }
      }
    },
    clear(userId) {
      if (userId === undefined) pending.clear();
      else pending.delete(userId);
    },
  };
}

/**
 * Kandydat od drugiej strony: od razu do pc, gdy ma remoteDescription;
 * inaczej do kolejki (flush po setRemoteDescription).
 */
export async function addOrQueueIceCandidate(
  queue: IceCandidateQueue,
  userId: number,
  pc: RTCPeerConnection | undefined,
  candidate: RTCIceCandidateInit
): Promise<void> {
  if (pc?.remoteDescription) {
    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      console.warn('🎤 [VOICE] Nie udało się dodać kandydata ICE:', error);
    }
    return;
  }
  queue.enqueue(userId, candidate);
}
