/**
 * Wywolanie Gemini z fallbackiem: glowny model -> model "lite" przy limicie
 * -> odpowiedz awaryjna (canned), zeby frontend nie dostawal 500.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CHAT_CONFIG, getGeminiApiKey } from './config';

export type TutorAnswer =
  { kind: 'model'; text: string; model: string } | { kind: 'fallback'; text: string };

export const FALLBACK_ANSWER =
  'Przepraszam, usługa AI jest tymczasowo niedostępna. Mogę zaoferować krótką podpowiedź: spróbuj podać więcej szczegółów zadania lub podziel pytanie na kroki. Jeśli chcesz, zapiszę Twoje zapytanie i spróbujemy ponownie później.';

/** Czy blad Gemini to przekroczony limit (wtedy warto probowac model lite). */
export function isQuotaError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? '';
  return (
    message.includes('quota') ||
    message.includes('limit') ||
    message.includes('429') ||
    message.includes('Resource has been exhausted')
  );
}

async function generateWith(genAI: GoogleGenerativeAI, modelName: string, prompt: string) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: CHAT_CONFIG.GEMINI_TEMPERATURE,
      maxOutputTokens: CHAT_CONFIG.GEMINI_MAX_TOKENS,
    },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Glowny model; przy bledzie limitu - fallback; gdy i on padnie - odpowiedz
 * awaryjna. Bledy inne niz limit (np. zly klucz) leca dalej do route.ts.
 */
export async function askTutor(prompt: string): Promise<TutorAnswer> {
  const genAI = new GoogleGenerativeAI(getGeminiApiKey());

  try {
    const text = await generateWith(genAI, CHAT_CONFIG.GEMINI_MODEL, prompt);
    return { kind: 'model', text, model: CHAT_CONFIG.GEMINI_MODEL };
  } catch (primaryError) {
    if (!isQuotaError(primaryError) || !CHAT_CONFIG.GEMINI_MODEL_FALLBACK) {
      throw primaryError;
    }
    console.warn(
      `⚠️ Primary model (${CHAT_CONFIG.GEMINI_MODEL}) quota exceeded, trying fallback: ${CHAT_CONFIG.GEMINI_MODEL_FALLBACK}`
    );
    try {
      const text = await generateWith(genAI, CHAT_CONFIG.GEMINI_MODEL_FALLBACK, prompt);
      return { kind: 'model', text, model: CHAT_CONFIG.GEMINI_MODEL_FALLBACK };
    } catch (fallbackError) {
      console.error('❌ Fallback model also failed:', fallbackError);
      return { kind: 'fallback', text: FALLBACK_ANSWER };
    }
  }
}
