import { VoiceSettings } from './types';
import { createLogger } from '@/_new/lib/logger';

const log = createLogger('voice-chat/constants');

export const DEFAULT_SETTINGS: VoiceSettings = {
  microphoneVolume: 1,
  speakerVolume: 1,
  pushToTalk: false,
  pushToTalkKey: 'Space',
  noiseSupression: true,
  echoCancellation: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// 🌐 WEBRTC ICE SERVERS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
//
// WAŻNE: Dla produkcji potrzebujesz WŁASNEGO TURN servera!
// Darmowe opcje:
// 1. Metered.ca (500MB/mies free) - https://www.metered.ca/stun-turn
// 2. Twilio (płatne ale niezawodne)
// 3. Self-hosted coturn
//
// Ustaw credentials w env variables:
// NEXT_PUBLIC_TURN_URL, NEXT_PUBLIC_TURN_USERNAME, NEXT_PUBLIC_TURN_CREDENTIAL

export const getIceServers = async (): Promise<RTCIceServer[]> => {
  const servers: RTCIceServer[] = [
    // STUN servers (darmowe, do odkrywania publicznego IP)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // XIRSYS TURN - pobierz aktualne serwery z API
  // ═══════════════════════════════════════════════════════════════════════════
  const xirsysIdent = process.env.NEXT_PUBLIC_XIRSYS_IDENT;
  const xirsysSecret = process.env.NEXT_PUBLIC_XIRSYS_SECRET;
  const xirsysChannel = process.env.NEXT_PUBLIC_XIRSYS_CHANNEL;

  if (xirsysIdent && xirsysSecret && xirsysChannel) {
    try {
      log.info('🔍 Pobieram serwery TURN z Xirsys API...');

      const auth = btoa(`${xirsysIdent}:${xirsysSecret}`);

      const response = await fetch(`https://global.xirsys.net/_turn/${xirsysChannel}`, {
        method: 'PUT',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ format: 'urls' }),
      });

      if (response.ok) {
        const data = await response.json();
        // Nie logujemy calej odpowiedzi ani data.v - zawieraja login/haslo TURN.
        log.debug('Xirsys API status:', data.s, '| typ data.v:', typeof data.v);

        if (data.s === 'ok' && data.v) {
          // Xirsys API może zwracać różne formaty
          let xirsysServers = [];

          if (data.v.iceServers && Array.isArray(data.v.iceServers)) {
            // Format 1: { v: { iceServers: [...] } }
            log.debug('Format: v.iceServers array');
            xirsysServers = data.v.iceServers;
          } else if (Array.isArray(data.v)) {
            // Format 2: { v: [...] } - bezpośrednio array
            log.debug('Format: v jest array');
            xirsysServers = data.v;
          } else if (typeof data.v === 'object') {
            // Format 3: może być { v: { stun: [...], turn: [...] } }
            log.debug('Format: v jest object, sprawdzam właściwości');
            const vKeys = Object.keys(data.v);
            log.debug('Klucze w data.v:', vKeys);

            // Spróbuj różnych kluczy
            if (data.v.stun && data.v.turn) {
              xirsysServers = [...data.v.stun, ...data.v.turn];
            } else if (data.v.urls && Array.isArray(data.v.urls)) {
              xirsysServers = data.v.urls;
            } else if (data.v.iceServers) {
              // 🎯 XIRSYS SPECIFIC FORMAT: { iceServers: { username, urls[], credential } }
              const xirsysData = data.v.iceServers;
              if (
                xirsysData.urls &&
                Array.isArray(xirsysData.urls) &&
                xirsysData.username &&
                xirsysData.credential
              ) {
                log.info('🎯 Konwertuję format Xirsys na RTCIceServer');

                // Przekształć format Xirsys: { username, urls[], credential }
                // Na standardowy: [{ urls: url1, username, credential }, { urls: url2, username, credential }]
                xirsysServers = xirsysData.urls.map((url: string) => ({
                  urls: url,
                  username: xirsysData.username,
                  credential: xirsysData.credential,
                }));

                log.info('✅ Przekształcono Xirsys serwery:', xirsysServers.length);
              }
            } else {
              // Ostatnia próba - może to są bezpośrednio serwery ICE
              const firstValue = Object.values(data.v)[0];
              if (Array.isArray(firstValue)) {
                xirsysServers = firstValue;
              }
            }
          }

          // Tylko liczba - wpisy zawieraja credential TURN.
          const xirsysCount = Array.isArray(xirsysServers) ? xirsysServers.length : -1;
          log.debug('Xirsys serwery do dodania:', xirsysCount);

          if (Array.isArray(xirsysServers) && xirsysServers.length > 0) {
            log.info('✅ Dodaję serwery Xirsys:', xirsysServers.length);
            servers.push(...xirsysServers);
            return servers;
          } else {
            log.error('❌ Nie mogę sparsować Xirsys serwerów (typ:', typeof xirsysServers, ')');
          }
        } else {
          log.error('❌ Xirsys API error, status:', data?.s);
        }
      } else {
        log.error('❌ Xirsys API HTTP error:', response.status, response.statusText);
      }
    } catch (error) {
      log.error('❌ Xirsys API fetch error:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FALLBACK: Publiczne darmowe TURN serwery (mniej niezawodne)
  // ═══════════════════════════════════════════════════════════════════════════
  log.info('⚠️ Używam fallback TURN serwerów');
  // numb.viagenie.ca usuniety 17.09.2026: domena nie ma juz rekordu DNS, a martwy
  // serwer TURN tylko wydluzal zbieranie kandydatow ICE.
  servers.push(
    // OpenRelay (metered.ca) - backup
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    }
  );

  return servers;
};

// Tymczasowy sync fallback dla inicjalizacji
export const getBasicIceServers = (): RTCIceServer[] => {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Fallback TURN
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];
};

export const RTC_CONFIG_BASIC: RTCConfiguration = {
  iceServers: getBasicIceServers(),
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
};
