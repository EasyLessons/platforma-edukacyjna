/**
 * Voice chat na telefonie: sciezki bledow i wyscigi sygnalizacji.
 *
 * Telefon na LTE jest wolniejszy od komputera, wiec wiadomosci od drugiej
 * strony (offer, kandydaci ICE) potrafia przyjsc, zanim lokalne polaczenie
 * zostanie zbudowane. Te testy symuluja to przez kontrolowane opoznienie
 * getIceServers() — to jedyny `await` sieciowy w createPeerConnection.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

// ── Kanal Supabase z przechwytywaniem handlerow ─────────────────────────────
type Handler = (msg: { payload: unknown }) => void | Promise<void>;
const handlers = new Map<string, Handler>();
const sent: Array<{ event: string; payload: any }> = [];
let subscribeStatus = 'SUBSCRIBED';

const channelMock: any = {
  on: vi.fn((_type: string, opts: { event: string }, cb: Handler) => {
    handlers.set(opts.event, cb);
    return channelMock;
  }),
  subscribe: vi.fn((cb?: (status: string) => void) => {
    cb?.(subscribeStatus);
    return channelMock;
  }),
  send: vi.fn((msg: { event: string; payload: any }) => {
    sent.push({ event: msg.event, payload: msg.payload });
  }),
  unsubscribe: vi.fn(),
};

const channelFactory = vi.fn((_name: string) => channelMock);
vi.mock('@/lib/supabase', () => ({
  supabase: { channel: (name: string) => channelFactory(name) },
}));

vi.mock('@/_new/lib/auth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 1, username: 'telefon' } })),
}));

// getIceServers sterowany z testu: domyslnie od razu, na zyczenie "wisi".
let iceGate: { promise: Promise<void>; release: () => void } | null = null;
vi.mock('./voice-chat/constants', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./voice-chat/constants')>();
  return {
    ...orig,
    getIceServers: vi.fn(async () => {
      if (iceGate) await iceGate.promise;
      return [{ urls: 'stun:stun.example:3478' }];
    }),
  };
});

import { VoiceChatProvider, useVoiceChatRequired } from './VoiceChatContext';

function holdIceServers() {
  let release!: () => void;
  const promise = new Promise<void>((r) => (release = r));
  iceGate = { promise, release };
  return iceGate;
}

// ── Globale przegladarki ────────────────────────────────────────────────────
const trackStop = vi.fn();
let peers: FakeRTCPeerConnection[] = [];

class FakeRTCPeerConnection {
  localDescription: any = null;
  remoteDescription: any = null;
  signalingState = 'stable';
  connectionState = 'new';
  iceConnectionState = 'new';
  onicecandidate: any = null;
  ontrack: any = null;
  onconnectionstatechange: any = null;
  oniceconnectionstatechange: any = null;
  addedCandidates: any[] = [];
  addTrack = vi.fn();
  close = vi.fn();
  restartIce = vi.fn();
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'local-offer' }));
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'local-answer' }));
  setLocalDescription = vi.fn(async (d: any) => {
    this.localDescription = d;
    this.signalingState = d.type === 'offer' ? 'have-local-offer' : 'stable';
  });
  setRemoteDescription = vi.fn(async (d: any) => {
    this.remoteDescription = d;
    this.signalingState = d.type === 'offer' ? 'have-remote-offer' : 'stable';
  });
  addIceCandidate = vi.fn(async (c: any) => {
    // Zachowanie jak w przegladarce: bez remoteDescription kandydat jest odrzucany.
    if (!this.remoteDescription) {
      throw new DOMException('remote description is null', 'InvalidStateError');
    }
    this.addedCandidates.push(c);
  });
  constructor() {
    peers.push(this);
  }
}

function makeStream() {
  const track = { stop: trackStop, enabled: true, getConstraints: () => ({}) };
  return { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
}

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const MESSENGER_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/470.0.0.40.108;FBBV/123;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBCR/;FBID/phone;FBLC/pl_PL;FBOP/5]';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <VoiceChatProvider boardId="tablica-1">{children}</VoiceChatProvider>
);

let getUserMediaMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  handlers.clear();
  sent.length = 0;
  peers = [];
  iceGate = null;
  subscribeStatus = 'SUBSCRIBED';
  vi.clearAllMocks();
  localStorage.clear();
  setUserAgent(SAFARI_IOS);

  vi.stubGlobal('RTCPeerConnection', FakeRTCPeerConnection as any);
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'running';
      createAnalyser() {
        return {
          fftSize: 0,
          frequencyBinCount: 8,
          getByteFrequencyData: (a: Uint8Array) => a.fill(0),
          connect: vi.fn(),
        };
      }
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      resume = vi.fn(async () => {});
      close = vi.fn(async () => {});
    } as any
  );

  getUserMediaMock = vi.fn(async () => makeStream());
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: getUserMediaMock },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderAndJoin() {
  const rendered = renderHook(() => useVoiceChatRequired(), { wrapper });
  await act(async () => {
    await rendered.result.current.joinVoiceChat();
  });
  return rendered;
}

const OFFER_FROM_COMPUTER = {
  payload: {
    type: 'voice-offer',
    fromUserId: 2,
    fromUsername: 'komputer',
    toUserId: 1,
    offer: { type: 'offer', sdp: 'remote-offer' },
  },
};

const SYNC_FROM_COMPUTER = {
  payload: { type: 'voice-sync', userId: 2, username: 'komputer', isMuted: false },
};

describe('wyscig sygnalizacji na wolnej sieci', () => {
  it('offer, ktory przyjdzie w trakcie budowania polaczenia, dostaje odpowiedz', async () => {
    await renderAndJoin();
    const gate = holdIceServers();

    // Komputer odpowiada voice-sync -> telefon zaczyna budowac polaczenie
    // (jako responder) i czeka na serwery ICE...
    await act(async () => {
      handlers.get('voice-sync')!(SYNC_FROM_COMPUTER);
    });

    // ...a w tym czasie przychodzi juz offer od komputera.
    let offerDone: Promise<void> | void;
    await act(async () => {
      offerDone = handlers.get('voice-offer')!(OFFER_FROM_COMPUTER);
    });

    await act(async () => {
      gate.release();
      await offerDone;
    });

    await waitFor(() => {
      expect(sent.some((m) => m.event === 'voice-answer' && m.payload.toUserId === 2)).toBe(true);
    });
    // Jedno polaczenie z komputerem, nie dwa.
    expect(peers.filter((p) => p.close.mock.calls.length === 0)).toHaveLength(1);
  });

  it('kandydaci ICE, ktorzy wyprzedza offer, nie gina', async () => {
    await renderAndJoin();
    const gate = holdIceServers();

    let offerDone: Promise<void> | void;
    await act(async () => {
      offerDone = handlers.get('voice-offer')!(OFFER_FROM_COMPUTER);
    });

    // Kandydat przychodzi, zanim telefon ustawil remoteDescription.
    await act(async () => {
      await handlers.get('voice-ice')!({
        payload: {
          type: 'voice-ice',
          fromUserId: 2,
          toUserId: 1,
          candidate: { candidate: 'candidate:1 1 udp 1 10.0.0.1 5000 typ relay', sdpMid: '0' },
        },
      });
    });

    await act(async () => {
      gate.release();
      await offerDone;
    });

    await waitFor(() => {
      const pc = peers.find((p) => p.remoteDescription);
      expect(pc?.addedCandidates).toHaveLength(1);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Sciezki bledow dolaczania — kazda ma konczyc sie komunikatem i sprzatnieciem
// ════════════════════════════════════════════════════════════════════════════

function micError(name: string) {
  return Object.assign(new Error(name), { name });
}

describe('bledy dolaczania', () => {
  it('przegladarka wbudowana (Messenger): komunikat, bez mikrofonu i bez kanalu', async () => {
    setUserAgent(MESSENGER_IOS);
    const { result } = renderHook(() => useVoiceChatRequired(), { wrapper });

    let joined: boolean | undefined;
    await act(async () => {
      joined = await result.current.joinVoiceChat();
    });

    expect(joined).toBe(false);
    expect(result.current.voiceError?.code).toBe('in-app-browser');
    expect(result.current.voiceError?.message).toMatch(/Safari lub Chrome/);
    expect(getUserMediaMock).not.toHaveBeenCalled();
    expect(channelFactory).not.toHaveBeenCalled();
    expect(result.current.isInVoiceChat).toBe(false);
  });

  it('brak navigator.mediaDevices: komunikat "nie obsluguje"', async () => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const { result } = renderHook(() => useVoiceChatRequired(), { wrapper });

    await act(async () => {
      await result.current.joinVoiceChat();
    });

    expect(result.current.voiceError?.code).toBe('unsupported');
    expect(channelFactory).not.toHaveBeenCalled();
  });

  it.each([
    ['NotAllowedError', 'mic-denied'],
    ['NotFoundError', 'mic-not-found'],
    ['NotReadableError', 'mic-busy'],
  ])('%s z getUserMedia -> %s, kanal NIE zostaje otwarty', async (errorName, code) => {
    getUserMediaMock.mockRejectedValueOnce(micError(errorName));
    const { result } = renderHook(() => useVoiceChatRequired(), { wrapper });

    let joined: boolean | undefined;
    await act(async () => {
      joined = await result.current.joinVoiceChat();
    });

    expect(joined).toBe(false);
    expect(result.current.voiceError?.code).toBe(code);
    expect(result.current.isInVoiceChat).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    // Znany problem: wczesniej kanal zostawal otwarty po odmowie mikrofonu.
    expect(channelFactory).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  it('blad kanalu: komunikat, mikrofon zatrzymany, subskrypcja zamknieta', async () => {
    subscribeStatus = 'CHANNEL_ERROR';
    const { result } = renderHook(() => useVoiceChatRequired(), { wrapper });

    await act(async () => {
      await result.current.joinVoiceChat();
    });

    expect(result.current.voiceError?.code).toBe('channel-failed');
    expect(trackStop).toHaveBeenCalled();
    expect(channelMock.unsubscribe).toHaveBeenCalled();
    expect(result.current.isInVoiceChat).toBe(false);
  });

  it('clearVoiceError chowa komunikat, a udane dolaczenie go nie zostawia', async () => {
    getUserMediaMock.mockRejectedValueOnce(micError('NotAllowedError'));
    const { result } = renderHook(() => useVoiceChatRequired(), { wrapper });

    await act(async () => {
      await result.current.joinVoiceChat();
    });
    expect(result.current.voiceError).not.toBeNull();

    act(() => result.current.clearVoiceError());
    expect(result.current.voiceError).toBeNull();

    let joined: boolean | undefined;
    await act(async () => {
      joined = await result.current.joinVoiceChat();
    });
    expect(joined).toBe(true);
    expect(result.current.voiceError).toBeNull();
    expect(result.current.isInVoiceChat).toBe(true);
  });

  it('brak AudioContext nie blokuje dolaczenia (detekcja mowienia jest opcjonalna)', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { result } = await renderAndJoin();

    expect(result.current.isInVoiceChat).toBe(true);
    expect(result.current.voiceError).toBeNull();
  });

  it('podwojne tapniecie w trakcie dolaczania nie odpala drugiego dolaczenia', async () => {
    const { result } = renderHook(() => useVoiceChatRequired(), { wrapper });

    await act(async () => {
      await Promise.all([result.current.joinVoiceChat(), result.current.joinVoiceChat()]);
    });

    expect(getUserMediaMock).toHaveBeenCalledTimes(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Odtwarzanie dzwieku na iOS
// ════════════════════════════════════════════════════════════════════════════

describe('odtwarzanie audio (iOS)', () => {
  let playMock: ReturnType<typeof vi.fn<() => Promise<void>>>;
  let created: any[];

  beforeEach(() => {
    created = [];
    playMock = vi.fn<() => Promise<void>>(async () => {});
    vi.stubGlobal(
      'Audio',
      class {
        srcObject: any = null;
        volume = 1;
        muted = false;
        autoplay = false;
        attrs: Record<string, string> = {};
        pause = vi.fn();
        play = () => playMock();
        setAttribute(k: string, v: string) {
          this.attrs[k] = v;
        }
        constructor() {
          created.push(this);
        }
      } as any
    );
  });

  async function connectAndReceiveTrack() {
    const rendered = await renderAndJoin();
    await act(async () => {
      await handlers.get('voice-offer')!(OFFER_FROM_COMPUTER);
    });
    const pc = peers.find((p) => p.remoteDescription)!;
    await act(async () => {
      pc.ontrack({ streams: [{ id: 'remote-stream' }] });
    });
    return rendered;
  }

  it('element audio ma autoplay i playsinline', async () => {
    await connectAndReceiveTrack();

    expect(created).toHaveLength(1);
    expect(created[0].autoplay).toBe(true);
    expect(created[0].attrs).toHaveProperty('playsinline');
  });

  it('odrzucone play() (NotAllowedError) -> isAudioBlocked; resumeAudio w gescie odblokowuje', async () => {
    playMock.mockRejectedValueOnce(micError('NotAllowedError'));
    const { result } = await connectAndReceiveTrack();

    await waitFor(() => expect(result.current.isAudioBlocked).toBe(true));

    await act(async () => {
      await result.current.resumeAudio();
    });
    expect(result.current.isAudioBlocked).toBe(false);
  });

  it('wyjscie z rozmowy zeruje flage zablokowanego audio', async () => {
    playMock.mockRejectedValueOnce(micError('NotAllowedError'));
    const { result } = await connectAndReceiveTrack();
    await waitFor(() => expect(result.current.isAudioBlocked).toBe(true));

    act(() => result.current.leaveVoiceChat());
    expect(result.current.isAudioBlocked).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Kolizja ofert (glare)
// ════════════════════════════════════════════════════════════════════════════

describe('kolizja ofert', () => {
  async function joinAndSendOwnOfferTo(peerId: number) {
    const rendered = await renderAndJoin();
    await act(async () => {
      handlers.get('voice-join')!({
        payload: { type: 'voice-join', userId: peerId, username: 'komputer' },
      });
    });
    // voice-join -> po 300 ms wysylamy wlasny offer (jestesmy inicjatorem)
    await waitFor(() => expect(sent.some((m) => m.event === 'voice-offer')).toBe(true));
    return rendered;
  }

  it('strona z nizszym id ustepuje: odpowiada na cudzy offer', async () => {
    await joinAndSendOwnOfferTo(2); // my: id 1 < 2

    await act(async () => {
      await handlers.get('voice-offer')!(OFFER_FROM_COMPUTER);
    });

    await waitFor(() =>
      expect(sent.some((m) => m.event === 'voice-answer' && m.payload.toUserId === 2)).toBe(true)
    );
  });

  it('strona z wyzszym id zostaje przy swoim offerze i nie odpowiada', async () => {
    const auth = await import('@/_new/lib/auth');
    vi.mocked(auth.useAuth).mockReturnValue({ user: { id: 5, username: 'telefon' } } as any);

    await joinAndSendOwnOfferTo(2); // my: id 5 > 2

    await act(async () => {
      await handlers.get('voice-offer')!({
        payload: { ...OFFER_FROM_COMPUTER.payload, toUserId: 5 },
      });
    });

    expect(sent.some((m) => m.event === 'voice-answer')).toBe(false);
    const ours = peers.find((p) => p.signalingState === 'have-local-offer');
    expect(ours?.close).not.toHaveBeenCalled();
  });
});
