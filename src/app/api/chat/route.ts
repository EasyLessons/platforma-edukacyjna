/**
 * ============================================================================
 * PLIK: src/app/api/chat/route.ts
 * ============================================================================
 * 
 * 🤖 MATH TUTOR AI CHATBOT API
 * 
 * Chatbot matematyczny wykorzystujący Gemini API do:
 * ✅ Pomocy z zadaniami matematycznymi
 * ✅ Wyjaśniania koncepcji
 * ✅ Generowania podpowiedzi
 * ✅ Rozwiązywania problemów krok po kroku
 * 
 * ============================================================================
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

// ==========================================
// 🎛️ KONFIGURACJA
// ==========================================
const CONFIG = {
  // Rate limiting
  RATE_LIMIT_REQUESTS: 20,
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minuta
  BLOCK_DURATION: 2 * 60 * 1000, // 2 minuty blokady
  
  // Cache
  CACHE_TTL: 30 * 60 * 1000, // 30 minut
  
  // Limity wiadomości
  MAX_MESSAGE_LENGTH: 1000,
  MIN_MESSAGE_LENGTH: 1,
  
  // Gemini
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_MODEL: "gemini-2.5-flash",
  GEMINI_MODEL_FALLBACK: "gemini-2.5-flash-lite", // Fallback gdy główny model przekroczy limit
  GEMINI_TEMPERATURE: 0.7,
  GEMINI_MAX_TOKENS: 12500,
  
  // Debug
  DEBUG_MODE: process.env.NODE_ENV === 'development'
};

// ==========================================
// 🛡️ RATE LIMITING
// ==========================================
interface RequestLog {
  timestamps: number[];
  blockUntil?: number;
}

const requestLog = new Map<string, RequestLog>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userLog = requestLog.get(ip) || { timestamps: [] };
  
  // Sprawdź czy zablokowany
  if (userLog.blockUntil && now < userLog.blockUntil) {
    return false;
  }
  
  // Wyczyść blokadę
  if (userLog.blockUntil && now >= userLog.blockUntil) {
    userLog.blockUntil = undefined;
  }
  
  // Filtruj stare requesty
  userLog.timestamps = userLog.timestamps.filter(
    time => now - time < CONFIG.RATE_LIMIT_WINDOW
  );
  
  // Sprawdź limit
  if (userLog.timestamps.length >= CONFIG.RATE_LIMIT_REQUESTS) {
    userLog.blockUntil = now + CONFIG.BLOCK_DURATION;
    requestLog.set(ip, userLog);
    console.warn(`⚠️ Rate limit exceeded for IP: ${ip.substring(0, 10)}...`);
    return false;
  }
  
  userLog.timestamps.push(now);
  requestLog.set(ip, userLog);
  return true;
}

// Cleanup co 5 minut
setInterval(() => {
  const now = Date.now();
  for (const [ip, log] of requestLog.entries()) {
    if (
      log.timestamps.length === 0 && 
      (!log.blockUntil || now >= log.blockUntil)
    ) {
      requestLog.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// ==========================================
// 🧠 CACHE
// ==========================================
interface CachedResponse {
  response: string;
  timestamp: number;
}

const responseCache = new Map<string, CachedResponse>();

function getCachedResponse(message: string): string | null {
  const key = message.toLowerCase().trim();
  const cached = responseCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_TTL) {
    return cached.response;
  }
  
  if (cached) {
    responseCache.delete(key);
  }
  
  return null;
}

function setCachedResponse(message: string, response: string): void {
  const key = message.toLowerCase().trim();
  responseCache.set(key, {
    response,
    timestamp: Date.now()
  });
}

// Cleanup cache co 15 minut
setInterval(() => {
  const now = Date.now();
  for (const [key, cached] of responseCache.entries()) {
    if (now - cached.timestamp > CONFIG.CACHE_TTL) {
      responseCache.delete(key);
    }
  }
}, 15 * 60 * 1000);

// ==========================================
// 📋 MATH TUTOR PROMPT
// ==========================================
function generateMathTutorPrompt(): string {
  return `Jesteś MATH TUTOR - przyjaznym asystentem matematycznym dla uczniów i studentów.

🎯 TWOJA MISJA:
Pomagasz w nauce matematyki. Jesteś cierpliwy, wyrozumiały i zawsze tłumaczysz rzeczy krok po kroku.

📚 TWOJE SPECJALIZACJE:
- Algebra (równania, nierówności, funkcje)
- Geometria (planimetria, stereometria, trygonometria)
- Analiza matematyczna (granice, pochodne, całki)
- Probabilistyka i statystyka
- Ciągi i szeregi
- Logarytmy i potęgi
- Liczby zespolone

⚙️ ZASADY ODPOWIEDZI:
1. **ZAWSZE** odpowiadaj po polsku
2. Używaj notacji matematycznej gdy to pomocne (np. x², √, π)
3. Rozwiązuj zadania KROK PO KROKU
4. Wyjaśniaj DLACZEGO stosujemy daną metodę
5. Dawaj PODPOWIEDZI zamiast od razu pełnych rozwiązań (jeśli user pyta o podpowiedź)
6. Jeśli user pokazuje swoje rozwiązanie - sprawdź je i wskaż błędy
7. Używaj prostego języka - dostosuj poziom do pytania
8. Podawaj wzory które mogą się przydać
9. Przy geometrii - opisz jak narysować/zwizualizować problem
10. Bądź pozytywny i motywujący! 🌟

📝 FORMATOWANIE:
- Używaj pogrubienia **tekst** dla ważnych pojęć
- Używaj list numerowanych dla kroków rozwiązania
- Wzory matematyczne pisz czytelnie
- Krótkie odpowiedzi gdy pytanie proste
- Szczegółowe wyjaśnienia gdy user prosi o pomoc

🔢 PRZYKŁADY ODPOWIEDZI:

User: "jak rozwiązać równanie x² - 5x + 6 = 0"
Ty: "To równanie kwadratowe! Rozwiążmy je metodą **rozkładu na czynniki**:

1. Szukamy dwóch liczb których iloczyn = 6, a suma = -5
2. Te liczby to **-2** i **-3** (bo -2 × -3 = 6 i -2 + -3 = -5)
3. Rozkładamy: x² - 5x + 6 = (x - 2)(x - 3) = 0
4. Stąd: **x = 2** lub **x = 3**

✅ Możesz też użyć wzoru: x = (-b ± √Δ) / 2a, gdzie Δ = b² - 4ac"

User: "podpowiedź do zadania z pochodną sin(x²)"
Ty: "Podpowiedź! 💡

To **złożenie funkcji** - potrzebujesz reguły łańcuchowej:
- Funkcja zewnętrzna: sin(u)
- Funkcja wewnętrzna: u = x²

Wzór: (f(g(x)))' = f'(g(x)) · g'(x)

Spróbuj sam! Co to jest (sin(u))' i (x²)'? 🤔"

🚫 NIE RÓB:
- Nie pisz kodu (chyba że user wyraźnie pyta)
- Nie dawaj odpowiedzi bez wyjaśnienia
- Nie używaj zbyt skomplikowanego języka
- Nie bądź zniecierpliwiony

Jesteś najlepszym korepetytorem matematyki! 🎓✨`;
}

// ==========================================
// 🚀 GŁÓWNY ENDPOINT API
// ==========================================
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 🔒 Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
               req.headers.get('x-real-ip') || 
               'unknown';
    
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { 
          response: "⏳ Za dużo pytań! Poczekaj chwilę i spróbuj ponownie.",
          error: "rate_limit"
        },
        { status: 429 }
      );
    }
    
    // 📥 Parsowanie body
    const body = await req.json();
    const { message, context } = body;
    
    // ✅ Walidacja
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { response: "Proszę wpisz pytanie! 📝", error: "invalid_message" },
        { status: 400 }
      );
    }
    
    const trimmedMessage = message.trim();
    
    if (trimmedMessage.length < CONFIG.MIN_MESSAGE_LENGTH) {
      return NextResponse.json(
        { response: "Pytanie jest za krótkie! Napisz więcej 😊", error: "too_short" },
        { status: 400 }
      );
    }
    
    if (trimmedMessage.length > CONFIG.MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { response: "Pytanie jest za długie! Maksymalnie 1000 znaków.", error: "too_long" },
        { status: 400 }
      );
    }
    
    // 🔍 Sprawdź cache
    const cachedResponse = getCachedResponse(trimmedMessage);
    if (cachedResponse) {
      return NextResponse.json({
        response: cachedResponse,
        cached: true,
        responseTime: Date.now() - startTime
      });
    }
    
    // 🤖 Wywołaj Gemini API z fallback na lite model
    const genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);
    
    // Buduj prompt z kontekstem
    let fullPrompt = generateMathTutorPrompt();
    
    // Dodaj kontekst tablicy jeśli dostępny
    if (context) {
      fullPrompt += `\n\n📋 KONTEKST TABLICY UŻYTKOWNIKA:\n${context}`;
    }
    
    fullPrompt += `\n\n👤 PYTANIE UŻYTKOWNIKA:\n${trimmedMessage}`;
    
    // Próbuj główny model, potem fallback
    let responseText: string;
    let usedModel = CONFIG.GEMINI_MODEL;
    
    try {
      const model = genAI.getGenerativeModel({ 
        model: CONFIG.GEMINI_MODEL,
        generationConfig: {
          temperature: CONFIG.GEMINI_TEMPERATURE,
          maxOutputTokens: CONFIG.GEMINI_MAX_TOKENS,
        }
      });
      
      const result = await model.generateContent(fullPrompt);
      responseText = result.response.text();
      
    } catch (primaryError: any) {
      // Jeśli główny model przekroczył limit - spróbuj fallback
      const isQuotaError = primaryError.message?.includes('quota') || 
                          primaryError.message?.includes('limit') ||
                          primaryError.message?.includes('429') ||
                          primaryError.message?.includes('Resource has been exhausted');
      
      if (isQuotaError && CONFIG.GEMINI_MODEL_FALLBACK) {
        console.log(`⚠️ Primary model (${CONFIG.GEMINI_MODEL}) quota exceeded, trying fallback: ${CONFIG.GEMINI_MODEL_FALLBACK}`);
        
        try {
          const fallbackModel = genAI.getGenerativeModel({ 
            model: CONFIG.GEMINI_MODEL_FALLBACK,
            generationConfig: {
              temperature: CONFIG.GEMINI_TEMPERATURE,
              maxOutputTokens: CONFIG.GEMINI_MAX_TOKENS,
            }
          });
          
          const fallbackResult = await fallbackModel.generateContent(fullPrompt);
          responseText = fallbackResult.response.text();
          usedModel = CONFIG.GEMINI_MODEL_FALLBACK;
          
        } catch (fallbackError: any) {
          console.error('❌ Fallback model also failed:', fallbackError);
          throw fallbackError; // Re-throw to main error handler
        }
      } else {
        throw primaryError; // Re-throw non-quota errors
      }
    }
    
    // 💾 Zapisz do cache
    setCachedResponse(trimmedMessage, responseText);
    
    // 📤 Zwróć odpowiedź
    return NextResponse.json({
      response: responseText,
      cached: false,
      apiUsed: true,
      model: usedModel,
      responseTime: Date.now() - startTime
    });
    
  } catch (error: any) {
    console.error('❌ Chat API Error:', error);
    
    // Obsługa różnych błędów
    if (error.message?.includes('API_KEY')) {
      return NextResponse.json(
        { response: "Błąd konfiguracji API. Skontaktuj się z administratorem.", error: "api_key_error" },
        { status: 500 }
      );
    }
    
    if (error.message?.includes('quota') || error.message?.includes('limit')) {
      return NextResponse.json(
        { response: "Przekroczono limit API. Spróbuj ponownie za chwilę.", error: "quota_exceeded" },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { 
        response: "Ups, coś poszło nie tak! 😅 Spróbuj ponownie.",
        error: "internal_error"
      },
      { status: 500 }
    );
  }
}

// ==========================================
// 📊 GET - Status endpoint
// ==========================================
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Math Tutor AI",
    model: CONFIG.GEMINI_MODEL,
    fallbackModel: CONFIG.GEMINI_MODEL_FALLBACK,
    cacheSize: responseCache.size,
    activeUsers: requestLog.size
  });
}
