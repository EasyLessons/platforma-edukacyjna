/**
 * Testy odzyskiwania polaczenia po zaniku sieci (restart ICE) i przelacznika
 * "Echo cancellation" z ustawien.
 *
 * Osobny plik od VoiceChatContext.flows.test.tsx: potrzebuje fake timerow
 * (sciezki `disconnected` maja opoznienia 2 s / 5 s) i bogatszego mocka
 * RTCPeerConnection (signalingState, remoteDescription, argumenty createOffer).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  getDtlsFingerprint,
  isRenegotiationOfSameSession,
  shouldInitiateIceRestart,
} from './voice-chat/iceRestart';

// ── Kanal Supabase z przechwytywaniem handlerow broadcastu ──────────────────
type Handler = (msg: { payload: unknown }) => void | Promise<void>;
const handlers = new Map<string, Handler>();
const sent: Array<{ event: string; payload: any }> = [];

const channelMock: any = {
  on: vi.fn((_type: string, opts: { event: string }, cb: Handler) => {
    handlers.set(opts.event, cb);
    return channelMock;
  }),
  subscribe: vi.fn((cb?: (status: string) => void) => {
    cb?.('SUBSCRIBED');
    return channelMock;
  }),
  send: vi.fn((msg: { event: string; payload: any }) => {
    sent.push({ event: msg.event, payload: msg.payload });
  }),
  unsubscribe: vi.fn(),
};

vi.mock('@/_new/lib/supabase/client', () => ({
  supabase: { channel: vi.fn(() => channelMock) },
}));

// Id zalogowanego usera zmieniamy per test (kto inicjuje restart zalezy od id).
const auth = vi.hoisted(() => ({ userId: 1 }));
vi.mock('@/_new/lib/auth', () => ({
  useAuth: () => ({ user: { id: auth.userId, username: 'me' } }),
}));

import { VoiceChatProvider, useVoiceChatRequired } from './VoiceChatContext';

// ── Mocki globali przegladarki ──────────────────────────────────────────────
const applyConstraints = vi.fn(async () => {});
let createdPeerConnections: FakeRTCPeerConnection[] = [];

function makeStream() {
  const track = {
    stop: vi.fn(),
    enabled: true,
    getConstraints: () => ({}),
    getSettings: () => ({}),
    applyConstraints,
  };
  return {
    id: 'local-stream',
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
}

const SDP_A = 'v=0\r\na=fingerprint:sha-256 AA:BB:CC\r\na=ice-ufrag:one\r\n';
const SDP_A_RESTART = 'v=0\r\na=fingerprint:sha-256 AA:BB:CC\r\na=ice-ufrag:two\r\n';
const SDP_B = 'v=0\r\na=fingerprint:sha-256 DD:EE:FF\r\na=ice-ufrag:three\r\n';

class FakeRTCPeerConnection {
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  signalingState = 'stable';
  connectionState = 'new';
  iceConnectionState = 'new';
  onicecandidate: any = null;
  ontrack: any = null;
  onconnectionstatechange: any = null;
  oniceconnectionstatechange: any = null;
  addTrack = vi.fn();
  close = vi.fn();
  restartIce = vi.fn();
  getSenders = vi.fn(() => []);
  addIceCandidate = vi.fn(async () => {});
  createOffer = vi.fn(async (_opts?: RTCOfferOptions) => ({ type: 'offer', sdp: SDP_A }));
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'answer-sdp' }));
  setRemoteDescription = vi.fn(async (desc: RTCSessionDescriptionInit) => {
    this.remoteDescription = desc;
    this.signalingState = desc.type === 'offer' ? 'have-remote-offer' : 'stable';
  });
  setLocalDescription = vi.fn(async (desc: RTCSessionDescriptionInit) => {
    this.localDescription = desc;
    this.signalingState = desc.type === 'offer' ? 'have-local-offer' : 'stable';
  });
  constructor() {
    createdPeerConnections.push(this);
  }
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <VoiceChatProvider boardId="test-board">{children}</VoiceChatProvider>
);

beforeEach(() => {
  handlers.clear();
  sent.length = 0;
  createdPeerConnections = [];
  auth.userId = 1;
  vi.clearAllMocks();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });

  vi.stubGlobal('RTCPeerConnection', FakeRTCPeerConnection as any);
  vi.stubGlobal(
    'AudioContext',
    class {
      createAnalyser() {
        return {
          fftSize: 0,
          frequencyBinCount: 128,
          getByteFrequencyData: (a: Uint8Array) => a.fill(0),
          connect: vi.fn(),
        };
      }
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      close = vi.fn(async () => {});
    } as any
  );
  vi.stubGlobal(
    'Audio',
    class {
      srcObject: any = null;
      volume = 1;
      pause = vi.fn();
      play = vi.fn(async () => {});
      setAttribute = vi.fn();
    } as any
  );
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn(async () => makeStream()) },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function joinChat() {
  const rendered = renderHook(() => useVoiceChatRequired(), { wrapper });
  await act(async () => {
    await rendered.result.current.joinVoiceChat();
  });
  return rendered;
}

/** Peer o danym id przysyla oferte -> mamy polaczenie (my = responder). */
async function connectWithPeer(peerId: number, sdp = SDP_A) {
  await act(async () => {
    await handlers.get('voice-offer')!({
      payload: {
        type: 'voice-offer',
        fromUserId: peerId,
        fromUsername: 'peer',
        toUserId: auth.userId,
        offer: { type: 'offer', sdp },
      },
    });
  });
  const pc = createdPeerConnections[createdPeerConnections.length - 1];
  pc.connectionState = 'connected';
  pc.iceConnectionState = 'connected';
  return pc;
}

const offersTo = (peerId: number) =>
  sent.filter((m) => m.event === 'voice-offer' && m.payload.toUserId === peerId);

// ── Czyste funkcje ──────────────────────────────────────────────────────────

describe('iceRestart helpers', () => {
  it('shouldInitiateIceRestart: inicjuje tylko strona z nizszym id', () => {
    expect(shouldInitiateIceRestart(1, 2)).toBe(true);
    expect(shouldInitiateIceRestart(2, 1)).toBe(false);
  });

  it('getDtlsFingerprint wyciaga fingerprint niezaleznie od wielkosci liter', () => {
    expect(getDtlsFingerprint(SDP_A)).toBe('sha-256 aa:bb:cc');
    expect(getDtlsFingerprint('v=0\r\nm=audio 9\r\n')).toBeNull();
    expect(getDtlsFingerprint(undefined)).toBeNull();
  });

  it('isRenegotiationOfSameSession: ten sam fingerprint = restart, inny = nowe polaczenie', () => {
    expect(isRenegotiationOfSameSession(SDP_A, SDP_A_RESTART)).toBe(true);
    expect(isRenegotiationOfSameSession(SDP_A, SDP_B)).toBe(false);
    expect(isRenegotiationOfSameSession(undefined, SDP_A)).toBe(false);
  });
});

// ── Zanik sieci ─────────────────────────────────────────────────────────────

describe('zanik sieci (connectionState: disconnected)', () => {
  it('strona z nizszym id po 2 s wysyla oferte z iceRestart:true na TYM SAMYM pc', async () => {
    auth.userId = 1;
    await joinChat();
    const pc = await connectWithPeer(2);
    expect(offersTo(2)).toHaveLength(0);

    pc.connectionState = 'disconnected';
    await act(async () => {
      pc.onconnectionstatechange();
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(pc.createOffer).toHaveBeenCalledWith({ iceRestart: true });
    expect(pc.setLocalDescription).toHaveBeenCalledWith(expect.objectContaining({ type: 'offer' }));
    expect(offersTo(2)).toHaveLength(1);
    expect(offersTo(2)[0].payload.fromUserId).toBe(1);
    // Zadnego nowego RTCPeerConnection ani zamkniecia starego.
    expect(createdPeerConnections).toHaveLength(1);
    expect(pc.close).not.toHaveBeenCalled();
    // Stare restartIce() bylo martwe - nie wolamy go wcale.
    expect(pc.restartIce).not.toHaveBeenCalled();
  });

  it('nie restartuje, jesli polaczenie samo wrocilo w ciagu 2 s', async () => {
    auth.userId = 1;
    await joinChat();
    const pc = await connectWithPeer(2);

    pc.connectionState = 'disconnected';
    await act(async () => {
      pc.onconnectionstatechange();
      await vi.advanceTimersByTimeAsync(1000);
      pc.connectionState = 'connected';
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(pc.createOffer).not.toHaveBeenCalled();
    expect(offersTo(2)).toHaveLength(0);
  });

  it('strona z wyzszym id NIE wysyla oferty - czeka na restart od drugiej strony', async () => {
    auth.userId = 5;
    await joinChat();
    const pc = await connectWithPeer(2);

    pc.connectionState = 'disconnected';
    await act(async () => {
      pc.onconnectionstatechange();
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(pc.createOffer).not.toHaveBeenCalled();
    expect(offersTo(2)).toHaveLength(0);
    expect(pc.close).not.toHaveBeenCalled();
  });

  it('iceConnectionState: failed -> natychmiastowa oferta restartu (nizszy id)', async () => {
    auth.userId = 1;
    await joinChat();
    const pc = await connectWithPeer(2);

    pc.iceConnectionState = 'failed';
    await act(async () => {
      pc.oniceconnectionstatechange();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(pc.createOffer).toHaveBeenCalledWith({ iceRestart: true });
    expect(offersTo(2)).toHaveLength(1);
    expect(createdPeerConnections).toHaveLength(1);
  });

  it('iceConnectionState: disconnected -> restart dopiero po 5 s, jesli nadal disconnected', async () => {
    auth.userId = 1;
    await joinChat();
    const pc = await connectWithPeer(2);

    pc.iceConnectionState = 'disconnected';
    await act(async () => {
      pc.oniceconnectionstatechange();
      await vi.advanceTimersByTimeAsync(4900);
    });
    expect(offersTo(2)).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(offersTo(2)).toHaveLength(1);
    expect(pc.createOffer).toHaveBeenCalledWith({ iceRestart: true });
  });
});

// ── Odbior oferty restartu ──────────────────────────────────────────────────

describe('oferta restartu ICE od peera', () => {
  it('ten sam fingerprint DTLS -> answer na istniejacym pc, bez zamykania i bez nowego pc', async () => {
    auth.userId = 5;
    await joinChat();
    const pc = await connectWithPeer(2, SDP_A);
    expect(sent.filter((m) => m.event === 'voice-answer')).toHaveLength(1);

    await act(async () => {
      await handlers.get('voice-offer')!({
        payload: {
          type: 'voice-offer',
          fromUserId: 2,
          fromUsername: 'peer',
          toUserId: 5,
          offer: { type: 'offer', sdp: SDP_A_RESTART },
        },
      });
    });

    expect(createdPeerConnections).toHaveLength(1);
    expect(pc.close).not.toHaveBeenCalled();
    expect(pc.setRemoteDescription).toHaveBeenCalledTimes(2);
    expect(pc.createAnswer).toHaveBeenCalledTimes(2);
    const answers = sent.filter((m) => m.event === 'voice-answer');
    expect(answers).toHaveLength(2);
    expect(answers[1].payload.toUserId).toBe(2);
  });

  it('inny fingerprint (peer odtworzyl polaczenie) -> stare pc zamkniete, nowe utworzone', async () => {
    auth.userId = 5;
    await joinChat();
    const oldPc = await connectWithPeer(2, SDP_A);

    await act(async () => {
      // handleOffer czeka 100 ms (setTimeout) po cleanupie, zanim zbuduje nowe pc -
      // przy fake timerach trzeba ten czas przesunac, ZANIM zaczekamy na handler.
      const handled = handlers.get('voice-offer')!({
        payload: {
          type: 'voice-offer',
          fromUserId: 2,
          fromUsername: 'peer',
          toUserId: 5,
          offer: { type: 'offer', sdp: SDP_B },
        },
      });
      await vi.advanceTimersByTimeAsync(500);
      await handled;
    });

    expect(oldPc.close).toHaveBeenCalled();
    expect(createdPeerConnections).toHaveLength(2);
    const newPc = createdPeerConnections[1];
    expect(newPc.setRemoteDescription).toHaveBeenCalledWith(
      expect.objectContaining({ sdp: SDP_B })
    );
    expect(sent.filter((m) => m.event === 'voice-answer')).toHaveLength(2);
  });
});

// ── Echo cancellation z ustawien ────────────────────────────────────────────

describe('ustawienie "Echo cancellation"', () => {
  it('trafia do constraints getUserMedia (wylaczone w localStorage -> false)', async () => {
    localStorage.setItem('voiceChatSettings', JSON.stringify({ echoCancellation: false }));
    await joinChat();

    const call = (navigator.mediaDevices.getUserMedia as any).mock.calls[0][0];
    expect(call.audio.echoCancellation).toBe(false);
    expect(call.audio.noiseSuppression).toBe(true);
  });

  it('domyslnie wlaczone', async () => {
    await joinChat();
    const call = (navigator.mediaDevices.getUserMedia as any).mock.calls[0][0];
    expect(call.audio.echoCancellation).toBe(true);
  });

  it('zmiana w trakcie rozmowy wola applyConstraints na zywym torze', async () => {
    const { result } = await joinChat();

    await act(async () => {
      result.current.updateSettings({ echoCancellation: false });
    });

    expect(applyConstraints).toHaveBeenCalledWith(
      expect.objectContaining({ echoCancellation: false, noiseSuppression: true })
    );
    expect(result.current.settings.echoCancellation).toBe(false);
  });

  it('zmiana glosnosci NIE dotyka constraints toru', async () => {
    const { result } = await joinChat();

    await act(async () => {
      result.current.updateSettings({ speakerVolume: 0.5 });
    });

    expect(applyConstraints).not.toHaveBeenCalled();
  });
});
