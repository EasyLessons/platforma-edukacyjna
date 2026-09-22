/**
 * iceRestart.ts
 *
 * Czyste funkcje pomocnicze do restartu ICE (odzyskiwanie polaczenia P2P po
 * zaniku sieci, np. telefon LTE <-> Wi-Fi) - bez Reactu, latwe do testow.
 *
 * Dlaczego jawny `createOffer({ iceRestart: true })`, a nie `pc.restartIce()`
 * + `onnegotiationneeded`: samo `restartIce()` tylko ustawia flage "potrzebna
 * renegocjacja" - bez wyslania nowej oferty druga strona nigdy sie o niej nie
 * dowie. Jawna oferta jest deterministyczna i testowalna, a `onnegotiationneeded`
 * odpala sie tez przy innych zmianach (addTrack), co utrudnia kontrole glare.
 */

/**
 * Restart ICE inicjuje TYLKO strona z nizszym id usera. Dzieki temu obie strony
 * nie wysylaja ofert restartu jednoczesnie (glare); druga strona po prostu
 * odpowiada answerem na przychodzaca oferte. Ta sama regula co przy kolizji
 * ofert w handleOffer (ustepuje strona z nizszym id, wiec tu nizsza inicjuje,
 * a wyzsza czeka - nigdy obie naraz).
 */
export function shouldInitiateIceRestart(myUserId: number, remoteUserId: number): boolean {
  return myUserId < remoteUserId;
}

/** Wyciaga fingerprint DTLS (`a=fingerprint:<alg> <hex>`) z SDP; null gdy brak. */
export function getDtlsFingerprint(sdp: string | null | undefined): string | null {
  if (!sdp) return null;
  const match = /^a=fingerprint:\s*(\S+\s+\S+)/im.exec(sdp);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Czy przychodzaca oferta to renegocjacja TEGO SAMEGO polaczenia (restart ICE
 * po stronie peera), a nie swieza oferta z nowo utworzonego RTCPeerConnection?
 *
 * Restart ICE zmienia ufrag/pwd i kandydatow, ale zachowuje fingerprint DTLS
 * (ten sam certyfikat tego samego RTCPeerConnection). Nowe polaczenie ma nowy
 * certyfikat, wiec nowy fingerprint - i wtedy trzeba odtworzyc nasze pc od zera
 * (przegladarki nie pozwalaja zmienic fingerprintu w trakcie sesji).
 */
export function isRenegotiationOfSameSession(
  currentRemoteSdp: string | null | undefined,
  incomingOfferSdp: string | null | undefined
): boolean {
  const current = getDtlsFingerprint(currentRemoteSdp);
  const incoming = getDtlsFingerprint(incomingOfferSdp);
  return current !== null && incoming !== null && current === incoming;
}

export interface IceRestartRequest {
  user: { id: number; username: string };
  remoteUserId: number;
  remoteUsername: string;
  pc: RTCPeerConnection;
  /** Wysyla oferte (voice-offer) do peera przez kanal sygnalizacji. */
  sendOffer: (offer: RTCSessionDescriptionInit | null) => void;
}

/**
 * Restart ICE na ISTNIEJACYM polaczeniu (po zaniku sieci: LTE <-> Wi-Fi, zmiana IP).
 * Nowa oferta z `iceRestart: true` leci tym samym kanalem co pierwsza; druga strona
 * odpowiada answerem na tym samym pc (handleOffer rozpoznaje restart po fingerprincie).
 * Zwraca true, jesli oferta poszla. Inicjuje tylko strona z nizszym id (glare = 0);
 * pomija, gdy pc nie jest `stable` (trwa inna negocjacja).
 */
export async function restartIceOnConnection({
  user,
  remoteUserId,
  remoteUsername,
  pc,
  sendOffer,
}: IceRestartRequest): Promise<boolean> {
  if (!shouldInitiateIceRestart(user.id, remoteUserId)) {
    console.log(
      `🎤 [VOICE] 🔁 Restart ICE z ${remoteUsername}: czekam na ofertę od drugiej strony`
    );
    return false;
  }
  if (pc.signalingState !== 'stable') {
    console.log(
      `🎤 [VOICE] 🔁 Restart ICE z ${remoteUsername} pominięty (signalingState=${pc.signalingState})`
    );
    return false;
  }
  try {
    console.log(`🎤 [VOICE] 🔁 Restart ICE z ${remoteUsername} - wysyłam nową ofertę`);
    const offer = await pc.createOffer({ iceRestart: true });
    await pc.setLocalDescription(offer);
    sendOffer(pc.localDescription);
    return true;
  } catch (error) {
    console.error(`🎤 [VOICE] ❌ Restart ICE z ${remoteUsername} nieudany:`, error);
    return false;
  }
}
