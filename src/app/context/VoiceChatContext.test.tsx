import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { VoiceChatProvider, useVoiceChat, useVoiceChatRequired } from './VoiceChatContext';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      send: vi.fn(),
      unsubscribe: vi.fn(),
    })),
  },
}));

vi.mock('@/_new/lib/auth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 1, username: 'testuser' } })),
}));

describe('VoiceChatContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <VoiceChatProvider boardId="test-board">{children}</VoiceChatProvider>
  );

  describe('Initial State', () => {
    it('provides default settings', () => {
      const { result } = renderHook(() => useVoiceChatRequired(), { wrapper });

      expect(result.current.settings).toEqual({
        microphoneVolume: 1,
        speakerVolume: 1,
        pushToTalk: false,
        pushToTalkKey: 'Space',
        noiseSupression: true,
        echoCancellation: true,
      });

      expect(result.current.isInVoiceChat).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.participants).toEqual([]);
      expect(result.current.isMuted).toBe(false);
      expect(result.current.isSpeaking).toBe(false);
    });

    it('loads settings from localStorage', () => {
      localStorage.setItem(
        'voiceChatSettings',
        JSON.stringify({ pushToTalk: true, speakerVolume: 0.5 })
      );

      const { result } = renderHook(() => useVoiceChatRequired(), { wrapper });

      expect(result.current.settings.pushToTalk).toBe(true);
      expect(result.current.settings.speakerVolume).toBe(0.5);
      expect(result.current.settings.microphoneVolume).toBe(1); // Default preserved
    });
  });

  describe('Actions', () => {
    it('updateSettings updates state and localStorage', () => {
      const { result } = renderHook(() => useVoiceChatRequired(), { wrapper });

      act(() => {
        result.current.updateSettings({ pushToTalk: true });
      });

      expect(result.current.settings.pushToTalk).toBe(true);

      const saved = JSON.parse(localStorage.getItem('voiceChatSettings') || '{}');
      expect(saved.pushToTalk).toBe(true);
    });

    it('useVoiceChatRequired throws outside provider', () => {
      // Suppress console.error for this expected error
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => renderHook(() => useVoiceChatRequired())).toThrow(
        'useVoiceChatRequired must be used within VoiceChatProvider'
      );
      consoleError.mockRestore();
    });

    it('useVoiceChat returns undefined outside provider', () => {
      const { result } = renderHook(() => useVoiceChat());
      expect(result.current).toBeUndefined();
    });
  });
});
