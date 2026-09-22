/**
 * Modal pomocy narzedzia Function: opis, formularz do wyprobowania wzoru,
 * lista operatorow/funkcji/stalych i wskazowki.
 *
 * Wyodrebnione z `toolbar/function-tool.tsx` - czysta prezentacja, stan
 * (wyrazenie, zakresy, kolor, grubosc) dostaje z rodzica przez propsy.
 */

'use client';

interface FunctionHelpModalProps {
  expression: string;
  error: string | null;
  xRange: number;
  yRange: number;
  color: string;
  lineWidth: number;
  onExpressionChange: (expression: string) => void;
  onXRangeChange: (range: number) => void;
  onYRangeChange: (range: number) => void;
  onColorChange: (color: string) => void;
  onLineWidthChange: (width: number) => void;
  onGenerate: () => void;
  onClose: () => void;
}

const OPERATORS: [string, string][] = [
  ['+', 'Dodawanie'],
  ['-', 'Odejmowanie'],
  ['*', 'Mnożenie'],
  ['/', 'Dzielenie'],
  ['^', 'Potęgowanie'],
  ['%', 'Reszta z dzielenia'],
];

const MATH_FUNCTIONS: { code: string; label: string; tone: string }[] = [
  { code: 'sqrt(x)', label: 'Pierwiastek kwadratowy', tone: 'blue' },
  { code: 'cbrt(x)', label: 'Pierwiastek sześcienny', tone: 'blue' },
  { code: 'sin(x)', label: 'Sinus', tone: 'green' },
  { code: 'cos(x)', label: 'Cosinus', tone: 'green' },
  { code: 'tan(x)', label: 'Tangens', tone: 'green' },
  { code: 'asin(x)', label: 'Arcus sinus', tone: 'green' },
  { code: 'log(x)', label: 'Logarytm naturalny (ln)', tone: 'purple' },
  { code: 'log10(x)', label: 'Logarytm dziesiętny', tone: 'purple' },
  { code: 'abs(x)', label: 'Wartość bezwzględna', tone: 'orange' },
  { code: 'exp(x)', label: 'e^x', tone: 'orange' },
  { code: 'ceil(x)', label: 'Zaokrąglenie w górę', tone: 'orange' },
  { code: 'floor(x)', label: 'Zaokrąglenie w dół', tone: 'orange' },
];

const EXAMPLES: { code: string; label: string; tone: string }[] = [
  { code: 'sin(x)', label: '- fala sinusoidalna', tone: 'blue' },
  { code: 'x^2', label: '- parabola', tone: 'green' },
  { code: 'sqrt(x)', label: '- pierwiastek kwadratowy', tone: 'purple' },
  { code: '2*sin(x) + cos(x)', label: '- kombinacja funkcji trygonometrycznych', tone: 'orange' },
  { code: '1/x', label: '- hiperbola', tone: 'red' },
  { code: 'abs(x)', label: '- wartość bezwzględna (kształt V)', tone: 'pink' },
  { code: 'log(x)', label: '- logarytm naturalny', tone: 'indigo' },
];

// Pelne nazwy klas (Tailwind nie widzi klas skladanych dynamicznie)
const FUNCTION_TONES: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700' },
  green: { bg: 'bg-green-50', text: 'text-green-700' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700' },
};

const EXAMPLE_TONES: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-gradient-to-r from-blue-50 to-blue-100', text: 'text-blue-800' },
  green: { bg: 'bg-gradient-to-r from-green-50 to-green-100', text: 'text-green-800' },
  purple: { bg: 'bg-gradient-to-r from-purple-50 to-purple-100', text: 'text-purple-800' },
  orange: { bg: 'bg-gradient-to-r from-orange-50 to-orange-100', text: 'text-orange-800' },
  red: { bg: 'bg-gradient-to-r from-red-50 to-red-100', text: 'text-red-800' },
  pink: { bg: 'bg-gradient-to-r from-pink-50 to-pink-100', text: 'text-pink-800' },
  indigo: { bg: 'bg-gradient-to-r from-indigo-50 to-indigo-100', text: 'text-indigo-800' },
};

const TIPS = [
  <>
    Możesz łączyć funkcje:{' '}
    <code className="bg-white bg-opacity-20 px-2 py-1 rounded text-white font-mono">sin(x^2)</code>
  </>,
  <>
    Automatyczne mnożenie działa:{' '}
    <code className="bg-white bg-opacity-20 px-2 py-1 rounded text-white font-mono">2x</code> ={' '}
    <code className="bg-white bg-opacity-20 px-2 py-1 rounded text-white font-mono">2*x</code>
  </>,
  'Użyj suwaków do dostosowania zakresu widocznego wykresu',
  'Live preview pokazuje jak będzie wyglądał wykres przed dodaniem',
  'Scroll + Ctrl - zoom in/out, Scroll - przesuwanie w pionie',
];

export function FunctionHelpModal({
  expression,
  error,
  xRange,
  yRange,
  color,
  lineWidth,
  onExpressionChange,
  onXRangeChange,
  onYRangeChange,
  onColorChange,
  onLineWidthChange,
  onGenerate,
  onClose,
}: FunctionHelpModalProps) {
  const submit = () => {
    onGenerate();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-5xl w-full mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-blue-500 text-white px-8 py-5 rounded-t-lg flex items-center justify-between shadow-lg">
          <h2 className="text-2xl font-bold">📐 Narzędzie Function - Przewodnik</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors flex items-center justify-center font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          {/* Opis */}
          <div>
            <h3 className="text-2xl font-semibold text-black mb-3">Co to narzędzie robi?</h3>
            <p className="text-black text-base leading-relaxed">
              Narzędzie <strong>Function</strong> pozwala rysować wykresy funkcji matematycznych na
              tablicy. Wpisz wyrażenie matematyczne (np.{' '}
              <code className="bg-gray-100 px-2 py-0.5 rounded text-black">sin(x)</code>), dostosuj
              zakres i kolory, a funkcja zostanie narysowana na wykresie kartezjańskim.
            </p>
          </div>

          {/* Formularz do testowania */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
            <h3 className="text-2xl font-semibold text-black mb-4">🧪 Wypróbuj funkcję</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-black mb-2">
                  Wyrażenie matematyczne:
                </label>
                <input
                  type="text"
                  value={expression}
                  onChange={(e) => onExpressionChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && expression.trim()) {
                      submit();
                    }
                  }}
                  placeholder="np. sin(x), x^2, sqrt(x)"
                  className="w-full px-4 py-3 text-base text-black border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
                {error && <p className="text-red-600 text-sm mt-2 font-medium">⚠️ {error}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-black mb-2">
                    Zakres X: ±{xRange}
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={xRange}
                    onChange={(e) => onXRangeChange(Number(e.target.value))}
                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-black mb-2">
                    Zakres Y: ±{yRange}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={yRange}
                    onChange={(e) => onYRangeChange(Number(e.target.value))}
                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold text-black">Kolor:</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => onColorChange(e.target.value)}
                    className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer hover:border-blue-400 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <label className="text-sm font-semibold text-black">Grubość:</label>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={lineWidth}
                    onChange={(e) => onLineWidthChange(Number(e.target.value))}
                    className="flex-1 h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-sm text-black font-bold w-10 text-right">
                    {lineWidth}px
                  </span>
                </div>
              </div>

              <button
                onClick={submit}
                disabled={!expression.trim()}
                className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base font-semibold"
              >
                ➕ Dodaj funkcję do tablicy
              </button>
            </div>
          </div>

          {/* Operatory */}
          <div>
            <h3 className="text-2xl font-semibold text-black mb-3">🔢 Operatory</h3>
            <div className="grid grid-cols-2 gap-3">
              {OPERATORS.map(([symbol, label]) => (
                <div key={symbol} className="bg-gray-50 p-4 rounded-lg">
                  <code className="font-mono font-bold text-blue-600 text-lg">{symbol}</code>
                  <span className="text-black ml-3 text-base">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Funkcje matematyczne */}
          <div>
            <h3 className="text-3xl font-semibold text-black mb-4">📊 Funkcje matematyczne</h3>
            <div className="grid grid-cols-2 gap-4">
              {MATH_FUNCTIONS.map(({ code, label, tone }) => (
                <div key={code} className={`${FUNCTION_TONES[tone].bg} p-4 rounded-lg`}>
                  <code className={`font-mono font-bold ${FUNCTION_TONES[tone].text} text-2xl`}>
                    {code}
                  </code>
                  <span className="text-black text-xl ml-3">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stałe */}
          <div>
            <h3 className="text-3xl font-semibold text-black mb-4">🔣 Stałe matematyczne</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-yellow-50 p-5 rounded-lg">
                <code className="font-mono font-bold text-yellow-700 text-2xl">pi</code>
                <span className="text-black ml-4 text-xl">π ≈ 3.14159...</span>
              </div>
              <div className="bg-yellow-50 p-5 rounded-lg">
                <code className="font-mono font-bold text-yellow-700 text-2xl">e</code>
                <span className="text-black ml-4 text-xl">e ≈ 2.71828...</span>
              </div>
            </div>
          </div>

          {/* Przykłady */}
          <div>
            <h3 className="text-3xl font-semibold text-black mb-4">✨ Przykłady wyrażeń</h3>
            <div className="space-y-4">
              {EXAMPLES.map(({ code, label, tone }) => (
                <div key={code} className={`${EXAMPLE_TONES[tone].bg} p-5 rounded-lg`}>
                  <code className={`font-mono font-bold ${EXAMPLE_TONES[tone].text} text-2xl`}>
                    {code}
                  </code>
                  <span className="text-black ml-4 text-xl">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Wskazówki - zielone tło matematyczne */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-8 rounded-xl shadow-lg">
            <h3 className="text-3xl font-semibold mb-4 flex items-center gap-2">
              <span>💡</span>
              <span>Wskazówki</span>
            </h3>
            <ul className="space-y-3 text-xl">
              {TIPS.map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-white font-bold">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
