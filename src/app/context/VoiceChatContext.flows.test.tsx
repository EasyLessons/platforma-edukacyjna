/**
 * Testy SCIEZEK voice chatu: dolaczenie, wyjscie, offer/answer, rozlaczenie peera.
 *
 * Osobny plik od VoiceChatContext.test.tsx swiadomie: te testy potrzebuja
 * ciezkich mockow globali (RTCPeerConnection, getUserMedia, AudioContext) oraz
 * kanalu Supabase, ktory realnie wola callback subscribe('SUBSCRIBED').
 * Wpiecie tego do tamtego pliku zmienialoby warunki dzialania istniejacych
 * testow stanu poczatkowego.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

// ── Kanal Supabase z przechwytywaniem handlerow broadcastu ──────────────────
type Handler = (msg: { payload: unknown }) => void | Promise<void>;
const handlers = new Map<string, Handler>();
const sent: Array<{ event: string; payload: any }> = [];
let channelName = '';

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
  supabase: {
    channel: vi.fn((name: string) => {
      channelName = name;
      return channelMock;
    }),
  },
}));

vi.mock('@/_new/lib/auth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 1, username: 'testuser' } })),
}));

import { VoiceChatProvider, useVoiceChatRequired } from './VoiceChatContext';

// ── Mocki globali przegladarki ──────────────────────────────────────────────
const trackStop = vi.fn();
let createdPeerConnections: any[] = [];

function makeStream() {
  const track = { stop: trackStop, enabled: true, getConstraints: () => ({}) };
  return {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
}

class FakeRTCPeerConnection {
  localDescription = { type: 'answer', sdp: 'fake-sdp' };
  connectionState = 'new';
  iceConnectionState = 'new';
  onicecandidate: any = null;
  ontrack: any = null;
  onconnectionstatechange: any = null;
  oniceconnectionstatechange: any = null;
  addTrack = vi.fn();
  close = vi.fn();
  setRemoteDescription = vi.fn(async () => {});
  setLocalDescription = vi.fn(async () => {});
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'o' }));
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'a' }));
  addIceCandidate = vi.fn(async () => {});
  restartIce = vi.fn();
  getSenders = vi.fn(() => []);
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
  vi.clearAllMocks();
  localStorage.clear();

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
    } as any
  );

  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn(async () => makeStream()) },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function joinChat() {
  const rendered = renderHook(() => useVoiceChatRequired(), { wrapper });
  await act(async () => {
    await rendered.result.current.joinVoiceChat();
  });
  return rendered;
}

const offerFromPeer = (toUserId: number) => ({
  payload: {
    type: 'voice-offer',
    fromUserId: 2,
    fromUsername: 'peer',
    toUserId,
    offer: { type: 'offer', sdp: 'remote-sdp' },
  },
});

describe('joinVoiceChat', () => {
  it('subskrybuje kanal voice tej tablicy i wchodzi w stan rozmowy', async () => {
    const { result } = await joinChat();

    expect(channelName).toBe('voice:test-board');
    expect(channelMock.subscribe).toHaveBeenCalled();
    expect(result.current.isInVoiceChat).toBe(true);
    expect(result.current.isConnecting).toBe(false);
  });

  it('prosi o mikrofon z wymuszonym echoCancellation', async () => {
    await joinChat();

    const call = (navigator.mediaDevices.getUserMedia as any).mock.calls[0][0];
    expect(call.audio.echoCancellation).toBe(true);
    expect(call.audio.channelCount).toBe(1);
  });

  it('rozglasza voice-join', async () => {
    await joinChat();
    expect(sent.some((m) => m.event === 'voice-join')).toBe(true);
  });
});

describe('leaveVoiceChat', () => {
  it('zatrzymuje mikrofon, rozglasza voice-leave i czysci stan', async () => {
    const { result } = await joinChat();

    await act(async () => {
      result.current.leaveVoiceChat();
    });

    expect(trackStop).toHaveBeenCalled();
    expect(sent.some((m) => m.event === 'voice-leave')).toBe(true);
    expect(result.current.isInVoiceChat).toBe(false);
    expect(result.current.participants).toEqual([]);
    expect(result.current.isSpeaking).toBe(false);
  });
});

describe('offer -> answer', () => {
  it('na voice-offer tworzy polaczenie i odsyla voice-answer', async () => {
    await joinChat();

    const offerHandler = handlers.get('voice-offer');
    expect(offerHandler).toBeDefined();

    await act(async () => {
      await offerHandler!(offerFromPeer(1));
    });

    await waitFor(() => {
      expect(sent.some((m) => m.event === 'voice-answer')).toBe(true);
    });

    const pc = createdPeerConnections[0];
    expect(pc.setRemoteDescription).toHaveBeenCalled();
    expect(pc.createAnswer).toHaveBeenCalled();
    expect(pc.setLocalDescription).toHaveBeenCalled();

    const answer = sent.find((m) => m.event === 'voice-answer')!;
    expect(answer.payload.toUserId).toBe(2);
    expect(answer.payload.fromUserId).toBe(1);
  });

  it('ignoruje offer zaadresowany do kogos innego', async () => {
    await joinChat();

    await act(async () => {
      await handlers.get('voice-offer')!(offerFromPeer(999));
    });

    expect(sent.some((m) => m.event === 'voice-answer')).toBe(false);
  });
});

describe('rozlaczenie peera', () => {
  it('voice-leave od peera zamyka jego polaczenie', async () => {
    await joinChat();

    await act(async () => {
      await handlers.get('voice-offer')!(offerFromPeer(1));
    });
    await waitFor(() => expect(createdPeerConnections.length).toBeGreaterThan(0));
    const pc = createdPeerConnections[0];

    await act(async () => {
      handlers.get('voice-leave')!({ payload: { type: 'voice-leave', userId: 2 } });
    });

    expect(pc.close).toHaveBeenCalled();
  });

  it('ignoruje wlasne voice-leave', async () => {
    await joinChat();

    await act(async () => {
      await handlers.get('voice-offer')!(offerFromPeer(1));
    });
    await waitFor(() => expect(createdPeerConnections.length).toBeGreaterThan(0));
    const pc = createdPeerConnections[0];

    await act(async () => {
      handlers.get('voice-leave')!({ payload: { type: 'voice-leave', userId: 1 } });
    });

    expect(pc.close).not.toHaveBeenCalled();
  });
});
