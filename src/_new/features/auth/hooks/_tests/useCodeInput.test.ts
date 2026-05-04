import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCodeInput } from '../useCodeInput';

describe('useCodeInput', () => {
  let onVerify: Mock<(code: string) => Promise<void>>;
  let onResend: Mock<() => Promise<void>>;

  beforeEach(() => {
    onVerify = vi.fn<(code: string) => Promise<void>>().mockResolvedValue(undefined);
    onResend = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  });

  const setup = () => renderHook(() => useCodeInput({ onVerify, onResend }));

  const pasteEvent = (text: string): React.ClipboardEvent =>
    ({
      preventDefault: vi.fn(),
      clipboardData: { getData: vi.fn().mockReturnValue(text) },
    }) as unknown as React.ClipboardEvent;

  it('inicjalizuje pusty 6-cyfrowy kod', () => {
    const { result } = setup();
    expect(result.current.code).toEqual(['', '', '', '', '', '']);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('');
    expect(result.current.resendCooldown).toBe(0);
  });

  describe('handleChange', () => {
    it('akceptuje cyfrę i aktualizuje pole', async () => {
      const { result } = setup();
      await act(async () => {
        result.current.handleChange(0, '5');
      });
      expect(result.current.code[0]).toBe('5');
    });

    it('odrzuca nie-cyfry', async () => {
      const { result } = setup();
      await act(async () => {
        result.current.handleChange(0, 'a');
      });
      expect(result.current.code[0]).toBe('');
    });

    it('czyści błąd po wpisaniu cyfry', async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.handleVerify();
      });
      expect(result.current.error).not.toBe('');
      await act(async () => {
        result.current.handleChange(0, '1');
      });
      expect(result.current.error).toBe('');
    });

    it('auto-weryfikuje po wypełnieniu ostatniego pola', async () => {
      const { result } = setup();
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          result.current.handleChange(i, String(i + 1));
        });
      }
      await act(async () => {
        result.current.handleChange(5, '6');
      });
      expect(onVerify).toHaveBeenCalledWith('123456');
    });
  });

  describe('handleKeyDown', () => {
    it('Backspace na pierwszym pustym polu nie zmienia kodu', async () => {
      const { result } = setup();
      await act(async () => {
        result.current.handleKeyDown(0, { key: 'Backspace' } as React.KeyboardEvent);
      });
      expect(result.current.code).toEqual(['', '', '', '', '', '']);
    });
  });

  describe('handlePaste', () => {
    it('wypełnia wszystkie pola przy 6 cyfrach', async () => {
      const { result } = setup();
      await act(async () => {
        result.current.handlePaste(pasteEvent('123456'));
      });
      expect(result.current.code).toEqual(['1', '2', '3', '4', '5', '6']);
    });

    it('auto-weryfikuje przy wklejeniu kompletnego kodu', async () => {
      const { result } = setup();
      await act(async () => {
        result.current.handlePaste(pasteEvent('123456'));
      });
      expect(onVerify).toHaveBeenCalledWith('123456');
    });

    it('odrzuca wklejenie zawierające litery', async () => {
      const { result } = setup();
      await act(async () => {
        result.current.handlePaste(pasteEvent('12ab56'));
      });
      expect(result.current.code).toEqual(['', '', '', '', '', '']);
    });
  });

  describe('handleVerify', () => {
    it('ustawia błąd gdy kod niekompletny', async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.handleVerify();
      });
      expect(result.current.error).toBe('Wprowadź pełny 6-cyfrowy kod');
      expect(onVerify).not.toHaveBeenCalled();
    });

    it('wywołuje onVerify z kompletnym kodem', async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.handleVerify('654321');
      });
      expect(onVerify).toHaveBeenCalledWith('654321');
    });

    it('ustawia błąd i czyści kod gdy onVerify rzuca', async () => {
      onVerify = vi
        .fn<(code: string) => Promise<void>>()
        .mockRejectedValue(new Error('Nieprawidłowy kod'));
      const { result } = setup();
      await act(async () => {
        await result.current.handleVerify('123456');
      });
      expect(result.current.error).toBe('Nieprawidłowy kod');
      expect(result.current.code).toEqual(['', '', '', '', '', '']);
    });
  });

  describe('handleResend', () => {
    it('wywołuje onResend i pokazuje komunikat sukcesu', async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.handleResend();
      });
      expect(onResend).toHaveBeenCalled();
      expect(result.current.resendMessage).toBe('Nowy kod wysłany!');
    });

    it('ustawia cooldown po wysłaniu', async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.handleResend();
      });
      expect(result.current.resendCooldown).toBe(60);
    });

    it('nie wywołuje onResend podczas aktywnego cooldown', async () => {
      const { result } = setup();
      await act(async () => {
        await result.current.handleResend();
      });
      onResend.mockClear();
      await act(async () => {
        await result.current.handleResend();
      });
      expect(onResend).not.toHaveBeenCalled();
    });

    it('ustawia błąd gdy onResend rzuca', async () => {
      onResend = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('Błąd serwera'));
      const { result } = setup();
      await act(async () => {
        await result.current.handleResend();
      });
      expect(result.current.error).toBe('Błąd serwera');
    });
  });
});
