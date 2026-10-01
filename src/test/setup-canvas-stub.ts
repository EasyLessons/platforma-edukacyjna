/**
 * jsdom nie implementuje Canvas 2D (`getContext` zwraca null). Excalidraw 0.18
 * na poziomie modułu robi `"filter" in canvas.getContext("2d")`, więc importy
 * `@excalidraw/excalidraw` w testach (features/board-engine) wywalały się przy
 * ładowaniu, a montowanie komponentu - przy pierwszym rysowaniu sceny.
 */

if (typeof HTMLCanvasElement !== 'undefined') {
  // Kontekst 2D jako Proxy: znane pola z wartościami, każda inna metoda (setTransform,
  // drawImage, arc...) to no-op. Montowanie <Excalidraw> rysuje scenę na kilku canvasach
  // i woła dziesiątki metod - wypisywanie ich ręcznie byłoby kruche przy bumpie wersji.
  const createContext2d = (canvas: HTMLCanvasElement) => {
    const known: Record<string, unknown> = {
      filter: '',
      canvas,
      measureText: () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      createLinearGradient: () => ({ addColorStop() {} }),
      createPattern: () => null,
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      getLineDash: () => [],
    };
    return new Proxy(known, {
      get: (target, prop) => (prop in target ? target[prop as string] : () => undefined),
      set: (target, prop, value) => {
        target[prop as string] = value;
        return true;
      },
      has: () => true,
    }) as unknown as RenderingContext;
  };

  // Nie wołamy oryginału: jsdom i tak zwraca null, a przy okazji loguje
  // "Not implemented: HTMLCanvasElement.prototype.getContext" do konsoli.
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: unknown[]) {
    return args[0] === '2d' ? createContext2d(this) : null;
  } as typeof HTMLCanvasElement.prototype.getContext;
}

// canvas-roundrect-polyfill (zależność Excalidraw) przy imporcie sięga po Path2D.
if (typeof globalThis.Path2D === 'undefined') {
  class Path2DStub {
    addPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    rect() {}
    roundRect() {}
  }
  (globalThis as unknown as { Path2D: unknown }).Path2D = Path2DStub;
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
