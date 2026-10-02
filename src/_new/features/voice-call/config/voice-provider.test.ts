import { describe, it, expect } from 'vitest';
import { resolveVoiceProvider } from './voice-provider';

describe('resolveVoiceProvider', () => {
  it('bez zmiennej albo z nieznaną wartością -> Daily (domyślnie)', () => {
    expect(resolveVoiceProvider(undefined)).toBe('daily');
    expect(resolveVoiceProvider('')).toBe('daily');
    expect(resolveVoiceProvider('daily')).toBe('daily');
    expect(resolveVoiceProvider('xirsys')).toBe('daily');
  });

  it('"legacy" (bez względu na wielkość liter i spacje) -> stary czat głosowy', () => {
    expect(resolveVoiceProvider('legacy')).toBe('legacy');
    expect(resolveVoiceProvider(' Legacy ')).toBe('legacy');
  });
});
