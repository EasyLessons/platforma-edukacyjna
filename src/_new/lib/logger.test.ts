import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, isVerboseLoggingEnabled } from './logger';

describe('createLogger', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('w testach (NODE_ENV=test) debug/info sa wyciszone', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NEXT_PUBLIC_DEBUG_LOGS', '');
    const log = createLogger('lib/test');

    log.debug('nie powinno wyjsc');
    log.info('nie powinno wyjsc');

    expect(isVerboseLoggingEnabled()).toBe(false);
    expect(debugSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('w produkcji debug/info sa wyciszone', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_DEBUG_LOGS', '');
    const log = createLogger('lib/test');

    log.debug('x');
    log.info('y');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('NEXT_PUBLIC_DEBUG_LOGS=1 wlacza debug/info nawet w produkcji', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_DEBUG_LOGS', '1');
    const log = createLogger('lib/test');

    log.debug('a', 1);
    log.info('b', { c: 2 });

    expect(debugSpy).toHaveBeenCalledWith('[lib/test]', 'a', 1);
    expect(logSpy).toHaveBeenCalledWith('[lib/test]', 'b', { c: 2 });
  });

  it('w developmencie debug/info wychodza z prefiksem [scope]', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_DEBUG_LOGS', '');
    const log = createLogger('voice-chat/x');

    log.info('start');

    expect(isVerboseLoggingEnabled()).toBe(true);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('[voice-chat/x]', 'start');
  });

  it('warn/error ida zawsze, z prefiksem i wszystkimi argumentami', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_DEBUG_LOGS', '');
    const log = createLogger('lib/test');
    const err = new Error('boom');

    log.warn('uwaga', 42);
    log.error('blad', err);

    expect(warnSpy).toHaveBeenCalledWith('[lib/test]', 'uwaga', 42);
    expect(errorSpy).toHaveBeenCalledWith('[lib/test]', 'blad', err);
  });

  it('poziom jest sprawdzany przy kazdym wywolaniu, nie przy tworzeniu loggera', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('NEXT_PUBLIC_DEBUG_LOGS', '');
    const log = createLogger('lib/test');
    log.info('cicho');
    expect(logSpy).not.toHaveBeenCalled();

    vi.stubEnv('NEXT_PUBLIC_DEBUG_LOGS', '1');
    log.info('glosno');
    expect(logSpy).toHaveBeenCalledWith('[lib/test]', 'glosno');
  });
});
