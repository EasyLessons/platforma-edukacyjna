/**
 * Ustawienia voice chatu w localStorage (klucz `voiceChatSettings`), scalone z domyslnymi.
 */
import { DEFAULT_SETTINGS } from './constants';
import type { VoiceSettings } from './types';

const STORAGE_KEY = 'voiceChatSettings';

export function loadVoiceSettings(): VoiceSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveVoiceSettings(settings: VoiceSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
