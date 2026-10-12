/**
 * Punkt wpięcia rozmowy w pasku online-users: przy `NEXT_PUBLIC_VOICE_PROVIDER` = daily
 * (domyślnie) stoi tam `CallButton` z features/voice-call, przy `legacy` - stary przycisk
 * "Czat głosowy" z niezmienioną obsługą.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const flags = vi.hoisted(() => ({ daily: true }));
const voiceChat = vi.hoisted(() => ({
  participants: [] as unknown[],
  isInVoiceChat: false,
  joinVoiceChat: vi.fn(async () => true),
  leaveVoiceChat: vi.fn(),
}));

vi.mock('@/_new/features/voice-call', () => ({
  get isDailyVoice() {
    return flags.daily;
  },
  CallButton: ({ compact }: { compact?: boolean }) => (
    <button data-testid="call-button" data-compact={String(!!compact)}>
      Rozmowa
    </button>
  ),
}));
vi.mock('@/_new/features/voice-chat', () => ({
  default: () => null,
  VoiceChatNotice: () => null,
  useVoiceChat: () => (flags.daily ? null : voiceChat),
}));
vi.mock('@/app/context/BoardRealtimeContext', () => ({
  useBoardRealtime: () => ({
    onlineUsers: [],
    isConnected: true,
    subscribeViewports: () => () => {},
  }),
}));
vi.mock('@/_new/lib/auth', () => ({ useAuth: () => ({ user: { id: 1, username: 'ala' } }) }));

import { OnlineUsers } from './online-users';

describe('OnlineUsers - przycisk rozmowy', () => {
  beforeEach(() => {
    flags.daily = true;
  });

  it('tryb daily: CallButton zamiast starego przycisku', () => {
    render(<OnlineUsers />);
    expect(screen.getByTestId('call-button')).toBeInTheDocument();
    expect(screen.queryByText('Czat głosowy')).not.toBeInTheDocument();
  });

  it('tryb legacy: stary przycisk "Czat głosowy" dołącza do starego czatu, bez CallButton', async () => {
    flags.daily = false;
    render(<OnlineUsers />);
    expect(screen.queryByTestId('call-button')).not.toBeInTheDocument();

    // Przy wąskim pasku przycisk jest samą ikoną - opis siedzi w dymku obok.
    const tooltip = screen.getAllByText('Czat głosowy')[0];
    const legacyButton = tooltip.closest('.group')?.querySelector('button');
    expect(legacyButton).toBeTruthy();
    fireEvent.click(legacyButton!);
    await waitFor(() => expect(voiceChat.joinVoiceChat).toHaveBeenCalledTimes(1));
  });
});
