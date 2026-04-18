/**
 * ============================================================================
 * PLIK: src/app/tablica/toolbar/MathChatbot.tsx
 * ============================================================================
 *
 * 🤖 MATH TUTOR CHATBOT - RESIZABLE SIDEBAR
 *
 * Chatbot matematyczny jako sidebar z prawej strony tablicy.
 * Pomaga uczniom z zadaniami, wyjaśnia koncepcje, daje podpowiedzi.
 *
 * ✨ FEATURES:
 * - Resizable - przeciąganie lewej krawędzi
 * - Backdrop blur - mleczny efekt
 * - Animacje wyjeżdżania
 * - Free plan notice
 * - Zapamiętuje szerokość w localStorage
 * ============================================================================
 */

'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Send,
  BookOpen,
  Lightbulb,
  Calculator,
  Loader2,
  Trash2,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Minimize,
  Sparkles,
  GraduationCap,
  PlusCircle,
  Crown,
  GripVertical,
  Minimize2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Link from 'next/link';

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
  boardContext?: string;
  onAddToBoard?: (content: string) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onActiveChange?: (isActive: boolean) => void;
  userRole?: 'owner' | 'editor' | 'viewer'; // 🆕 Rola użytkownika
}

// ==========================================
// 🧩 MEMOIZED MESSAGE COMPONENT
// ==========================================

interface ChatMessageViewProps {
  msg: ChatMessage;
  onAddToBoard?: (content: string) => void;
  userRole?: 'owner' | 'editor' | 'viewer'; // 🆕 Rola użytkownika
}

const ChatMessageView = memo(
  function ChatMessageView({ msg, onAddToBoard, userRole }: ChatMessageViewProps) {
    if (msg.role === 'user') {
      return (
        <div className="flex justify-end">
          <div className="max-w-[90%] rounded-2xl px-4 py-2.5 bg-gray-700 text-white rounded-br-md shadow-lg">
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] rounded-2xl px-4 py-2.5 bg-gray-100 text-gray-800 rounded-bl-md shadow-lg">
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {msg.content}
            </ReactMarkdown>
          </div>
          {onAddToBoard &&
            msg.id !== 'welcome' &&
            msg.id !== 'welcome-new' &&
            userRole !== 'viewer' && (
              <button
                onClick={() => onAddToBoard(msg.content)}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-all active:scale-95 shadow-md cursor-pointer"
                title="Dodaj tę odpowiedź jako notatkę na tablicy"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Dodaj do tablicy
              </button>
            )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.msg.id === nextProps.msg.id && prevProps.msg.content === nextProps.msg.content;
  }
);

// ==========================================
// 🎨 QUICK PROMPTS
// ==========================================
const QUICK_PROMPTS = [
  { icon: Lightbulb, text: 'Podpowiedź', prompt: 'Potrzebuję podpowiedzi do zadania: ' },
  { icon: Calculator, text: 'Sprawdź', prompt: 'Sprawdź moje rozwiązanie: ' },
  { icon: BookOpen, text: 'Wyjaśnij', prompt: 'Wyjaśnij mi ' },
];

// LocalStorage key
const CHATBOT_WIDTH_KEY = 'mathChatbotWidth';

// ==========================================
// 🤖 GŁÓWNY KOMPONENT - RESIZABLE SIDEBAR
// ==========================================
function MathChatbotInner({
  canvasWidth,
  canvasHeight,
  boardContext,
  onAddToBoard,
  messages,
  setMessages,
  onActiveChange,
  userRole,
}: MathChatbotProps) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // 🆕 Domyślnie zwinięty - pokazuje bąbelek
  const [isExiting, setIsExiting] = useState(false);
  const [width, setWidth] = useState(() => {
    // Załaduj z localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(CHATBOT_WIDTH_KEY);
      return saved ? parseInt(saved, 10) : 420;
    }
    return 420;
  });
  const [isResizing, setIsResizing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Zapisz szerokość do localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CHATBOT_WIDTH_KEY, width.toString());
    }
  }, [width]);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Resize handling
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      setIsResizing(true);
      resizeStartX.current = e.clientX;
      resizeStartWidth.current = width;
      e.preventDefault();
    },
    [width]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = resizeStartX.current - e.clientX;
      const newWidth = Math.max(300, Math.min(800, resizeStartWidth.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Send message
  const sendMessage = useCallback(
    async (customMessage?: string) => {
      const messageText = customMessage || input.trim();
      if (!messageText || isLoading) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: messageText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messageText,
            context: boardContext,
          }),
        });

        const data = await response.json();

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.ok
            ? data.response
            : data.response || 'Przepraszam, wystąpił błąd. Spróbuj ponownie! 😅',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        console.error('Chat error:', error);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Nie mogę się połączyć. Sprawdź internet! 🔌',
            timestamp: new Date(),
          },
        ]);
      }

      setIsLoading(false);
    },
    [input, isLoading, boardContext, setMessages]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const clearChat = useCallback(() => {
    setMessages([
      {
        id: 'welcome-new',
        role: 'assistant',
        content: 'Nowa rozmowa! Jak mogę Ci pomóc? 🚀',
        timestamp: new Date(),
      },
    ]);
  }, [setMessages]);

  const handleQuickPrompt = useCallback((prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  }, []);

  // Handler do przekierowania na stronę główną + scroll
  const handlePricingClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      router.push('/#pricing');
      // Czekamy na załadowanie strony i scrollujemy
      setTimeout(() => {
        const element = document.getElementById('pricing');
        element?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    },
    [router]
  );

  // Funkcja zwijania z animacją
  const handleCollapse = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsCollapsed(true);
      setIsExiting(false);
    }, 400); // czas animacji
  }, []);

  // Obsługa scrolla myszką w chatbocie
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
  }, []);

  // Notyfikuj parent o stanie aktywności (blokowanie tablicy)
  useEffect(() => {
    if (!isCollapsed) {
      onActiveChange?.(true);
      return () => onActiveChange?.(false);
    }
  }, [isCollapsed, onActiveChange]);

  // Obsługa kliknięcia poza chatbotem - zwija chatbot
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Środkowy przycisk (button === 1) - ignoruj
      if (e.button === 1) return;

      // Lewy (button === 0) lub prawy (button === 2) - zwiń
      if (!isCollapsed && overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        handleCollapse();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCollapsed, handleCollapse]);

  // Oblicz wysokość z marginesami
  const chatbotHeight = typeof window !== 'undefined' ? window.innerHeight - 5 : canvasHeight - 5;

  // Collapsed state - latająca chmurka
  if (isCollapsed && !isExiting) {
    return (
      <div
        className="fixed z-50 pointer-events-auto"
        style={{
          right: '20px',
          bottom: '20px',
          animation: 'slideInFromBottom 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <button
  onClick={() => setIsCollapsed(false)}
  className="cursor-pointer font-semibold hover-shine flex items-center justify-center gap-2 h-10 px-4 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition-all duration-300 ease-in-out shadow-md group"
  title="Powrót do rozmowy"
>
  <svg 
    viewBox="0 0 512 512" 
    xmlns="http://www.w3.org/2000/svg" 
    className="w-4 h-4 text-gray-600 transition-colors group-hover:text-blue-500"
    fill="currentColor"
  >
    <path d="M256 25.063c-61.584 61.583-76.97 107.77-76.97 138.562 0 30.792 46.18 46.188 76.97 46.188 30.792 0 76.97-15.396 76.97-46.188S317.583 86.647 256 25.062zM132.72 204.125c-9.21-.108-20.947 1.46-36.72 5.688 11.27 42.062 24.604 49.77 37.938 57.468C147.27 274.98 168.3 269.335 176 256c7.698-13.333 2.053-34.365-11.28-42.063-8.334-4.81-16.654-9.632-32-9.812zm246.56 0c-15.346.18-23.666 5-32 9.813-13.332 7.697-18.978 28.73-11.28 42.062 7.698 13.333 28.73 18.98 42.063 11.28 13.333-7.697 26.667-15.405 37.937-57.467-15.774-4.227-27.51-5.796-36.72-5.688zM256 240.595c-34.01 0-61.594 27.58-61.594 61.593 0 34.01 27.583 61.593 61.594 61.593 34.01 0 61.594-27.58 61.594-61.592S290.01 240.594 256 240.594zm-144.03 60.218c-5.005.098-9.887 1.353-14.47 4C70.833 320.21 38.542 356.625 16 440.75c84.125 22.54 131.833 12.77 158.5-2.625 26.667-15.396 16.896-63.083 1.5-89.75-12.75-22.084-39.923-48.04-64.03-47.563zm286.686 0c-23.76.5-50.147 25.895-62.656 47.562-15.396 26.667-25.167 74.354 1.5 89.75s74.375 25.166 158.5 2.625c-22.54-84.126-54.833-120.54-81.5-135.938-5-2.886-10.36-4.115-15.844-4zM256 394.563c-15.396 0-30.78 15.385-30.78 30.78 0 15.397-.012 30.803 30.78 61.594 30.792-30.792 30.78-46.198 30.78-61.593 0-15.396-15.384-30.78-30.78-30.78z" />
  </svg>
  <span className="text-[13px]">Tutor AI</span>
</button>
      </div>
    );
  }

  // Full sidebar
  return (
    <>
      {/* Bąbelek podczas collapse - wyjeżdża od dołu równocześnie z zwijaniem */}
      {isExiting && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            right: '20px',
            bottom: '20px',
            animation: 'slideInFromBottom 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <button
  onClick={() => setIsCollapsed(false)}
  className="cursor-pointer font-semibold hover-shine flex items-center justify-center gap-2 h-10 px-4 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition-all duration-300 ease-in-out shadow-md group"
  title="Powrót do rozmowy"
>
  <svg 
    viewBox="0 0 512 512" 
    xmlns="http://www.w3.org/2000/svg" 
    className="w-4 h-4 text-gray-600 transition-colors group-hover:text-blue-500"
    fill="currentColor"
  >
    <path d="M256 25.063c-61.584 61.583-76.97 107.77-76.97 138.562 0 30.792 46.18 46.188 76.97 46.188 30.792 0 76.97-15.396 76.97-46.188S317.583 86.647 256 25.062zM132.72 204.125c-9.21-.108-20.947 1.46-36.72 5.688 11.27 42.062 24.604 49.77 37.938 57.468C147.27 274.98 168.3 269.335 176 256c7.698-13.333 2.053-34.365-11.28-42.063-8.334-4.81-16.654-9.632-32-9.812zm246.56 0c-15.346.18-23.666 5-32 9.813-13.332 7.697-18.978 28.73-11.28 42.062 7.698 13.333 28.73 18.98 42.063 11.28 13.333-7.697 26.667-15.405 37.937-57.467-15.774-4.227-27.51-5.796-36.72-5.688zM256 240.595c-34.01 0-61.594 27.58-61.594 61.593 0 34.01 27.583 61.593 61.594 61.593 34.01 0 61.594-27.58 61.594-61.592S290.01 240.594 256 240.594zm-144.03 60.218c-5.005.098-9.887 1.353-14.47 4C70.833 320.21 38.542 356.625 16 440.75c84.125 22.54 131.833 12.77 158.5-2.625 26.667-15.396 16.896-63.083 1.5-89.75-12.75-22.084-39.923-48.04-64.03-47.563zm286.686 0c-23.76.5-50.147 25.895-62.656 47.562-15.396 26.667-25.167 74.354 1.5 89.75s74.375 25.166 158.5 2.625c-22.54-84.126-54.833-120.54-81.5-135.938-5-2.886-10.36-4.115-15.844-4zM256 394.563c-15.396 0-30.78 15.385-30.78 30.78 0 15.397-.012 30.803 30.78 61.594 30.792-30.792 30.78-46.198 30.78-61.593 0-15.396-15.384-30.78-30.78-30.78z" />
  </svg>
  <span className="text-[13px]">Tutor AI</span>
</button>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes slideInFromRight {
          0% {
            transform: translate(100%, 100%) scale(0.95);
            opacity: 0;
          }
          100% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
        }
        @keyframes slideOutToRight {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(100%, 100%) scale(0.95);
            opacity: 0;
          }
        }
        @keyframes slideInFromBottom {
          0% {
            transform: translateY(100px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>

      <div
        ref={overlayRef}
        className="fixed flex flex-col z-60 pointer-events-auto"
        style={{
          width: `${width}px`,
          height: `${chatbotHeight}px`,
          bottom: '10px',
          right: '10px',
          paddingTop: '120px',
          animation: isExiting
            ? 'slideOutToRight 1s cubic-bezier(0.32, 0.72, 0, 1) forwards'
            : 'slideInFromRight 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Resize Handle */}
        <div
          onMouseDown={handleResizeStart}
          className={`absolute left-0 top-[120px] bottom-0 w-2 cursor-ew-resize group z-50 hover:bg-blue-500/20 transition-colors ${
            isResizing ? 'bg-blue-500/30' : ''
          }`}
          style={{
            bottom: '10px',
            right: '10px',

            paddingTop: '120px',
          }}
        >
          {/* Visual indicator */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-4 h-4 text-blue-500" />
          </div>
        </div>

        {/* Main Container - mleczne tło z blur */}
        <div className="flex-1 flex flex-col bg-white/80 backdrop-blur-xl border border-gray-200/50 shadow-2xl rounded-2xl overflow-hidden">
          {/* 📌 HEADER - bez gradientu */}
          <div className="bg-white/80 backdrop-blur-sm px-5 py-4 flex items-center justify-between shadow-md border-b border-gray-200/50">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center shadow-sm">
                <GraduationCap className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-gray-900 font-bold flex items-center gap-1.5 text-lg">
                  Math Tutor
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                </h3>
                <p className="text-gray-500 text-xs">Asystent AI</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="p-2 hover:bg-gray-200/50 rounded-lg transition-colors cursor-pointer"
                title="Wyczyść czat"
              >
                <Trash2 className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={handleCollapse}
                className="p-2 hover:bg-gray-200/50 rounded-lg transition-colors cursor-pointer"
                title="Zwiń"
              >
                <Minimize2 className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* 💬 MESSAGES */}
          <div
            className="flex-1 overflow-y-auto p-5 space-y-10 bg-gray-50/30 backdrop-blur-sm"
            onWheel={handleWheel}
          >
            {messages.map((msg) => (
              <ChatMessageView
                key={msg.id}
                msg={msg}
                onAddToBoard={onAddToBoard}
                userRole={userRole}
              />
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-lg">
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
          <div className="px-4 py-3 bg-white/60 backdrop-blur-sm border-t border-gray-200/50 flex gap-2">
            {QUICK_PROMPTS.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickPrompt(item.prompt)}
                className="bg-gray-800 text-white flex-1 flex items-center justify-center gap-1.5 px-3 py-2  hover:bg-gray-700 rounded-xl text-xs text-white-700 transition-all shadow-sm hover:shadow-md cursor-pointer"
                disabled={isLoading}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.text}
              </button>
            ))}
          </div>

          {/* 👑 FREE PLAN NOTICE */}
          <div className="px-4 py-3 bg-amber-50/80 backdrop-blur-sm border-t border-amber-200/50">
            <div className="flex items-center gap-2 text-xs">
              <Crown className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-amber-900 flex-1">
                Jesteś na planie <span className="font-semibold">Free</span>.{' '}
                <button
                  onClick={handlePricingClick}
                  className="underline hover:text-amber-950 font-medium cursor-pointer bg-transparent border-none p-0"
                >
                  Wykup Premium
                </button>{' '}
                po większe limity AI Tutora
              </p>
            </div>
          </div>

          {/* 📝 INPUT */}
          <div className="p-4 bg-white/20 backdrop-blur-sm border-t border-gray-200/50">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Zadaj pytanie..."
                className="flex-1 resize-none border-2 border-gray-300/50 bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-transparent shadow-sm transition-all"
                rows={2}
                disabled={isLoading}
                maxLength={1000}
              />
              <button
                onClick={() => sendMessage()}
                disabled={isLoading || !input.trim()}
                className={`px-6 rounded-xl transition-all shadow-md cursor-pointer ${
                  isLoading || !input.trim()
                    ? 'bg-gray-300 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white active:scale-95 hover:shadow-lg'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Shift+Enter → nowa linia • Enter → wyślij
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ==========================================
// 🎯 MEMOIZOWANY EXPORT
// ==========================================
export const MathChatbot = memo(MathChatbotInner, (prevProps, nextProps) => {
  return (
    prevProps.messages === nextProps.messages &&
    prevProps.canvasWidth === nextProps.canvasWidth &&
    prevProps.canvasHeight === nextProps.canvasHeight &&
    prevProps.userRole === nextProps.userRole
  );
});

export default MathChatbot;
