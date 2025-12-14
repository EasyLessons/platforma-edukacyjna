/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/CalculatorTool.tsx
 * ============================================================================
 * 
 * Kalkulator matematyczny wbudowany w tablicę.
 * Obsługuje podstawowe operacje + funkcje matematyczne.
 * Teraz jest przeciągalnym obiektem zamiast modala.
 * ============================================================================
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ViewportTransform } from '../whiteboard/types';
import { zoomViewport, panViewportWithWheel, constrainViewport } from '../whiteboard/viewport';
import { X, Delete, Divide, Plus, Minus, Equal, Percent, GripHorizontal } from 'lucide-react';
import * as math from 'mathjs';

interface CalculatorToolProps {
  viewport: ViewportTransform;
  canvasWidth: number;
  canvasHeight: number;
  onViewportChange?: (viewport: ViewportTransform) => void;
  onClose?: () => void;
}

export function CalculatorTool({
  viewport,
  canvasWidth,
  canvasHeight,
  onViewportChange,
  onClose,
}: CalculatorToolProps) {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [isResult, setIsResult] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showScientific, setShowScientific] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // Pozycja kalkulatora (przeciągalne okno)
  const [position, setPosition] = useState({ x: canvasWidth - 340, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Obsługa przeciągania
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, Math.min(canvasWidth - 320, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(canvasHeight - 400, e.clientY - dragOffset.y)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, canvasWidth, canvasHeight]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumber(e.key);
      } else if (e.key === '.') {
        handleDecimal();
      } else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
        handleOperator(e.key);
      } else if (e.key === 'Enter' || e.key === '=') {
        handleEquals();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      } else if (e.key === '%') {
        handlePercent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [display, expression, isResult]);

  const handleNumber = (num: string) => {
    if (isResult) {
      setDisplay(num);
      setExpression(num);
      setIsResult(false);
    } else if (display === '0') {
      setDisplay(num);
      setExpression(expression.slice(0, -1) + num);
    } else {
      setDisplay(display + num);
      setExpression(expression + num);
    }
  };

  const handleOperator = (op: string) => {
    setIsResult(false);
    const displayOp = op === '*' ? '×' : op === '/' ? '÷' : op;
    setExpression(expression + ' ' + op + ' ');
    setDisplay(displayOp);
  };

  const handleDecimal = () => {
    if (isResult) {
      setDisplay('0.');
      setExpression('0.');
      setIsResult(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
      setExpression(expression + '.');
    }
  };

  const handleEquals = () => {
    try {
      // Używamy mathjs do bezpiecznej ewaluacji
      const result = math.evaluate(expression.replace(/×/g, '*').replace(/÷/g, '/'));
      const resultStr = typeof result === 'number' 
        ? Number.isInteger(result) ? result.toString() : result.toFixed(10).replace(/\.?0+$/, '')
        : result.toString();
      
      setHistory([...history, `${expression} = ${resultStr}`]);
      setDisplay(resultStr);
      setExpression(resultStr);
      setIsResult(true);
    } catch (error) {
      setDisplay('Błąd');
      setIsResult(true);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setExpression('');
    setIsResult(false);
  };

  const handleBackspace = () => {
    if (isResult) {
      handleClear();
    } else if (display.length > 1) {
      setDisplay(display.slice(0, -1));
      setExpression(expression.slice(0, -1));
    } else {
      setDisplay('0');
      setExpression(expression.slice(0, -1));
    }
  };

  const handlePercent = () => {
    try {
      const value = math.evaluate(display) / 100;
      setDisplay(value.toString());
      setExpression(expression.slice(0, -display.length) + value.toString());
    } catch {
      // Ignore errors
    }
  };

  const handleScientific = (func: string) => {
    try {
      let result: number;
      const currentValue = math.evaluate(display);
      
      switch (func) {
        case 'sin':
          result = math.sin(currentValue);
          break;
        case 'cos':
          result = math.cos(currentValue);
          break;
        case 'tan':
          result = math.tan(currentValue);
          break;
        case 'log':
          result = math.log10(currentValue);
          break;
        case 'ln':
          result = math.log(currentValue);
          break;
        case 'sqrt':
          result = Number(math.sqrt(currentValue));
          break;
        case 'pow2':
          result = Number(math.pow(currentValue, 2));
          break;
        case 'pow3':
          result = Number(math.pow(currentValue, 3));
          break;
        case '1/x':
          result = 1 / currentValue;
          break;
        case 'pi':
          result = Number(math.pi);
          break;
        case 'e':
          result = Number(math.e);
          break;
        case 'factorial':
          result = Number(math.factorial(currentValue));
          break;
        default:
          return;
      }
      
      const resultStr = Number.isInteger(result) ? result.toString() : result.toFixed(10).replace(/\.?0+$/, '');
      setDisplay(resultStr);
      setExpression(resultStr);
      setIsResult(true);
    } catch {
      setDisplay('Błąd');
      setIsResult(true);
    }
  };

  const Button = ({ children, onClick, className = '', wide = false }: { 
    children: React.ReactNode; 
    onClick: () => void; 
    className?: string;
    wide?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={`${wide ? 'col-span-2' : ''} p-3 rounded-lg text-lg font-medium transition-all active:scale-95 ${className}`}
    >
      {children}
    </button>
  );

  return (
    <div 
      ref={overlayRef}
      className="absolute bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 overflow-hidden pointer-events-auto z-30"
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header - draggable */}
      <div 
        className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 cursor-move select-none"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Kalkulator</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScientific(!showScientific)}
            className={`px-2 py-1 text-xs rounded transition-colors ${showScientific ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
          >
            fx
          </button>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

        {/* Expression display */}
        <div className="px-4 pt-2 text-right text-sm text-gray-400 h-6 overflow-hidden">
          {expression || '\u00A0'}
        </div>

        {/* Main display */}
        <div className="px-4 pb-2 text-right text-4xl font-light text-gray-800 overflow-x-auto">
          {display}
        </div>

        {/* Scientific buttons */}
        {showScientific && (
          <div className="grid grid-cols-5 gap-1 px-2 pb-2">
            <Button onClick={() => handleScientific('sin')} className="bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm">sin</Button>
            <Button onClick={() => handleScientific('cos')} className="bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm">cos</Button>
            <Button onClick={() => handleScientific('tan')} className="bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm">tan</Button>
            <Button onClick={() => handleScientific('log')} className="bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm">log</Button>
            <Button onClick={() => handleScientific('ln')} className="bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm">ln</Button>
            <Button onClick={() => handleScientific('sqrt')} className="bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm">√</Button>
            <Button onClick={() => handleScientific('pow2')} className="bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm">x²</Button>
            <Button onClick={() => handleScientific('pow3')} className="bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm">x³</Button>
            <Button onClick={() => handleScientific('1/x')} className="bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm">1/x</Button>
            <Button onClick={() => handleScientific('factorial')} className="bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm">n!</Button>
            <Button onClick={() => handleScientific('pi')} className="bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm">π</Button>
            <Button onClick={() => handleScientific('e')} className="bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm">e</Button>
            <Button onClick={() => { setExpression(expression + '('); setDisplay('('); }} className="bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm">(</Button>
            <Button onClick={() => { setExpression(expression + ')'); setDisplay(')'); }} className="bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm">)</Button>
            <Button onClick={() => { setExpression(expression + '^'); setDisplay('^'); }} className="bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm">^</Button>
          </div>
        )}

        {/* Main buttons */}
        <div className="grid grid-cols-4 gap-1 p-2">
          <Button onClick={handleClear} className="bg-red-100 text-red-600 hover:bg-red-200">C</Button>
          <Button onClick={handleBackspace} className="bg-gray-100 text-gray-600 hover:bg-gray-200">
            <Delete className="w-5 h-5 mx-auto" />
          </Button>
          <Button onClick={handlePercent} className="bg-gray-100 text-gray-600 hover:bg-gray-200">%</Button>
          <Button onClick={() => handleOperator('/')} className="bg-blue-100 text-blue-600 hover:bg-blue-200">÷</Button>
          
          <Button onClick={() => handleNumber('7')} className="bg-gray-50 text-gray-800 hover:bg-gray-100">7</Button>
          <Button onClick={() => handleNumber('8')} className="bg-gray-50 text-gray-800 hover:bg-gray-100">8</Button>
          <Button onClick={() => handleNumber('9')} className="bg-gray-50 text-gray-800 hover:bg-gray-100">9</Button>
          <Button onClick={() => handleOperator('*')} className="bg-blue-100 text-blue-600 hover:bg-blue-200">×</Button>
          
          <Button onClick={() => handleNumber('4')} className="bg-gray-50 text-gray-800 hover:bg-gray-100">4</Button>
          <Button onClick={() => handleNumber('5')} className="bg-gray-50 text-gray-800 hover:bg-gray-100">5</Button>
          <Button onClick={() => handleNumber('6')} className="bg-gray-50 text-gray-800 hover:bg-gray-100">6</Button>
          <Button onClick={() => handleOperator('-')} className="bg-blue-100 text-blue-600 hover:bg-blue-200">−</Button>
          
          <Button onClick={() => handleNumber('1')} className="bg-gray-50 text-gray-800 hover:bg-gray-100">1</Button>
          <Button onClick={() => handleNumber('2')} className="bg-gray-50 text-gray-800 hover:bg-gray-100">2</Button>
          <Button onClick={() => handleNumber('3')} className="bg-gray-50 text-gray-800 hover:bg-gray-100">3</Button>
          <Button onClick={() => handleOperator('+')} className="bg-blue-100 text-blue-600 hover:bg-blue-200">+</Button>
          
          <Button onClick={() => handleNumber('0')} wide className="bg-gray-50 text-gray-800 hover:bg-gray-100">0</Button>
          <Button onClick={handleDecimal} className="bg-gray-50 text-gray-800 hover:bg-gray-100">.</Button>
          <Button onClick={handleEquals} className="bg-blue-500 text-white hover:bg-blue-600">=</Button>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="border-t border-gray-200 max-h-24 overflow-y-auto">
            <div className="px-4 py-2">
              <p className="text-xs text-gray-400 mb-1">Historia:</p>
              {history.slice(-5).map((item, i) => (
                <p key={i} className="text-xs text-gray-500">{item}</p>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
