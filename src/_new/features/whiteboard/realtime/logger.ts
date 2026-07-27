/**
 * Malutki logger, żeby każdy z rozbitych plików (usePresence, useCursors, itd.)
 * nie musiał sam sobie definiować "loguj tylko w trybie dev" — DRY (Don't Repeat
 * Yourself: jak coś powtarza się w 2+ miejscach, wyciągamy do jednej funkcji,
 * żeby zmiana zachowania (np. wyłączenie logów) działa się w jednym miejscu).
 */

const DEBUG = process.env.NODE_ENV === 'development';

export const log = DEBUG ? console.log.bind(console) : () => {};
export const logWarn = DEBUG ? console.warn.bind(console) : () => {};
export const logDebug = DEBUG ? console.debug.bind(console) : () => {};
