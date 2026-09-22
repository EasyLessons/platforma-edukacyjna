/**
 * Jedyny wrapper nad `console` w projekcie. Zamiast `console.log` (eslint
 * `no-console` = warning) piszemy:
 *
 *   const log = createLogger('voice-chat/useVoiceSession');
 *   log.info('Kanal gotowy');            // -> console.log('[voice-chat/useVoiceSession]', 'Kanal gotowy')
 *
 * - `debug`/`info` wychodza tylko w developmencie. W produkcji (`NODE_ENV=production`)
 *   i w testach (`NODE_ENV=test`) sa wyciszone, chyba ze `NEXT_PUBLIC_DEBUG_LOGS=1`
 *   (w testach wyciszenie usuwa flake vitesta "Closing rpc while onUserConsoleLog
 *   was pending" w voice-chat).
 * - `warn`/`error` ida ZAWSZE przez `console.warn`/`console.error` z prefiksem `[scope]`.
 * - Dziala tak samo w przegladarce i w Node (Route Handlery, `src/_new/server`).
 * - Nie loguj tokenow, e-maili ani tresci tablicy - logi trafiaja do konsoli usera.
 *
 * Swiadomie bez zewnetrznej zaleznosci (pino/loglevel/debug): kilkanascie linii
 * nad `console` nie uzasadnia nowej paczki w bundlu klienta.
 */

/* eslint-disable no-console */

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Czy `debug`/`info` maja cos wypisywac. Liczone przy kazdym wywolaniu (nie przy
 * imporcie), zeby testy mogly przelaczac env przez `vi.stubEnv`. Zmienne czytane
 * jako pelne literaly `process.env.X` - Next.js podmienia je w bundlu klienta
 * tylko w tej formie.
 */
export function isVerboseLoggingEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DEBUG_LOGS === '1') return true;
  const env = process.env.NODE_ENV;
  return env !== 'production' && env !== 'test';
}

export function createLogger(scope: string): Logger {
  const prefix = `[${scope}]`;
  return {
    debug: (...args) => {
      if (isVerboseLoggingEnabled()) console.debug(prefix, ...args);
    },
    info: (...args) => {
      if (isVerboseLoggingEnabled()) console.log(prefix, ...args);
    },
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}
