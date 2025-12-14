/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/MathChatbot.tsx
 * ============================================================================
 * 
 * 🤖 MATH TUTOR CHATBOT - SIDEBAR
 * 
 * Chatbot matematyczny jako sidebar z prawej strony tablicy.
 * Pomaga uczniom z zadaniami, wyjaśnia koncepcje, daje podpowiedzi.
 * Zawsze aktywny - nie blokuje rysowania na tablicy.
 * ============================================================================
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Send, 
  BookOpen, 
  Lightbulb,
  Calculator,
  Loader2,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  GraduationCap,
  PlusCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// ==========================================
// 📝 TYPY
// ==========================================
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface MathChatbotProps {
  canvasWidth: number;
  canvasHeight: number;
  onClose: () => void;
  boardContext?: string;
  onAddToBoard?: (content: string) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

// ==========================================
// 🎨 QUICK PROMPTS
// ==========================================
const QUICK_PROMPTS = [
  { icon: Lightbulb, text: "Podpowiedź", prompt: "Potrzebuję podpowiedzi do zadania: " },
  { icon: Calculator, text: "Sprawdź", prompt: "Sprawdź moje rozwiązanie: " },
  { icon: BookOpen, text: "Wyjaśnij", prompt: "Wyjaśnij mi " },
];

// ==========================================
// 🤖 GŁÓWNY KOMPONENT - SIDEBAR
// ==========================================
export function MathChatbot({
  canvasWidth,
  canvasHeight,
  onClose,
  boardContext,
  onAddToBoard,
  messages,
  setMessages,
}: MathChatbotProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Send message
  const sendMessage = async (customMessage?: string) => {
    const messageText = customMessage || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: messageText,
          context: boardContext 
        })
      });

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.ok 
          ? data.response 
          : (data.response || 'Przepraszam, wystąpił błąd. Spróbuj ponownie! 😅'),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Nie mogę się połączyć. Sprawdź internet! 🔌',
        timestamp: new Date(),
      }]);
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome-new',
      role: 'assistant',
      content: 'Nowa rozmowa! Jak mogę Ci pomóc? 🚀',
      timestamp: new Date(),
    }]);
  };

  // Collapsed state - mini przycisk z boku
  if (isCollapsed) {
    return (
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50 pointer-events-auto">
        <button
          onClick={() => setIsCollapsed(false)}
          className="bg-gradient-to-b from-blue-600 to-purple-600 text-white p-3 rounded-l-xl shadow-lg hover:from-blue-700 hover:to-purple-700 transition-all group"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Otwórz Math Tutor
          </span>
        </button>
      </div>
    );
  }

  // Full sidebar
  return (
    <div 
      className="fixed right-0 top-0 h-full w-[380px] bg-white shadow-2xl border-l border-gray-200 flex flex-col z-40 pointer-events-auto"
      style={{
        animation: 'slideInFromRight 0.3s ease-out'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* CSS Animation */}
      <style jsx>{`
        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* 📌 HEADER */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold flex items-center gap-1">
              Math Tutor
              <Sparkles className="w-4 h-4 text-yellow-300" />
            </h3>
            <p className="text-white/70 text-xs">Asystent AI</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Wyczyść czat"
          >
            <Trash2 className="w-4 h-4 text-white/80" />
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Zwiń"
          >
            <ChevronRight className="w-4 h-4 text-white/80" />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Zamknij"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* 💬 MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-md'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div>
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  {/* 🆕 Przycisk "Dodaj do tablicy" */}
                  {onAddToBoard && msg.id !== 'welcome' && msg.id !== 'welcome-new' && (
                    <button
                      onClick={() => onAddToBoard(msg.content)}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xs font-medium rounded-lg transition-all active:scale-95 shadow-sm"
                      title="Dodaj tę odpowiedź jako notatkę na tablicy"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Dodaj do tablicy
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm text-gray-500">Myślę...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 🚀 QUICK PROMPTS */}
      <div className="px-3 py-2 bg-white border-t border-gray-100 flex gap-2">
        {QUICK_PROMPTS.map((item, idx) => (
          <button
            key={idx}
            onClick={() => {
              setInput(item.prompt);
              inputRef.current?.focus();
            }}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-700 transition-colors"
            disabled={isLoading}
          >
            <item.icon className="w-3 h-3" />
            {item.text}
          </button>
        ))}
      </div>

      {/* 📝 INPUT */}
      <div className="p-3 bg-white border-t border-gray-200">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Zadaj pytanie..."
            className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            disabled={isLoading}
            maxLength={1000}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            className={`px-4 rounded-xl transition-all ${
              isLoading || !input.trim()
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white active:scale-95'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          Shift+Enter → nowa linia • Enter → wyślij
        </p>
      </div>
    </div>
  );
}

export default MathChatbot;
