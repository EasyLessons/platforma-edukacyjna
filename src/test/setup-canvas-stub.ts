/**
 * jsdom nie implementuje Canvas 2D (`getContext` zwraca null). Excalidraw 0.18
 * na poziomie modułu robi `"filter" in canvas.getContext("2d")`, więc importy
 * `@excalidraw/excalidraw` w testach (prototyp whiteboard-excalidraw, scripts/)
 * wywalały się przy ładowaniu. Stub zwraca minimalny obiekt tylko wtedy, gdy
 * prawdziwy kontekst jest niedostępny.
 */

if (typeof HTMLCanvasElement !== 'undefined') {
  // Nie wołamy oryginału: jsdom i tak zwraca null, a przy okazji loguje
  // "Not implemented: HTMLCanvasElement.prototype.getContext" do konsoli.
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: unknown[]) {
    if (args[0] === '2d') {
      return {
        filter: '',
        canvas: this,
        measureText: () => ({ width: 0 }),
        save() {},
        restore() {},
        scale() {},
        translate() {},
        clearRect() {},
        fillRect() {},
        beginPath() {},
        closePath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        fill() {},
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        setLineDash() {},
      } as unknown as RenderingContext;
    }
    return null;
  } as typeof HTMLCanvasElement.prototype.getContext;
}

// Excalidraw rejestruje fonty przez `new FontFace(...)` i `document.fonts` przy
// tworzeniu elementów tekstowych (getLineHeight) - jsdom nie ma CSS Font Loading API.
if (typeof globalThis.FontFace === 'undefined') {
  class FontFaceStub {
    family: string;
    status = 'loaded';
    constructor(family: string) {
      this.family = family;
    }
    load() {
      return Promise.resolve(this);
    }
  }
  (globalThis as unknown as { FontFace: unknown }).FontFace = FontFaceStub;
}
if (typeof document !== 'undefined' && !('fonts' in document)) {
  Object.defineProperty(document, 'fonts', {
    value: {
      add() {},
      delete() {},
      has: () => false,
      check: () => true,
      load: () => Promise.resolve([]),
      forEach() {},
      ready: Promise.resolve(),
      addEventListener() {},
      removeEventListener() {},
    },
  });
}
